import { describe, expect, it, vi, beforeEach } from 'vitest'
import { POST } from './route'

const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
    }),
}))

describe('POST /api/whatsapp/templates/analyze-compliance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    })
  })

  it('detects single brace variable syntax error', async () => {
    const req = new Request('http://localhost:3000/api/whatsapp/templates/analyze-compliance', {
      method: 'POST',
      body: JSON.stringify({
        category: 'UTILITY',
        bodyText: 'Olá {1}, seu pedido foi enviado!',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.passed).toBe(false)
    expect(json.risks.some((r: any) => r.rule === 'META_VARIABLE_DOUBLE_BRACES')).toBe(true)
    expect(json.optimizedText).toContain('{{1}}')
  })

  it('detects promo keyword in UTILITY category and suggests MARKETING', async () => {
    const req = new Request('http://localhost:3000/api/whatsapp/templates/analyze-compliance', {
      method: 'POST',
      body: JSON.stringify({
        category: 'UTILITY',
        bodyText: 'Olá {{1}}, aproveite nosso cupom de desconto de 20%!',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.passed).toBe(false)
    expect(json.suggestedCategory).toBe('MARKETING')
  })

  it('detects banned url shorteners', async () => {
    const req = new Request('http://localhost:3000/api/whatsapp/templates/analyze-compliance', {
      method: 'POST',
      body: JSON.stringify({
        category: 'MARKETING',
        bodyText: 'Confira nossa promoção no link bit.ly/promocao123',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.risks.some((r: any) => r.rule === 'META_NO_URL_SHORTENERS')).toBe(true)
  })

  it('approves a compliant template', async () => {
    const req = new Request('http://localhost:3000/api/whatsapp/templates/analyze-compliance', {
      method: 'POST',
      body: JSON.stringify({
        category: 'UTILITY',
        bodyText: 'Olá {{1}}, seu agendamento foi confirmado para amanhã às 14h.',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.passed).toBe(true)
    expect(json.score).toBeGreaterThanOrEqual(90)
  })
})
