// ============================================================
// POST /api/webhooks/stripe
//
// Webhook receiver for Stripe events (international billing).
// Handles card/subscription payments (USD/EUR) and activations.
// Strict idempotency via payment_transactions.gateway_reference_id.
// ============================================================

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/payments/stripe/client';
import { supabaseAdmin } from '@/lib/flows/admin-client';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;

    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Invalid signature';
        console.error('[stripe-webhook] Signature verification failed:', msg);
        return NextResponse.json({ error: `Webhook signature error: ${msg}` }, { status: 400 });
      }
    } else {
      if (process.env.NODE_ENV === 'production' && !process.env.VITEST) {
        console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured in production.');
        return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
      }
      try {
        event = JSON.parse(rawBody) as Stripe.Event;
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
      }
    }

    const supabase = supabaseAdmin();

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const accountId = session.client_reference_id || session.metadata?.accountId;
        const planId = session.metadata?.planId || 'starter';
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        const subscriptionId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

        if (!accountId) {
          return NextResponse.json({ received: true, ignored: true, reason: 'No accountId in session' });
        }

        // Idempotency check via payment_transactions
        const uniqueTxKey = session.id;
        const { data: existingTx } = await supabase
          .from('payment_transactions')
          .select('id, status')
          .eq('gateway_reference_id', uniqueTxKey)
          .maybeSingle();

        if (existingTx && existingTx.status === 'PAID') {
          return NextResponse.json({ received: true, already_processed: true });
        }

        const amountCents = session.amount_total || 0;
        const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        // 1. Record transaction in payment_transactions
        if (!existingTx) {
          await supabase.from('payment_transactions').insert({
            account_id: accountId,
            gateway: 'stripe',
            gateway_reference_id: uniqueTxKey,
            amount_cents: amountCents,
            payment_method: 'card',
            status: 'PAID',
            payload: event as unknown as Record<string, unknown>,
          });
        } else {
          await supabase
            .from('payment_transactions')
            .update({
              status: 'PAID',
              payload: event as unknown as Record<string, unknown>,
            })
            .eq('id', existingTx.id);
        }

        // 2. Fetch plan quotas
        const { data: plan } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('id', planId)
          .maybeSingle();

        // 3. Upsert account_subscriptions
        await supabase
          .from('account_subscriptions')
          .upsert(
            {
              account_id: accountId,
              plan_id: planId,
              status: 'active',
              payment_method: 'stripe_card',
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              current_period_start: new Date().toISOString(),
              current_period_end: currentPeriodEnd,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'account_id' }
          );

        // 4. Update account members limit if plan defines it
        if (plan?.max_members) {
          await supabase
            .from('accounts')
            .update({
              max_members: plan.max_members,
              allow_member_invites: true,
            })
            .eq('id', accountId);
        }

        console.log(`[stripe-webhook] Subscription successfully activated for account ${accountId} on plan ${planId}`);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceWithSub = invoice as unknown as { subscription?: string | { id: string } | null };
        const subscriptionId =
          typeof invoiceWithSub.subscription === 'string'
            ? invoiceWithSub.subscription
            : invoiceWithSub.subscription?.id;

        if (subscriptionId) {
          // Extend subscription period
          const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          await supabase
            .from('account_subscriptions')
            .update({
              status: 'active',
              current_period_end: currentPeriodEnd,
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', subscriptionId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await supabase
          .from('account_subscriptions')
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', sub.id);
        break;
      }

      default:
        // Ignore other events
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    console.error('[stripe-webhook] Handler error:', err);
    const message = err instanceof Error ? err.message : 'Internal webhook error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
