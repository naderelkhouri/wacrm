// ============================================================
// GET /api/admin/overview
//
// Platform Master Overview metrics across all tenants.
// Guarded by requireSuperAdmin().
// ============================================================

import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { toErrorResponse } from '@/lib/auth/account';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { supabaseAdmin } = await requireSuperAdmin();

    // 1. Total Tenants (Accounts)
    const { count: totalTenants } = await supabaseAdmin
      .from('accounts')
      .select('*', { count: 'exact', head: true });

    // 2. Active & Trialing Subscriptions
    const { data: subscriptions } = await supabaseAdmin
      .from('account_subscriptions')
      .select('status, plan_id, plan:subscription_plans(price_cents)');

    let activeSubscriptions = 0;
    let trialingSubscriptions = 0;
    let mrrCents = 0;

    subscriptions?.forEach((sub) => {
      if (sub.status === 'active') {
        activeSubscriptions += 1;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const planPrice = (sub.plan as any)?.price_cents || 0;
        mrrCents += planPrice;
      } else if (sub.status === 'trialing') {
        trialingSubscriptions += 1;
      }
    });

    // 3. Total Contacts across all accounts
    const { count: totalContacts } = await supabaseAdmin
      .from('contacts')
      .select('*', { count: 'exact', head: true });

    // 4. Total Messages across all accounts
    const { count: totalMessages } = await supabaseAdmin
      .from('messages')
      .select('*', { count: 'exact', head: true });

    // 5. Total WhatsApp Numbers connected
    const { count: totalWhatsAppConnected } = await supabaseAdmin
      .from('whatsapp_config')
      .select('*', { count: 'exact', head: true });

    // 6. Total Revenue Processed (PAID)
    const { data: paidTx } = await supabaseAdmin
      .from('payment_transactions')
      .select('amount_cents')
      .eq('status', 'PAID');

    const totalRevenueCents = paidTx?.reduce((acc, tx) => acc + (tx.amount_cents || 0), 0) || 0;

    // 7. Platform Signup Mode
    const { data: signupSetting } = await supabaseAdmin
      .from('platform_settings')
      .select('value')
      .eq('key', 'signup_mode')
      .maybeSingle();

    const signupMode = (signupSetting?.value as { mode?: string })?.mode || 'open';

    // 8. Recent 5 Tenants
    const { data: recentAccounts } = await supabaseAdmin
      .from('accounts')
      .select(`
        id,
        name,
        created_at,
        owner:profiles!accounts_owner_user_id_fkey(full_name, email),
        subscription:account_subscriptions(status, plan_id)
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    // 9. Recent 5 Transactions
    const { data: recentTransactions } = await supabaseAdmin
      .from('payment_transactions')
      .select(`
        id,
        gateway_reference_id,
        amount_cents,
        payment_method,
        status,
        created_at,
        account:accounts(name)
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      metrics: {
        total_tenants: totalTenants || 0,
        active_subscriptions: activeSubscriptions,
        trialing_subscriptions: trialingSubscriptions,
        mrr_cents: mrrCents,
        total_revenue_cents: totalRevenueCents,
        total_contacts: totalContacts || 0,
        total_messages: totalMessages || 0,
        total_whatsapp_connected: totalWhatsAppConnected || 0,
        signup_mode: signupMode,
      },
      recent_tenants: recentAccounts || [],
      recent_transactions: recentTransactions || [],
    });
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}
