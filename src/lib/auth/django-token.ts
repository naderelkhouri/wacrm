/**
 * Utilities for Django JWT tokens in Next.js (Client, Server, and Edge Middleware)
 */

export interface JwtPayload {
  token_type: string;
  exp: number;
  iat: number;
  jti: string;
  user_id: number | string;
}

export function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(padLen);
    const raw = atob(padded);
    return JSON.parse(raw) as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenValid(token?: string | null): boolean {
  if (!token) return false;
  const payload = parseJwtPayload(token);
  if (!payload || !payload.exp) return false;
  // Exp is in seconds; check if expires in the future (with 10s leeway)
  return payload.exp * 1000 > Date.now() + 10_000;
}

export const DJANGO_ACCESS_COOKIE = 'django_access_token';
export const DJANGO_REFRESH_COOKIE = 'django_refresh_token';
