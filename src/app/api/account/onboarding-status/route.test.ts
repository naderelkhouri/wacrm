import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentAccount: vi.fn(),
}));

vi.mock('@/lib/auth/account', () => ({
  getCurrentAccount: mocks.getCurrentAccount,
  toErrorResponse: vi.fn((err) =>
    Response.json({ error: (err as Error).message }, { status: 500 })
  ),
}));

import { GET } from './route';

describe('/api/account/onboarding-status', () => {
  beforeEach(() => {
    mocks.getCurrentAccount.mockReset();
  });

  it('calculates onboarding percentage and completed steps for a new account', async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'whatsapp_config') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { full_name: 'John Doe', avatar_url: null },
            }),
          };
        }
        if (table === 'ai_configs') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
            }),
          };
        }
        // Count queries
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          then: (resolve: any) => resolve({ count: 0 }),
        };
      }),
    };

    mocks.getCurrentAccount.mockResolvedValue({
      supabase: mockSupabase,
      accountId: 'account-123',
      userId: 'user-123',
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalCount).toBe(6);
    expect(data.completedCount).toBe(1); // Profile is completed
    expect(data.percentage).toBe(17);
    expect(data.allCompleted).toBe(false);
    expect(data.steps[0].id).toBe('whatsapp');
    expect(data.steps[0].completed).toBe(false);
    expect(data.steps[1].id).toBe('profile');
    expect(data.steps[1].completed).toBe(true);
  });
});
