import type { SupabaseClient } from '@supabase/supabase-js';

export interface ResolvedWhatsAppConfig {
  id: string;
  account_id: string;
  provider: 'meta' | 'uazapi';
  api_url: string | null;
  instance_name: string | null;
  phone_number_id: string;
  waba_id: string | null;
  access_token: string;
  verify_token: string | null;
  status: string;
  name?: string | null;
  color?: string | null;
}

/**
 * Robust, multi-instance aware resolution for an account's WhatsApp configuration.
 *
 * Priority order:
 * 1. Explicit whatsappConfigId requested by caller
 * 2. Conversation's bound whatsapp_config_id (if conversationId provided)
 * 3. Default instance for the account (is_default = true or oldest instance)
 * 4. Platform-wide global WhatsApp configuration fallback (if allow_tenant_fallback = true)
 *
 * Never uses `.single()` to avoid throwing when multiple WhatsApp instances exist.
 */
export async function resolveWhatsAppConfig(
  db: SupabaseClient,
  accountId: string,
  options?: {
    whatsappConfigId?: string | null;
    conversationId?: string | null;
  }
): Promise<ResolvedWhatsAppConfig | null> {
  let config: ResolvedWhatsAppConfig | null = null;

  const targetConfigId = options?.whatsappConfigId;

  if (targetConfigId) {
    const { data } = await db
      .from('whatsapp_config')
      .select('*')
      .eq('id', targetConfigId)
      .eq('account_id', accountId)
      .maybeSingle();
    if (data) config = data as unknown as ResolvedWhatsAppConfig;
  }

  if (!config && options?.conversationId) {
    const { data: conv } = await db
      .from('conversations')
      .select('whatsapp_config_id')
      .eq('id', options.conversationId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (conv?.whatsapp_config_id) {
      const { data } = await db
        .from('whatsapp_config')
        .select('*')
        .eq('id', conv.whatsapp_config_id)
        .eq('account_id', accountId)
        .maybeSingle();
      if (data) config = data as unknown as ResolvedWhatsAppConfig;
    }
  }

  if (!config) {
    const res = await db
      .from('whatsapp_config')
      .select('*')
      .eq('account_id', accountId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    const raw = res?.data;
    if (raw) {
      if (Array.isArray(raw) && raw.length > 0) {
        // Prioritize unofficial API (Uazapi) instances over Meta official
        // while respecting explicitly configured default instances when connected.
        const defaultUazapi = raw.find(
          (c) => c.provider === 'uazapi' && c.is_default && c.status === 'connected'
        );
        const connectedUazapi = raw.find(
          (c) => c.provider === 'uazapi' && c.status === 'connected'
        );
        const anyUazapi = raw.find((c) => c.provider === 'uazapi');
        const defaultAny = raw.find((c) => c.is_default);

        config = (defaultUazapi || connectedUazapi || anyUazapi || defaultAny || raw[0]) as unknown as ResolvedWhatsAppConfig;
      } else if (!Array.isArray(raw)) {
        // Handle mocks or single-record wrappers
        config = raw as unknown as ResolvedWhatsAppConfig;
      }
    }
  }

  if (!config) {
    const { data: globalRow } = await db
      .from('platform_settings')
      .select('value')
      .eq('key', 'global_whatsapp_config')
      .maybeSingle();

    const globalVal = (globalRow?.value as Record<string, unknown>) || {};
    if (
      globalVal.phone_number_id &&
      globalVal.encrypted_access_token &&
      globalVal.allow_tenant_fallback
    ) {
      config = {
        id: 'global',
        account_id: accountId,
        provider: (globalVal.provider as 'meta' | 'uazapi') || 'meta',
        api_url: (globalVal.api_url as string) || null,
        instance_name: (globalVal.instance_name as string) || null,
        phone_number_id: globalVal.phone_number_id as string,
        waba_id: (globalVal.waba_id as string) || null,
        access_token: globalVal.encrypted_access_token as string,
        verify_token: (globalVal.encrypted_verify_token as string) || null,
        status: 'connected',
      };
    }
  }

  return config;
}
