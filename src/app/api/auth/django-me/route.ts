import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { djangoApi, DjangoApiError } from '@/lib/api/django-client';
import { DJANGO_ACCESS_COOKIE } from '@/lib/auth/django-token';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(DJANGO_ACCESS_COOKIE)?.value;

    if (!token) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const user = await djangoApi.auth.me(token);
    return NextResponse.json({ user });
  } catch (err: unknown) {
    if (err instanceof DjangoApiError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status }
      );
    }
    const message = err instanceof Error ? err.message : 'Erro interno.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
