import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import {
  registerPhoneNumber,
  subscribeWabaToApp,
  verifyPhoneNumber,
} from '@/lib/whatsapp/meta-api'
import {
  verifyUazapiInstance,
  configureUazapiWebhook,
  normalizeUazapiBaseUrl,
  getPublicAppOrigin,
} from '@/lib/whatsapp/uazapi'
import { encrypt, decrypt } from '@/lib/whatsapp/encryption'
import { ensureAccountForUser } from '@/lib/auth/ensure-account'

/**
 * Resolve the caller's account_id from their profile with self-healing fallback.
 */
async function resolveAccountId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null },
): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!error && data?.account_id) return data.account_id as string

  // Self-healing fallback: guarantee an account/profile exists for the user
  try {
    const healed = await ensureAccountForUser(user)
    if (healed?.accountId) return healed.accountId
  } catch (err) {
    console.error('[resolveAccountId] Failed to self-heal account:', err)
  }

  return null
}

// Lazy-initialised service-role client. We need it to detect a
// phone_number_id already claimed by a *different* user — under RLS,
// the user's own session can't see other users' rows, so the conflict
// would be invisible without the service role.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

/**
 * GET /api/whatsapp/config
 *
 * Used by the "Test API Connection" button and by the page to check
 * whether the saved config is healthy. Returns 200 in all non-auth cases
 * so the UI can render an appropriate message rather than show a 500.
 *
 * Response shape:
 *   { connected: true,  phone_info: {...} }
 *   { connected: false, reason: 'no_config',        message: '...' }
 *   { connected: false, reason: 'token_corrupted',  message: '...', needs_reset: true }
 *   { connected: false, reason: 'meta_api_error',   message: '...' }
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountId = await resolveAccountId(supabase, user)
    if (!accountId) {
      return NextResponse.json(
        {
          connected: false,
          reason: 'no_account',
          message: 'Your profile is not linked to an account.',
        },
        { status: 200 },
      )
    }

    const url = new URL(request.url)
    const requestedId = url.searchParams.get('id')

    const { data: configs, error: configError } = await supabase
      .from('whatsapp_config')
      .select('id, name, is_default, color, provider, api_url, instance_name, phone_number_id, waba_id, status, connected_at, registered_at, subscribed_apps_at, last_registration_error, access_token, created_at')
      .eq('account_id', accountId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })

    if (configError) {
      console.error('Error fetching whatsapp_config:', configError)
      return NextResponse.json(
        { connected: false, reason: 'db_error', message: 'Failed to fetch configuration', configs: [] },
        { status: 200 }
      )
    }

    if (!configs || configs.length === 0) {
      // Check if global platform WhatsApp connection exists and has fallback enabled
      const { data: globalRow } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'global_whatsapp_config')
        .maybeSingle()

      const globalVal = (globalRow?.value as Record<string, unknown>) || {}
      if (globalVal.phone_number_id && globalVal.encrypted_access_token && globalVal.allow_tenant_fallback) {
        return NextResponse.json(
          {
            connected: true,
            using_global: true,
            provider: (globalVal.provider as string) || 'meta',
            phone_number_id: globalVal.phone_number_id,
            phone_info: globalVal.phone_info || null,
            configs: [],
            message: 'Esta organização está utilizando a Conexão WhatsApp Global da plataforma.',
          },
          { status: 200 },
        )
      }

      return NextResponse.json(
        {
          connected: false,
          reason: 'no_config',
          message: 'No WhatsApp configuration saved yet. Fill in the form and click Save Configuration.',
          configs: [],
        },
        { status: 200 }
      )
    }

    const sanitizedConfigs = configs.map((c) => ({
      id: c.id,
      name: c.name || 'WhatsApp',
      is_default: Boolean(c.is_default),
      color: c.color || '#25D366',
      provider: c.provider,
      api_url: c.api_url,
      instance_name: c.instance_name,
      phone_number_id: c.phone_number_id,
      waba_id: c.waba_id,
      status: c.status,
      connected_at: c.connected_at,
      registered_at: c.registered_at,
      subscribed_apps_at: c.subscribed_apps_at,
      last_registration_error: c.last_registration_error,
      created_at: c.created_at,
    }))

    const activeConfig = (requestedId ? configs.find((c) => c.id === requestedId) : null) || configs[0]

    let accessToken: string
    try {
      accessToken = decrypt(activeConfig.access_token)
    } catch (err) {
      console.error('[whatsapp/config GET] Token decryption failed:', err)
      return NextResponse.json(
        {
          connected: false,
          reason: 'token_corrupted',
          needs_reset: true,
          activeConfig: sanitizedConfigs.find((c) => c.id === activeConfig.id),
          configs: sanitizedConfigs,
          message:
            'The stored access token cannot be decrypted with the current ENCRYPTION_KEY. Click "Reset Configuration" below, then re-save.',
        },
        { status: 200 }
      )
    }

    if (activeConfig.provider === 'uazapi' && activeConfig.api_url) {
      try {
        const phoneInfo = await verifyUazapiInstance({
          apiUrl: activeConfig.api_url as string,
          instanceToken: accessToken,
          instanceName: (activeConfig.instance_name as string) || null,
          fallbackPhoneId: activeConfig.phone_number_id,
        })
        return NextResponse.json({
          connected: true,
          provider: 'uazapi',
          api_url: activeConfig.api_url,
          instance_name: activeConfig.instance_name,
          phone_info: phoneInfo,
          activeConfig: sanitizedConfigs.find((c) => c.id === activeConfig.id),
          configs: sanitizedConfigs,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown Uazapi error'
        console.error('[whatsapp/config GET] Uazapi verification failed:', message)
        return NextResponse.json(
          {
            connected: false,
            provider: 'uazapi',
            reason: 'meta_api_error',
            message: `Uazapi API error: ${message}`,
            activeConfig: sanitizedConfigs.find((c) => c.id === activeConfig.id),
            configs: sanitizedConfigs,
          },
          { status: 200 }
        )
      }
    }

    // Validate credentials against Meta
    try {
      const phoneInfo = await verifyPhoneNumber({
        phoneNumberId: activeConfig.phone_number_id,
        accessToken,
      })
      return NextResponse.json({
        connected: true,
        provider: 'meta',
        phone_info: phoneInfo,
        activeConfig: sanitizedConfigs.find((c) => c.id === activeConfig.id),
        configs: sanitizedConfigs,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      console.error('[whatsapp/config GET] Meta API verification failed:', message)
      return NextResponse.json(
        {
          connected: false,
          reason: 'meta_api_error',
          message: `Meta API rejected the credentials: ${message}`,
          activeConfig: sanitizedConfigs.find((c) => c.id === activeConfig.id),
          configs: sanitizedConfigs,
        },
        { status: 200 }
      )
    }
  } catch (error) {
    console.error('Error in WhatsApp config GET:', error)
    return NextResponse.json(
      { connected: false, reason: 'unknown', message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/whatsapp/config
 *
 * Saves or updates the WhatsApp config for the authenticated user.
 * Verifies credentials with Meta first, then encrypts and stores.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountId = await resolveAccountId(supabase, user)
    if (!accountId) {
      return NextResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 },
      )
    }

    const body = await request.json()
    const {
      id: instanceId,
      name: instanceNameInput,
      is_default: isDefaultInput,
      color: instanceColorInput,
      provider: rawProvider,
      api_url,
      instance_name,
      phone_number_id: rawPhoneNumberId,
      waba_id,
      access_token,
      verify_token,
      pin,
    } = body

    const targetInstanceId = instanceId ? String(instanceId).trim() : null
    let existingConfig: { id: string; access_token?: string } | null = null
    if (targetInstanceId) {
      const { data } = await supabaseAdmin()
        .from('whatsapp_config')
        .select('id, access_token')
        .eq('id', targetInstanceId)
        .eq('account_id', accountId)
        .maybeSingle()
      existingConfig = data
    }

    const { count: existingCount } = await supabaseAdmin()
      .from('whatsapp_config')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)

    const willBeDefault = (existingCount === 0 || existingCount === null) || (isDefaultInput === true)
    if (willBeDefault) {
      await supabaseAdmin()
        .from('whatsapp_config')
        .update({ is_default: false })
        .eq('account_id', accountId)
    }

    const provider = rawProvider === 'uazapi' ? 'uazapi' : 'meta'

    if (provider === 'uazapi') {
      let resolvedToken = (access_token && String(access_token).trim()) || ''

      if (!resolvedToken || resolvedToken === '••••••••••••••••') {
        if (existingConfig?.access_token) {
          try {
            resolvedToken = decrypt(existingConfig.access_token)
          } catch {
            // failed decrypt
          }
        }
      }

      if (!resolvedToken || !api_url) {
        return NextResponse.json(
          { error: 'URL da API Uazapi e Token da Instância são obrigatórios.' },
          { status: 400 }
        )
      }

      let normalizedApiUrl: string
      try {
        normalizedApiUrl = normalizeUazapiBaseUrl(String(api_url))
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'URL da API Uazapi inválida' },
          { status: 400 }
        )
      }

      let phoneInfo
      try {
        phoneInfo = await verifyUazapiInstance({
          apiUrl: normalizedApiUrl,
          instanceToken: resolvedToken,
          instanceName: instance_name ? String(instance_name).trim() : null,
          fallbackPhoneId: rawPhoneNumberId ? String(rawPhoneNumberId).trim() : null,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Falha na conexão com Uazapi'
        return NextResponse.json({ error: message }, { status: 400 })
      }

      const resolvedPhoneNumberId =
        (rawPhoneNumberId && String(rawPhoneNumberId).trim()) ||
        phoneInfo.id ||
        (instance_name && String(instance_name).trim()) ||
        `uazapi_${accountId.slice(0, 8)}`

      const { data: claimed } = await supabaseAdmin()
        .from('whatsapp_config')
        .select('account_id')
        .eq('phone_number_id', resolvedPhoneNumberId)
        .neq('account_id', accountId)
        .maybeSingle()

      if (claimed) {
        return NextResponse.json(
          {
            error:
              'Esta instância/número Uazapi já está vinculado a outra conta nesta plataforma.',
          },
          { status: 409 }
        )
      }

      const tokenToVerifyWebhook =
        (typeof verify_token === 'string' && verify_token.trim()) ||
        resolvedToken

      const encryptedAccessToken = encrypt(resolvedToken)
      const encryptedVerifyToken = encrypt(tokenToVerifyWebhook)

      // Auto-configure webhook on the Uazapi instance (best-effort)
      const appOrigin = getPublicAppOrigin(request)
      const webhookUrl = `${appOrigin}/api/whatsapp/webhook?token=${encodeURIComponent(tokenToVerifyWebhook)}`
      await configureUazapiWebhook({
        apiUrl: normalizedApiUrl,
        instanceToken: resolvedToken,
        instanceName: instance_name ? String(instance_name).trim() : null,
        webhookUrl,
      })

      const nowIso = new Date().toISOString()
      const uazRow = {
        name: (instanceNameInput && String(instanceNameInput).trim()) || (instance_name ? String(instance_name).trim() : (phoneInfo.instance_name || 'WhatsApp Uazapi')),
        is_default: willBeDefault,
        color: (instanceColorInput && String(instanceColorInput).trim()) || '#25D366',
        provider: 'uazapi' as const,
        api_url: normalizedApiUrl,
        instance_name: instance_name ? String(instance_name).trim() : (phoneInfo.instance_name || null),
        phone_number_id: resolvedPhoneNumberId,
        waba_id: waba_id ? String(waba_id).trim() : 'uazapi',
        access_token: encryptedAccessToken,
        verify_token: encryptedVerifyToken,
        status: 'connected' as const,
        connected_at: nowIso,
        registered_at: nowIso,
        subscribed_apps_at: nowIso,
        last_registration_error: null,
        updated_at: nowIso,
      }

      if (existingConfig) {
        const { error: updErr } = await supabase
          .from('whatsapp_config')
          .update(uazRow)
          .eq('id', existingConfig.id)
          .eq('account_id', accountId)
        if (updErr) {
          console.error('Error updating Uazapi whatsapp_config:', updErr)
          return NextResponse.json({ error: 'Failed to update Uazapi configuration' }, { status: 500 })
        }
      } else {
        const { error: insErr } = await supabase
          .from('whatsapp_config')
          .insert({
            account_id: accountId,
            user_id: user.id,
            ...uazRow,
          })
        if (insErr) {
          console.error('Error inserting Uazapi whatsapp_config:', insErr)
          return NextResponse.json({ error: 'Failed to save Uazapi configuration' }, { status: 500 })
        }
      }

      return NextResponse.json({
        success: true,
        saved: true,
        provider: 'uazapi',
        registered: true,
        registration_skipped: false,
        phone_info: phoneInfo,
      })
    }

    const phone_number_id = rawPhoneNumberId
    let resolvedMetaToken = (access_token && String(access_token).trim()) || ''

    if (!resolvedMetaToken || resolvedMetaToken === '••••••••••••••••') {
      if (existingConfig?.access_token) {
        try {
          resolvedMetaToken = decrypt(existingConfig.access_token)
        } catch {
          // decrypt error
        }
      }
    }

    if (!resolvedMetaToken || !phone_number_id) {
      return NextResponse.json(
        { error: 'access_token and phone_number_id are required' },
        { status: 400 }
      )
    }

    if (pin !== undefined && pin !== null && pin !== '') {
      if (typeof pin !== 'string' || !/^\d{6}$/.test(pin)) {
        return NextResponse.json(
          { error: 'PIN must be exactly 6 digits.' },
          { status: 400 }
        )
      }
    }

    // Reject if another account has already claimed this phone_number_id.
    // wacrm is single-tenant-per-WhatsApp-number — letting two accounts
    // bind the same number causes the webhook's `.single()` lookup to
    // throw PGRST116 ("multiple rows"), silently dropping every
    // inbound message. See issue #136. Post-multi-user we key on
    // account_id (not user_id) since teammates inside the same account
    // all share one config; the conflict is between accounts.
    const { data: claimed, error: claimedError } = await supabaseAdmin()
      .from('whatsapp_config')
      .select('account_id')
      .eq('phone_number_id', phone_number_id)
      .neq('account_id', accountId)
      .maybeSingle()

    if (claimedError) {
      console.error('Error checking phone_number_id ownership:', claimedError)
      return NextResponse.json(
        { error: 'Failed to validate configuration' },
        { status: 500 }
      )
    }

    if (claimed) {
      return NextResponse.json(
        {
          error:
            'This WhatsApp phone number is already linked to another account on this instance. Each phone number can only be connected to one wacrm user.',
        },
        { status: 409 }
      )
    }

    // Verify credentials with Meta BEFORE saving
    let phoneInfo
    try {
      phoneInfo = await verifyPhoneNumber({
        phoneNumberId: phone_number_id,
        accessToken: resolvedMetaToken,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      console.error('Meta API verification failed during save:', message)
      return NextResponse.json(
        { error: `Meta API error: ${message}` },
        { status: 400 }
      )
    }

    // Encrypt sensitive tokens before storing
    let encryptedAccessToken: string
    let encryptedVerifyToken: string | null
    try {
      encryptedAccessToken = encrypt(resolvedMetaToken)
      encryptedVerifyToken = verify_token ? encrypt(verify_token) : null
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown encryption error'
      console.error('Encryption failed:', message)
      return NextResponse.json(
        {
          error:
            'Failed to encrypt token. Check that ENCRYPTION_KEY is a valid 64-character hex string in your environment variables.',
        },
        { status: 500 }
      )
    }

    // Look up any pre-existing row for this account so we know whether
    // this number is already registered with Meta — if so we can skip
    // /register when the user didn't provide a PIN this time around.
    const { data: existing } = await supabase
      .from('whatsapp_config')
      .select('id, registered_at, phone_number_id')
      .eq('account_id', accountId)
      .maybeSingle()

    const sameNumber =
      existing?.phone_number_id === phone_number_id &&
      existing?.registered_at != null

    // Step 1: register the phone number for inbound webhooks.
    //
    // Attempted on first save AND whenever the user supplies a fresh
    // PIN (e.g. they rotated the 2FA PIN in Meta Manager). Skipped
    // when the same number is already registered and no PIN was
    // supplied — re-registering an already-active number with a
    // stale PIN would actually fail and undo the active subscription.
    let registeredAt: string | null = existing?.registered_at ?? null
    let registrationError: string | null = null
    // True when registration was deliberately skipped because no PIN
    // was supplied (see below). Distinct from registrationError — this
    // is not a failure, just an incomplete-but-valid save.
    let registrationSkipped = false

    const needsRegistration = !sameNumber || (typeof pin === 'string' && pin.length > 0)
    if (needsRegistration) {
      if (!pin) {
        // No PIN provided. Meta TEST numbers (Developer Console) are
        // pre-registered by Meta and expose no two-step verification
        // PIN to set, so requiring one made them impossible to connect
        // (issue #242). The /register + PIN step only matters for
        // production numbers under a shared WABA (issue #136), so treat
        // it as best-effort: skip it, save the (already Meta-verified)
        // credentials as connected, and leave registered_at null. The
        // UI surfaces a separate "Not registered" banner with a path to
        // add a PIN later for users who do need inbound webhook routing.
        registrationSkipped = true
      } else {
        try {
          await registerPhoneNumber({
            phoneNumberId: phone_number_id,
            accessToken: resolvedMetaToken,
            pin,
          })
          registeredAt = new Date().toISOString()
        } catch (err) {
          registrationError =
            err instanceof Error ? err.message : 'Unknown Meta API error'
          console.error('Phone number /register failed:', registrationError)
          // We deliberately fall through and still save the row so the
          // user can retry without re-entering everything. The UI
          // surfaces `last_registration_error` so they see WHY it's
          // not actually live yet.
        }
      }
    }

    // Step 2: subscribe the WABA to this app. Idempotent on Meta's
    // side, so we call on every save and persist the timestamp.
    // Skipped only when there's no waba_id (legacy rows from before
    // we required it).
    let subscribedAppsAt: string | null = null
    if (waba_id) {
      try {
        await subscribeWabaToApp({
          wabaId: waba_id,
          accessToken: resolvedMetaToken,
        })
        subscribedAppsAt = new Date().toISOString()
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.warn('WABA subscribed_apps failed (non-fatal):', message)
        // Subscription failures are rare once the App has the right
        // permissions; we don't block save on them — the diagnostic
        // endpoint surfaces this state too.
      }
    }

    // Persist everything in one shot. If /register failed we still
    // store the credentials and the error so the UI can guide the
    // user through a retry.
    const baseRow = {
      name: (instanceNameInput && String(instanceNameInput).trim()) || (phoneInfo?.verified_name || `WhatsApp ${phone_number_id}`),
      is_default: willBeDefault,
      color: (instanceColorInput && String(instanceColorInput).trim()) || '#25D366',
      provider: 'meta' as const,
      api_url: null,
      instance_name: null,
      phone_number_id,
      waba_id: waba_id || null,
      access_token: encryptedAccessToken,
      verify_token: encryptedVerifyToken,
      status: registrationError ? 'disconnected' : 'connected',
      connected_at: registrationError ? null : new Date().toISOString(),
      registered_at: registrationError ? null : registeredAt,
      subscribed_apps_at: subscribedAppsAt ?? null,
      last_registration_error: registrationError,
      updated_at: new Date().toISOString(),
    }

    if (existingConfig) {
      const { error: updateError } = await supabase
        .from('whatsapp_config')
        .update(baseRow)
        .eq('id', existingConfig.id)
        .eq('account_id', accountId)

      if (updateError) {
        console.error('Error updating whatsapp_config:', updateError)
        return NextResponse.json(
          { error: 'Failed to update configuration' },
          { status: 500 }
        )
      }
    } else {
      // Insert with both columns: `account_id` is the tenancy key
      // `user_id` is the audit column identifying which member saved the config.
      const { error: insertError } = await supabase
        .from('whatsapp_config')
        .insert({
          account_id: accountId,
          user_id: user.id,
          ...baseRow,
        })

      if (insertError) {
        console.error('Error inserting whatsapp_config:', insertError)
        return NextResponse.json(
          { error: 'Failed to save configuration' },
          { status: 500 }
        )
      }
    }

    if (registrationError) {
      // Save succeeded but the number isn't actually live. Return
      // 200 with a structured error so the UI can show the specific
      // remediation step instead of a generic toast.
      return NextResponse.json({
        success: false,
        saved: true,
        registered: false,
        registration_error: registrationError,
        phone_info: phoneInfo,
      })
    }

    return NextResponse.json({
      success: true,
      saved: true,
      registered: registeredAt != null,
      // Credentials are valid and saved, but inbound webhook
      // registration was skipped because no PIN was supplied (e.g. a
      // Meta test number). The UI shows the "Not registered" banner
      // rather than claiming the number is fully live.
      registration_skipped: registrationSkipped,
      phone_info: phoneInfo,
    })
  } catch (error) {
    console.error('Error in WhatsApp config POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/whatsapp/config
 *
 * Update instance metadata (name, color, is_default).
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountId = await resolveAccountId(supabase, user)
    if (!accountId) {
      return NextResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { id, name, color, is_default } = body
    if (!id) {
      return NextResponse.json({ error: 'Instance id is required' }, { status: 400 })
    }

    if (is_default === true) {
      await supabaseAdmin()
        .from('whatsapp_config')
        .update({ is_default: false })
        .eq('account_id', accountId)
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (typeof name === 'string' && name.trim()) updatePayload.name = name.trim()
    if (typeof color === 'string' && color.trim()) updatePayload.color = color.trim()
    if (typeof is_default === 'boolean') updatePayload.is_default = is_default

    const { error: updErr } = await supabaseAdmin()
      .from('whatsapp_config')
      .update(updatePayload)
      .eq('id', id)
      .eq('account_id', accountId)

    if (updErr) {
      console.error('Error updating instance:', updErr)
      return NextResponse.json({ error: 'Failed to update instance' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error in PATCH /api/whatsapp/config:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/whatsapp/config
 *
 * Removes a specific instance (if ?id= is given) or all instances for the account.
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountId = await resolveAccountId(supabase, user)
    if (!accountId) {
      return NextResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 },
      )
    }

    const url = new URL(request.url)
    const targetId = url.searchParams.get('id')

    if (targetId) {
      const { data: rowToDelete } = await supabaseAdmin()
        .from('whatsapp_config')
        .select('id, is_default')
        .eq('id', targetId)
        .eq('account_id', accountId)
        .maybeSingle()

      if (!rowToDelete) {
        return NextResponse.json({ error: 'Instance not found' }, { status: 404 })
      }

      const { error: deleteError } = await supabaseAdmin()
        .from('whatsapp_config')
        .delete()
        .eq('id', targetId)
        .eq('account_id', accountId)

      if (deleteError) {
        console.error('Error deleting whatsapp_config instance:', deleteError)
        return NextResponse.json(
          { error: 'Failed to delete configuration' },
          { status: 500 }
        )
      }

      if (rowToDelete.is_default) {
        const { data: nextInstance } = await supabaseAdmin()
          .from('whatsapp_config')
          .select('id')
          .eq('account_id', accountId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (nextInstance) {
          await supabaseAdmin()
            .from('whatsapp_config')
            .update({ is_default: true })
            .eq('id', nextInstance.id)
        }
      }

      return NextResponse.json({ success: true })
    }

    const { error: deleteError } = await supabase
      .from('whatsapp_config')
      .delete()
      .eq('account_id', accountId)

    if (deleteError) {
      console.error('Error deleting whatsapp_config:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete configuration' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in WhatsApp config DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
