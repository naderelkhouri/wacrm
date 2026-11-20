// ============================================================
// POST /api/webhooks/bunkerpay
//
// Webhook receiver for BunkerPay (bunkerpay.io) events.
// Handles Pix payment confirmations and subscription activations.
// Strict HMAC-SHA256 signature verification & replay protection.
// Idempotency enforced via payment_transactions.gateway_reference_id.
// ============================================================

import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import type { BunkerPayWebhookEvent, BunkerPayPaymentResponse } from '@/lib/payments/bunkerpay/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    let bodyJson: Record<string, unknown>;

    try {
      bodyJson = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Webhook authentication (fail-closed in production)
    const configuredSecret = process.env.BUNKERPAY_WEBHOOK_SECRET;
    if (!configuredSecret) {
      if (process.env.NODE_ENV === 'production' && !process.env.VITEST) {
        console.error('[bunkerpay-webhook] BUNKERPAY_WEBHOOK_SECRET is not configured in production — rejecting request.');
        return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
      }
      console.warn('[bunkerpay-webhook] WARNING: BUNKERPAY_WEBHOOK_SECRET not set in non-production environment.');
    } else {
      const signature = request.headers.get('x-webhook-signature');
      const timestamp = request.headers.get('x-webhook-timestamp');

      if (!signature || !timestamp) {
        console.warn('[bunkerpay-webhook] Missing x-webhook-signature or x-webhook-timestamp header');
        return NextResponse.json({ error: 'Missing webhook signature headers' }, { status: 401 });
      }

      // Replay attack prevention: timestamp must be within 5 minutes (300 seconds)
      const nowSeconds = Math.floor(Date.now() / 1000);
      const reqTimestamp = parseInt(timestamp, 10);
      if (isNaN(reqTimestamp) || Math.abs(nowSeconds - reqTimestamp) > 300) {
        console.warn('[bunkerpay-webhook] Webhook timestamp outside of acceptable tolerance (replay protection)');
        return NextResponse.json({ error: 'Timestamp expired or outside acceptable window' }, { status: 401 });
      }

      // Signature verification: HMAC-SHA256(secret, `${timestamp}.${rawBody}`)
      const signedPayload = `${timestamp}.${rawBody}`;
      const expectedSignature = createHmac('sha256', configuredSecret).update(signedPayload).digest('hex');

      const suppliedBuf = Buffer.from(signature, 'hex');
      const expectedBuf = Buffer.from(expectedSignature, 'hex');

      const isValid =
        suppliedBuf.length === expectedBuf.length &&
        timingSafeEqual(suppliedBuf, expectedBuf);

      if (!isValid) {
        console.warn('[bunkerpay-webhook] Invalid webhook signature');
        return NextResponse.json({ error: 'Unauthorized: signature mismatch' }, { status: 401 });
      }
    }

    // Extract payment object and status
    // BunkerPay sends { event: 'payment.status_changed', payment: { ... } } or direct payment object
    const event = bodyJson as unknown as BunkerPayWebhookEvent;
    const payment = (event.payment || bodyJson) as BunkerPayPaymentResponse;

    const paymentId = payment.id;
    const paymentStatus = (payment.status || 'pending').toLowerCase();
    const observation = payment.observation || '';

    if (!paymentId) {
      return NextResponse.json({ received: true, ignored: true, reason: 'No payment id' });
    }

    // Check observation format: sub_{accountId}_{planId}_{timestamp}
    // E.g. "Assinatura WACRM - sub_acc123_pro_1700000000" or raw "sub_acc123_pro_1700000000"
    const subMatch = observation.match(/sub_([a-zA-Z0-9_-]+)_([a-zA-Z0-9_-]+)_([0-9]+)/);
    if (!subMatch) {
      return NextResponse.json({
        received: true,
        ignored: true,
        reason: 'Observation does not contain valid subscription reference (sub_{accountId}_{planId}_{timestamp})',
      });
    }

    const accountId = subMatch[1];
    const planId = subMatch[2];
    const amountCents = Math.round((payment.amount || 0) * 100);

    const supabase = supabaseAdmin();

    // Idempotency check via payment_transactions table
    const { data: existingTx } = await supabase
      .from('payment_transactions')
      .select('id, status')
      .eq('gateway_reference_id', paymentId)
      .maybeSingle();

    const isPaidStatus = paymentStatus === 'approved' || paymentStatus === 'paid' || paymentStatus === 'receipt_sent';

    if (existingTx && existingTx.status === 'PAID' && isPaidStatus) {
      return NextResponse.json({ received: true, already_processed: true });
    }

    // Record or update transaction in audit ledger
    if (!existingTx) {
      await supabase.from('payment_transactions').insert({
        account_id: accountId,
        gateway: 'bunkerpay',
        gateway_reference_id: paymentId,
        amount_cents: amountCents,
        payment_method: 'pix',
        status: isPaidStatus ? 'PAID' : paymentStatus.toUpperCase(),
        payload: bodyJson,
      });
    } else {
      await supabase
        .from('payment_transactions')
        .update({
          status: isPaidStatus ? 'PAID' : paymentStatus.toUpperCase(),
          payload: bodyJson,
        })
        .eq('id', existingTx.id);
    }

    // If payment is confirmed as PAID / APPROVED, activate subscription & update quotas
    if (isPaidStatus) {
      // 1. Fetch plan quotas
      const { data: plan } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .maybeSingle();

      const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // 2. Activate account subscription
      await supabase
        .from('account_subscriptions')
        .upsert(
          {
            account_id: accountId,
            plan_id: planId,
            status: 'active',
            payment_method: 'pix',
            current_period_start: new Date().toISOString(),
            current_period_end: currentPeriodEnd,
            updated_at: new Date().toISOString(),
            metadata: {
              gateway: 'bunkerpay',
              bunkerpay_payment_id: paymentId,
              bunkerpay_store_id: payment.storeId,
              amount: payment.amount,
              liquid_value: payment.liquidValue,
              fee_amount: payment.feeAmount,
              activated_at: new Date().toISOString(),
            },
          },
          { onConflict: 'account_id' }
        );

      // 3. Enforce member quota on account table
      if (plan?.max_members) {
        await supabase
          .from('accounts')
          .update({
            max_members: plan.max_members,
            allow_member_invites: true,
          })
          .eq('id', accountId);
      }

      console.log(`[bunkerpay-webhook] Subscription successfully activated for account ${accountId} on plan ${planId}`);
    }

    return NextResponse.json({
      received: true,
      status: paymentStatus,
      paid: isPaidStatus,
    });
  } catch (err: unknown) {
    console.error('[bunkerpay-webhook] Handler error:', err);
    return NextResponse.json({ error: 'Internal server error processing webhook' }, { status: 500 });
  }
}
