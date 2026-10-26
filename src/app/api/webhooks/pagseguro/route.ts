// ============================================================
// POST /api/webhooks/pagseguro
//
// Webhook receiver for PagBank / PagSeguro events.
// Handles Pix payment confirmations and subscription activations.
// Strict idempotency via payment_transactions.gateway_reference_id.
// ============================================================

import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import type { PagSeguroWebhookEvent } from '@/lib/payments/pagseguro/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    let event: PagSeguroWebhookEvent;

    try {
      event = JSON.parse(rawBody) as PagSeguroWebhookEvent;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Webhook authentication (fail-closed in production)
    const configuredSecret = process.env.PAGSEGURO_WEBHOOK_SECRET;
    if (!configuredSecret) {
      if (process.env.NODE_ENV === 'production' && !process.env.VITEST) {
        console.error('[pagseguro-webhook] PAGSEGURO_WEBHOOK_SECRET is not configured in production — rejecting request.');
        return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
      }
      console.warn('[pagseguro-webhook] WARNING: PAGSEGURO_WEBHOOK_SECRET not set in non-production environment.');
    } else {
      const authHeader = request.headers.get('authorization') || request.headers.get('x-authenticity-token');
      const token = authHeader?.replace(/^Bearer\s+/i, '').trim() || '';
      const suppliedBuf = Buffer.from(token);
      const expectedBuf = Buffer.from(configuredSecret);
      const isValid =
        suppliedBuf.length === expectedBuf.length &&
        timingSafeEqual(suppliedBuf, expectedBuf);
      if (!isValid) {
        console.warn('[pagseguro-webhook] Unauthorized webhook attempt');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Extract charge status and reference_id
    const charge = event.charges?.[0];
    const orderId = event.id || event.order?.id;
    const referenceId = event.reference_id || charge?.reference_id || event.order?.reference_id;
    const chargeStatus = charge?.status || 'WAITING';

    if (!referenceId) {
      // Ignored: not a subscription order originating from WACRM
      return NextResponse.json({ received: true, ignored: true, reason: 'No reference_id' });
    }

    // Reference ID format: sub_{accountId}_{planId}_{timestamp}
    const parts = referenceId.split('_');
    if (parts.length < 3 || parts[0] !== 'sub') {
      return NextResponse.json({ received: true, ignored: true, reason: 'Unrecognized reference_id pattern' });
    }

    const accountId = parts[1];
    const planId = parts[2];
    const uniqueTxKey = charge?.id || orderId || referenceId;
    const amountCents = charge?.amount?.value || 0;
    const paymentMethod = charge?.payment_method?.type?.toLowerCase() || 'pix';

    const supabase = supabaseAdmin();

    // Check for existing transaction (Idempotency check)
    const { data: existingTx } = await supabase
      .from('payment_transactions')
      .select('id, status')
      .eq('gateway_reference_id', uniqueTxKey)
      .maybeSingle();

    if (existingTx && existingTx.status === 'PAID') {
      return NextResponse.json({ received: true, already_processed: true });
    }

    // Record or update transaction in ledger
    if (!existingTx) {
      await supabase.from('payment_transactions').insert({
        account_id: accountId,
        gateway: 'pagseguro',
        gateway_reference_id: uniqueTxKey,
        amount_cents: amountCents,
        payment_method: paymentMethod,
        status: chargeStatus,
        payload: event as unknown as Record<string, unknown>,
      });
    } else {
      await supabase
        .from('payment_transactions')
        .update({
          status: chargeStatus,
          payload: event as unknown as Record<string, unknown>,
        })
        .eq('id', existingTx.id);
    }

    // If payment is confirmed (PAID), activate subscription & quotas
    if (chargeStatus === 'PAID') {
      // 1. Fetch plan details (quotas)
      const { data: plan } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .maybeSingle();

      const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // 2. Update account subscription
      await supabase
        .from('account_subscriptions')
        .upsert(
          {
            account_id: accountId,
            plan_id: planId,
            status: 'active',
            payment_method: paymentMethod,
            pagseguro_order_id: orderId,
            current_period_start: new Date().toISOString(),
            current_period_end: currentPeriodEnd,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'account_id' }
        );

      // 3. Enforce member limit on accounts table based on plan quota
      if (plan?.max_members) {
        await supabase
          .from('accounts')
          .update({
            max_members: plan.max_members,
            allow_member_invites: true,
          })
          .eq('id', accountId);
      }

      console.log(`[pagseguro-webhook] Subscription successfully activated for account ${accountId} on plan ${planId}`);
    }

    return NextResponse.json({
      received: true,
      status: chargeStatus,
      account_id: accountId,
      plan_id: planId,
    });
  } catch (err: unknown) {
    console.error('[pagseguro-webhook] Handler error:', err);
    const message = err instanceof Error ? err.message : 'Internal webhook error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
