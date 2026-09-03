import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/whatsapp/encryption'
import { getWhatsAppHealthDetails } from '@/lib/whatsapp/meta-api'

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
      .select('phone_number_id, waba_id, access_token_encrypted, pin_encrypted, is_connected, updated_at')
      .eq('account_id', profile.account_id)
      .maybeSingle()

    if (configError || !config) {
      return NextResponse.json(
        {
          healthy: false,
          reason: 'no_config',
          message: 'WhatsApp Cloud API is not configured yet for this account.',
        },
        { status: 200 }
      )
    }

    if (!config.access_token_encrypted || !config.phone_number_id || !config.waba_id) {
      return NextResponse.json(
        {
          healthy: false,
          reason: 'incomplete_config',
          message: 'Missing phone_number_id, waba_id or access_token.',
        },
        { status: 200 }
      )
    }

    let accessToken: string
    try {
      accessToken = decrypt(config.access_token_encrypted)
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
  } catch (error: any) {
    console.error('[/api/whatsapp/health] Error:', error)
    return NextResponse.json(
      {
        healthy: false,
        reason: 'meta_api_error',
        message: error.message || 'Failed to check WhatsApp health status.',
      },
      { status: 200 }
    )
  }
}
