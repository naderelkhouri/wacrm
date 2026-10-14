import { NextResponse } from 'next/server';
import { djangoApi, DjangoApiError } from '@/lib/api/django-client';
import { DJANGO_ACCESS_COOKIE, DJANGO_REFRESH_COOKIE, parseJwtPayload } from '@/lib/auth/django-token';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Usuário/email e senha são obrigatórios.' },
        { status: 400 }
      );
    }

    const data = await djangoApi.auth.login(identifier, password);
    const accessPayload = parseJwtPayload(data.access);
    const refreshPayload = parseJwtPayload(data.refresh);

    const accessMaxAge = accessPayload?.exp
      ? Math.max(0, accessPayload.exp - Math.floor(Date.now() / 1000))
      : 3600;

    const refreshMaxAge = refreshPayload?.exp
      ? Math.max(0, refreshPayload.exp - Math.floor(Date.now() / 1000))
      : 14 * 86400;

    const response = NextResponse.json({
      success: true,
      user: data.user,
    });

    response.cookies.set({
      name: DJANGO_ACCESS_COOKIE,
      value: data.access,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: accessMaxAge,
    });

    response.cookies.set({
      name: DJANGO_REFRESH_COOKIE,
      value: data.refresh,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: refreshMaxAge,
    });

    return response;
  } catch (err: unknown) {
    if (err instanceof DjangoApiError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status }
      );
    }
    const message = err instanceof Error ? err.message : 'Erro interno ao autenticar.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
