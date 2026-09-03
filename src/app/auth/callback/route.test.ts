import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
    },
  }),
}));

import { GET } from './route';

describe('/auth/callback', () => {
  beforeEach(() => {
    mocks.exchangeCodeForSession.mockReset();
  });

  it('exchanges code for session and redirects to next destination', async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });

    const request = new Request(
      'https://wacrm.admx.tech/auth/callback?code=test-code&next=/reset-password'
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://wacrm.admx.tech/reset-password'
    );
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith('test-code');
  });

  it('sanitizes open redirect target in next param', async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });

    const request = new Request(
      'https://wacrm.admx.tech/auth/callback?code=test-code&next=https://malicious.site'
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://wacrm.admx.tech/dashboard'
    );
  });

  it('handles exchange error gracefully and redirects to forgot-password when next is reset-password', async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      error: new Error('Token has expired or is invalid'),
    });

    const request = new Request(
      'https://wacrm.admx.tech/auth/callback?code=expired-code&next=/reset-password'
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/forgot-password?error=');
  });

  it('handles provider error params and redirects accordingly', async () => {
    const request = new Request(
      'https://wacrm.admx.tech/auth/callback?error=access_denied&error_description=User+cancelled&next=/reset-password'
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/forgot-password?error=');
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('redirects to /login if code is missing', async () => {
    const request = new Request('https://wacrm.admx.tech/auth/callback');

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://wacrm.admx.tech/login'
    );
  });
});
