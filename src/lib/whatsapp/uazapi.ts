// ============================================================
// Uazapi (WhatsApp API v2 / Go & v1 / Evolution-compatible) Client
//
// Provides a complete, secure, dual-compatible integration layer for
// Uazapi alongside Meta Cloud API.
//
// Key capabilities:
// - SSRF-safe base URL normalization (`normalizeUazapiBaseUrl`)
// - Dual authentication headers (`token` + `apikey`) for UazapiGO v2 & v1
// - Instance health / status verification (`verifyUazapiInstance`)
// - Outbound text, media, interactive menu (buttons/list), template-as-text,
//   and reaction messages (`sendUazapiTextMessage`, `sendUazapiMediaMessage`,
//   `sendUazapiInteractiveMessage`, `sendUazapiTemplateMessage`,
//   `sendUazapiReactionMessage`)
// - Webhook auto-configuration (`configureUazapiWebhook`)
// - Inbound webhook payload normalization (`parseUazapiWebhookToMetaEntries`)
//   translating Uazapi v2 (`EventType: 'messages' | 'messages_update'`) and
//   v1 (`messages.upsert` / `messages.update`) into Meta Cloud API's
//   `WhatsAppWebhookEntry[]` structure so 100% of existing WACRM features
//   (Inbox, Flows, Automations, AI Auto-Reply, Broadcast status tracking,
//   Reactions, and Telemetry) work transparently.
// ============================================================

import type { InteractiveButton, InteractiveListSection, MediaKind, MetaPhoneInfo } from './meta-api';
import type { MessageTemplate } from '@/types';
import type { SendTimeParams } from './template-send-builder';

const UAZAPI_TIMEOUT_MS = 15_000;

/**
 * Normalizes and validates a Uazapi base URL.
 * Blocks private/loopback/metadata IP ranges in production to prevent SSRF.
 */
export function normalizeUazapiBaseUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error('A URL da API Uazapi é obrigatória.');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`URL da API Uazapi inválida: "${rawUrl}". Use o formato https://seu-servidor.uazapi.com`);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('A URL da API Uazapi deve usar protocolo https:// ou http://.');
  }

  const host = parsed.hostname.toLowerCase();
  const isProd = process.env.NODE_ENV === 'production' && !process.env.VITEST;
  if (isProd) {
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.startsWith('169.254.') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      host.endsWith('.internal') ||
      host.endsWith('.local')
    ) {
      throw new Error('Host interno ou privado não permitido para URL da API Uazapi.');
    }
  }

  return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
}

/**
 * Formats a phone number for Uazapi (digits only, e.g. "5511999998888").
 */
export function formatPhoneForUazapi(phone: string): string {
  const cleaned = phone.replace(/@s\.whatsapp\.net$/i, '').replace(/\D/g, '');
  return cleaned;
}

function buildUazapiHeaders(instanceToken: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    token: instanceToken,
    apikey: instanceToken,
  };
}

function extractUazapiMessageId(data: unknown): string {
  if (!data || typeof data !== 'object') {
    return `uazapi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
  const obj = data as Record<string, unknown>;

  if (typeof obj.messageid === 'string' && obj.messageid) return obj.messageid;
  if (typeof obj.messageId === 'string' && obj.messageId) return obj.messageId;
  if (typeof obj.id === 'string' && obj.id) return obj.id;

  if (obj.key && typeof obj.key === 'object') {
    const key = obj.key as Record<string, unknown>;
    if (typeof key.id === 'string' && key.id) return key.id;
  }

  if (obj.message && typeof obj.message === 'object') {
    const msg = obj.message as Record<string, unknown>;
    if (typeof msg.messageid === 'string' && msg.messageid) return msg.messageid;
    if (typeof msg.id === 'string' && msg.id) return msg.id;
    if (msg.key && typeof msg.key === 'object') {
      const k = msg.key as Record<string, unknown>;
      if (typeof k.id === 'string' && k.id) return k.id;
    }
  }

  if (obj.data && typeof obj.data === 'object') {
    return extractUazapiMessageId(obj.data);
  }

  if (obj.response && typeof obj.response === 'object') {
    return extractUazapiMessageId(obj.response);
  }

  return `uazapi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function extractUazapiError(data: unknown, status: number): string {
  if (!data) return `Uazapi HTTP ${status}`;
  if (typeof data === 'string') return data.slice(0, 300) || `Uazapi HTTP ${status}`;
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (typeof obj.error === 'string' && obj.error) return obj.error;
    if (typeof obj.message === 'string' && obj.message) return obj.message;
    if (obj.response && typeof obj.response === 'object') {
      const resp = obj.response as Record<string, unknown>;
      if (typeof resp.message === 'string' && resp.message) return resp.message;
    }
  }
  return `Uazapi HTTP ${status}`;
}

export interface UazapiInstanceStatus {
  connected: boolean;
  state: string;
  phoneNumber: string;
  profileName: string;
  instanceId: string;
  instanceName: string;
}

/**
 * Verifies an Uazapi instance's connection status and returns a
 * `MetaPhoneInfo`-compatible summary so all UI & admin panels work seamlessly.
 */
export async function verifyUazapiInstance(params: {
  apiUrl: string;
  instanceToken: string;
  instanceName?: string | null;
  fallbackPhoneId?: string | null;
}): Promise<MetaPhoneInfo & { state?: string; instance_name?: string }> {
  const baseUrl = normalizeUazapiBaseUrl(params.apiUrl);
  const headers = buildUazapiHeaders(params.instanceToken);

  // 1. Try Uazapi v2 (Go): GET /instance/status
  const primaryUrl = `${baseUrl}/instance/status`;
  let res = await fetch(primaryUrl, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(UAZAPI_TIMEOUT_MS),
  });

  // 2. Fallback to Uazapi v1 / Evolution: GET /instance/connectionState/{instanceName}
  if (res.status === 404 && params.instanceName) {
    const fallbackUrl = `${baseUrl}/instance/connectionState/${encodeURIComponent(params.instanceName)}`;
    res = await fetch(fallbackUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(UAZAPI_TIMEOUT_MS),
    });
  }

  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    // Non-JSON response
  }

  if (!res.ok) {
    throw new Error(
      `Falha ao verificar instância Uazapi (${res.status}): ${extractUazapiError(data, res.status)}`
    );
  }

  const instanceObj = (data.instance as Record<string, unknown>) || {};
  const statusObj = (data.status as Record<string, unknown>) || {};

  const rawState =
    (typeof instanceObj.status === 'string' && instanceObj.status) ||
    (typeof instanceObj.state === 'string' && instanceObj.state) ||
    (typeof statusObj.state === 'string' && statusObj.state) ||
    (typeof data.state === 'string' && data.state) ||
    (typeof data.status === 'string' && data.status) ||
    (statusObj.connected === true || data.connected === true ? 'connected' : 'unknown');

  const isConnected =
    statusObj.connected === true ||
    statusObj.loggedIn === true ||
    data.connected === true ||
    ['connected', 'open', 'online', 'authenticated'].includes(String(rawState).toLowerCase());

  const ownerJid =
    (typeof instanceObj.owner === 'string' && instanceObj.owner) ||
    (typeof instanceObj.ownerJid === 'string' && instanceObj.ownerJid) ||
    (typeof statusObj.jid === 'string' && statusObj.jid) ||
    (typeof data.owner === 'string' && data.owner) ||
    (typeof data.jid === 'string' && data.jid) ||
    '';

  const extractedPhone = ownerJid.replace(/@s\.whatsapp\.net$/i, '').replace(/:\d+$/, '');
  const displayPhone =
    extractedPhone ||
    params.fallbackPhoneId ||
    params.instanceName ||
    (typeof instanceObj.name === 'string' ? instanceObj.name : '') ||
    'Instância Uazapi';

  const profileName =
    (typeof instanceObj.profileName === 'string' && instanceObj.profileName) ||
    (typeof instanceObj.name === 'string' && instanceObj.name) ||
    (typeof data.profileName === 'string' && data.profileName) ||
    params.instanceName ||
    'Uazapi WhatsApp';

  const resolvedId =
    extractedPhone ||
    params.fallbackPhoneId ||
    (typeof instanceObj.id === 'string' && instanceObj.id) ||
    params.instanceName ||
    'uazapi-instance';

  return {
    id: resolvedId,
    display_phone_number: displayPhone,
    verified_name: profileName,
    quality_rating: isConnected ? 'GREEN' : 'YELLOW',
    state: String(rawState),
    instance_name:
      (typeof instanceObj.name === 'string' && instanceObj.name) ||
      params.instanceName ||
      undefined,
  };
}

/**
 * Configures the webhook on a Uazapi v2 instance so inbound messages and
 * status updates are delivered to WACRM automatically, while excluding
 * messages sent by the API itself (`excludeMessages: ['wasSentByApi']`)
 * to prevent infinite automation loops.
 */
export async function configureUazapiWebhook(params: {
  apiUrl: string;
  instanceToken: string;
  webhookUrl: string;
  instanceName?: string | null;
}): Promise<{ configured: boolean; error?: string }> {
  try {
    const baseUrl = normalizeUazapiBaseUrl(params.apiUrl);
    const headers = buildUazapiHeaders(params.instanceToken);

    const payload = {
      enabled: true,
      url: params.webhookUrl,
      events: ['messages', 'messages_update', 'connection'],
      excludeMessages: ['wasSentByApi'],
    };

    const res = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(UAZAPI_TIMEOUT_MS),
    });

    if (res.ok) {
      return { configured: true };
    }

    // Fallback for Uazapi v1 / Evolution: POST /webhook/set/{instanceName}
    if (res.status === 404 && params.instanceName) {
      const v1Res = await fetch(
        `${baseUrl}/webhook/set/${encodeURIComponent(params.instanceName)}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            webhook: {
              enabled: true,
              url: params.webhookUrl,
              events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'],
            },
          }),
          signal: AbortSignal.timeout(UAZAPI_TIMEOUT_MS),
        }
      );
      if (v1Res.ok) {
        return { configured: true };
      }
    }

    const errText = await res.text().catch(() => '');
    return {
      configured: false,
      error: `HTTP ${res.status}: ${errText.slice(0, 200)}`,
    };
  } catch (err) {
    return {
      configured: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Sends a plain text message via Uazapi (`POST /send/text`, with fallback
 * to v1 `/message/sendText/{instance}` if 404).
 */
export async function sendUazapiTextMessage(params: {
  apiUrl: string;
  instanceToken: string;
  instanceName?: string | null;
  to: string;
  text: string;
  replyToMessageId?: string;
}): Promise<{ messageId: string }> {
  const baseUrl = normalizeUazapiBaseUrl(params.apiUrl);
  const headers = buildUazapiHeaders(params.instanceToken);
  const number = formatPhoneForUazapi(params.to);

  const v2Body: Record<string, unknown> = {
    number,
    text: params.text,
    linkPreview: true,
  };
  if (params.replyToMessageId) {
    v2Body.replyid = params.replyToMessageId;
  }

  let res = await fetch(`${baseUrl}/send/text`, {
    method: 'POST',
    headers,
    body: JSON.stringify(v2Body),
    signal: AbortSignal.timeout(UAZAPI_TIMEOUT_MS),
  });

  if (res.status === 404) {
    const fallbackPath = params.instanceName
      ? `${baseUrl}/message/sendText/${encodeURIComponent(params.instanceName)}`
      : `${baseUrl}/message/sendText`;
    res = await fetch(fallbackPath, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        number,
        text: params.text,
        textMessage: { text: params.text },
      }),
      signal: AbortSignal.timeout(UAZAPI_TIMEOUT_MS),
    });
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON
  }

  if (!res.ok) {
    throw new Error(`Uazapi sendText error: ${extractUazapiError(data, res.status)}`);
  }

  return { messageId: extractUazapiMessageId(data) };
}

/**
 * Sends an image, video, audio, or document via Uazapi (`POST /send/media`).
 */
export async function sendUazapiMediaMessage(params: {
  apiUrl: string;
  instanceToken: string;
  instanceName?: string | null;
  to: string;
  kind: MediaKind | 'audio';
  link: string;
  caption?: string;
  filename?: string;
  replyToMessageId?: string;
}): Promise<{ messageId: string }> {
  const baseUrl = normalizeUazapiBaseUrl(params.apiUrl);
  const headers = buildUazapiHeaders(params.instanceToken);
  const number = formatPhoneForUazapi(params.to);

  const payload: Record<string, unknown> = {
    number,
    type: params.kind,
    file: params.link,
    media: params.link,
  };
  if (params.caption) {
    payload.text = params.caption;
    payload.caption = params.caption;
  }
  if (params.filename) {
    payload.docName = params.filename;
    payload.fileName = params.filename;
  }
  if (params.replyToMessageId) {
    payload.replyid = params.replyToMessageId;
  }

  let res = await fetch(`${baseUrl}/send/media`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(UAZAPI_TIMEOUT_MS),
  });

  if (res.status === 404) {
    const fallbackPath = params.instanceName
      ? `${baseUrl}/message/sendMedia/${encodeURIComponent(params.instanceName)}`
      : `${baseUrl}/message/sendMedia`;
    res = await fetch(fallbackPath, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        number,
        mediatype: params.kind,
        media: params.link,
        caption: params.caption || '',
        fileName: params.filename,
      }),
      signal: AbortSignal.timeout(UAZAPI_TIMEOUT_MS),
    });
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON
  }

  if (!res.ok) {
    throw new Error(`Uazapi sendMedia error: ${extractUazapiError(data, res.status)}`);
  }

  return { messageId: extractUazapiMessageId(data) };
}

/**
 * Sends an interactive button message via Uazapi (`POST /send/menu`),
 * falling back to a clean formatted text message if the endpoint or client
 * does not support native interactive menus.
 */
export async function sendUazapiInteractiveButtons(params: {
  apiUrl: string;
  instanceToken: string;
  instanceName?: string | null;
  to: string;
  bodyText: string;
  buttons: InteractiveButton[];
  headerText?: string;
  footerText?: string;
  replyToMessageId?: string;
}): Promise<{ messageId: string }> {
  const baseUrl = normalizeUazapiBaseUrl(params.apiUrl);
  const headers = buildUazapiHeaders(params.instanceToken);
  const number = formatPhoneForUazapi(params.to);

  const fullText = params.headerText
    ? `*${params.headerText.trim()}*\n\n${params.bodyText}`
    : params.bodyText;

  // Uazapi v2 /send/menu format: choices: ["Title|id"]
  const choices = params.buttons.map((b) => `${b.title}|${b.id}`);

  const menuPayload: Record<string, unknown> = {
    number,
    type: 'button',
    text: fullText,
    choices,
  };
  if (params.footerText) {
    menuPayload.footerText = params.footerText;
  }
  if (params.replyToMessageId) {
    menuPayload.replyid = params.replyToMessageId;
  }

  const res = await fetch(`${baseUrl}/send/menu`, {
    method: 'POST',
    headers,
    body: JSON.stringify(menuPayload),
    signal: AbortSignal.timeout(UAZAPI_TIMEOUT_MS),
  });

  if (res.ok) {
    const data = await res.json().catch(() => ({}));
    return { messageId: extractUazapiMessageId(data) };
  }

  // Fallback to formatted text if /send/menu is not supported on this Uazapi version
  const optionsText = params.buttons
    .map((b, i) => `*${i + 1}.* ${b.title}`)
    .join('\n');
  const fallbackText = [
    fullText,
    '',
    optionsText,
    params.footerText ? `\n_${params.footerText}_` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return sendUazapiTextMessage({
    apiUrl: params.apiUrl,
    instanceToken: params.instanceToken,
    instanceName: params.instanceName,
    to: params.to,
    text: fallbackText,
    replyToMessageId: params.replyToMessageId,
  });
}

/**
 * Sends an interactive list message via Uazapi (`POST /send/menu`),
 * falling back to a formatted text menu if needed.
 */
export async function sendUazapiInteractiveList(params: {
  apiUrl: string;
  instanceToken: string;
  instanceName?: string | null;
  to: string;
  bodyText: string;
  buttonLabel: string;
  sections: InteractiveListSection[];
  headerText?: string;
  footerText?: string;
  replyToMessageId?: string;
}): Promise<{ messageId: string }> {
  const baseUrl = normalizeUazapiBaseUrl(params.apiUrl);
  const headers = buildUazapiHeaders(params.instanceToken);
  const number = formatPhoneForUazapi(params.to);

  const fullText = params.headerText
    ? `*${params.headerText.trim()}*\n\n${params.bodyText}`
    : params.bodyText;

  // Uazapi v2 /send/menu list choices: "[Section Title]", "Row Title|id|Description"
  const choices: string[] = [];
  for (const section of params.sections) {
    if (section.title) {
      choices.push(`[${section.title}]`);
    }
    for (const row of section.rows) {
      const desc = row.description ? `|${row.description}` : '';
      choices.push(`${row.title}|${row.id}${desc}`);
    }
  }

  const menuPayload: Record<string, unknown> = {
    number,
    type: 'list',
    text: fullText,
    listButton: params.buttonLabel || 'Ver opções',
    choices,
  };
  if (params.footerText) {
    menuPayload.footerText = params.footerText;
  }
  if (params.replyToMessageId) {
    menuPayload.replyid = params.replyToMessageId;
  }

  const res = await fetch(`${baseUrl}/send/menu`, {
    method: 'POST',
    headers,
    body: JSON.stringify(menuPayload),
    signal: AbortSignal.timeout(UAZAPI_TIMEOUT_MS),
  });

  if (res.ok) {
    const data = await res.json().catch(() => ({}));
    return { messageId: extractUazapiMessageId(data) };
  }

  // Fallback to formatted text menu
  const lines: string[] = [fullText, ''];
  for (const section of params.sections) {
    if (section.title) lines.push(`*${section.title}*`);
    for (const row of section.rows) {
      lines.push(`• *${row.title}*${row.description ? ` — ${row.description}` : ''}`);
    }
  }
  if (params.footerText) {
    lines.push(`\n_${params.footerText}_`);
  }

  return sendUazapiTextMessage({
    apiUrl: params.apiUrl,
    instanceToken: params.instanceToken,
    instanceName: params.instanceName,
    to: params.to,
    text: lines.join('\n'),
    replyToMessageId: params.replyToMessageId,
  });
}

/**
 * Renders a `MessageTemplate` (or template name + positional params) into
 * a formatted WhatsApp message and dispatches it via Uazapi (as media + caption
 * when the template has an image/video/document header, or as rich text).
 */
export async function sendUazapiTemplateMessage(params: {
  apiUrl: string;
  instanceToken: string;
  instanceName?: string | null;
  to: string;
  templateName: string;
  template?: MessageTemplate | null;
  params?: string[];
  messageParams?: SendTimeParams;
  replyToMessageId?: string;
}): Promise<{ messageId: string }> {
  const bodyValues = params.messageParams?.body ?? params.params ?? [];

  const interpolate = (raw: string, values: string[]): string => {
    return raw.replace(/\{\{(\d+)\}\}/g, (_, idxStr: string) => {
      const idx = parseInt(idxStr, 10) - 1;
      return values[idx] !== undefined ? values[idx] : `{{${idxStr}}}`;
    });
  };

  if (params.template) {
    const tpl = params.template;
    const parts: string[] = [];

    if (tpl.header_type === 'text' && tpl.header_content) {
      const headerVal = params.messageParams?.headerText
        ? [params.messageParams.headerText]
        : bodyValues;
      parts.push(`*${interpolate(tpl.header_content, headerVal).trim()}*`);
    }

    if (tpl.body_text) {
      parts.push(interpolate(tpl.body_text, bodyValues));
    }

    if (tpl.footer_text) {
      parts.push(`_${tpl.footer_text.trim()}_`);
    }

    const renderedText = parts.join('\n\n') || tpl.name;
    const mediaLink = params.messageParams?.headerMediaUrl ?? tpl.header_media_url;

    if (
      mediaLink &&
      (tpl.header_type === 'image' ||
        tpl.header_type === 'video' ||
        tpl.header_type === 'document')
    ) {
      return sendUazapiMediaMessage({
        apiUrl: params.apiUrl,
        instanceToken: params.instanceToken,
        instanceName: params.instanceName,
        to: params.to,
        kind: tpl.header_type,
        link: mediaLink,
        caption: renderedText,
        replyToMessageId: params.replyToMessageId,
      });
    }

    return sendUazapiTextMessage({
      apiUrl: params.apiUrl,
      instanceToken: params.instanceToken,
      instanceName: params.instanceName,
      to: params.to,
      text: renderedText,
      replyToMessageId: params.replyToMessageId,
    });
  }

  // Fallback when no local MessageTemplate row exists in DB
  const fallbackText =
    bodyValues.length > 0
      ? bodyValues.join(' ')
      : `[Template: ${params.templateName}]`;

  return sendUazapiTextMessage({
    apiUrl: params.apiUrl,
    instanceToken: params.instanceToken,
    instanceName: params.instanceName,
    to: params.to,
    text: fallbackText,
    replyToMessageId: params.replyToMessageId,
  });
}

/**
 * Sends a reaction emoji to a message via Uazapi (`POST /message/react` or `/send/reaction`).
 */
export async function sendUazapiReactionMessage(params: {
  apiUrl: string;
  instanceToken: string;
  instanceName?: string | null;
  to: string;
  targetMessageId: string;
  emoji: string;
}): Promise<void> {
  const baseUrl = normalizeUazapiBaseUrl(params.apiUrl);
  const headers = buildUazapiHeaders(params.instanceToken);
  const number = formatPhoneForUazapi(params.to);

  const payload = {
    number: `${number}@s.whatsapp.net`,
    text: params.emoji,
    id: params.targetMessageId,
  };

  const res = await fetch(`${baseUrl}/message/react`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(UAZAPI_TIMEOUT_MS),
  });

  if (res.ok) return;

  // Fallback to /send/reaction
  const fallbackRes = await fetch(`${baseUrl}/send/reaction`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      number,
      text: params.emoji,
      emoji: params.emoji,
      id: params.targetMessageId,
      messageId: params.targetMessageId,
    }),
    signal: AbortSignal.timeout(UAZAPI_TIMEOUT_MS),
  });

  if (!fallbackRes.ok) {
    const errData = await fallbackRes.json().catch(() => ({}));
    throw new Error(
      `Uazapi reaction error: ${extractUazapiError(errData, fallbackRes.status)}`
    );
  }
}

// ============================================================
// Inbound Webhook Normalization (Uazapi v2 & v1 -> Meta Webhook Entry)
// ============================================================

export interface NormalizedWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: Array<{
        profile: { name: string };
        wa_id: string;
      }>;
      messages?: Array<{
        id: string;
        from: string;
        timestamp: string;
        type: string;
        text?: { body: string };
        image?: { id: string; mime_type: string; caption?: string };
        video?: { id: string; mime_type: string; caption?: string };
        document?: { id: string; mime_type: string; filename?: string; caption?: string };
        audio?: { id: string; mime_type: string };
        sticker?: { id: string; mime_type: string };
        location?: { latitude: number; longitude: number; name?: string; address?: string };
        reaction?: { message_id: string; emoji: string };
        interactive?: {
          type: 'button_reply' | 'list_reply';
          button_reply?: { id: string; title: string };
          list_reply?: { id: string; title: string; description?: string };
        };
        context?: { id: string };
      }>;
      statuses?: Array<{
        id: string;
        status: string;
        timestamp: string;
        recipient_id: string;
      }>;
    };
    field: string;
  }>;
}

/**
 * Checks whether a parsed JSON body looks like a Uazapi (v2 or v1) webhook payload.
 */
export function isUazapiWebhookPayload(payload: unknown): payload is Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return false;
  const obj = payload as Record<string, unknown>;
  if (obj.object === 'whatsapp_business_account' && Array.isArray(obj.entry)) {
    return false;
  }
  return Boolean(
    typeof obj.EventType === 'string' ||
      typeof obj.event === 'string' ||
      (obj.message && typeof obj.message === 'object' && typeof obj.token === 'string') ||
      (obj.data && typeof obj.data === 'object' && typeof obj.instance === 'string')
  );
}

/**
 * Extracts any authentication token sent by Uazapi in the webhook request
 * (headers, query string, or JSON body `token` / `apikey`).
 */
export function extractUazapiWebhookToken(
  request: Request,
  payload: Record<string, unknown>
): string | null {
  const url = new URL(request.url);
  const queryToken =
    url.searchParams.get('token') ||
    url.searchParams.get('verify_token') ||
    url.searchParams.get('apikey');
  if (queryToken) return queryToken.trim();

  const headerToken =
    request.headers.get('x-uazapi-token') ||
    request.headers.get('token') ||
    request.headers.get('apikey') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (headerToken) return headerToken.trim();

  if (typeof payload.token === 'string' && payload.token.trim()) {
    return payload.token.trim();
  }
  if (typeof payload.apikey === 'string' && payload.apikey.trim()) {
    return payload.apikey.trim();
  }

  return null;
}

function toUnixSecondsString(rawTs: unknown): string {
  if (typeof rawTs === 'number' && Number.isFinite(rawTs)) {
    // If milliseconds (> 1e11), convert to seconds
    const secs = rawTs > 100_000_000_000 ? Math.floor(rawTs / 1000) : Math.floor(rawTs);
    return String(secs);
  }
  if (typeof rawTs === 'string' && /^\d+$/.test(rawTs.trim())) {
    const n = Number(rawTs.trim());
    const secs = n > 100_000_000_000 ? Math.floor(n / 1000) : Math.floor(n);
    return String(secs);
  }
  return String(Math.floor(Date.now() / 1000));
}

/**
 * Converts a Uazapi webhook payload (v2 `EventType: 'messages' | 'messages_update'`
 * or v1 `event: 'messages.upsert' | 'messages.update'`) into the standard
 * Meta Cloud API `WhatsAppWebhookEntry[]` format consumed by `processWebhook()`.
 */
export function parseUazapiWebhookToMetaEntries(
  payload: Record<string, unknown>,
  phoneNumberId: string
): NormalizedWebhookEntry[] {
  const eventType = String(payload.EventType || payload.event || '').toLowerCase();

  // ----------------------------------------------------------
  // 1. Status Updates (messages_update / messages.update)
  // ----------------------------------------------------------
  if (eventType === 'messages_update' || eventType === 'messages.update') {
    const stateRaw = String(
      payload.state ||
        (payload.event && typeof payload.event === 'object'
          ? (payload.event as Record<string, unknown>).Type ||
            (payload.event as Record<string, unknown>).status
          : '') ||
        (payload.data && typeof payload.data === 'object'
          ? (payload.data as Record<string, unknown>).status
          : '') ||
        ''
    ).toLowerCase();

    let mappedStatus: 'sent' | 'delivered' | 'read' | 'failed' | null = null;
    if (['read', 'played', '4', 'read_by_recipient'].includes(stateRaw)) {
      mappedStatus = 'read';
    } else if (['delivered', 'delivery_ack', '3'].includes(stateRaw)) {
      mappedStatus = 'delivered';
    } else if (['sent', 'server_ack', '2'].includes(stateRaw)) {
      mappedStatus = 'sent';
    } else if (['failed', 'error', '5'].includes(stateRaw)) {
      mappedStatus = 'failed';
    }

    if (!mappedStatus) return [];

    const eventObj =
      (payload.event && typeof payload.event === 'object'
        ? (payload.event as Record<string, unknown>)
        : null) ||
      (payload.data && typeof payload.data === 'object'
        ? (payload.data as Record<string, unknown>)
        : null) ||
      payload;

    const msgIds: string[] = [];
    if (Array.isArray(eventObj.MessageIDs)) {
      for (const id of eventObj.MessageIDs) {
        if (typeof id === 'string' && id) msgIds.push(id);
      }
    } else if (typeof eventObj.messageid === 'string' && eventObj.messageid) {
      msgIds.push(eventObj.messageid);
    } else if (typeof eventObj.id === 'string' && eventObj.id) {
      msgIds.push(eventObj.id);
    } else if (typeof eventObj.keyId === 'string' && eventObj.keyId) {
      msgIds.push(eventObj.keyId);
    }

    if (msgIds.length === 0) return [];

    const recipientRaw = String(eventObj.Chat || eventObj.remoteJid || '').replace(
      /@s\.whatsapp\.net$/i,
      ''
    );
    const ts = toUnixSecondsString(eventObj.Timestamp || payload.timestamp);

    return [
      {
        id: phoneNumberId,
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: phoneNumberId,
                phone_number_id: phoneNumberId,
              },
              statuses: msgIds.map((id) => ({
                id,
                status: mappedStatus,
                timestamp: ts,
                recipient_id: recipientRaw,
              })),
            },
          },
        ],
      },
    ];
  }

  // ----------------------------------------------------------
  // 2. Inbound Messages (Uazapi v2 `message` or v1 `data`)
  // ----------------------------------------------------------
  const msgObj =
    (payload.message && typeof payload.message === 'object'
      ? (payload.message as Record<string, unknown>)
      : null) ||
    (payload.data && typeof payload.data === 'object'
      ? (payload.data as Record<string, unknown>)
      : null);

  if (!msgObj) return [];

  // Extract key info for v1/Evolution compatibility
  const keyObj =
    msgObj.key && typeof msgObj.key === 'object'
      ? (msgObj.key as Record<string, unknown>)
      : {};

  const fromMe = Boolean(
    msgObj.fromMe === true ||
      msgObj.wasSentByApi === true ||
      keyObj.fromMe === true
  );
  if (fromMe) {
    return [];
  }

  const rawChatId = String(
    msgObj.chatid ||
      msgObj.sender ||
      msgObj.sender_pn ||
      keyObj.remoteJid ||
      (payload.chat && typeof payload.chat === 'object'
        ? (payload.chat as Record<string, unknown>).wa_chatid
        : '') ||
      ''
  );

  const isGroup = Boolean(
    msgObj.isGroup === true ||
      rawChatId.endsWith('@g.us') ||
      rawChatId.includes('@broadcast') ||
      rawChatId.includes('status@broadcast')
  );
  if (isGroup) {
    return [];
  }

  const senderPhone = rawChatId
    .replace(/@s\.whatsapp\.net$/i, '')
    .replace(/:\d+$/, '')
    .replace(/\D/g, '');
  if (!senderPhone) return [];

  const chatObj =
    payload.chat && typeof payload.chat === 'object'
      ? (payload.chat as Record<string, unknown>)
      : {};

  const contactName = String(
    msgObj.senderName ||
      msgObj.pushName ||
      chatObj.wa_name ||
      chatObj.name ||
      senderPhone
  ).trim();

  const messageId = String(
    msgObj.messageid ||
      msgObj.id ||
      keyObj.id ||
      `uazapi_in_${Date.now()}`
  );

  const timestamp = toUnixSecondsString(
    msgObj.messageTimestamp || msgObj.timestamp || payload.timestamp
  );

  const quotedId =
    typeof msgObj.quoted === 'string' && msgObj.quoted.trim()
      ? msgObj.quoted.trim()
      : undefined;

  // Interactive button/list tap in Uazapi v2
  const buttonOrListId =
    typeof msgObj.buttonOrListid === 'string' && msgObj.buttonOrListid.trim()
      ? msgObj.buttonOrListid.trim()
      : '';

  const rawType = String(
    msgObj.messageType || msgObj.type || msgObj.mediaType || 'text'
  ).toLowerCase();

  // Extract text content from v2 (`msgObj.text` / `msgObj.content`) or v1 (`msgObj.message.conversation`)
  const innerMessage =
    msgObj.message && typeof msgObj.message === 'object'
      ? (msgObj.message as Record<string, unknown>)
      : {};

  const textContent =
    (typeof msgObj.text === 'string' && msgObj.text) ||
    (typeof msgObj.content === 'string' && msgObj.content) ||
    (typeof innerMessage.conversation === 'string' && innerMessage.conversation) ||
    (innerMessage.extendedTextMessage &&
    typeof innerMessage.extendedTextMessage === 'object' &&
    typeof (innerMessage.extendedTextMessage as Record<string, unknown>).text === 'string'
      ? String((innerMessage.extendedTextMessage as Record<string, unknown>).text)
      : '') ||
    '';

  const mediaUrlRaw =
    (typeof msgObj.fileURL === 'string' && msgObj.fileURL) ||
    (typeof msgObj.mediaUrl === 'string' && msgObj.mediaUrl) ||
    (typeof msgObj.url === 'string' && msgObj.url) ||
    (msgObj.content &&
    typeof msgObj.content === 'object' &&
    typeof (msgObj.content as Record<string, unknown>).URL === 'string'
      ? String((msgObj.content as Record<string, unknown>).URL)
      : '') ||
    '';

  type MetaMsg = NonNullable<
    NormalizedWebhookEntry['changes'][number]['value']['messages']
  >[number];

  const normalizedMessage: MetaMsg = {
    id: messageId,
    from: senderPhone,
    timestamp,
    type: 'text',
    ...(quotedId ? { context: { id: quotedId } } : {}),
  };

  if (buttonOrListId || rawType.includes('buttonsresponse') || rawType.includes('listresponse') || rawType.includes('templatebuttonreply')) {
    const replyId = buttonOrListId || textContent || 'reply';
    const replyTitle = textContent || replyId;
    normalizedMessage.type = 'interactive';
    normalizedMessage.interactive = {
      type: rawType.includes('list') ? 'list_reply' : 'button_reply',
      ...(rawType.includes('list')
        ? { list_reply: { id: replyId, title: replyTitle } }
        : { button_reply: { id: replyId, title: replyTitle } }),
    };
  } else if (rawType.includes('reaction') || typeof msgObj.reaction === 'string') {
    const targetId = String(msgObj.reaction || quotedId || '');
    if (targetId) {
      normalizedMessage.type = 'reaction';
      normalizedMessage.reaction = {
        message_id: targetId,
        emoji: textContent,
      };
    } else {
      normalizedMessage.type = 'text';
      normalizedMessage.text = { body: textContent };
    }
  } else if (rawType.includes('image')) {
    normalizedMessage.type = 'image';
    normalizedMessage.image = {
      id: mediaUrlRaw || messageId,
      mime_type: 'image/jpeg',
      caption: textContent || undefined,
    };
  } else if (rawType.includes('video')) {
    normalizedMessage.type = 'video';
    normalizedMessage.video = {
      id: mediaUrlRaw || messageId,
      mime_type: 'video/mp4',
      caption: textContent || undefined,
    };
  } else if (rawType.includes('audio') || rawType.includes('ptt')) {
    normalizedMessage.type = 'audio';
    normalizedMessage.audio = {
      id: mediaUrlRaw || messageId,
      mime_type: 'audio/ogg',
    };
  } else if (rawType.includes('document')) {
    normalizedMessage.type = 'document';
    normalizedMessage.document = {
      id: mediaUrlRaw || messageId,
      mime_type: 'application/octet-stream',
      caption: textContent || undefined,
      filename: typeof msgObj.fileName === 'string' ? msgObj.fileName : undefined,
    };
  } else if (rawType.includes('sticker')) {
    normalizedMessage.type = 'sticker';
    normalizedMessage.sticker = {
      id: mediaUrlRaw || messageId,
      mime_type: 'image/webp',
    };
  } else if (rawType.includes('location')) {
    const contentObj =
      msgObj.content && typeof msgObj.content === 'object'
        ? (msgObj.content as Record<string, unknown>)
        : {};
    normalizedMessage.type = 'location';
    normalizedMessage.location = {
      latitude: Number(contentObj.degreesLatitude || msgObj.latitude || 0),
      longitude: Number(contentObj.degreesLongitude || msgObj.longitude || 0),
      name: typeof contentObj.name === 'string' ? contentObj.name : undefined,
      address: typeof contentObj.address === 'string' ? contentObj.address : undefined,
    };
  } else {
    normalizedMessage.type = 'text';
    normalizedMessage.text = { body: textContent };
  }

  return [
    {
      id: phoneNumberId,
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: phoneNumberId,
              phone_number_id: phoneNumberId,
            },
            contacts: [
              {
                profile: { name: contactName },
                wa_id: senderPhone,
              },
            ],
            messages: [normalizedMessage],
          },
        },
      ],
    },
  ];
}
