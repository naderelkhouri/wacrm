import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BunkerPayClient, BunkerPayApiError } from './client';

describe('BunkerPayClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws BunkerPayApiError when token is missing', async () => {
    delete process.env.BUNKERPAY_TOKEN;
    const client = new BunkerPayClient();

    await expect(
      client.createPayment({ amount: 50, email: 'user@example.com' })
    ).rejects.toThrow(BunkerPayApiError);
  });

  it('rejects payments below minimum R$ 5,00', async () => {
    process.env.BUNKERPAY_TOKEN = 'valid-token';
    const client = new BunkerPayClient();

    await expect(
      client.createPayment({ amount: 4.99, email: 'user@example.com' })
    ).rejects.toThrow(/mínimo permitido.*5,00/i);
  });

  it('successfully creates dynamic payment and returns QR code data', async () => {
    process.env.BUNKERPAY_TOKEN = 'test-token-123';
    process.env.BUNKERPAY_API_URL = 'https://public-api.bunkerpay.io';

    const mockResponse = {
      id: 'pay_12345',
      status: 'pending',
      amount: 147.0,
      storeId: 'store_1',
      createdAt: '2026-11-20T00:00:00.000Z',
      email: 'client@example.com',
      observation: 'sub_acc1_starter_123',
      qrCopyPaste: '00020126580014br.gov.bcb.pix...',
      qrCodeUrl: 'https://qrcode.bunkerpay.io/123.png',
      qrCodeBase64: 'data:image/png;base64,iVBORw0KGgo...',
      isPublic: true,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => mockResponse,
    });

    const client = new BunkerPayClient();
    const result = await client.createPayment({
      amount: 147.0,
      email: 'client@example.com',
      observation: 'sub_acc1_starter_123',
    });

    expect(result.id).toBe('pay_12345');
    expect(result.amount).toBe(147.0);
    expect(result.qrCopyPaste).toContain('br.gov.bcb.pix');
    expect(result.qrCodeBase64).toContain('data:image/png;base64');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://public-api.bunkerpay.io/api-public/payments',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token-123',
        }),
      })
    );
  });

  it('handles getPayment and getBalance correctly', async () => {
    process.env.BUNKERPAY_TOKEN = 'test-token-123';

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/payments/pay_123')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'pay_123', status: 'paid', amount: 99 }),
        };
      }
      if (url.includes('/balance')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ availableBalance: 1500.5, currency: 'BRL' }),
        };
      }
      return { ok: false, status: 404 };
    });

    const client = new BunkerPayClient();
    const payment = await client.getPayment('pay_123');
    expect(payment.status).toBe('paid');

    const balance = await client.getBalance();
    expect(balance.availableBalance).toBe(1500.5);
  });
});
