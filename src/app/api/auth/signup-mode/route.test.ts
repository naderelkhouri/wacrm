import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  checkRateLimit: vi.fn(() => ({ success: true })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  rateLimitResponse: vi.fn(),
  RATE_LIMITS: { general: { limit: 100, windowMs: 60000 } },
}));

import { GET } from "./route";

describe("GET /api/auth/signup-mode", () => {
  const originalEnv = process.env.SIGNUP_MODE;
  const originalPublicEnv = process.env.NEXT_PUBLIC_SIGNUP_MODE;

  beforeEach(() => {
    delete process.env.SIGNUP_MODE;
    delete process.env.NEXT_PUBLIC_SIGNUP_MODE;
    mocks.createClient.mockReset();
    mocks.checkRateLimit.mockReturnValue({ success: true });
  });

  afterAll(() => {
    process.env.SIGNUP_MODE = originalEnv;
    process.env.NEXT_PUBLIC_SIGNUP_MODE = originalPublicEnv;
  });

  it("returns database signup_mode when no env variable is set", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { value: { mode: "invite_only" } },
          error: null,
        }),
      }),
    };
    mocks.createClient.mockResolvedValue(mockSupabase);

    const request = new Request("http://localhost:3000/api/auth/signup-mode");
    const res = await GET(request);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.mode).toBe("invite_only");
    expect(data.source).toBe("database");
    expect(data.lockedByEnv).toBe(false);
  });

  it("prioritizes environment variable when SIGNUP_MODE is set", async () => {
    process.env.SIGNUP_MODE = "closed";

    const request = new Request("http://localhost:3000/api/auth/signup-mode");
    const res = await GET(request);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.mode).toBe("closed");
    expect(data.source).toBe("env");
    expect(data.lockedByEnv).toBe(true);
  });

  it("validates invite token when provided in query parameters", async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "platform_settings") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { value: { mode: "invite_only" } },
              error: null,
            }),
          };
        }
        if (table === "account_invitations") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                role: "agent",
                expires_at: new Date(Date.now() + 86400000).toISOString(),
                accepted_at: null,
              },
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    };
    mocks.createClient.mockResolvedValue(mockSupabase);

    const request = new Request("http://localhost:3000/api/auth/signup-mode?invite=valid-token");
    const res = await GET(request);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.mode).toBe("invite_only");
    expect(data.invite?.valid).toBe(true);
    expect(data.invite?.role).toBe("agent");
  });
});
