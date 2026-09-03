import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'

/**
 * POST /api/whatsapp/webhook/simulate
 *
 * Allows authenticated administrators to simulate incoming WhatsApp messages,
 * button clicks, or delivery receipts to test automations, flows, and AI responses
 * without physical devices or Meta charges.
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile?.account_id) {
      return NextResponse.json({ error: 'No account found' }, { status: 400 })
    }

    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('phone_number_id, waba_id')
      .eq('account_id', profile.account_id)
      .maybeSingle()

    const body = await request.json()
    const {
      type = 'text',
      fromPhone = '5511999990000',
      customerName = 'Simulated Customer',
      text = 'Olá, gostaria de informações!',
      buttonPayload,
      status = 'delivered',
      whatsappMessageId,
    } = body

    const phoneNumberId = config?.phone_number_id || 'simulated_phone_number_id'
    const wabaId = config?.waba_id || 'simulated_waba_id'
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const simulatedMsgId = `wamid.simulated_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    let entryChangeValue: any = {
      messaging_product: 'whatsapp',
      metadata: {
        display_phone_number: '5511900000000',
        phone_number_id: phoneNumberId,
      },
    }

    if (type === 'text') {
      entryChangeValue.contacts = [{ profile: { name: customerName }, wa_id: fromPhone }]
      entryChangeValue.messages = [
        {
          from: fromPhone,
          id: simulatedMsgId,
          timestamp,
          type: 'text',
          text: { body: text },
        },
      ]
    } else if (type === 'interactive') {
      entryChangeValue.contacts = [{ profile: { name: customerName }, wa_id: fromPhone }]
      entryChangeValue.messages = [
        {
          from: fromPhone,
          id: simulatedMsgId,
          timestamp,
          type: 'interactive',
          interactive: {
            type: 'button_reply',
            button_reply: {
              id: buttonPayload || 'btn_1',
              title: text,
            },
          },
        },
      ]
    } else if (type === 'status') {
      entryChangeValue.statuses = [
        {
          id: whatsappMessageId || simulatedMsgId,
          status,
          timestamp,
          recipient_id: fromPhone,
        },
      ]
    }

    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: wabaId,
          changes: [
            {
              value: entryChangeValue,
              field: 'messages',
            },
          ],
        },
      ],
    }

    // Call the local webhook endpoint internally with HMAC signature
    const rawBody = JSON.stringify(payload)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-wacrm-simulated': 'true',
    }

    if (process.env.META_APP_SECRET) {
      const crypto = await import('node:crypto')
      const signature =
        'sha256=' +
        crypto.createHmac('sha256', process.env.META_APP_SECRET).update(rawBody).digest('hex')
      headers['x-hub-signature-256'] = signature
    }

    const webhookUrl = new URL('/api/whatsapp/webhook', request.url).toString()
    const internalRes = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: rawBody,
    })

    const webhookStatus = internalRes.status

    return NextResponse.json({
      success: true,
      simulatedMessageId: simulatedMsgId,
      webhookStatus,
      payload,
    })
  } catch (error: any) {
    console.error('[/api/whatsapp/webhook/simulate] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to simulate webhook event' },
      { status: 500 }
    )
  }
}
