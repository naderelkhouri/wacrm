import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { ensureAccountForUser } from '@/lib/auth/ensure-account';

const MAX_AVATAR_BYTES = 3 * 1024 * 1024; // 3MB
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export async function POST(
  request: Request,
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

    // Check contact exists and belongs to account
    const { data: contact, error: contactError } = await supabaseAdmin()
      .from('contacts')
      .select('id, name, phone, account_id')
      .eq('id', contactId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (contactError || !contact) {
      return NextResponse.json(
        { error: 'Contato não encontrado nesta conta.' },
        { status: 404 }
      );
    }

    const contentType = request.headers.get('content-type') || '';
    let avatarUrl: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
      }

      if (!ALLOWED_MIME.has(file.type)) {
        return NextResponse.json(
          { error: 'Formato não suportado. Utilize PNG, JPEG, WebP ou GIF.' },
          { status: 400 }
        );
      }

      if (file.size > MAX_AVATAR_BYTES) {
        return NextResponse.json(
          { error: 'Tamanho excede o limite de 3MB.' },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const storagePath = `contacts/${accountId}/${contact.id}-${Date.now()}.${ext}`;

      const admin = supabaseAdmin();
      const { error: uploadError } = await admin.storage
        .from('avatars')
        .upload(storagePath, buffer, {
          contentType: file.type,
          upsert: true,
          cacheControl: '3600',
        });

      if (uploadError) {
        console.error('[contact avatar upload] Storage error:', uploadError);
        return NextResponse.json(
          { error: `Falha no upload da imagem: ${uploadError.message}` },
          { status: 500 }
        );
      }

      const {
        data: { publicUrl },
      } = admin.storage.from('avatars').getPublicUrl(storagePath);
      avatarUrl = publicUrl;
    } else {
      const body = await request.json().catch(() => ({}));
      avatarUrl = typeof body.avatar_url === 'string' ? body.avatar_url.trim() : null;
    }

    if (!avatarUrl) {
      return NextResponse.json(
        { error: 'URL do avatar não informada ou arquivo inválido.' },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabaseAdmin()
      .from('contacts')
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contact.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao atualizar avatar do contato.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      avatar_url: avatarUrl,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
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

    const { error: updateError } = await supabaseAdmin()
      .from('contacts')
      .update({
        avatar_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId)
      .eq('account_id', accountId);

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao remover avatar do contato.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, avatar_url: null });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
