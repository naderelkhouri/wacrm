import { describe, expect, it, vi, beforeEach } from 'vitest';
import { POST } from './route';

const mockGetUser = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

vi.mock('@/lib/whatsapp/encryption', () => ({
  decrypt: vi.fn((val) => `decrypted_${val}`),
}));

vi.mock('@/lib/whatsapp/uazapi', () => ({
  normalizeUazapiBaseUrl: vi.fn((url) => url),
  verifyUazapiInstance: vi.fn().mockResolvedValue({
    id: 'uaz_123',
    display_phone_number: '5511999998888',
    verified_name: 'Minha Instância Uazapi',
    quality_rating: 'GREEN',
  }),
}));

vi.mock('@/lib/whatsapp/meta-api', () => ({
  verifyPhoneNumber: vi.fn().mockResolvedValue({
    id: 'meta_123',
    display_phone_number: '+15551234567',
    verified_name: 'Meta Test Number',
  }),
}));

describe('POST /api/whatsapp/config/test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      maybeSingle: mockMaybeSingle,
    });
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('unauth') });
    const req = new Request('http://localhost/api/whatsapp/config/test', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('tests uazapi instance successfully', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { account_id: 'acc-1' },
      error: null,
    });

    const req = new Request('http://localhost/api/whatsapp/config/test', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'uazapi',
        api_url: 'https://api.uazapi.com',
        access_token: 'test_token',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.connected).toBe(true);
    expect(data.provider).toBe('uazapi');
    expect(data.phone_info.verified_name).toBe('Minha Instância Uazapi');
  });

  it('tests meta phone number successfully', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { account_id: 'acc-1' },
      error: null,
    });

    const req = new Request('http://localhost/api/whatsapp/config/test', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'meta',
        phone_number_id: '1234567890',
        access_token: 'test_meta_token',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.connected).toBe(true);
    expect(data.provider).toBe('meta');
    expect(data.phone_info.display_phone_number).toBe('+15551234567');
  });
});
