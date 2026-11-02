import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/whatsapp/encryption'
import { getWhatsAppHealthDetails } from '@/lib/whatsapp/meta-api'
import { verifyUazapiInstance } from '@/lib/whatsapp/uazapi'

/**
 * GET /api/whatsapp/health
 *
 * Full diagnostic health check for WhatsApp Cloud API integration.
 * Fetches phone number quality rating, limits tier, WABA details,
 * and webhook subscription status.
 */
export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve account_id from user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile?.account_id) {
      return NextResponse.json(
        { healthy: false, reason: 'no_account', message: 'No account found for user.' },
        { status: 200 }
      )
    }

    // Fetch config
    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('provider, api_url, instance_name, phone_number_id, waba_id, access_token, access_token_encrypted, pin_encrypted, status, updated_at')
      .eq('account_id', profile.account_id)
      .maybeSingle()

    if (configError || !config) {
      return NextResponse.json(
        {
          healthy: false,
          reason: 'no_config',
          message: 'WhatsApp API is not configured yet for this account.',
        },
        { status: 200 }
      )
    }

    const rawEncryptedToken = (config.access_token || config.access_token_encrypted) as string | undefined
    if (!rawEncryptedToken || !config.phone_number_id) {
      return NextResponse.json(
        {
          healthy: false,
          reason: 'incomplete_config',
          message: 'Missing phone_number_id or access_token.',
        },
        { status: 200 }
      )
    }

    let accessToken: string
    try {
      accessToken = decrypt(rawEncryptedToken)
    } catch {
      return NextResponse.json(
        {
          healthy: false,
          reason: 'token_corrupted',
          message: 'Decryption failed for stored access token.',
        },
        { status: 200 }
      )
    }

    if (config.provider === 'uazapi' && config.api_url) {
      const uazInfo = await verifyUazapiInstance({
        apiUrl: config.api_url as string,
        instanceToken: accessToken,
        instanceName: (config.instance_name as string) || null,
        fallbackPhoneId: config.phone_number_id,
      })
      const isConnected = uazInfo.quality_rating === 'GREEN'
      return NextResponse.json({
        healthy: isConnected,
        provider: 'uazapi',
        health: {
          phone: {
            id: uazInfo.id,
            display_phone_number: uazInfo.display_phone_number,
            verified_name: uazInfo.verified_name,
            quality_rating: uazInfo.quality_rating,
            status: isConnected ? 'CONNECTED' : 'DISCONNECTED',
            state: uazInfo.state,
          },
          webhook: {
            isSubscribed: true,
          },
        },
        lastUpdated: config.updated_at,
      })
    }

    if (!config.waba_id) {
      return NextResponse.json(
        {
          healthy: false,
          reason: 'incomplete_config',
          message: 'Missing waba_id for Meta Cloud API.',
        },
        { status: 200 }
      )
    }

    const health = await getWhatsAppHealthDetails({
      phoneNumberId: config.phone_number_id,
      wabaId: config.waba_id,
      accessToken,
    })

    const isHealthy =
      health.phone.status === 'CONNECTED' &&
      health.phone.quality_rating !== 'RED' &&
      health.webhook.isSubscribed

    return NextResponse.json({
      healthy: isHealthy,
      health,
      lastUpdated: config.updated_at,
    })
  } catch (error: unknown) {
    console.error('[/api/whatsapp/health] Error:', error)
    const message = error instanceof Error ? error.message : 'Failed to check WhatsApp health status.'
    return NextResponse.json(
      {
        healthy: false,
        reason: 'meta_api_error',
        message,
      },
      { status: 200 }
    )
  }
}
