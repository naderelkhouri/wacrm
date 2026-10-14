import { NextResponse } from 'next/server';
import { DJANGO_ACCESS_COOKIE, DJANGO_REFRESH_COOKIE } from '@/lib/auth/django-token';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(DJANGO_ACCESS_COOKIE);
  response.cookies.delete(DJANGO_REFRESH_COOKIE);
  return response;
}
