import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { decrypt } from '@/lib/whatsapp/encryption';
import { fetchUazapiProfilePictureUrl } from '@/lib/whatsapp/uazapi';
import { resolveWhatsAppConfig } from '@/lib/whatsapp/resolve-config';
import { ensureAccountForUser } from '@/lib/auth/ensure-account';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contactId } = await params;
    if (!contactId) {
      return NextResponse.json({ error: 'ID do contato não fornecido.' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    // Resolve tenant account
    let accountId: string | null = null;
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profile?.account_id) {
      accountId = profile.account_id;
    } else {
      const healed = await ensureAccountForUser(user);
      accountId = healed?.accountId ?? null;
    }

    if (!accountId) {
      return NextResponse.json(
        { error: 'Perfil não vinculado a uma organização/conta.' },
        { status: 403 }
      );
    }

    // Fetch target contact scoped to account
    const { data: contact, error: contactError } = await supabaseAdmin()
      .from('contacts')
      .select('id, name, phone, avatar_url, account_id')
      .eq('id', contactId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (contactError || !contact) {
      return NextResponse.json(
        { error: 'Contato não encontrado nesta conta.' },
        { status: 404 }
      );
    }

    // Fetch account's WhatsApp config
    const config = await resolveWhatsAppConfig(supabaseAdmin(), accountId);

    if (!config) {
      return NextResponse.json(
        {
          success: false,
          message: 'Nenhuma conexão do WhatsApp configurada para esta conta.',
        },
        { status: 200 }
      );
    }

    if (config.provider !== 'uazapi') {
      return NextResponse.json(
        {
          success: false,
          message:
            'A sincronização de foto de perfil do WhatsApp está disponível para instâncias Uazapi conectadas.',
        },
        { status: 200 }
      );
    }

    if (!config.api_url || !config.access_token) {
      return NextResponse.json(
        {
          success: false,
          message: 'Configuração do Uazapi incompleta (URL ou token ausente).',
        },
        { status: 200 }
      );
    }

    let instanceToken: string;
    try {
      instanceToken = decrypt(config.access_token);
    } catch (decErr) {
      console.error('[sync-whatsapp-avatar] Token decryption failed:', decErr);
      return NextResponse.json(
        {
          success: false,
          message: 'Falha ao descriptografar token da instância Uazapi.',
        },
        { status: 500 }
      );
    }

    // Query Uazapi for contact profile picture
    const avatarUrl = await fetchUazapiProfilePictureUrl({
      apiUrl: config.api_url,
      instanceToken,
      instanceName: config.instance_name,
      phone: contact.phone,
    });

    if (!avatarUrl) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Foto não encontrada no WhatsApp. O contato pode não ter foto pública ou suas configurações de privacidade restringem a visualização.',
        },
        { status: 200 }
      );
    }

    // Update contact in database
    const { error: updateError } = await supabaseAdmin()
      .from('contacts')
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contact.id);

    if (updateError) {
      console.error('[sync-whatsapp-avatar] Update contact error:', updateError);
      return NextResponse.json(
        { error: 'Erro ao salvar foto de perfil no banco.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      avatar_url: avatarUrl,
      message: 'Foto de perfil do WhatsApp sincronizada com sucesso!',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('[sync-whatsapp-avatar] Unexpected error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
