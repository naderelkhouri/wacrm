// ============================================================
// /api/admin/whatsapp-config
//
// Platform Global WhatsApp Connection Settings
// Guarded by requireSuperAdmin().
// Allows platform administrator to configure, connect, test and manage
// WhatsApp Cloud API globally for the platform.
// ============================================================

import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { toErrorResponse } from '@/lib/auth/account';
import { encrypt, decrypt } from '@/lib/whatsapp/encryption';
import { verifyPhoneNumber, type MetaPhoneInfo } from '@/lib/whatsapp/meta-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { supabaseAdmin } = await requireSuperAdmin();

    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .select('value, updated_at, updated_by')
      .eq('key', 'global_whatsapp_config')
      .maybeSingle();

    if (error) {
      console.error('[GET /api/admin/whatsapp-config] DB error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data?.value) {
      return NextResponse.json({
        configured: false,
        status: 'disconnected',
        allow_tenant_fallback: false,
        verify_token: process.env.META_WHATSAPP_VERIFY_TOKEN || 'wcloudapi_global_verify',
      });
    }

    const val = data.value as {
      phone_number_id?: string;
      waba_id?: string;
      encrypted_access_token?: string;
      encrypted_verify_token?: string;
      meta_app_id?: string;
      encrypted_meta_app_secret?: string;
      allow_tenant_fallback?: boolean;
      status?: string;
      phone_info?: MetaPhoneInfo | null;
      connected_at?: string;
    };

    let verifyToken = 'wcloudapi_global_verify';
    if (val.encrypted_verify_token) {
      try {
        verifyToken = decrypt(val.encrypted_verify_token);
      } catch {
        // keep fallback
      }
    }

    return NextResponse.json({
      configured: !!val.phone_number_id,
      phone_number_id: val.phone_number_id || '',
      waba_id: val.waba_id || '',
      has_access_token: !!val.encrypted_access_token,
      access_token_masked: val.encrypted_access_token ? '••••••••••••••••' : '',
      verify_token: verifyToken,
      meta_app_id: val.meta_app_id || '',
      has_meta_app_secret: !!val.encrypted_meta_app_secret,
      allow_tenant_fallback: !!val.allow_tenant_fallback,
      status: val.status || (val.phone_number_id ? 'connected' : 'disconnected'),
      phone_info: val.phone_info || null,
      updated_at: data.updated_at,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const { user, profile, supabaseAdmin } = await requireSuperAdmin();

    const body = (await request.json().catch(() => null)) as {
      phone_number_id?: string;
      waba_id?: string;
      access_token?: string;
      verify_token?: string;
      meta_app_id?: string;
      meta_app_secret?: string;
      allow_tenant_fallback?: boolean;
      sync_master_account?: boolean;
    } | null;

    if (!body) {
      return NextResponse.json({ error: 'Payload JSON inválido.' }, { status: 400 });
    }

    const {
      phone_number_id,
      waba_id,
      access_token,
      verify_token,
      meta_app_id,
      meta_app_secret,
      allow_tenant_fallback = true,
      sync_master_account = true,
    } = body;

    if (!phone_number_id || !waba_id) {
      return NextResponse.json(
        { error: 'Phone Number ID e WABA ID são obrigatórios.' },
        { status: 400 }
      );
    }

    // Fetch existing settings to preserve token if not edited
    const { data: existingRow } = await supabaseAdmin
      .from('platform_settings')
      .select('value')
      .eq('key', 'global_whatsapp_config')
      .maybeSingle();

    const existingVal = (existingRow?.value as Record<string, unknown>) || {};

    let encryptedAccessToken = existingVal.encrypted_access_token as string | undefined;
    let plainTokenToVerify = '';

    if (access_token && access_token !== '••••••••••••••••') {
      encryptedAccessToken = encrypt(access_token.trim());
      plainTokenToVerify = access_token.trim();
    } else if (encryptedAccessToken) {
      try {
        plainTokenToVerify = decrypt(encryptedAccessToken);
      } catch {
        return NextResponse.json(
          { error: 'O token existente está corrompido. Insira um novo token de acesso permanente.' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Token de acesso permanente da Meta é obrigatório.' },
        { status: 400 }
      );
    }

    // Live verification with Meta Graph API
    let phoneInfo: MetaPhoneInfo | null = null;
    try {
      phoneInfo = await verifyPhoneNumber({
        phoneNumberId: phone_number_id.trim(),
        accessToken: plainTokenToVerify,
      });
    } catch (metaErr: unknown) {
      const msg = metaErr instanceof Error ? metaErr.message : 'Falha na validação com a Meta';
      return NextResponse.json(
        { error: `Erro da Meta Cloud API: ${msg}` },
        { status: 400 }
      );
    }

    // Encrypt verify token
    const tokenToSave = verify_token?.trim() || 'wcloudapi_global_verify';
    const encryptedVerifyToken = encrypt(tokenToSave);

    // Encrypt meta app secret if provided
    let encryptedAppSecret = existingVal.encrypted_meta_app_secret as string | undefined;
    if (meta_app_secret) {
      encryptedAppSecret = encrypt(meta_app_secret.trim());
    }

    const newConfigValue = {
      phone_number_id: phone_number_id.trim(),
      waba_id: waba_id.trim(),
      encrypted_access_token: encryptedAccessToken,
      encrypted_verify_token: encryptedVerifyToken,
      meta_app_id: meta_app_id?.trim() || '',
      encrypted_meta_app_secret: encryptedAppSecret || '',
      allow_tenant_fallback: !!allow_tenant_fallback,
      status: 'connected',
      phone_info: phoneInfo,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save in platform_settings
    const { error: upsertErr } = await supabaseAdmin
      .from('platform_settings')
      .upsert(
        {
          key: 'global_whatsapp_config',
          value: newConfigValue,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        },
        { onConflict: 'key' }
      );

    if (upsertErr) {
      console.error('[POST /api/admin/whatsapp-config] save error:', upsertErr);
      return NextResponse.json({ error: 'Erro ao persistir configuração global.' }, { status: 500 });
    }

    // Optionally sync with the admin's master account so admin inbox can immediately use it
    if (sync_master_account && profile.account_id) {
      await supabaseAdmin
        .from('whatsapp_config')
        .upsert(
          {
            account_id: profile.account_id,
            user_id: user.id,
            phone_number_id: phone_number_id.trim(),
            waba_id: waba_id.trim(),
            access_token: encryptedAccessToken,
            verify_token: encryptedVerifyToken,
            status: 'connected',
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'account_id' }
        );
    }

    return NextResponse.json({
      ok: true,
      message: 'Conexão Global do WhatsApp estabelecida e validada com sucesso!',
      phone_info: phoneInfo,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE() {
  try {
    const { supabaseAdmin } = await requireSuperAdmin();

    const { error } = await supabaseAdmin
      .from('platform_settings')
      .delete()
      .eq('key', 'global_whatsapp_config');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: 'Conexão global desconectada com sucesso.' });
  } catch (err) {
    return toErrorResponse(err);
  }
}
