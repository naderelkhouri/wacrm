import { describe, expect, it, vi, beforeEach } from 'vitest'
import { GET } from './route'
import * as encryption from '@/lib/whatsapp/encryption'
import * as metaApi from '@/lib/whatsapp/meta-api'

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

vi.mock('@/lib/whatsapp/encryption', () => ({
  decrypt: vi.fn((val) => `decrypted_${val}`),
}))

vi.mock('@/lib/whatsapp/meta-api', () => ({
  getWhatsAppHealthDetails: vi.fn(),
}))

describe('GET /api/whatsapp/health', () => {
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

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('unauth') })

    const response = await GET()
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns healthy: false if no config found', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'u1' } },
      error: null,
    })
    // profile lookup
    mockMaybeSingle.mockResolvedValueOnce({ data: { account_id: 'acc1' } })
    // config lookup
    mockMaybeSingle.mockResolvedValueOnce({ data: null })

    const response = await GET()
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.healthy).toBe(false)
    expect(json.reason).toBe('no_config')
  })

  it('returns health details when Meta API responds successfully', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'u1' } },
      error: null,
    })
    mockMaybeSingle.mockResolvedValueOnce({ data: { account_id: 'acc1' } })
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        phone_number_id: 'pn123',
        waba_id: 'waba123',
        access_token_encrypted: 'enc_tok',
        pin_encrypted: 'enc_pin',
        is_connected: true,
        updated_at: '2026-09-03T00:00:00Z',
      },
    })

    vi.mocked(metaApi.getWhatsAppHealthDetails).mockResolvedValueOnce({
      phone: {
        id: 'pn123',
        display_phone_number: '+55 11 99999-9999',
        quality_rating: 'GREEN',
        messaging_limit_tier: 'TIER_10K',
        status: 'CONNECTED',
      },
      waba: {
        id: 'waba123',
        name: 'My Business WABA',
        currency: 'BRL',
      },
      webhook: {
        isSubscribed: true,
        subscribedAppsCount: 1,
        appName: 'WACRM Cloud App',
      },
    })

    const response = await GET()
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.healthy).toBe(true)
    expect(json.health.phone.quality_rating).toBe('GREEN')
    expect(json.health.phone.messaging_limit_tier).toBe('TIER_10K')
    expect(json.health.webhook.isSubscribed).toBe(true)
  })
})
