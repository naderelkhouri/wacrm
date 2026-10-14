import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  djangoApi,
  DJANGO_API_BASE_URL,
} from './django-client';

describe('Django API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('health() fetches from /api/health/', async () => {
    const mockResponse = {
      status: 'ok',
      service: 'whatsapp-saas-api',
      version: '0.1.0',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    } as unknown as Response);

    const result = await djangoApi.health();
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${DJANGO_API_BASE_URL}/api/health/`,
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    );
  });

  it('auth.login sends POST with credentials', async () => {
    const mockAuth = {
      access: 'jwt_access',
      refresh: 'jwt_refresh',
      user: {
        id: 1,
        username: 'ops',
        email: 'ops@admx.tech',
        full_name: 'Ops ADMX',
        role: 'superadmin',
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockAuth),
    } as unknown as Response);

    const result = await djangoApi.auth.login('ops@admx.tech', 'secret123');
    expect(result.access).toBe('jwt_access');
    expect(global.fetch).toHaveBeenCalledWith(
      `${DJANGO_API_BASE_URL}/api/auth/login/`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ identifier: 'ops@admx.tech', password: 'secret123' }),
      })
    );
  });

  it('throws DjangoApiError on 401 Unauthorized', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({ detail: 'Credenciais inválidas.' }),
    } as unknown as Response);

    await expect(djangoApi.auth.login('wrong', 'pass')).rejects.toThrow(
      'Credenciais inválidas.'
    );
  });

  it('contacts.list passes query parameters and Bearer token', async () => {
    const mockContacts = {
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 1,
          name: 'João Silva',
          phone_number: '+5511999999999',
          company: 1,
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockContacts),
    } as unknown as Response);

    const result = await djangoApi.contacts.list(
      { search: 'João', limit: 10, offset: 0 },
      'my_token'
    );

    expect(result.count).toBe(1);
    expect(global.fetch).toHaveBeenCalledWith(
      `${DJANGO_API_BASE_URL}/api/contacts/?search=Jo%C3%A3o&limit=10&offset=0`,
      expect.objectContaining({
        method: 'GET',
        headers: expect.any(Headers),
      })
    );
  });
});
