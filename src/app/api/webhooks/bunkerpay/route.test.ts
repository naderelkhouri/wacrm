import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { POST } from './route';

const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});
const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockMaybeSingle = vi.fn();

const mockFrom = vi.fn((table: string) => {
  if (table === 'payment_transactions') {
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: mockMaybeSingle,
        }),
      }),
      insert: mockInsert,
      update: mockUpdate,
    };
  }
  if (table === 'subscription_plans') {
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'pro', max_members: 10, monthly_messages_quota: 25000 },
          }),
        }),
      }),
    };
  }
  if (table === 'account_subscriptions') {
    return {
      upsert: mockUpsert,
    };
  }
  if (table === 'accounts') {
    return {
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    };
  }
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ error: null }),
  };
});

vi.mock('@/lib/flows/admin-client', () => ({
  supabaseAdmin: () => ({
    from: mockFrom,
  }),
}));

describe('POST /api/webhooks/bunkerpay', () => {
  const SECRET = 'test_webhook_secret_123';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BUNKERPAY_WEBHOOK_SECRET = SECRET;
  });

  function signRequest(body: string, timestampSeconds: number, secret = SECRET) {
    const signedPayload = `${timestampSeconds}.${body}`;
    return createHmac('sha256', secret).update(signedPayload).digest('hex');
  }

  it('rejects invalid JSON body with 400 Bad Request', async () => {
    const req = new Request('https://wcloudapi.dev/api/webhooks/bunkerpay', {
      method: 'POST',
      body: 'invalid-json',
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects requests missing signature headers with 401', async () => {
    const body = JSON.stringify({ id: 'pay_123' });
    const req = new Request('https://wcloudapi.dev/api/webhooks/bunkerpay', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects timestamp outside acceptable window (replay protection) with 401', async () => {
    const body = JSON.stringify({ id: 'pay_123' });
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
    const sig = signRequest(body, oldTimestamp);

    const req = new Request('https://wcloudapi.dev/api/webhooks/bunkerpay', {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': sig,
        'x-webhook-timestamp': String(oldTimestamp),
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/expired|acceptable window/i);
  });

  it('rejects invalid signature mismatch with 401', async () => {
    const body = JSON.stringify({ id: 'pay_123' });
    const now = Math.floor(Date.now() / 1000);
    const badSig = signRequest(body, now, 'wrong-secret');

    const req = new Request('https://wcloudapi.dev/api/webhooks/bunkerpay', {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': badSig,
        'x-webhook-timestamp': String(now),
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/signature mismatch/i);
  });

  it('ignores events without valid subscription observation reference', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      event: 'payment.created',
      payment: {
        id: 'pay_999',
        status: 'pending',
        amount: 50.0,
        observation: 'Venda de produto avulso',
      },
    };
    const body = JSON.stringify(payload);
    const sig = signRequest(body, now);

    const req = new Request('https://wcloudapi.dev/api/webhooks/bunkerpay', {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': sig,
        'x-webhook-timestamp': String(now),
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ignored).toBe(true);
  });

  it('enforces idempotency when transaction is already marked as PAID', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'tx_123', status: 'PAID' },
    });

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      event: 'payment.status_changed',
      payment: {
        id: 'pay_001',
        status: 'approved',
        amount: 297.0,
        observation: 'sub_acc123_pro_1700000000',
      },
    };
    const body = JSON.stringify(payload);
    const sig = signRequest(body, now);

    const req = new Request('https://wcloudapi.dev/api/webhooks/bunkerpay', {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': sig,
        'x-webhook-timestamp': String(now),
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.already_processed).toBe(true);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('successfully processes approved payment and activates subscription', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null }); // No previous transaction

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      event: 'payment.status_changed',
      payment: {
        id: 'pay_abc123',
        status: 'approved',
        amount: 297.0,
        liquidValue: 293.0,
        feeAmount: 4.0,
        storeId: 'store_xyz',
        observation: 'Assinatura Plano Pro - sub_acc123_pro_1700000000',
      },
    };
    const body = JSON.stringify(payload);
    const sig = signRequest(body, now);

    const req = new Request('https://wcloudapi.dev/api/webhooks/bunkerpay', {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': sig,
        'x-webhook-timestamp': String(now),
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.paid).toBe(true);

    // Verify transaction insert
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: 'acc123',
        gateway: 'bunkerpay',
        gateway_reference_id: 'pay_abc123',
        amount_cents: 29700,
        status: 'PAID',
      })
    );

    // Verify subscription upsert
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: 'acc123',
        plan_id: 'pro',
        status: 'active',
        payment_method: 'pix',
      }),
      { onConflict: 'account_id' }
    );
  });
});
