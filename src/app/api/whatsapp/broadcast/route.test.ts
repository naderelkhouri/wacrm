import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let currentUser: Record<string, unknown> | null = { id: 'user-1' }
let profileRow: Record<string, unknown> | null = {
  account_id: 'acct-1',
  account_role: 'agent',
}
let configRow: Record<string, unknown> | null = {
  id: 'cfg-1',
  account_id: 'acct-1',
  phone_number_id: 'PNID-1',
  access_token: 'enc-token',
}
let templateRow: Record<string, unknown> | null = {
  id: 'tpl-1',
  account_id: 'acct-1',
  user_id: 'user-1',
  name: 'welcome_message',
  language: 'en_US',
  category: 'MARKETING',
  body_text: 'Hello {{1}}',
  status: 'APPROVED',
}

function makeSupabaseMock() {
  function builder(table: string) {
    const selectResult = () => {
      switch (table) {
        case 'profiles':
          return { data: profileRow, error: null }
        case 'whatsapp_config':
          return { data: configRow, error: null }
        case 'message_templates':
          return { data: templateRow, error: null }
        default:
          return { data: null, error: null }
      }
    }

    const b: Record<string, unknown> = {}
    const chain = () => b
    for (const m of ['select', 'eq', 'order', 'limit']) {
      b[m] = vi.fn(chain)
    }
    b.single = vi.fn(() => Promise.resolve(selectResult()))
    b.maybeSingle = vi.fn(() => Promise.resolve(selectResult()))
    b.then = (resolve: (v: unknown) => unknown) => resolve(selectResult())
    return b
  }

  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: currentUser },
        error: currentUser ? null : new Error('Unauthorized'),
      })),
    },
    from: vi.fn((table: string) => builder(table)),
  }
}

let supabaseMock = makeSupabaseMock()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => supabaseMock),
}))

const { decryptMock } = vi.hoisted(() => ({
  decryptMock: vi.fn(() => 'decrypted-token'),
}))

vi.mock('@/lib/whatsapp/encryption', () => ({
  decrypt: decryptMock,
  encrypt: vi.fn(() => 'enc-token'),
}))

const { sendTemplateMessageMock } = vi.hoisted(() => ({
  sendTemplateMessageMock: vi.fn(async () => ({ messageId: 'wamid-bcast-1' })),
}))

vi.mock('@/lib/whatsapp/meta-api', () => ({
  sendTemplateMessage: sendTemplateMessageMock,
}))

import { __resetRateLimitForTests } from '@/lib/rate-limit'

import { POST } from './route'

function postBroadcast(bodyOverrides: Record<string, unknown> = {}) {
  return POST(
    new Request('http://localhost/api/whatsapp/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipients: [{ phone: '+15551234567', params: ['John'] }],
        template_name: 'welcome_message',
        template_language: 'en_US',
        ...bodyOverrides,
      }),
    }),
  )
}

describe('POST /api/whatsapp/broadcast — role permissions and dispatch', () => {
  beforeEach(() => {
    currentUser = { id: 'user-1' }
    profileRow = { account_id: 'acct-1', account_role: 'agent' }
    configRow = {
      id: 'cfg-1',
      account_id: 'acct-1',
      phone_number_id: 'PNID-1',
      access_token: 'enc-token',
    }
    templateRow = {
      id: 'tpl-1',
      account_id: 'acct-1',
      user_id: 'user-1',
      name: 'welcome_message',
      language: 'en_US',
      category: 'MARKETING',
      body_text: 'Hello {{1}}',
      status: 'APPROVED',
    }
    supabaseMock = makeSupabaseMock()
    decryptMock.mockClear()
    sendTemplateMessageMock.mockClear()
    __resetRateLimitForTests()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated requests with 401 Unauthorized', async () => {
    currentUser = null
    const res = await postBroadcast()
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toMatch(/unauthorized/i)
    expect(decryptMock).not.toHaveBeenCalled()
    expect(sendTemplateMessageMock).not.toHaveBeenCalled()
  })

  it('rejects viewer role with 403 Forbidden without decrypting credentials or sending', async () => {
    profileRow = { account_id: 'acct-1', account_role: 'viewer' }
    const res = await postBroadcast()
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toMatch(/insufficient permissions/i)
    expect(decryptMock).not.toHaveBeenCalled()
    expect(sendTemplateMessageMock).not.toHaveBeenCalled()
  })

  it('rejects profile not linked to an account with 403 Forbidden', async () => {
    profileRow = { account_id: null, account_role: 'agent' }
    const res = await postBroadcast()
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toMatch(/not linked to an account/i)
    expect(decryptMock).not.toHaveBeenCalled()
    expect(sendTemplateMessageMock).not.toHaveBeenCalled()
  })

  it('allows agent role to dispatch broadcast', async () => {
    profileRow = { account_id: 'acct-1', account_role: 'agent' }
    const res = await postBroadcast()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.sent).toBe(1)
    expect(decryptMock).toHaveBeenCalledWith('enc-token')
    expect(sendTemplateMessageMock).toHaveBeenCalledTimes(1)
  })

  it('allows admin role to dispatch broadcast', async () => {
    profileRow = { account_id: 'acct-1', account_role: 'admin' }
    const res = await postBroadcast()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(sendTemplateMessageMock).toHaveBeenCalledTimes(1)
  })

  it('allows owner role to dispatch broadcast', async () => {
    profileRow = { account_id: 'acct-1', account_role: 'owner' }
    const res = await postBroadcast()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(sendTemplateMessageMock).toHaveBeenCalledTimes(1)
  })

  it('rejects batch size exceeding MAX_BROADCAST_BATCH_SIZE (400 Bad Request)', async () => {
    const hugeRecipients = Array.from({ length: 51 }, (_, i) => ({
      phone: `+1555000${String(i).padStart(4, '0')}`,
      params: ['Test'],
    }))
    const res = await postBroadcast({ recipients: hugeRecipients })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/batch size exceeds maximum limit/i)
    expect(sendTemplateMessageMock).not.toHaveBeenCalled()
  })

  it('rejects recipients with missing or empty phone (400 Bad Request)', async () => {
    const res = await postBroadcast({
      recipients: [{ phone: '   ', params: ['Test'] }],
    })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/missing a valid phone number/i)
    expect(sendTemplateMessageMock).not.toHaveBeenCalled()
  })
})
