// ============================================================
// POST /api/whatsapp/config/test
//
// Live test connection endpoint for WhatsApp (Uazapi & Meta Cloud API).
// Enables users to test their credentials immediately before or after saving.
// ============================================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { verifyPhoneNumber } from '@/lib/whatsapp/meta-api';
import { verifyUazapiInstance, normalizeUazapiBaseUrl } from '@/lib/whatsapp/uazapi';
import { decrypt } from '@/lib/whatsapp/encryption';
import { ensureAccountForUser } from '@/lib/auth/ensure-account';

function supabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve caller's account
    let accountId: string | undefined;
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profile?.account_id) {
      accountId = profile.account_id;
    } else {
      const healed = await ensureAccountForUser(user);
      if (healed?.accountId) accountId = healed.accountId;
    }

    if (!accountId) {
      return NextResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      provider: rawProvider,
      api_url,
      instance_name,
      phone_number_id,
      access_token,
    } = body;

    const provider = rawProvider === 'uazapi' ? 'uazapi' : 'meta';

    // Resolve access token (supports reusing existing encrypted token if masked)
    let tokenToTest = (typeof access_token === 'string' && access_token.trim()) || '';
    if (!tokenToTest || tokenToTest === '••••••••••••••••') {
      const { data: existingConfig } = await supabaseAdmin()
        .from('whatsapp_config')
        .select('access_token')
        .eq('account_id', accountId)
        .maybeSingle();

      if (existingConfig?.access_token) {
        try {
          tokenToTest = decrypt(existingConfig.access_token);
        } catch (decErr) {
          console.error('[whatsapp/config/test] Decryption failed:', decErr);
        }
      }
    }

    if (provider === 'uazapi') {
      if (!api_url) {
        return NextResponse.json(
          { connected: false, error: 'A URL do servidor Uazapi é obrigatória.' },
          { status: 400 }
        );
      }
      if (!tokenToTest) {
        return NextResponse.json(
          { connected: false, error: 'O Token da Instância Uazapi é obrigatório.' },
          { status: 400 }
        );
      }

      let normalizedUrl: string;
      try {
        normalizedUrl = normalizeUazapiBaseUrl(api_url);
      } catch (err) {
        return NextResponse.json(
          { connected: false, error: err instanceof Error ? err.message : 'URL da Uazapi inválida.' },
          { status: 400 }
        );
      }

      try {
        const phoneInfo = await verifyUazapiInstance({
          apiUrl: normalizedUrl,
          instanceToken: tokenToTest,
          instanceName: instance_name ? String(instance_name).trim() : null,
          fallbackPhoneId: phone_number_id ? String(phone_number_id).trim() : null,
        });

        return NextResponse.json({
          connected: true,
          provider: 'uazapi',
          phone_info: phoneInfo,
          message: phoneInfo.verified_name
            ? `Instância Uazapi conectada: ${phoneInfo.verified_name} (${phoneInfo.display_phone_number})`
            : 'Conexão com a instância Uazapi realizada com sucesso!',
        });
      } catch (uazErr) {
        const msg = uazErr instanceof Error ? uazErr.message : 'Falha na validação com Uazapi';
        return NextResponse.json(
          { connected: false, error: msg },
          { status: 400 }
        );
      }
    } else {
      // Meta Cloud API
      const pid = (typeof phone_number_id === 'string' && phone_number_id.trim()) || '';
      if (!pid) {
        return NextResponse.json(
          { connected: false, error: 'Phone Number ID é obrigatório para Meta Cloud API.' },
          { status: 400 }
        );
      }
      if (!tokenToTest) {
        return NextResponse.json(
          { connected: false, error: 'Access Token da Meta é obrigatório.' },
          { status: 400 }
        );
      }

      try {
        const phoneInfo = await verifyPhoneNumber({
          phoneNumberId: pid,
          accessToken: tokenToTest,
        });

        return NextResponse.json({
          connected: true,
          provider: 'meta',
          phone_info: phoneInfo,
          message: phoneInfo.verified_name
            ? `Conectado à Meta: ${phoneInfo.verified_name} (${phoneInfo.display_phone_number})`
            : 'Conexão com Meta Cloud API verificada com sucesso!',
        });
      } catch (metaErr) {
        const msg = metaErr instanceof Error ? metaErr.message : 'Falha na validação com Meta';
        return NextResponse.json(
          { connected: false, error: msg },
          { status: 400 }
        );
      }
    }
  } catch (error) {
    console.error('Error in /api/whatsapp/config/test:', error);
    return NextResponse.json({ connected: false, error: 'Internal server error' }, { status: 500 });
  }
}
