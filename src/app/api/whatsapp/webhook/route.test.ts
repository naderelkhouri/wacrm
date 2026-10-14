import { describe, expect, it, vi, beforeEach } from 'vitest'
import { GET, POST } from './route'

// Mock next/server after to run synchronously in tests
vi.mock('next/server', async () => {
  const actual = await vi.importActual('next/server')
  return {
    ...actual,
    after: (fn: () => Promise<void>) => fn(),
  }
})

// Mock encryption
vi.mock('@/lib/whatsapp/encryption', () => ({
  decrypt: (val: string) => val.replace('enc:', ''),
  encrypt: (val: string) => `enc:${val}`,
  isLegacyFormat: () => false,
}))

// Mock signature verification
const mockVerifySignature = vi.fn()
vi.mock('@/lib/whatsapp/webhook-signature', () => ({
  verifyMetaWebhookSignature: (...args: unknown[]) => mockVerifySignature(...args),
}))

// Mock flows, automations, ai-reply, webhooks
vi.mock('@/lib/flows/engine', () => ({
  dispatchInboundToFlows: vi.fn().mockResolvedValue({ consumed: false }),
}))

vi.mock('@/lib/automations/engine', () => ({
  runAutomationsForTrigger: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/ai/auto-reply', () => ({
  dispatchInboundToAiReply: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/webhooks/deliver', () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue(undefined),
}))

// Supabase mock
const mockInsert = vi.fn()
const mockSelect = vi.fn()
const mockUpdate = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockLimit = vi.fn()
const mockFrom = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}))

describe('WhatsApp Webhook Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifySignature.mockReturnValue(true)

    // Setup default fluent chain
    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    })
    mockSelect.mockReturnValue({
      eq: mockEq,
      like: vi.fn().mockReturnValue({ data: [] }),
    })
    mockEq.mockReturnValue({
      eq: mockEq,
      order: mockOrder,
      limit: mockLimit,
      select: mockSelect,
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })
    mockOrder.mockReturnValue({
      limit: mockLimit,
    })
    mockLimit.mockResolvedValue({ data: [], error: null })
    mockInsert.mockResolvedValue({ data: null, error: null })
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    })
  })

  describe('GET (Webhook verification)', () => {
    it('returns 400 when query params are missing', async () => {
      const req = new Request('http://localhost:3000/api/whatsapp/webhook')
      const res = await GET(req)
      expect(res.status).toBe(400)
    })

    it('returns challenge text when token matches', async () => {
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockResolvedValueOnce({
          data: [{ id: 'cfg1', verify_token: 'enc:my-secret-token' }],
          error: null,
        }),
      })

      const req = new Request(
        'http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.challenge=11223344&hub.verify_token=my-secret-token'
      )
      const res = await GET(req)
      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).toBe('11223344')
    })

    it('returns 403 when token mismatches', async () => {
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockResolvedValueOnce({
          data: [{ id: 'cfg1', verify_token: 'enc:different-token' }],
          error: null,
        }),
      })

      const req = new Request(
        'http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.challenge=11223344&hub.verify_token=wrong-token'
      )
      const res = await GET(req)
      expect(res.status).toBe(403)
    })
  })

  describe('POST (Replay protection and message processing)', () => {
    it('returns 401 when Meta HMAC signature is invalid', async () => {
      mockVerifySignature.mockReturnValueOnce(false)
      const req = new Request('http://localhost:3000/api/whatsapp/webhook', {
        method: 'POST',
        headers: { 'x-hub-signature-256': 'sha256=invalid' },
        body: JSON.stringify({ entry: [] }),
      })
      const res = await POST(req)
      expect(res.status).toBe(401)
    })

    it('returns 200 and ignores duplicate message (replay pre-check)', async () => {
      const payload = {
        entry: [
          {
            id: 'e1',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    phone_number_id: 'pn123',
                    display_phone_number: '123',
                  },
                  contacts: [{ profile: { name: 'Alice' }, wa_id: '5511999990000' }],
                  messages: [
                    {
                      id: 'wamid.HBg123',
                      from: '5511999990000',
                      timestamp: '1690000000',
                      type: 'text',
                      text: { body: 'Hello world' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }

      // Mock DB lookups
      mockFrom.mockImplementation((table: string) => {
        if (table === 'whatsapp_config') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'cfg1',
                    account_id: 'acc1',
                    user_id: 'user1',
                    access_token: 'enc:token',
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === 'contacts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                like: vi.fn().mockResolvedValue({
                  data: [{ id: 'ct1', phone: '+5511999990000', name: 'Alice' }],
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === 'conversations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [{ id: 'conv1', account_id: 'acc1', contact_id: 'ct1' }],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }
        }
        if (table === 'messages') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockImplementation((col: string, val: string) => {
                  if (col === 'message_id' && val === 'wamid.HBg123') {
                    // Pre-check finds an existing message row (replay scenario)
                    return {
                      limit: vi.fn().mockResolvedValue({
                        data: [{ id: 'existing-msg-uuid' }],
                        error: null,
                      }),
                    }
                  }
                  return {
                    head: vi.fn().mockResolvedValue({ count: 1, error: null }),
                  }
                }),
              }),
            }),
            insert: mockInsert,
          }
        }
        return {
          select: mockSelect,
          insert: mockInsert,
          update: mockUpdate,
        }
      })

      const req = new Request('http://localhost:3000/api/whatsapp/webhook', {
        method: 'POST',
        headers: { 'x-hub-signature-256': 'sha256=valid' },
        body: JSON.stringify(payload),
      })

      const res = await POST(req)
      expect(res.status).toBe(200)

      // Insert must NOT be called for duplicate message replay
      expect(mockInsert).not.toHaveBeenCalled()
    })

    it('handles unique violation error (code 23505) gracefully on racing duplicate', async () => {
      const payload = {
        entry: [
          {
            id: 'e1',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    phone_number_id: 'pn123',
                    display_phone_number: '123',
                  },
                  contacts: [{ profile: { name: 'Alice' }, wa_id: '5511999990000' }],
                  messages: [
                    {
                      id: 'wamid.HBgRaced123',
                      from: '5511999990000',
                      timestamp: '1690000000',
                      type: 'text',
                      text: { body: 'Raced message' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }

      mockFrom.mockImplementation((table: string) => {
        if (table === 'whatsapp_config') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'cfg1',
                    account_id: 'acc1',
                    user_id: 'user1',
                    access_token: 'enc:token',
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === 'contacts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                like: vi.fn().mockResolvedValue({
                  data: [{ id: 'ct1', phone: '+5511999990000', name: 'Alice' }],
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === 'conversations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [{ id: 'conv1', account_id: 'acc1', contact_id: 'ct1' }],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }
        }
        if (table === 'messages') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockImplementation((col: string) => {
                  if (col === 'message_id') {
                    // Pre-check saw nothing (race condition)
                    return {
                      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                    }
                  }
                  return {
                    head: vi.fn().mockResolvedValue({ count: 1, error: null }),
                  }
                }),
              }),
            }),
            // Insert rejected by unique constraint
            insert: vi.fn().mockResolvedValue({
              data: null,
              error: {
                code: '23505',
                message: 'duplicate key value violates unique constraint "idx_messages_conversation_message_id_uniq"',
              },
            }),
          }
        }
        return {
          select: mockSelect,
          insert: mockInsert,
          update: mockUpdate,
        }
      })

      const req = new Request('http://localhost:3000/api/whatsapp/webhook', {
        method: 'POST',
        headers: { 'x-hub-signature-256': 'sha256=valid' },
        body: JSON.stringify(payload),
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
    })
  })
})
