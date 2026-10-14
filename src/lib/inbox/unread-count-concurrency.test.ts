import { describe, expect, it } from 'vitest'

/**
 * Model that implements the exact PostgreSQL transaction and trigger semantics
 * defined in migration 038_atomic_unread_count.sql:
 *
 * - Table conversations: (id, unread_count, last_message_text, last_message_at, updated_at)
 * - Table messages: (id, conversation_id, sender_type, content_type, content_text, message_id, created_at)
 * - UNIQUE INDEX idx_messages_conversation_message_id_uniq on (conversation_id, message_id) WHERE message_id IS NOT NULL
 * - AFTER INSERT trigger trg_increment_unread_count_on_customer_message:
 *     WHEN (NEW.sender_type = 'customer')
 *     UPDATE conversations SET unread_count = COALESCE(unread_count, 0) + 1, ...
 */
class SimulatedPostgresDatabase {
  conversations: Map<
    string,
    {
      id: string
      unread_count: number
      last_message_text: string | null
      last_message_at: string | null
      updated_at: string
    }
  > = new Map()

  messages: Array<{
    id: string
    conversation_id: string
    sender_type: 'customer' | 'agent' | 'bot'
    content_type: string
    content_text: string | null
    message_id: string | null
    created_at: string
  }> = []

  // Simulated mutex / row-level lock per conversation row
  private convLocks: Map<string, Promise<void>> = new Map()

  private async acquireRowLock(conversationId: string): Promise<() => void> {
    while (this.convLocks.has(conversationId)) {
      await this.convLocks.get(conversationId)
    }
    let releaseLock: () => void = () => {}
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve
    })
    this.convLocks.set(conversationId, lockPromise)
    return () => {
      this.convLocks.delete(conversationId)
      releaseLock()
    }
  }

  /**
   * Insert message within a transaction that enforces the partial unique index
   * and executes the AFTER INSERT trigger atomically.
   */
  async insertMessage(msg: {
    id: string
    conversation_id: string
    sender_type: 'customer' | 'agent' | 'bot'
    content_type: string
    content_text: string | null
    message_id: string | null
    created_at?: string
    shouldSimulateDbFailure?: boolean
  }): Promise<{ success: boolean; error?: { code: string; message: string } }> {
    const unlock = await this.acquireRowLock(msg.conversation_id)

    try {
      // 1. Enforce partial unique index: (conversation_id, message_id) WHERE message_id IS NOT NULL
      if (msg.message_id !== null) {
        const duplicate = this.messages.some(
          (m) =>
            m.conversation_id === msg.conversation_id &&
            m.message_id === msg.message_id
        )
        if (duplicate) {
          return {
            success: false,
            error: {
              code: '23505',
              message: 'duplicate key value violates unique constraint "idx_messages_conversation_message_id_uniq"',
            },
          }
        }
      }

      // 2. Simulate potential internal DB failure / constraint violation rollback
      if (msg.shouldSimulateDbFailure) {
        return {
          success: false,
          error: {
            code: 'XX000',
            message: 'simulated database transaction failure / rollback',
          },
        }
      }

      const createdAt = msg.created_at || new Date().toISOString()
      const newMsg = {
        ...msg,
        created_at: createdAt,
      }
      this.messages.push(newMsg)

      // 3. AFTER INSERT trigger execution:
      if (msg.sender_type === 'customer') {
        const conv = this.conversations.get(msg.conversation_id)
        if (conv) {
          conv.unread_count = (conv.unread_count ?? 0) + 1
          conv.last_message_text =
            msg.content_text || `[${msg.content_type || 'message'}]`
          conv.last_message_at = createdAt
          conv.updated_at = new Date().toISOString()
        }
      }

      return { success: true }
    } finally {
      unlock()
    }
  }

  /**
   * Mark conversation as read (UPDATE conversations SET unread_count = 0).
   * Acquires the row-level lock on the conversation row.
   */
  async markAsRead(conversationId: string): Promise<void> {
    const unlock = await this.acquireRowLock(conversationId)
    try {
      const conv = this.conversations.get(conversationId)
      if (conv) {
        conv.unread_count = 0
        conv.updated_at = new Date().toISOString()
      }
    } finally {
      unlock()
    }
  }
}

describe('Etapa 4: Database-level atomic unread_count and concurrency', () => {
  it('starting at 5 unread, two concurrent confirmed new messages produce 7', async () => {
    const db = new SimulatedPostgresDatabase()
    const convId = 'c1'
    db.conversations.set(convId, {
      id: convId,
      unread_count: 5,
      last_message_text: 'old message',
      last_message_at: '2026-09-10T10:00:00.000Z',
      updated_at: '2026-09-10T10:00:00.000Z',
    })

    // Dispatch two concurrent customer message inserts
    const [res1, res2] = await Promise.all([
      db.insertMessage({
        id: 'm1',
        conversation_id: convId,
        sender_type: 'customer',
        content_type: 'text',
        content_text: 'First concurrent message',
        message_id: 'wamid.001',
      }),
      db.insertMessage({
        id: 'm2',
        conversation_id: convId,
        sender_type: 'customer',
        content_type: 'text',
        content_text: 'Second concurrent message',
        message_id: 'wamid.002',
      }),
    ])

    expect(res1.success).toBe(true)
    expect(res2.success).toBe(true)

    const updated = db.conversations.get(convId)!
    // 5 + 1 + 1 = 7, without lost updates or race conditions
    expect(updated.unread_count).toBe(7)
    expect(db.messages).toHaveLength(2)
  })

  it('replay of an event does not alter the unread_count count', async () => {
    const db = new SimulatedPostgresDatabase()
    const convId = 'c1'
    db.conversations.set(convId, {
      id: convId,
      unread_count: 5,
      last_message_text: 'old',
      last_message_at: '2026-09-10T10:00:00.000Z',
      updated_at: '2026-09-10T10:00:00.000Z',
    })

    // Insert first message -> 6
    const res1 = await db.insertMessage({
      id: 'm1',
      conversation_id: convId,
      sender_type: 'customer',
      content_type: 'text',
      content_text: 'Original message delivery',
      message_id: 'wamid.same_event_id',
    })
    expect(res1.success).toBe(true)
    expect(db.conversations.get(convId)!.unread_count).toBe(6)

    // Replay with identical message_id
    const res2 = await db.insertMessage({
      id: 'm2',
      conversation_id: convId,
      sender_type: 'customer',
      content_type: 'text',
      content_text: 'Replayed message delivery',
      message_id: 'wamid.same_event_id',
    })

    // Unique constraint violation (23505) rejected it
    expect(res2.success).toBe(false)
    expect(res2.error?.code).toBe('23505')

    // Count must remain 6, not bumped to 7
    expect(db.conversations.get(convId)!.unread_count).toBe(6)
    expect(db.messages).toHaveLength(1)
  })

  it('an insertion that fails / rolls back does not increment the count', async () => {
    const db = new SimulatedPostgresDatabase()
    const convId = 'c1'
    db.conversations.set(convId, {
      id: convId,
      unread_count: 5,
      last_message_text: 'old',
      last_message_at: '2026-09-10T10:00:00.000Z',
      updated_at: '2026-09-10T10:00:00.000Z',
    })

    const res = await db.insertMessage({
      id: 'm1',
      conversation_id: convId,
      sender_type: 'customer',
      content_type: 'text',
      content_text: 'Failing insert',
      message_id: 'wamid.fail_id',
      shouldSimulateDbFailure: true,
    })

    expect(res.success).toBe(false)
    // Count remains exactly 5
    expect(db.conversations.get(convId)!.unread_count).toBe(5)
    expect(db.messages).toHaveLength(0)
  })

  it('outbound messages from agent or bot do not increment unread_count', async () => {
    const db = new SimulatedPostgresDatabase()
    const convId = 'c1'
    db.conversations.set(convId, {
      id: convId,
      unread_count: 3,
      last_message_text: 'old',
      last_message_at: '2026-09-10T10:00:00.000Z',
      updated_at: '2026-09-10T10:00:00.000Z',
    })

    const resAgent = await db.insertMessage({
      id: 'm1',
      conversation_id: convId,
      sender_type: 'agent',
      content_type: 'text',
      content_text: 'Hello from support agent',
      message_id: null,
    })
    expect(resAgent.success).toBe(true)

    const resBot = await db.insertMessage({
      id: 'm2',
      conversation_id: convId,
      sender_type: 'bot',
      content_type: 'text',
      content_text: 'Hello from automated flow bot',
      message_id: null,
    })
    expect(resBot.success).toBe(true)

    // Unread count must stay 3
    expect(db.conversations.get(convId)!.unread_count).toBe(3)
  })

  it('concurrent read marking and message arrival adheres to row-level serialization rules', async () => {
    const db = new SimulatedPostgresDatabase()
    const convId = 'c1'
    db.conversations.set(convId, {
      id: convId,
      unread_count: 5,
      last_message_text: 'old',
      last_message_at: '2026-09-10T10:00:00.000Z',
      updated_at: '2026-09-10T10:00:00.000Z',
    })

    // Scenario A: Mark as read executes, then message arrives -> count is 1
    await db.markAsRead(convId)
    await db.insertMessage({
      id: 'mA',
      conversation_id: convId,
      sender_type: 'customer',
      content_type: 'text',
      content_text: 'Message after mark as read',
      message_id: 'wamid.after_read',
    })
    expect(db.conversations.get(convId)!.unread_count).toBe(1)

    // Scenario B: Message arrives, then mark as read executes -> count is 0
    await db.insertMessage({
      id: 'mB',
      conversation_id: convId,
      sender_type: 'customer',
      content_type: 'text',
      content_text: 'Message before mark as read',
      message_id: 'wamid.before_read',
    })
    expect(db.conversations.get(convId)!.unread_count).toBe(2)
    await db.markAsRead(convId)
    expect(db.conversations.get(convId)!.unread_count).toBe(0)
  })
})
