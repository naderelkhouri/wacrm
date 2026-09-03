import { describe, expect, it, vi, beforeEach } from 'vitest'
import { POST } from './route'

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

describe('POST /api/whatsapp/webhook/simulate', () => {
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

    // Mock global fetch for internal webhook call
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      text: () => Promise.resolve('EVENT_RECEIVED'),
    } as any)
  })

  it('returns 401 when user is unauthorized', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('unauth') })
    const req = new Request('http://localhost:3000/api/whatsapp/webhook/simulate', {
      method: 'POST',
      body: JSON.stringify({ type: 'text', text: 'Hello' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('simulates text message webhook successfully', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'u1' } },
      error: null,
    })
    // profile lookup
    mockMaybeSingle.mockResolvedValueOnce({ data: { account_id: 'acc1' } })
    // config lookup
    mockMaybeSingle.mockResolvedValueOnce({
      data: { phone_number_id: 'pn123', waba_id: 'waba123' },
    })

    const req = new Request('http://localhost:3000/api/whatsapp/webhook/simulate', {
      method: 'POST',
      body: JSON.stringify({
        type: 'text',
        fromPhone: '5511988887777',
        customerName: 'Cliente Teste',
        text: 'Olá, simulação de webhook!',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.simulatedMessageId).toContain('wamid.simulated_')
    expect(json.payload.entry[0].changes[0].value.messages[0].text.body).toBe('Olá, simulação de webhook!')
  })
})
