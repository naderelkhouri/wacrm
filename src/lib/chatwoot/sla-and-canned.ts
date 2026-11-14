// ============================================================
// SLA Engine (FRT / NRT / RT) & Canned Variable Guard
// Adapted from @chatwoot/utils (src/sla.ts & src/canned.ts)
// ============================================================

export interface SlaPolicyThresholds {
  /** First Response Time threshold in seconds (default 15 min = 900s) */
  frtSeconds?: number;
  /** Next Response Time threshold in seconds (default 30 min = 1800s) */
  nrtSeconds?: number;
  /** Resolution Time threshold in seconds (default 24h = 86400s) */
  rtSeconds?: number;
}

export interface EvaluatedSlaBadge {
  type: 'FRT' | 'NRT' | 'RT';
  label: string;
  /** Formatted time e.g. '14m', '2h 15m' */
  timeText: string;
  /** true if SLA has already breached */
  isMissed: boolean;
  /** true if less than 25% of SLA time remains */
  isWarning: boolean;
  remainingSeconds: number;
}

export function formatSlaDuration(secondsInput: number): string {
  let seconds = Math.abs(Math.floor(secondsInput));
  if (seconds < 60) return '1m';

  const units: Array<[string, number]> = [
    ['d', 86400],
    ['h', 3600],
    ['m', 60],
  ];

  const parts: string[] = [];
  for (const [unit, unitSeconds] of units) {
    if (parts.length === 2) break;
    const value = Math.floor(seconds / unitSeconds);
    if (value > 0) {
      parts.push(`${value}${unit}`);
      seconds -= value * unitSeconds;
    }
  }

  return parts.join(' ') || '1m';
}

/**
 * Evaluates a conversation's SLA urgency badge for Inbox operators.
 */
export function evaluateConversationSla(
  conversation: {
    status: string;
    unread_count?: number;
    last_message_at?: string | null;
    created_at?: string | null;
  },
  thresholds: SlaPolicyThresholds = {
    frtSeconds: 900,   // 15m target for unread response
    nrtSeconds: 1800,  // 30m target for next reply
    rtSeconds: 86400,  // 24h resolution target
  },
): EvaluatedSlaBadge | null {
  if (!conversation || conversation.status === 'closed') {
    return null;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const unread = (conversation.unread_count ?? 0) > 0;
  const lastMsgSec = conversation.last_message_at
    ? Math.floor(new Date(conversation.last_message_at).getTime() / 1000)
    : null;

  // When customer is waiting for a reply (unread > 0)
  if (unread && lastMsgSec) {
    const targetSec = thresholds.frtSeconds ?? 900;
    const deadlineSec = lastMsgSec + targetSec;
    const remaining = deadlineSec - nowSec;
    const isMissed = remaining < 0;
    const isWarning = !isMissed && remaining <= targetSec * 0.3;

    return {
      type: 'NRT',
      label: isMissed ? 'SLA Expirado' : 'SLA Resposta',
      timeText: formatSlaDuration(remaining),
      isMissed,
      isWarning,
      remainingSeconds: remaining,
    };
  }

  return null;
}

// ============================================================
// CANNED & TEMPLATE VARIABLE INTERPOLATION + ORPHAN GUARD
// ============================================================

const MESSAGE_VARIABLES_REGEX = /\{\{([^{}]+)\}\}/g;

function skipCodeBlocks(str: string): string {
  return str.replace(/```(?:.|\n)+?```/g, '');
}

export function capitalizeName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .split(' ')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
    .join(' ');
}

export function getFirstName(fullName: string | null | undefined): string {
  if (!fullName) return '';
  const first = fullName.trim().split(/\s+/)[0] || '';
  return capitalizeName(first);
}

export function getLastName(fullName: string | null | undefined): string {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? capitalizeName(parts[parts.length - 1]) : '';
}

export interface CannedContext {
  contact?: {
    id?: string;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    company?: string | null;
    custom_fields?: Record<string, unknown> | null;
  } | null;
  conversation?: {
    id?: string;
    whatsapp_instance?: {
      id?: string;
      name?: string | null;
    } | null;
  } | null;
  agent?: {
    name?: string | null;
    email?: string | null;
  } | null;
}

/**
 * Builds standard + custom variable map following Chatwoot's canned.ts convention
 * plus Brazilian Portuguese aliases (`nome`, `primeiro_nome`, `empresa`, `telefone`).
 */
export function buildMessageVariables(ctx: CannedContext): Record<string, string> {
  const contactName = capitalizeName(ctx.contact?.name);
  const firstName = getFirstName(ctx.contact?.name);
  const lastName = getLastName(ctx.contact?.name);
  const phone = ctx.contact?.phone || '';
  const email = ctx.contact?.email || '';
  const company = ctx.contact?.company || '';
  const agentName = capitalizeName(ctx.agent?.name);
  const agentFirst = getFirstName(ctx.agent?.name);

  const vars: Record<string, string> = {
    // Chatwoot standard keys
    'contact.name': contactName,
    'contact.first_name': firstName,
    'contact.last_name': lastName,
    'contact.phone': phone,
    'contact.email': email,
    'contact.company': company,
    'contact.id': ctx.contact?.id || '',
    'conversation.id': ctx.conversation?.id || '',
    'inbox.name': ctx.conversation?.whatsapp_instance?.name || 'WhatsApp',
    'agent.name': agentName,
    'agent.first_name': agentFirst,
    'agent.email': ctx.agent?.email || '',
    // Friendly PT-BR shorthand aliases
    nome: contactName,
    primeiro_nome: firstName,
    sobrenome: lastName,
    telefone: phone,
    email,
    empresa: company,
    atendente: agentName,
  };

  if (ctx.contact?.custom_fields && typeof ctx.contact.custom_fields === 'object') {
    for (const [k, v] of Object.entries(ctx.contact.custom_fields)) {
      if (v != null && String(v).trim() !== '') {
        vars[`contact.custom_attribute.${k}`] = String(v);
        vars[k.toLowerCase()] = String(v);
      }
    }
  }

  return vars;
}

/**
 * Replaces `{{variable}}` tokens in a message using the resolved variable map.
 * Keeps unresolved tokens intact so the operator can see or fix them.
 */
export function replaceVariablesInMessage(
  message: string,
  variables: Record<string, string>,
): string {
  if (!message) return '';
  return message.replace(MESSAGE_VARIABLES_REGEX, (fullMatch, rawKey: string) => {
    const key = rawKey.trim().toLowerCase();
    const val = variables[key] ?? variables[rawKey.trim()];
    return val !== undefined && val !== '' ? val : fullMatch;
  });
}

/**
 * Returns an array of variable names inside `{{...}}` (ignoring code blocks)
 * that have no resolved value for the current conversation/contact.
 */
export function getUndefinedVariablesInMessage(
  message: string,
  variables: Record<string, string>,
): string[] {
  if (!message) return [];
  const clean = skipCodeBlocks(message);
  const matches = clean.match(MESSAGE_VARIABLES_REGEX);
  if (!matches) return [];

  const undefinedVars = new Set<string>();
  for (const match of matches) {
    const token = match.replace(/^\{\{|\}\}$/g, '').trim();
    if (!token) continue;
    const resolved = variables[token.toLowerCase()] ?? variables[token];
    if (!resolved || resolved.trim() === '') {
      undefinedVars.add(token);
    }
  }

  return Array.from(undefinedVars);
}
