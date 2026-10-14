import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { djangoApi, DjangoApiError } from '@/lib/api/django-client';
import { DJANGO_ACCESS_COOKIE } from '@/lib/auth/django-token';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const djangoToken = cookieStore.get(DJANGO_ACCESS_COOKIE)?.value;

  const url = new URL(request.url);
  const search = url.searchParams.get('search') || undefined;
  const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 25;
  const offset = url.searchParams.get('offset') ? Number(url.searchParams.get('offset')) : 0;

  if (djangoToken) {
    try {
      const data = await djangoApi.contacts.list({ search, limit, offset }, djangoToken);

      const contacts = data.results.map((c) => ({
        id: String(c.id),
        user_id: String(c.company),
        account_id: String(c.company),
        name: c.name || undefined,
        phone: c.phone_number,
        phone_normalized: c.phone_number.replace(/\D/g, ''),
        email: c.email || undefined,
        tags: Array.isArray(c.tags)
          ? c.tags.map((t, idx) =>
              typeof t === 'string'
                ? { id: `tag-${idx}`, name: t, color: '#3b82f6', user_id: '1', created_at: c.created_at }
                : t
            )
          : [],
        created_at: c.created_at,
        updated_at: c.updated_at,
      }));

      return NextResponse.json({
        contacts,
        totalCount: data.count,
        source: 'django',
      });
    } catch (err: unknown) {
      if (err instanceof DjangoApiError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      return NextResponse.json({ error: 'Erro ao carregar contatos do Django.' }, { status: 500 });
    }
  }

  // Fallback to Supabase
  try {
    const supabase = await createClient();
    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      const like = `%${search.trim()}%`;
      query = query.or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like}`);
    }

    const { data, count, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      contacts: data || [],
      totalCount: count || 0,
      source: 'supabase',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao carregar contatos.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const djangoToken = cookieStore.get(DJANGO_ACCESS_COOKIE)?.value;

  try {
    const body = await request.json();
    const { name, phone, email, tags, company } = body;

    if (!phone) {
      return NextResponse.json({ error: 'Telefone é obrigatório.' }, { status: 400 });
    }

    if (djangoToken) {
      let companyId = 1;
      try {
        const me = await djangoApi.auth.me(djangoToken);
        if (me.last_active_company) companyId = me.last_active_company;
      } catch {}

      const newContact = await djangoApi.contacts.create(
        {
          company: companyId,
          name: name || '',
          phone_number: phone,
          email: email || '',
          tags: tags || [],
          metadata: company ? { company } : {},
        },
        djangoToken
      );

      return NextResponse.json({
        contact: {
          id: String(newContact.id),
          user_id: String(newContact.company),
          account_id: String(newContact.company),
          name: newContact.name,
          phone: newContact.phone_number,
          email: newContact.email,
          tags: newContact.tags || [],
          created_at: newContact.created_at,
          updated_at: newContact.updated_at,
        },
        source: 'django',
      });
    }

    // Fallback to Supabase
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .single();

    const { data: contact, error } = await supabase
      .from('contacts')
      .insert({
        user_id: user.id,
        account_id: profile?.account_id,
        name,
        phone,
        email,
        company,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ contact, source: 'supabase' });
  } catch (err: unknown) {
    if (err instanceof DjangoApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Erro interno.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
