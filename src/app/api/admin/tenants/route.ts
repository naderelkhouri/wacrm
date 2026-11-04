// ============================================================
// GET /api/admin/tenants
//
// Lists all organizations/tenants across the entire platform.
// Guarded by requireSuperAdmin().
// ============================================================

import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { toErrorResponse } from '@/lib/auth/account';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { supabaseAdmin } = await requireSuperAdmin();
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.trim()?.toLowerCase();

    // 1. Fetch accounts and their subscriptions
    const { data: accounts, error } = await supabaseAdmin
      .from('accounts')
      .select(`
        id,
        name,
        owner_user_id,
        created_at,
        allow_member_invites,
        max_members,
        subscription:account_subscriptions(*, plan:subscription_plans(name, price_cents))
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[GET /api/admin/tenants] error:', error);
      return NextResponse.json({ error: 'Erro ao listar empresas.' }, { status: 500 });
    }

    // 2. Fetch owner profiles by matching owner_user_id
    const ownerIds = Array.from(
      new Set((accounts || []).map((a) => a.owner_user_id).filter(Boolean))
    );

    const profileMap = new Map<
      string,
      { user_id: string; full_name: string | null; email: string | null }
    >();

    if (ownerIds.length > 0) {
      const { data: profiles, error: pErr } = await supabaseAdmin
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', ownerIds);

      if (pErr) {
        console.error('[GET /api/admin/tenants] profile query error:', pErr);
      } else if (profiles) {
        for (const p of profiles) {
          profileMap.set(p.user_id, p);
        }
      }
    }

    // 3. Map accounts with owner profile and normalized subscription
    const mappedAccounts = (accounts || []).map((acc) => {
      const sub = Array.isArray(acc.subscription) ? acc.subscription[0] : acc.subscription;
      return {
        id: acc.id,
        name: acc.name,
        created_at: acc.created_at,
        allow_member_invites: acc.allow_member_invites,
        max_members: acc.max_members,
        owner: acc.owner_user_id ? profileMap.get(acc.owner_user_id) || null : null,
        subscription: sub || null,
      };
    });

    // 4. Filter by name or owner email/name if search param is provided
    let filtered = mappedAccounts;
    if (search) {
      filtered = filtered.filter((acc) => {
        const nameMatch = acc.name?.toLowerCase().includes(search);
        const ownerEmail = acc.owner?.email?.toLowerCase();
        const ownerName = acc.owner?.full_name?.toLowerCase();
        return nameMatch || ownerEmail?.includes(search) || ownerName?.includes(search);
      });
    }

    return NextResponse.json({
      tenants: filtered,
      total: filtered.length,
    });
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}
