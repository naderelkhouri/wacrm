// ============================================================
// GET /api/admin/transactions
//
// Lists recent payment transactions across all tenants.
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
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);

    const { data: transactions, error } = await supabaseAdmin
      .from('payment_transactions')
      .select(`
        id,
        gateway,
        gateway_reference_id,
        amount_cents,
        payment_method,
        status,
        created_at,
        account:accounts(id, name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[GET /api/admin/transactions] error:', error);
      return NextResponse.json({ error: 'Erro ao listar transações.' }, { status: 500 });
    }

    return NextResponse.json({
      transactions: transactions || [],
      total: transactions?.length || 0,
    });
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}
