import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PagSeguroClient, PagSeguroApiError } from './client';

describe('PagSeguroClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('detects when token is missing', () => {
    delete process.env.PAGSEGURO_TOKEN;
    const client = new PagSeguroClient();
    expect(client.isConfigured()).toBe(false);
  });

  it('detects when token is present', () => {
    process.env.PAGSEGURO_TOKEN = 'test_token_123';
    const client = new PagSeguroClient();
    expect(client.isConfigured()).toBe(true);
  });

  it('throws PagSeguroApiError when attempting to create order without token', async () => {
    delete process.env.PAGSEGURO_TOKEN;
    const client = new PagSeguroClient();
    await expect(
      client.createPixOrder({
        accountId: 'acc_123',
        planId: 'pro',
        planName: 'Professional',
        amountCents: 29700,
        customer: { name: 'João Silva', email: 'joao@empresa.com' },
      })
    ).rejects.toThrow(PagSeguroApiError);
  });

  it('formats payload and calls PagBank endpoint correctly', async () => {
    process.env.PAGSEGURO_TOKEN = 'valid_token_abc';
    process.env.PAGSEGURO_ENV = 'sandbox';

    const mockResponse = {
      id: 'ORDE_123456',
      reference_id: 'sub_acc_123_pro_12345',
      created_at: '2026-10-15T00:00:00Z',
      qr_codes: [
        {
          amount: { value: 29700 },
          text: '00020126580014br.gov.bcb.pix...',
          links: [
            {
              rel: 'QRCODE.PNG',
              href: 'https://sandbox.api.pagseguro.com/qrcode/123.png',
              media: 'image/png',
              type: 'GET',
            },
          ],
        },
      ],
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });
    global.fetch = fetchSpy;

    const client = new PagSeguroClient();
    const result = await client.createPixOrder({
      accountId: 'acc_123',
      planId: 'pro',
      planName: 'Professional',
      amountCents: 29700,
      customer: {
        name: 'João Silva',
        email: 'joao@empresa.com',
        taxId: '123.456.789-00',
        phone: '11988887777',
      },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://sandbox.api.pagseguro.com/orders');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer valid_token_abc');

    const body = JSON.parse(options.body);
    expect(body.customer.name).toBe('João Silva');
    expect(body.customer.tax_id).toBe('12345678900');
    expect(body.customer.phones[0].number).toBe('988887777');
    expect(body.items[0].unit_amount).toBe(29700);
    expect(result.id).toBe('ORDE_123456');
    expect(result.qr_codes?.[0].text).toContain('br.gov.bcb.pix');
  });
});
