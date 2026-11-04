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
import {
  verifyUazapiInstance,
  configureUazapiWebhook,
  normalizeUazapiBaseUrl,
  getPublicAppOrigin,
} from '@/lib/whatsapp/uazapi';

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
        provider: 'meta',
        api_url: '',
        instance_name: '',
        status: 'disconnected',
        allow_tenant_fallback: false,
        verify_token: process.env.META_WHATSAPP_VERIFY_TOKEN || 'wcloudapi_global_verify',
      });
    }

    const val = data.value as {
      provider?: 'meta' | 'uazapi';
      api_url?: string;
      instance_name?: string;
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
      configured: !!(val.phone_number_id || val.api_url),
      provider: val.provider === 'uazapi' ? 'uazapi' : 'meta',
      api_url: val.api_url || '',
      instance_name: val.instance_name || '',
      phone_number_id: val.phone_number_id || '',
      waba_id: val.waba_id || '',
      has_access_token: !!val.encrypted_access_token,
      access_token_masked: val.encrypted_access_token ? '••••••••••••••••' : '',
      verify_token: verifyToken,
      meta_app_id: val.meta_app_id || '',
      has_meta_app_secret: !!val.encrypted_meta_app_secret,
      allow_tenant_fallback: !!val.allow_tenant_fallback,
      status: val.status || (val.phone_number_id || val.api_url ? 'connected' : 'disconnected'),
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
      provider?: 'meta' | 'uazapi';
      api_url?: string;
      instance_name?: string;
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
      provider: rawProvider,
      api_url,
      instance_name,
      phone_number_id,
      waba_id,
      access_token,
      verify_token,
      meta_app_id,
      meta_app_secret,
      allow_tenant_fallback = true,
      sync_master_account = true,
    } = body;

    const provider = rawProvider === 'uazapi' ? 'uazapi' : 'meta';

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
          { error: 'O token existente está corrompido. Insira um novo token de acesso.' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        {
          error:
            provider === 'uazapi'
              ? 'Token da Instância Uazapi é obrigatório.'
              : 'Token de acesso permanente da Meta é obrigatório.',
        },
        { status: 400 }
      );
    }

    let phoneInfo: MetaPhoneInfo | null = null;
    let resolvedPhoneNumberId = (phone_number_id || '').trim();
    let resolvedWabaId = (waba_id || '').trim();
    let normalizedApiUrl: string | null = null;
    let resolvedInstanceName: string | null = instance_name?.trim() || null;

    if (provider === 'uazapi') {
      const rawUrl = api_url?.trim() || (existingVal.api_url as string) || '';
      if (!rawUrl) {
        return NextResponse.json(
          { error: 'A URL da API Uazapi é obrigatória.' },
          { status: 400 }
        );
      }
      try {
        normalizedApiUrl = normalizeUazapiBaseUrl(rawUrl);
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'URL da API Uazapi inválida.' },
          { status: 400 }
        );
      }

      try {
        const uazInfo = await verifyUazapiInstance({
          apiUrl: normalizedApiUrl,
          instanceToken: plainTokenToVerify,
          instanceName: resolvedInstanceName,
          fallbackPhoneId: resolvedPhoneNumberId || null,
        });
        phoneInfo = uazInfo;
        resolvedPhoneNumberId = resolvedPhoneNumberId || uazInfo.id || resolvedInstanceName || 'uazapi-global';
        resolvedWabaId = resolvedWabaId || 'uazapi';
        resolvedInstanceName = resolvedInstanceName || uazInfo.instance_name || null;
      } catch (uazErr: unknown) {
        const msg = uazErr instanceof Error ? uazErr.message : 'Falha na validação com Uazapi';
        return NextResponse.json({ error: `Erro da Uazapi: ${msg}` }, { status: 400 });
      }
    } else {
      if (!resolvedPhoneNumberId || !resolvedWabaId) {
        return NextResponse.json(
          { error: 'Phone Number ID e WABA ID são obrigatórios para a Meta Cloud API.' },
          { status: 400 }
        );
      }

      try {
        phoneInfo = await verifyPhoneNumber({
          phoneNumberId: resolvedPhoneNumberId,
          accessToken: plainTokenToVerify,
        });
      } catch (metaErr: unknown) {
        const msg = metaErr instanceof Error ? metaErr.message : 'Falha na validação com a Meta';
        return NextResponse.json(
          { error: `Erro da Meta Cloud API: ${msg}` },
          { status: 400 }
        );
      }
    }

    // Encrypt verify token
    const tokenToSave = verify_token?.trim() || 'wcloudapi_global_verify';
    const encryptedVerifyToken = encrypt(tokenToSave);

    if (provider === 'uazapi' && normalizedApiUrl) {
      const appOrigin = getPublicAppOrigin(request);
      const webhookUrl = `${appOrigin}/api/whatsapp/webhook?token=${encodeURIComponent(tokenToSave)}`;
      await configureUazapiWebhook({
        apiUrl: normalizedApiUrl,
        instanceToken: plainTokenToVerify,
        instanceName: resolvedInstanceName,
        webhookUrl,
      });
    }

    // Encrypt meta app secret if provided
    let encryptedAppSecret = existingVal.encrypted_meta_app_secret as string | undefined;
    if (meta_app_secret) {
      encryptedAppSecret = encrypt(meta_app_secret.trim());
    }

    const newConfigValue = {
      provider,
      api_url: normalizedApiUrl,
      instance_name: resolvedInstanceName,
      phone_number_id: resolvedPhoneNumberId,
      waba_id: resolvedWabaId,
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
            provider,
            api_url: normalizedApiUrl,
            instance_name: resolvedInstanceName,
            phone_number_id: resolvedPhoneNumberId,
            waba_id: resolvedWabaId,
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
