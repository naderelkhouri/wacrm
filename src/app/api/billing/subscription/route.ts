// ============================================================
// GET /api/billing/subscription
//
// Returns current account subscription, plan limits, and list of
// available plans for upgrade/downgrade.
// ============================================================

import { NextResponse } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ctx = await getCurrentAccount();
    const { supabase, accountId } = ctx;

    // 1. Fetch current subscription
    const { data: subscription } = await supabase
      .from('account_subscriptions')
      .select('*, plan:subscription_plans(*)')
      .eq('account_id', accountId)
      .maybeSingle();

    // 2. Fetch all active subscription plans
    const { data: plans } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('active', true)
      .order('price_cents', { ascending: true });

    // 3. Count current active members in the account
    const { count: currentMembersCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId);

    // 4. Count connected WhatsApp numbers
    const { count: whatsappNumbersCount } = await supabase
      .from('whatsapp_config')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId);

    return NextResponse.json({
      subscription: subscription || null,
      plans: plans || [],
      usage: {
        members_count: currentMembersCount || 1,
        whatsapp_numbers_count: whatsappNumbersCount || 0,
      },
      is_owner: ctx.role === 'owner',
    });
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}
