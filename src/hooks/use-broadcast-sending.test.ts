import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveVariables, useBroadcastSending } from './use-broadcast-sending'
import type { Contact, MessageTemplate } from '@/types'

vi.mock('react', () => ({
  useState: <T>(initial: T) => {
    let val = initial
    const setter = vi.fn((next: T | ((prev: T) => T)) => {
      val = typeof next === 'function' ? (next as (prev: T) => T)(val) : next
    })
    return [val, setter]
  },
}))

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ accountId: 'acct-1', user: { id: 'u-1' } }),
}))

const recipientUpdates: Array<{ id: string; status: string; error_message?: string }> = []
let broadcastUpdate: Record<string, unknown> | null = null

function makeMockSupabase(contactsList: Contact[]) {
  return {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { user: { id: 'u-1' } } },
      })),
    },
    from: vi.fn((table: string) => {
      const b: Record<string, unknown> = {}
      const chain = () => b
      for (const m of ['select', 'in', 'eq', 'order']) {
        b[m] = vi.fn(chain)
      }

      b.single = vi.fn(async () => {
        if (table === 'broadcasts') {
          return { data: { id: 'bcast-1' }, error: null }
        }
        return { data: null, error: null }
      })

      b.insert = vi.fn((payload: Record<string, unknown>) => {
        return {
          select: () => ({
            single: async () => ({
              data: { id: 'bcast-1', ...(payload || {}) },
              error: null,
            }),
          }),
          then: (resolve: (res: { error: null }) => void) => resolve({ error: null }),
        }
      })

      b.update = vi.fn((payload: Record<string, unknown>) => {
        return {
          eq: vi.fn((col: string, val: string) => {
            if (table === 'broadcast_recipients' && col === 'id') {
              recipientUpdates.push({ id: val, ...(payload as { status: string; error_message?: string }) })
            }
            if (table === 'broadcasts' && col === 'id') {
              broadcastUpdate = payload
            }
            return Promise.resolve({ error: null })
          }),
        }
      })

      b.then = (resolve: (res: { data: unknown; error: null }) => void) => {
        if (table === 'contacts') {
          return resolve({ data: contactsList, error: null })
        }
        if (table === 'broadcast_recipients') {
          const recRows = contactsList.map((c, i) => ({
            id: `rec-${i}`,
            broadcast_id: 'bcast-1',
            contact_id: c.id,
            contact: c,
          }))
          return resolve({ data: recRows, error: null })
        }
        if (table === 'contact_custom_values') {
          return resolve({ data: [], error: null })
        }
        return resolve({ data: null, error: null })
      }

      return b
    }),
  }
}

let mockContacts: Contact[] = []
let mockSupabase = makeMockSupabase(mockContacts)

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}))

describe('useBroadcastSending', () => {
  beforeEach(() => {
    recipientUpdates.length = 0
    broadcastUpdate = null
    vi.restoreAllMocks()
    vi.spyOn(global, 'setTimeout').mockImplementation((cb: TimerHandler) => {
      if (typeof cb === 'function') cb()
      return 0 as unknown as NodeJS.Timeout
    })
  })

  describe('resolveVariables', () => {
    const contact: Contact = {
      id: 'c1',
      account_id: 'acct-1',
      user_id: 'u1',
      name: 'Alice',
      phone: '+15551234567',
      email: 'alice@example.com',
      company: 'Acme Corp',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    it('resolves static, built-in fields, and custom fields in numeric key order', () => {
      const customValues = new Map<string, string>([['cf-city', 'New York']])
      const variables = {
        '2': { type: 'field' as const, value: 'name' },
        '1': { type: 'static' as const, value: 'VIP' },
        '10': { type: 'custom_field' as const, value: 'cf-city' },
        '3': { type: 'field' as const, value: 'company' },
      }

      const resolved = resolveVariables(variables, contact, customValues)
      // Sorted numerically: "1", "2", "3", "10"
      expect(resolved).toEqual(['VIP', 'Alice', 'Acme Corp', 'New York'])
    })
  })

  describe('createAndSendBroadcast 429 rate limit retry flow', () => {
    it('handles 60 recipients (6 batches) where batch 6 encounters 429, pauses and retries successfully', async () => {
      mockContacts = Array.from({ length: 60 }, (_, i) => ({
        id: `contact-${i}`,
        account_id: 'acct-1',
        user_id: 'u-1',
        phone: `+1555000${String(i).padStart(4, '0')}`,
        name: `Contact ${i}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))
      mockSupabase = makeMockSupabase(mockContacts)

      let fetchCallCount = 0
      const fetchHistory: Array<{ call: number; recipientsCount: number }> = []

      // Batches 1 to 5 (i=0, 10, 20, 30, 40) succeed.
      // Batch 6 (i=50) gets 429 on first attempt with Retry-After: 1, then succeeds on retry.
      global.fetch = vi.fn(async (_url: RequestInfo | URL, options?: RequestInit) => {
        fetchCallCount++
        const body = JSON.parse((options?.body as string) || '{}')
        fetchHistory.push({ call: fetchCallCount, recipientsCount: body.recipients.length })

        if (fetchCallCount === 6) {
          // 6th batch 1st attempt: Rate limit exceeded!
          return {
            ok: false,
            status: 429,
            headers: new Headers({ 'Retry-After': '1' }),
            json: async () => ({ error: 'Rate limit exceeded', retry_after_seconds: 1 }),
            clone() {
              return this
            },
          } as Response
        }

        // Return successful batch result
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            total: body.recipients.length,
            results: (body.recipients as Array<{ phone: string }>).map((r) => ({
              phone: r.phone,
              status: 'sent',
              whatsapp_message_id: `wamid-${r.phone}`,
            })),
          }),
        } as unknown as Response
      })

      const { createAndSendBroadcast } = useBroadcastSending()

      const template: MessageTemplate = {
        id: 'tpl-1',
        user_id: 'u-1',
        name: 'promo_alert',
        language: 'en_US',
        category: 'Marketing',
        body_text: 'Promo text',
        status: 'APPROVED',
        created_at: new Date().toISOString(),
      }

      const bcastId = await createAndSendBroadcast({
        name: 'Test 60 campaign',
        template,
        audience: { type: 'all' },
        variables: {},
      })

      expect(bcastId).toBe('bcast-1')

      // Exactly 7 fetch calls: 5 batches + 1 rate-limited attempt + 1 successful retry of batch 6
      expect(fetchCallCount).toBe(7)

      // All 60 recipients were marked as sent, none as failed
      const sentUpdates = recipientUpdates.filter((u) => u.status === 'sent')
      const failedUpdates = recipientUpdates.filter((u) => u.status === 'failed')

      expect(sentUpdates.length).toBe(60)
      expect(failedUpdates.length).toBe(0)
      expect(broadcastUpdate).toEqual({ status: 'sent' })
    })

    it('marks batch as failed when 429 retries are completely exhausted', async () => {
      mockContacts = Array.from({ length: 10 }, (_, i) => ({
        id: `c-${i}`,
        account_id: 'acct-1',
        user_id: 'u-1',
        phone: `+1555111${String(i).padStart(4, '0')}`,
        name: `Contact ${i}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))
      mockSupabase = makeMockSupabase(mockContacts)

      // Persistent 429
      global.fetch = vi.fn(async () => ({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '1' }),
        json: async () => ({ error: 'Rate limit exceeded', retry_after_seconds: 1 }),
        clone() {
          return this
        },
      } as unknown as Response))

      const { createAndSendBroadcast } = useBroadcastSending()

      const template: MessageTemplate = {
        id: 'tpl-1',
        user_id: 'u-1',
        name: 'promo_alert',
        language: 'en_US',
        category: 'Marketing',
        body_text: 'Promo text',
        status: 'APPROVED',
        created_at: new Date().toISOString(),
      }

      await createAndSendBroadcast({
        name: 'Retry exhaust test',
        template,
        audience: { type: 'all' },
        variables: {},
      })

      // Batch marked failed after exhausting all retry attempts
      expect(recipientUpdates.length).toBe(10)
      expect(recipientUpdates.every((u) => u.status === 'failed')).toBe(true)
      expect(broadcastUpdate).toEqual({ status: 'failed' })
    })

    it('handles non-429 network errors without waiting for rate limit countdown', async () => {
      mockContacts = [
        {
          id: 'c-1',
          account_id: 'acct-1',
          user_id: 'u-1',
          phone: '+15552223333',
          name: 'Contact Fail',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]
      mockSupabase = makeMockSupabase(mockContacts)

      // Network 500
      global.fetch = vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
        clone() {
          return this
        },
      } as unknown as Response))

      const { createAndSendBroadcast } = useBroadcastSending()

      const template: MessageTemplate = {
        id: 'tpl-1',
        user_id: 'u-1',
        name: 'promo_alert',
        language: 'en_US',
        category: 'Marketing',
        body_text: 'Promo text',
        status: 'APPROVED',
        created_at: new Date().toISOString(),
      }

      await createAndSendBroadcast({
        name: 'Server error test',
        template,
        audience: { type: 'all' },
        variables: {},
      })

      expect(recipientUpdates).toHaveLength(1)
      expect(recipientUpdates[0].status).toBe('failed')
      expect(recipientUpdates[0].error_message).toBe('Internal server error')
    })
  })
})
