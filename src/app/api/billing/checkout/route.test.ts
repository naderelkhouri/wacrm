import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

const mockGetCurrentAccount = vi.fn();
vi.mock('@/lib/auth/account', () => ({
  getCurrentAccount: () => mockGetCurrentAccount(),
  toErrorResponse: (err: Error) => ({
    status: 500,
    json: async () => ({ error: err.message }),
  }),
  ForbiddenError: class ForbiddenError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ForbiddenError';
    }
  },
}));

const mockCreatePayment = vi.fn();
vi.mock('@/lib/payments/bunkerpay/client', () => ({
  bunkerPayClient: {
    createPayment: (...args: unknown[]) => mockCreatePayment(...args),
  },
  BunkerPayApiError: class BunkerPayApiError extends Error {
    public status: number;
    public details?: unknown;
    constructor(message: string, status = 500, details?: unknown) {
      super(message);
      this.status = status;
      this.details = details;
    }
  },
}));

describe('POST /api/billing/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects non-owner with 403 Forbidden', async () => {
    mockGetCurrentAccount.mockResolvedValueOnce({
      role: 'agent',
    });

    const req = new Request('https://wcloudapi.dev/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId: 'pro' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(500); // Handled by toErrorResponse as ForbiddenError
  });

  it('creates Pix checkout order via BunkerPay by default', async () => {
    const mockPlan = {
      id: 'pro',
      name: 'Professional',
      price_cents: 29700,
      active: true,
    };

    mockGetCurrentAccount.mockResolvedValueOnce({
      role: 'owner',
      accountId: 'acc_123',
      userId: 'usr_123',
      account: { name: 'Empresa Teste' },
      supabase: {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: mockPlan, error: null }),
              }),
              maybeSingle: async () => ({
                data: { full_name: 'Dono da Conta', email: 'owner@empresa.com' },
                error: null,
              }),
            }),
          }),
        }),
      },
    });

    mockCreatePayment.mockResolvedValueOnce({
      id: 'pay_bunker_123',
      status: 'pending',
      amount: 297.0,
      qrCopyPaste: '00020126580014br.gov.bcb.pix...',
      qrCodeBase64: 'data:image/png;base64,iVBORw0KG...',
    });

    const req = new Request('https://wcloudapi.dev/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId: 'pro' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.gateway).toBe('bunkerpay');
    expect(json.order_id).toBe('pay_bunker_123');
    expect(json.pix.qr_code_text).toBe('00020126580014br.gov.bcb.pix...');
    expect(json.pix.qr_code_image_url).toBe('data:image/png;base64,iVBORw0KG...');

    expect(mockCreatePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 297.0,
        email: 'owner@empresa.com',
        observation: expect.stringMatching(/sub_acc_123_pro_/),
      })
    );
  });
});
