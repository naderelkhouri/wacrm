// ============================================================
// PATCH /api/admin/tenants/[id]
//
// Super Admin manual override for a tenant account:
// Change subscription status, switch plan, adjust max_members.
// ============================================================

import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { toErrorResponse } from '@/lib/auth/account';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { supabaseAdmin } = await requireSuperAdmin();
    const { id: accountId } = await props.params;

    const body = (await request.json().catch(() => null)) as {
      planId?: string;
      status?: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid';
      maxMembers?: number;
      allowMemberInvites?: boolean;
      daysToAdd?: number;
    } | null;

    if (!body) {
      return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
    }

    // 1. Update account level fields if provided
    if (typeof body.maxMembers === 'number' || typeof body.allowMemberInvites === 'boolean') {
      const accountUpdates: Record<string, unknown> = {};
      if (typeof body.maxMembers === 'number') accountUpdates.max_members = body.maxMembers;
      if (typeof body.allowMemberInvites === 'boolean') accountUpdates.allow_member_invites = body.allowMemberInvites;

      await supabaseAdmin.from('accounts').update(accountUpdates).eq('id', accountId);
    }

    // 2. Update subscription if planId or status is provided
    if (body.planId || body.status || body.daysToAdd) {
      const subUpdates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (body.planId) subUpdates.plan_id = body.planId;
      if (body.status) subUpdates.status = body.status;
      if (body.daysToAdd) {
        subUpdates.current_period_end = new Date(
          Date.now() + body.daysToAdd * 24 * 60 * 60 * 1000
        ).toISOString();
      }

      await supabaseAdmin
        .from('account_subscriptions')
        .upsert(
          {
            account_id: accountId,
            plan_id: body.planId || 'starter',
            status: body.status || 'active',
            ...subUpdates,
          },
          { onConflict: 'account_id' }
        );
    }

    return NextResponse.json({ success: true, account_id: accountId });
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}
