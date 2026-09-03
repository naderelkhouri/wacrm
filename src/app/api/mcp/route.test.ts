import { describe, expect, it, vi, beforeEach } from 'vitest'
import { GET, POST } from './route'
import * as keysStore from '@/lib/api-keys/store'
import * as keysGen from '@/lib/api-keys/keys'

const mockGetUser = vi.fn()
const mockMaybeSingle = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    }),
}))

vi.mock('@/lib/flows/admin-client', () => ({
  supabaseAdmin: () => ({
    from: mockFrom,
  }),
}))

vi.mock('@/lib/api-keys/store', () => ({
  findActiveKeyByHash: vi.fn(),
  touchLastUsed: vi.fn(),
}))

vi.mock('@/lib/api-keys/keys', () => ({
  looksLikeApiKey: vi.fn((k) => k.startsWith('wacrm_live_')),
  hashApiKey: vi.fn((k) => `hash_${k}`),
}))

describe('WACRM MCP Server (/api/mcp)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({
      select: mockSelect,
    })
    mockSelect.mockReturnValue({
      eq: mockEq,
    })
    mockEq.mockReturnValue({
      maybeSingle: mockMaybeSingle,
    })
  })

  it('GET /api/mcp returns discovery metadata', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.name).toBe('wacrm-mcp-server')
    expect(json.toolsCount).toBeGreaterThan(5)
    expect(Array.isArray(json.tools)).toBe(true)
  })

  it('POST /api/mcp returns 401 when no auth provided', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const req = new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('POST /api/mcp handles initialize method with valid API key', async () => {
    vi.mocked(keysStore.findActiveKeyByHash).mockResolvedValueOnce({
      id: 'k1',
      account_id: 'acc123',
      created_by: 'u1',
    } as any)

    const req = new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: {
        authorization: 'Bearer wacrm_live_testkey123',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.result.serverInfo.name).toBe('wacrm-mcp-server')
    expect(json.result.protocolVersion).toBe('2024-11-05')
  })

  it('POST /api/mcp lists tools on tools/list', async () => {
    vi.mocked(keysStore.findActiveKeyByHash).mockResolvedValueOnce({
      id: 'k1',
      account_id: 'acc123',
      created_by: 'u1',
    } as any)

    const req = new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: {
        authorization: 'Bearer wacrm_live_testkey123',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json.result.tools)).toBe(true)
    const toolNames = json.result.tools.map((t: any) => t.name)
    expect(toolNames).toContain('wacrm_get_overview')
    expect(toolNames).toContain('wacrm_search_contacts')
    expect(toolNames).toContain('wacrm_send_whatsapp_message')
  })
})
