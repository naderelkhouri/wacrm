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

    const { data: accounts, error } = await supabaseAdmin
      .from('accounts')
      .select(`
        id,
        name,
        created_at,
        allow_member_invites,
        max_members,
        owner:profiles!accounts_owner_user_id_fkey(user_id, full_name, email),
        subscription:account_subscriptions(*, plan:subscription_plans(name, price_cents))
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[GET /api/admin/tenants] error:', error);
      return NextResponse.json({ error: 'Erro ao listar empresas.' }, { status: 500 });
    }

    // Filter by name or owner email if search param is provided
    let filtered = accounts || [];
    if (search) {
      filtered = filtered.filter((acc) => {
        const nameMatch = acc.name?.toLowerCase().includes(search);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ownerEmail = (acc.owner as any)?.email?.toLowerCase();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ownerName = (acc.owner as any)?.full_name?.toLowerCase();
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
