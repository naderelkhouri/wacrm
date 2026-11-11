import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from './route';

const mockAdmin = {
  from: vi.fn(),
};

vi.mock('@/lib/flows/admin-client', () => ({
  supabaseAdmin: () => mockAdmin,
}));

vi.mock('@/lib/auth/super-admin', () => ({
  requireSuperAdmin: vi.fn().mockResolvedValue({ user: { id: 'super-user-123' } }),
}));

vi.mock('@/lib/whatsapp/encryption', () => ({
  decrypt: vi.fn((val: string) => `decrypted_${val}`),
}));

vi.mock('@/lib/whatsapp/uazapi', () => ({
  verifyUazapiInstance: vi.fn().mockResolvedValue({
    id: 'uaz-123',
    display_phone_number: '+5521982915059',
    verified_name: 'WCloud Test',
    quality_rating: 'GREEN',
  }),
}));

describe('Telemetry Cron Route (/api/admin/telemetry/cron)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTOMATION_CRON_SECRET = 'test_cron_secret_123';

    mockAdmin.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [{ id: 'profile-1' }], error: null }),
          }),
        };
      }
      if (table === 'whatsapp_config') {
        return {
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'cfg-1',
                  account_id: 'acc-1',
                  provider: 'uazapi',
                  api_url: 'https://admxtech-admin.uazapi.com',
                  instance_name: 'test-node',
                  phone_number_id: '5521982915059',
                  access_token: 'encrypted_tok_123',
                },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'broadcast_campaigns') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === 'system_telemetry_events') {
        return {
          delete: vi.fn().mockReturnValue({
            lt: vi.fn().mockResolvedValue({ count: 5, error: null }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });
  });

  it('rejects unauthorized requests with 401', async () => {
    const { requireSuperAdmin } = await import('@/lib/auth/super-admin');
    vi.mocked(requireSuperAdmin).mockRejectedValueOnce(new Error('Unauthorized'));

    const req = new Request('http://localhost/api/admin/telemetry/cron', {
      method: 'GET',
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('authorizes requests with matching x-cron-secret header', async () => {
    const req = new Request('http://localhost/api/admin/telemetry/cron', {
      method: 'GET',
      headers: {
        'x-cron-secret': 'test_cron_secret_123',
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.metrics.whatsapp_instances_checked).toBe(1);
    expect(json.metrics.whatsapp_healthy).toBe(1);
    expect(json.metrics.events_pruned).toBe(5);
  });

  it('authorizes requests with matching Authorization Bearer token', async () => {
    const req = new Request('http://localhost/api/admin/telemetry/cron', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test_cron_secret_123',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.metrics.whatsapp_instances_checked).toBe(1);
  });

  it('authorizes requests from authenticated super admin sessions', async () => {
    const req = new Request('http://localhost/api/admin/telemetry/cron', {
      method: 'POST',
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
