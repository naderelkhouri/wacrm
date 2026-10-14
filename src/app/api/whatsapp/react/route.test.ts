import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let currentUser: Record<string, unknown> | null = { id: 'user-1' }
let profileRow: Record<string, unknown> | null = {
  account_id: 'acct-1',
  account_role: 'agent',
}
let messageRow: Record<string, unknown> | null = {
  id: 'msg-1',
  message_id: 'wamid-123',
  conversation_id: 'conv-1',
}
let conversationRow: Record<string, unknown> | null = {
  id: 'conv-1',
  account_id: 'acct-1',
  contact: { phone: '+15551234567' },
}
let configRow: Record<string, unknown> | null = {
  id: 'cfg-1',
  account_id: 'acct-1',
  phone_number_id: 'PNID-1',
  access_token: 'enc-token',
}

function makeSupabaseMock() {
  function builder(table: string) {
    const selectResult = () => {
      switch (table) {
        case 'profiles':
          return { data: profileRow, error: null }
        case 'messages':
          return { data: messageRow, error: null }
        case 'conversations':
          return { data: conversationRow, error: null }
        case 'whatsapp_config':
          return { data: configRow, error: null }
        default:
          return { data: null, error: null }
      }
    }

    const b: Record<string, unknown> = {}
    const chain = () => b
    for (const m of ['select', 'eq', 'order', 'limit', 'upsert', 'delete']) {
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

const { sendReactionMessageMock } = vi.hoisted(() => ({
  sendReactionMessageMock: vi.fn(async () => ({ messageId: 'wamid-react-1' })),
}))

vi.mock('@/lib/whatsapp/meta-api', () => ({
  sendReactionMessage: sendReactionMessageMock,
}))

import { POST } from './route'

function postReaction(bodyOverrides: Record<string, unknown> = {}) {
  return POST(
    new Request('http://localhost/api/whatsapp/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message_id: 'msg-1',
        emoji: '👍',
        ...bodyOverrides,
      }),
    }),
  )
}

describe('POST /api/whatsapp/react — role permissions and reaction dispatch', () => {
  beforeEach(() => {
    currentUser = { id: 'user-1' }
    profileRow = { account_id: 'acct-1', account_role: 'agent' }
    messageRow = {
      id: 'msg-1',
      message_id: 'wamid-123',
      conversation_id: 'conv-1',
    }
    conversationRow = {
      id: 'conv-1',
      account_id: 'acct-1',
      contact: { phone: '+15551234567' },
    }
    configRow = {
      id: 'cfg-1',
      account_id: 'acct-1',
      phone_number_id: 'PNID-1',
      access_token: 'enc-token',
    }
    supabaseMock = makeSupabaseMock()
    decryptMock.mockClear()
    sendReactionMessageMock.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated requests with 401 Unauthorized', async () => {
    currentUser = null
    const res = await postReaction()
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toMatch(/unauthorized/i)
    expect(sendReactionMessageMock).not.toHaveBeenCalled()
  })

  it('rejects viewer role with 403 Forbidden without calling Meta API', async () => {
    profileRow = { account_id: 'acct-1', account_role: 'viewer' }
    const res = await postReaction()
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toMatch(/insufficient permissions/i)
    expect(sendReactionMessageMock).not.toHaveBeenCalled()
  })

  it('rejects profile not linked to an account with 403 Forbidden', async () => {
    profileRow = { account_id: null, account_role: 'agent' }
    const res = await postReaction()
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toMatch(/not linked to an account/i)
    expect(sendReactionMessageMock).not.toHaveBeenCalled()
  })

  it('allows agent role to send reaction', async () => {
    profileRow = { account_id: 'acct-1', account_role: 'agent' }
    const res = await postReaction()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(sendReactionMessageMock).toHaveBeenCalledTimes(1)
  })

  it('allows admin role to send reaction', async () => {
    profileRow = { account_id: 'acct-1', account_role: 'admin' }
    const res = await postReaction()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(sendReactionMessageMock).toHaveBeenCalledTimes(1)
  })

  it('allows owner role to send reaction', async () => {
    profileRow = { account_id: 'acct-1', account_role: 'owner' }
    const res = await postReaction()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(sendReactionMessageMock).toHaveBeenCalledTimes(1)
  })
})
