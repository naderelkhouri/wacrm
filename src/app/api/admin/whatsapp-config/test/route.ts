// ============================================================
// POST /api/admin/whatsapp-config/test
//
// Tests WhatsApp Cloud API credentials against Meta Graph API in real time.
// ============================================================

import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { toErrorResponse } from '@/lib/auth/account';
import { decrypt } from '@/lib/whatsapp/encryption';
import { verifyPhoneNumber } from '@/lib/whatsapp/meta-api';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { supabaseAdmin } = await requireSuperAdmin();

    const body = (await request.json().catch(() => ({}))) as {
      phone_number_id?: string;
      access_token?: string;
    };

    let phoneNumberId = body.phone_number_id?.trim();
    let token = body.access_token?.trim();

    // If no credentials supplied or token masked, read existing saved global config
    if (!phoneNumberId || !token || token === '••••••••••••••••') {
      const { data } = await supabaseAdmin
        .from('platform_settings')
        .select('value')
        .eq('key', 'global_whatsapp_config')
        .maybeSingle();

      const val = (data?.value as Record<string, unknown>) || {};
      phoneNumberId = (val.phone_number_id as string) || phoneNumberId;

      if (val.encrypted_access_token) {
        token = decrypt(val.encrypted_access_token as string);
      }
    }

    if (!phoneNumberId || !token) {
      return NextResponse.json(
        { error: 'Phone Number ID e Access Token são obrigatórios para teste.' },
        { status: 400 }
      );
    }

    // Call Meta Graph API
    const phoneInfo = await verifyPhoneNumber({
      phoneNumberId,
      accessToken: token,
    });

    return NextResponse.json({
      success: true,
      phone_info: phoneInfo,
      message: `Conexão bem sucedida com o número ${phoneInfo.display_phone_number} (${phoneInfo.verified_name || 'Sem nome verificado'}). Qualidade: ${phoneInfo.quality_rating || 'N/A'}.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Falha na comunicação com a Meta';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
