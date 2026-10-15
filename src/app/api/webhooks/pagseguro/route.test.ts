import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('POST /api/webhooks/pagseguro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid non-JSON body with 400', async () => {
    const req = new Request('https://wcloudapi.dev/api/webhooks/pagseguro', {
      method: 'POST',
      body: 'invalid-string-not-json',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid JSON body');
  });

  it('ignores events without valid reference_id', async () => {
    const req = new Request('https://wcloudapi.dev/api/webhooks/pagseguro', {
      method: 'POST',
      body: JSON.stringify({ id: 'ORD_123' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ignored).toBe(true);
  });

  it('enforces idempotency when transaction is already marked as PAID', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'tx_existing_1', status: 'PAID' },
    });

    const event = {
      id: 'ORDE_ABC123',
      reference_id: 'sub_acc123_pro_999999',
      charges: [
        {
          id: 'CHAR_456',
          status: 'PAID',
          amount: { value: 29700 },
        },
      ],
    };

    const req = new Request('https://wcloudapi.dev/api/webhooks/pagseguro', {
      method: 'POST',
      body: JSON.stringify(event),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.already_processed).toBe(true);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('successfully processes new PAID notification and activates subscription', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null });

    const event = {
      id: 'ORDE_ABC123',
      reference_id: 'sub_acc123_pro_999999',
      charges: [
        {
          id: 'CHAR_456',
          status: 'PAID',
          amount: { value: 29700 },
          payment_method: { type: 'PIX' },
        },
      ],
    };

    const req = new Request('https://wcloudapi.dev/api/webhooks/pagseguro', {
      method: 'POST',
      body: JSON.stringify(event),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('PAID');
    expect(json.account_id).toBe('acc123');
    expect(json.plan_id).toBe('pro');

    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const upsertArgs = mockUpsert.mock.calls[0][0];
    expect(upsertArgs.status).toBe('active');
    expect(upsertArgs.plan_id).toBe('pro');
  });
});
