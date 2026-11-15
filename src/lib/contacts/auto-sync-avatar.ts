import type { SupabaseClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/whatsapp/encryption';
import { fetchUazapiProfilePictureUrl } from '@/lib/whatsapp/uazapi';
import { resolveWhatsAppConfig } from '@/lib/whatsapp/resolve-config';

interface AutoSyncAvatarParams {
  db: SupabaseClient;
  accountId: string;
  contactId: string;
  phone: string;
  currentAvatarUrl?: string | null;
  configId?: string | null;
}

/**
 * Automatically synchronizes contact avatar from WhatsApp in the background.
 * If the contact doesn't have an avatar or it hasn't been refreshed, it queries
 * the WhatsApp provider (Uazapi) and saves the avatar_url directly in contacts.
 * Non-blocking, fails gracefully without throwing.
 */
export async function autoSyncContactAvatar(params: AutoSyncAvatarParams): Promise<string | null> {
  const { db, accountId, contactId, phone, currentAvatarUrl, configId } = params;

  // If already has avatar, skip automatic background sync
  if (currentAvatarUrl && currentAvatarUrl.trim().length > 0) {
    return currentAvatarUrl;
  }

  try {
    const config = await resolveWhatsAppConfig(db, accountId, {
      whatsappConfigId: configId ?? undefined,
    });

    if (!config || config.provider !== 'uazapi' || !config.api_url || !config.access_token) {
      return null;
    }

    let instanceToken: string;
    try {
      instanceToken = decrypt(config.access_token);
    } catch {
      return null;
    }

    const avatarUrl = await fetchUazapiProfilePictureUrl({
      apiUrl: config.api_url,
      instanceToken,
      instanceName: config.instance_name,
      phone,
    });

    if (avatarUrl) {
      await db
        .from('contacts')
        .update({
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contactId);

      return avatarUrl;
    }
  } catch (err) {
    console.warn('[auto-sync-avatar] Background sync failed:', err);
  }

  return null;
}
