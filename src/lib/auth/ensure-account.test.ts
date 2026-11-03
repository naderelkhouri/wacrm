import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensureAccountForUser } from './ensure-account';

// Mock supabaseAdmin
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();

const mockFrom = vi.fn((table: string) => {
  return {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    eq: mockEq,
  };
});

vi.mock('@/lib/flows/admin-client', () => ({
  supabaseAdmin: () => ({
    from: mockFrom,
  }),
}));

describe('ensureAccountForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
      single: mockSingle,
    });
    mockEq.mockReturnValue({
      maybeSingle: mockMaybeSingle,
      single: mockSingle,
      select: mockSelect,
    });
    mockInsert.mockReturnValue({
      select: mockSelect,
    });
    mockUpdate.mockReturnValue({
      eq: mockEq,
    });
  });

  it('returns existing accountId if profile and account exist', async () => {
    // 1. Profile lookup returns existing profile with account_id
    mockMaybeSingle
      .mockResolvedValueOnce({
        data: {
          id: 'prof-1',
          user_id: 'user-1',
          email: 'test@example.com',
          account_id: 'acc-1',
          account_role: 'owner',
        },
        error: null,
      })
      // 2. Account verification lookup returns the account
      .mockResolvedValueOnce({
        data: { id: 'acc-1', name: 'Test' },
        error: null,
      });

    const res = await ensureAccountForUser({
      id: 'user-1',
      email: 'test@example.com',
    });

    expect(res).toEqual({
      accountId: 'acc-1',
      accountRole: 'owner',
      isNewAccount: false,
      isNewProfile: false,
    });
  });

  it('creates an account and updates profile if profile exists without account_id', async () => {
    // 1. Profile lookup returns profile with null account_id
    mockMaybeSingle
      .mockResolvedValueOnce({
        data: {
          id: 'prof-1',
          user_id: 'user-1',
          email: 'test@example.com',
          account_id: null,
        },
        error: null,
      })
      // 2. Owned account lookup returns null
      .mockResolvedValueOnce({
        data: null,
        error: null,
      });

    // 3. New account insertion returns new account
    mockSingle.mockResolvedValueOnce({
      data: { id: 'new-acc-1' },
      error: null,
    });

    const res = await ensureAccountForUser({
      id: 'user-1',
      email: 'test@example.com',
      user_metadata: { full_name: 'Test User' },
    });

    expect(res).toEqual({
      accountId: 'new-acc-1',
      accountRole: 'owner',
      isNewAccount: true,
      isNewProfile: false,
    });
    expect(mockUpdate).toHaveBeenCalled();
  });
});
