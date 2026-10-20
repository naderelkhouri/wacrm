import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireSuperAdmin: vi.fn(),
}));

vi.mock('@/lib/auth/super-admin', () => ({
  requireSuperAdmin: mocks.requireSuperAdmin,
}));

vi.mock('@/lib/auth/account', () => ({
  toErrorResponse: vi.fn((err) =>
    Response.json({ error: (err as Error).message }, { status: 401 })
  ),
}));

import { GET } from './route';
import { POST as executePOST } from './actions/execute/route';
import { POST as applyPOST } from './recommendations/apply/route';

describe('/api/admin/telemetry APIs', () => {
  beforeEach(() => {
    mocks.requireSuperAdmin.mockReset();
  });

  it('GET /api/admin/telemetry returns snapshot, anomalies and recommendations for super admin', async () => {
    mocks.requireSuperAdmin.mockResolvedValue({
      user: { id: 'usr-admin-1', email: 'admin@admx.tech' },
      profile: { user_id: 'usr-admin-1', is_super_admin: true },
    });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty('snapshot');
    expect(json.data).toHaveProperty('anomalies');
    expect(json.data).toHaveProperty('recommendations');
    expect(json.data.snapshot).toHaveProperty('health_index');
  });

  it('GET /api/admin/telemetry returns 401 when not super admin', async () => {
    mocks.requireSuperAdmin.mockRejectedValue(new Error('Sessão expirada ou não autenticada.'));

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toContain('não autenticada');
  });

  it('POST /api/admin/telemetry/actions/execute triggers self-healing action successfully', async () => {
    mocks.requireSuperAdmin.mockResolvedValue({
      user: { id: 'usr-admin-1', email: 'admin@admx.tech' },
      profile: { user_id: 'usr-admin-1', is_super_admin: true },
    });

    const req = new Request('http://localhost/api/admin/telemetry/actions/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_type: 'purge_ephemeral_cache' }),
    });

    const res = await executePOST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.action_type).toBe('purge_ephemeral_cache');
    expect(json.data.status).toBe('succeeded');
  });

  it('POST /api/admin/telemetry/actions/execute rejects invalid action type', async () => {
    mocks.requireSuperAdmin.mockResolvedValue({
      user: { id: 'usr-admin-1', email: 'admin@admx.tech' },
      profile: { user_id: 'usr-admin-1', is_super_admin: true },
    });

    const req = new Request('http://localhost/api/admin/telemetry/actions/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_type: 'invalid_action_xyz' }),
    });

    const res = await executePOST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain('Ação inválida');
  });

  it('POST /api/admin/telemetry/recommendations/apply applies optimization suggestion', async () => {
    mocks.requireSuperAdmin.mockResolvedValue({
      user: { id: 'usr-admin-1', email: 'admin@admx.tech' },
      profile: { user_id: 'usr-admin-1', is_super_admin: true },
    });

    const req = new Request('http://localhost/api/admin/telemetry/recommendations/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recommendation_id: 'rec_meta_template_cache' }),
    });

    const res = await applyPOST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.status).toBe('applied');
  });
});
