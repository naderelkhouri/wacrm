import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSuperAdmin: vi.fn(),
  checkRateLimit: vi.fn(() => ({ success: true })),
}));

vi.mock("@/lib/auth/super-admin", () => ({
  requireSuperAdmin: mocks.requireSuperAdmin,
}));

vi.mock("@/lib/auth/account", () => ({
  toErrorResponse: vi.fn((err) =>
    Response.json({ error: (err as Error).message }, { status: 500 }),
  ),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  rateLimitResponse: vi.fn(),
  RATE_LIMITS: { adminAction: { limit: 30, windowMs: 60000 } },
}));

import { GET, PATCH } from "./route";

describe("/api/admin/platform-settings", () => {
  const originalEnv = process.env.SIGNUP_MODE;

  beforeEach(() => {
    delete process.env.SIGNUP_MODE;
    mocks.requireSuperAdmin.mockReset();
    mocks.checkRateLimit.mockReturnValue({ success: true });
  });

  afterAll(() => {
    process.env.SIGNUP_MODE = originalEnv;
  });

  it("GET returns current signup mode for owner", async () => {
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

    mocks.requireSuperAdmin.mockResolvedValue({
      user: { id: "owner-1", email: "admin@admx.tech" },
      profile: { user_id: "owner-1", is_super_admin: true },
      supabaseAdmin: mockSupabase,
    });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.mode).toBe("invite_only");
    expect(data.lockedByEnv).toBe(false);
  });

  it("PATCH updates signup mode in database", async () => {
    const upsertFn = vi.fn().mockResolvedValue({ error: null });
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        upsert: upsertFn,
      }),
    };

    mocks.requireSuperAdmin.mockResolvedValue({
      user: { id: "owner-1", email: "admin@admx.tech" },
      profile: { user_id: "owner-1", is_super_admin: true },
      supabaseAdmin: mockSupabase,
    });

    const request = new Request("http://localhost:3000/api/admin/platform-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "closed" }),
    });

    const res = await PATCH(request);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.mode).toBe("closed");
    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "signup_mode",
        value: { mode: "closed" },
        updated_by: "owner-1",
      }),
      { onConflict: "key" },
    );
  });

  it("PATCH rejects invalid mode values", async () => {
    mocks.requireSuperAdmin.mockResolvedValue({
      user: { id: "owner-1", email: "admin@admx.tech" },
      profile: { user_id: "owner-1", is_super_admin: true },
      supabaseAdmin: {},
    });

    const request = new Request("http://localhost:3000/api/admin/platform-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "invalid_mode" }),
    });

    const res = await PATCH(request);
    expect(res.status).toBe(400);
  });

  it("PATCH rejects changes when mode is locked by environment variable", async () => {
    process.env.SIGNUP_MODE = "closed";

    mocks.requireSuperAdmin.mockResolvedValue({
      user: { id: "owner-1", email: "admin@admx.tech" },
      profile: { user_id: "owner-1", is_super_admin: true },
      supabaseAdmin: {},
    });

    const request = new Request("http://localhost:3000/api/admin/platform-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "open" }),
    });

    const res = await PATCH(request);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("SIGNUP_MODE na infraestrutura");
  });
});
