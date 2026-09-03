import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * /auth/callback — Supabase Auth exchange handler.
 *
 * Exchanges the auth code from email confirmation, magic links,
 * or password reset flows for a persistent session stored in cookies.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Prevent open redirect attacks — ensure 'next' is a relative path
  const safeNext =
    next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  // Determine host and protocol with proxy / load balancer awareness
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const baseUrl =
    process.env.NODE_ENV === 'development'
      ? origin
      : forwardedHost
        ? `${forwardedProto}://${forwardedHost}`
        : origin;

  if (error) {
    console.error('[auth/callback] Auth error from provider:', error, errorDescription);
    const dest = safeNext.startsWith('/reset-password')
      ? '/forgot-password'
      : '/login';
    return NextResponse.redirect(
      `${baseUrl}${dest}?error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('[auth/callback] exchangeCodeForSession error:', exchangeError.message);
      const dest = safeNext.startsWith('/reset-password')
        ? '/forgot-password'
        : '/login';
      return NextResponse.redirect(
        `${baseUrl}${dest}?error=${encodeURIComponent(exchangeError.message)}`
      );
    }

    return NextResponse.redirect(`${baseUrl}${safeNext}`);
  }

  // If no code and no error, check if user requested a specific next destination or fall back to login
  return NextResponse.redirect(`${baseUrl}/login`);
}
