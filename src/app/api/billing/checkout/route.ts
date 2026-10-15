// ============================================================
// POST /api/billing/checkout
//
// Creates a PagBank (PagSeguro) Pix order for a subscription plan.
// Restricted to account owners.
// ============================================================

import { NextResponse } from 'next/server';
import { getCurrentAccount, toErrorResponse, ForbiddenError } from '@/lib/auth/account';
import { pagseguroClient, PagSeguroApiError } from '@/lib/payments/pagseguro/client';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    if (ctx.role !== 'owner') {
      throw new ForbiddenError('Apenas o proprietário da conta pode gerenciar faturamento e assinaturas.');
    }

    const body = (await request.json().catch(() => null)) as {
      planId?: string;
      customerTaxId?: string;
      customerPhone?: string;
      customerName?: string;
    } | null;

    if (!body?.planId) {
      return NextResponse.json({ error: 'O identificador do plano (planId) é obrigatório.' }, { status: 400 });
    }

    const { supabase, accountId, userId } = ctx;

    // 1. Fetch requested plan
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', body.planId)
      .eq('active', true)
      .maybeSingle();

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plano não encontrado ou indisponível.' }, { status: 404 });
    }

    // 2. Fetch customer user details
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('user_id', userId)
      .maybeSingle();

    const customerName = body.customerName || userProfile?.full_name || ctx.account.name || 'Cliente WACRM';
    let customerEmail = userProfile?.email || 'contato@wcloudapi.dev';

    // PagBank sandbox rejects orders where buyer email is identical to the merchant account email
    const merchantEmail = process.env.PAGSEGURO_MERCHANT_EMAIL || 'progredindosempre@gmail.com';
    if (process.env.PAGSEGURO_ENV === 'sandbox' && customerEmail.toLowerCase() === merchantEmail.toLowerCase()) {
      customerEmail = customerEmail.replace('@', '+comprador@');
    }

    // 3. Create Pix Order via PagBank
    const order = await pagseguroClient.createPixOrder({
      accountId,
      planId: plan.id,
      planName: plan.name,
      amountCents: plan.price_cents,
      customer: {
        name: customerName,
        email: customerEmail,
        taxId: body.customerTaxId,
        phone: body.customerPhone,
      },
      expirationMinutes: 120, // 2 hours
    });

    const qrCode = order.qr_codes?.[0];
    const qrCodeImage = qrCode?.links?.find((l) => l.media?.includes('image') || l.rel === 'QRCODE.PNG')?.href;

    return NextResponse.json({
      success: true,
      order_id: order.id,
      reference_id: order.reference_id,
      plan: {
        id: plan.id,
        name: plan.name,
        price_cents: plan.price_cents,
      },
      pix: {
        qr_code_text: qrCode?.text || '',
        qr_code_image_url: qrCodeImage || '',
        expiration_date: qrCode?.expiration_date,
      },
    });
  } catch (err: unknown) {
    if (err instanceof PagSeguroApiError) {
      return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
    }
    return toErrorResponse(err);
  }
}
