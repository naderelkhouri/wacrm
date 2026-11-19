import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createBroadcast, BroadcastError } from './broadcast-core';
import { encrypt } from './encryption';

// These assertions all fire in the pure validation prologue, before
// any Supabase call — a bare stub is enough.
const db = {} as SupabaseClient;

describe('createBroadcast validation', () => {
  it('rejects a missing template_name', async () => {
    await expect(
      createBroadcast(db, 'acc', 'user', {
        templateName: '',
        recipients: [{ to: '+14155550123' }],
      })
    ).rejects.toMatchObject({ code: 'bad_request', status: 400 });
  });

  it('rejects an empty recipient list', async () => {
    await expect(
      createBroadcast(db, 'acc', 'user', {
        templateName: 'promo',
        recipients: [],
      })
    ).rejects.toBeInstanceOf(BroadcastError);
  });

  it('rejects more than 1000 recipients', async () => {
    const recipients = Array.from({ length: 1001 }, () => ({
      to: '+14155550123',
    }));
    await expect(
      createBroadcast(db, 'acc', 'user', { templateName: 'promo', recipients })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects broadcasts that exceed the daily warmup limit when warmup is enabled', async () => {
    const fakeDb = {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'cfg-1',
                  provider: 'uazapi',
                  access_token: encrypt('dummy-token'),
                  warmup_enabled: true,
                  daily_message_limit: 30,
                  messages_sent_today: 25,
                },
                error: null,
              }),
            }),
            maybeSingle: async () => ({
              data: {
                id: 'cfg-1',
                provider: 'uazapi',
                access_token: encrypt('dummy-token'),
                warmup_enabled: true,
                daily_message_limit: 30,
                messages_sent_today: 25,
              },
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    // Remaining quota is 30 - 25 = 5. Sending 10 recipients should trigger warmup_limit_exceeded.
    const recipients = Array.from({ length: 10 }, (_, i) => ({
      to: `+551199999000${i}`,
    }));

    await expect(
      createBroadcast(fakeDb, 'acc-1', 'user-1', {
        templateName: 'boas_vindas',
        whatsappConfigId: 'cfg-1',
        recipients,
      })
    ).rejects.toMatchObject({
      code: 'warmup_limit_exceeded',
      status: 400,
    });
  });
});
