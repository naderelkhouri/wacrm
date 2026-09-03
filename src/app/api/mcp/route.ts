import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { findActiveKeyByHash, touchLastUsed } from '@/lib/api-keys/store'
import { hashApiKey, looksLikeApiKey } from '@/lib/api-keys/keys'
import { getWhatsAppHealthDetails, sendTextMessage } from '@/lib/whatsapp/meta-api'
import { decrypt } from '@/lib/whatsapp/encryption'

interface MCPContext {
  accountId: string
  supabase: any
  userId?: string | null
}

/**
 * Resolve auth context from either Bearer/x-api-key OR Supabase session cookies.
 */
async function resolveMCPContext(request: Request): Promise<MCPContext | null> {
  const authHeader = request.headers.get('authorization') || request.headers.get('x-api-key')
  let rawKey: string | null = null

  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) rawKey = authHeader.slice(7).trim()
    else rawKey = authHeader.trim()
  }

  if (rawKey && looksLikeApiKey(rawKey)) {
    const keyHash = hashApiKey(rawKey)
    const keyRow = await findActiveKeyByHash(keyHash)
    if (keyRow) {
      void touchLastUsed(keyRow.id)
      return {
        accountId: keyRow.account_id,
        supabase: supabaseAdmin(),
        userId: keyRow.created_by,
      }
    }
  }

  // Fallback to cookie session
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('account_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (profile?.account_id) {
        return {
          accountId: profile.account_id,
          supabase,
          userId: user.id,
        }
      }
    }
  } catch {
    // Cookie auth unavailable
  }

  return null
}

const MCP_TOOLS = [
  {
    name: 'wacrm_get_overview',
    description: 'Get CRM overview metrics including active conversations, contacts count, open deals value, currency, and WhatsApp status.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'wacrm_search_contacts',
    description: 'Search contacts by name, phone number, or tag filter.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term for name or phone number' },
        tag: { type: 'string', description: 'Filter by specific tag ID' },
        limit: { type: 'number', description: 'Maximum contacts to return (default 20)' },
      },
    },
  },
  {
    name: 'wacrm_get_contact',
    description: 'Retrieve full details for a contact by ID or phone number.',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'UUID of the contact' },
        phone: { type: 'string', description: 'Phone number in international format' },
      },
    },
  },
  {
    name: 'wacrm_upsert_contact',
    description: 'Create or update a contact with name, phone, email, company, and notes.',
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Phone number with country code (e.g. 5511999998888)' },
        name: { type: 'string', description: 'Full name' },
        email: { type: 'string', description: 'Email address' },
        company: { type: 'string', description: 'Company name' },
      },
      required: ['phone'],
    },
  },
  {
    name: 'wacrm_list_conversations',
    description: 'List recent conversations, unread count, and latest messages.',
    inputSchema: {
      type: 'object',
      properties: {
        unreadOnly: { type: 'boolean', description: 'Filter only unread conversations' },
        limit: { type: 'number', description: 'Maximum conversations to return' },
      },
    },
  },
  {
    name: 'wacrm_get_conversation_messages',
    description: 'Fetch message history for a given contact.',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'UUID of the contact' },
        limit: { type: 'number', description: 'Number of recent messages (default 50)' },
      },
      required: ['contactId'],
    },
  },
  {
    name: 'wacrm_send_whatsapp_message',
    description: 'Send an outbound text message to a contact via WhatsApp Cloud API.',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'Target contact ID' },
        message: { type: 'string', description: 'Text message content to send' },
      },
      required: ['contactId', 'message'],
    },
  },
  {
    name: 'wacrm_list_deals',
    description: 'List deals in the pipeline with their stages, values, and owners.',
    inputSchema: {
      type: 'object',
      properties: {
        pipelineId: { type: 'string', description: 'Filter by pipeline UUID (optional)' },
        stageId: { type: 'string', description: 'Filter by stage UUID (optional)' },
      },
    },
  },
  {
    name: 'wacrm_create_or_move_deal',
    description: 'Create a new deal or move an existing deal to a different pipeline stage.',
    inputSchema: {
      type: 'object',
      properties: {
        dealId: { type: 'string', description: 'Deal UUID (if moving existing deal)' },
        title: { type: 'string', description: 'Deal title' },
        value: { type: 'number', description: 'Monetary value' },
        contactId: { type: 'string', description: 'Associated contact UUID' },
        pipelineId: { type: 'string', description: 'Pipeline UUID' },
        stageId: { type: 'string', description: 'Target stage UUID' },
      },
    },
  },
  {
    name: 'wacrm_check_whatsapp_health',
    description: 'Run diagnostic health checks on WhatsApp Cloud API, Quality Rating, and Webhooks.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
]

async function handleToolCall(name: string, args: Record<string, any>, ctx: MCPContext) {
  const { accountId, supabase } = ctx

  switch (name) {
    case 'wacrm_get_overview': {
      const [contactsRes, dealsRes, convsRes, configRes] = await Promise.all([
        supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('account_id', accountId),
        supabase.from('deals').select('value, status').eq('account_id', accountId),
        supabase.from('conversations').select('id, unread_count').eq('account_id', accountId),
        supabase.from('whatsapp_config').select('phone_number_id, is_connected').eq('account_id', accountId).maybeSingle(),
      ])

      const totalContacts = contactsRes.count ?? 0
      const openDeals = (dealsRes.data ?? []).filter((d: any) => d.status === 'open')
      const totalDealsValue = openDeals.reduce((sum: number, d: any) => sum + (Number(d.value) || 0), 0)
      const totalUnread = (convsRes.data ?? []).reduce((sum: number, c: any) => sum + (c.unread_count || 0), 0)

      return {
        account_id: accountId,
        total_contacts: totalContacts,
        active_conversations_count: (convsRes.data ?? []).length,
        total_unread_messages: totalUnread,
        open_deals_count: openDeals.length,
        open_deals_value: totalDealsValue,
        whatsapp_connected: Boolean(configRes.data?.is_connected),
      }
    }

    case 'wacrm_search_contacts': {
      let query = supabase.from('contacts').select('id, name, phone, email, company, created_at').eq('account_id', accountId)
      if (args.query) {
        query = query.or(`name.ilike.%${args.query}%,phone.ilike.%${args.query}%,email.ilike.%${args.query}%`)
      }
      query = query.order('created_at', { ascending: false }).limit(args.limit || 20)
      const { data, error } = await query
      if (error) throw error
      return { contacts: data ?? [] }
    }

    case 'wacrm_get_contact': {
      let query = supabase.from('contacts').select('*, tags:contact_tags(tags(*))').eq('account_id', accountId)
      if (args.contactId) query = query.eq('id', args.contactId)
      else if (args.phone) query = query.eq('phone', args.phone)
      else throw new Error('Either contactId or phone must be provided')

      const { data, error } = await query.maybeSingle()
      if (error) throw error
      if (!data) throw new Error('Contact not found')
      return { contact: data }
    }

    case 'wacrm_upsert_contact': {
      const cleanPhone = String(args.phone).replace(/\D/g, '')
      if (!cleanPhone) throw new Error('Valid phone number is required')

      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('account_id', accountId)
        .eq('phone', cleanPhone)
        .maybeSingle()

      if (existing) {
        const updateData: any = { updated_at: new Date().toISOString() }
        if (args.name) updateData.name = args.name
        if (args.email) updateData.email = args.email
        if (args.company) updateData.company = args.company

        const { data, error } = await supabase
          .from('contacts')
          .update(updateData)
          .eq('id', existing.id)
          .select()
          .single()

        if (error) throw error
        return { updated: true, contact: data }
      } else {
        const { data, error } = await supabase
          .from('contacts')
          .insert({
            account_id: accountId,
            phone: cleanPhone,
            name: args.name || null,
            email: args.email || null,
            company: args.company || null,
          })
          .select()
          .single()

        if (error) throw error
        return { created: true, contact: data }
      }
    }

    case 'wacrm_list_conversations': {
      let query = supabase
        .from('conversations')
        .select('id, contact_id, unread_count, updated_at, contact:contacts(name, phone, avatar_url)')
        .eq('account_id', accountId)

      if (args.unreadOnly) query = query.gt('unread_count', 0)
      query = query.order('updated_at', { ascending: false }).limit(args.limit || 20)

      const { data, error } = await query
      if (error) throw error
      return { conversations: data ?? [] }
    }

    case 'wacrm_get_conversation_messages': {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('id, direction, content, message_type, status, created_at')
        .eq('account_id', accountId)
        .eq('contact_id', args.contactId)
        .order('created_at', { ascending: true })
        .limit(args.limit || 50)

      if (error) throw error
      return { messages: messages ?? [] }
    }

    case 'wacrm_send_whatsapp_message': {
      const { data: contact } = await supabase
        .from('contacts')
        .select('phone')
        .eq('account_id', accountId)
        .eq('id', args.contactId)
        .maybeSingle()

      if (!contact) throw new Error('Contact not found')

      const { data: config } = await supabase
        .from('whatsapp_config')
        .select('phone_number_id, access_token_encrypted')
        .eq('account_id', accountId)
        .maybeSingle()

      if (!config?.access_token_encrypted || !config?.phone_number_id) {
        throw new Error('WhatsApp Cloud API is not configured on this account')
      }

      const accessToken = decrypt(config.access_token_encrypted)
      const res = await sendTextMessage({
        phoneNumberId: config.phone_number_id,
        accessToken,
        to: contact.phone,
        text: args.message,
      })

      // Insert message record into database
      await supabase.from('messages').insert({
        account_id: accountId,
        contact_id: args.contactId,
        direction: 'outbound',
        message_type: 'text',
        content: args.message,
        whatsapp_message_id: res.messageId,
        status: 'sent',
      })

      return { success: true, messageId: res.messageId }
    }

    case 'wacrm_list_deals': {
      const { data, error } = await supabase
        .from('deals')
        .select('id, title, value, currency, status, stage_id, contact_id, contact:contacts(name, phone)')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return { deals: data ?? [] }
    }

    case 'wacrm_create_or_move_deal': {
      if (args.dealId) {
        const updatePayload: any = { updated_at: new Date().toISOString() }
        if (args.stageId) updatePayload.stage_id = args.stageId
        if (args.value !== undefined) updatePayload.value = args.value
        if (args.title) updatePayload.title = args.title

        const { data, error } = await supabase
          .from('deals')
          .update(updatePayload)
          .eq('account_id', accountId)
          .eq('id', args.dealId)
          .select()
          .single()

        if (error) throw error
        return { updated: true, deal: data }
      } else {
        if (!args.title || !args.stageId || !args.pipelineId) {
          throw new Error('title, stageId, and pipelineId are required to create a deal')
        }
        const { data, error } = await supabase
          .from('deals')
          .insert({
            account_id: accountId,
            title: args.title,
            value: args.value || 0,
            pipeline_id: args.pipelineId,
            stage_id: args.stageId,
            contact_id: args.contactId || null,
            status: 'open',
          })
          .select()
          .single()

        if (error) throw error
        return { created: true, deal: data }
      }
    }

    case 'wacrm_check_whatsapp_health': {
      const { data: config } = await supabase
        .from('whatsapp_config')
        .select('phone_number_id, waba_id, access_token_encrypted, is_connected')
        .eq('account_id', accountId)
        .maybeSingle()

      if (!config?.access_token_encrypted || !config?.phone_number_id || !config?.waba_id) {
        return { configured: false, status: 'Not configured' }
      }

      const accessToken = decrypt(config.access_token_encrypted)
      const health = await getWhatsAppHealthDetails({
        phoneNumberId: config.phone_number_id,
        wabaId: config.waba_id,
        accessToken,
      })

      return { configured: true, health }
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

/**
 * POST /api/mcp
 *
 * Model Context Protocol (MCP) JSON-RPC 2.0 Handler.
 */
export async function POST(request: Request) {
  try {
    const ctx = await resolveMCPContext(request)
    if (!ctx) {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Unauthorized. Provide Bearer API key or sign in.' },
          id: null,
        },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { jsonrpc, id, method, params } = body

    if (jsonrpc !== '2.0') {
      return NextResponse.json(
        { jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' }, id: id ?? null },
        { status: 400 }
      )
    }

    // 1. Initialize
    if (method === 'initialize') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'wacrm-mcp-server',
            version: '1.0.0',
          },
        },
      })
    }

    // 2. Initialized Notification
    if (method === 'notifications/initialized') {
      return NextResponse.json({ jsonrpc: '2.0', id: id ?? null, result: {} })
    }

    // 3. List Tools
    if (method === 'tools/list') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: MCP_TOOLS,
        },
      })
    }

    // 4. Call Tool
    if (method === 'tools/call') {
      const toolName = params?.name
      const toolArgs = params?.arguments || {}

      if (!toolName) {
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          error: { code: -32602, message: 'Missing tool name in params' },
        })
      }

      try {
        const result = await handleToolCall(toolName, toolArgs, ctx)
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          },
        })
      } catch (err: any) {
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            isError: true,
            content: [
              {
                type: 'text',
                text: `Tool error: ${err.message || String(err)}`,
              },
            ],
          },
        })
      }
    }

    return NextResponse.json({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    })
  } catch (err: any) {
    console.error('[/api/mcp] Handler error:', err)
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32603, message: err.message || 'Internal JSON-RPC Error' }, id: null },
      { status: 500 }
    )
  }
}

/**
 * GET /api/mcp
 *
 * Provides a discovery endpoint for clients inspecting the MCP endpoint.
 */
export async function GET() {
  return NextResponse.json({
    name: 'wacrm-mcp-server',
    version: '1.0.0',
    protocol: 'model-context-protocol',
    protocolVersion: '2024-11-05',
    transport: 'http-jsonrpc',
    endpoint: '/api/mcp',
    toolsCount: MCP_TOOLS.length,
    tools: MCP_TOOLS.map((t) => ({ name: t.name, description: t.description })),
  })
}
