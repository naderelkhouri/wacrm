import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  checkRateLimit: vi.fn(() => ({ success: true })),
}));

vi.mock("@/lib/auth/account", () => ({
  requireRole: mocks.requireRole,
  toErrorResponse: vi.fn((err) =>
    Response.json({ error: (err as Error).message }, { status: 500 }),
  ),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  rateLimitResponse: vi.fn(),
  RATE_LIMITS: { adminAction: { limit: 30, windowMs: 60000 } },
}));

import { POST } from "./route";

describe("POST /api/account/invitations", () => {
  beforeEach(() => {
    mocks.requireRole.mockReset();
    mocks.checkRateLimit.mockReturnValue({ success: true });
  });

  it("rejects invitation creation when allow_member_invites is false for the account", async () => {
    mocks.requireRole.mockResolvedValue({
      userId: "admin-1",
      accountId: "acc-1",
      role: "admin",
      account: {
        id: "acc-1",
        name: "Test Org",
        allow_member_invites: false,
      },
      supabase: {},
    });

    const request = new Request("http://localhost:3000/api/account/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "agent" }),
    });

    const res = await POST(request);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain("desativada para esta organização");
  });

  it("rejects invitation creation when account max_members limit is reached", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          count: 5,
          error: null,
        }),
      }),
    };

    mocks.requireRole.mockResolvedValue({
      userId: "admin-1",
      accountId: "acc-1",
      role: "admin",
      account: {
        id: "acc-1",
        name: "Test Org",
        allow_member_invites: true,
        max_members: 5,
      },
      supabase: mockSupabase,
    });

    const request = new Request("http://localhost:3000/api/account/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "agent" }),
    });

    const res = await POST(request);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain("Limite máximo de 5 membros atingido");
  });

  it("creates invitation successfully when allow_member_invites is true", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "inv-1",
            role: "agent",
            label: "Test Invite",
            expires_at: new Date(Date.now() + 86400000).toISOString(),
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    };

    mocks.requireRole.mockResolvedValue({
      userId: "admin-1",
      accountId: "acc-1",
      role: "admin",
      account: {
        id: "acc-1",
        name: "Test Org",
        allow_member_invites: true,
      },
      supabase: mockSupabase,
    });

    const request = new Request("http://localhost:3000/api/account/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "agent", label: "Test Invite" }),
    });

    const res = await POST(request);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.invitation.id).toBe("inv-1");
    expect(data.token).toBeDefined();
    expect(data.url).toBeDefined();
  });
});
