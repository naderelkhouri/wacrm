import { describe, it, expect } from 'vitest';
import { parseJwtPayload, isTokenValid } from './django-token';

describe('Django Token Utilities', () => {
  it('parses valid JWT payload', () => {
    // Payload: {"user_id": 1, "exp": 2000000000, "token_type": "access"}
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ user_id: 1, exp: 2000000000, token_type: 'access' }));
    const fakeJwt = `${header}.${payload}.signature`;

    const parsed = parseJwtPayload(fakeJwt);
    expect(parsed).not.toBeNull();
    expect(parsed?.user_id).toBe(1);
    expect(parsed?.exp).toBe(2000000000);
  });

  it('detects unexpired token as valid', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ user_id: 1, exp: futureExp }));
    const fakeJwt = `${header}.${payload}.signature`;

    expect(isTokenValid(fakeJwt)).toBe(true);
  });

  it('detects expired token as invalid', () => {
    const pastExp = Math.floor(Date.now() / 1000) - 100;
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ user_id: 1, exp: pastExp }));
    const fakeJwt = `${header}.${payload}.signature`;

    expect(isTokenValid(fakeJwt)).toBe(false);
  });

  it('returns false for null or malformed tokens', () => {
    expect(isTokenValid(null)).toBe(false);
    expect(isTokenValid('')).toBe(false);
    expect(isTokenValid('not.a.valid.jwt.token')).toBe(false);
  });
});
