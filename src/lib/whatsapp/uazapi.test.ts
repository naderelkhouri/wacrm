import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeUazapiBaseUrl,
  getPublicAppOrigin,
  formatPhoneForUazapi,
  verifyUazapiInstance,
  sendUazapiTextMessage,
  sendUazapiMediaMessage,
  sendUazapiInteractiveButtons,
  sendUazapiTemplateMessage,
  isUazapiWebhookPayload,
  extractUazapiWebhookToken,
  parseUazapiWebhookToMetaEntries,
  extractAvatarUrlFromData,
  fetchUazapiProfilePictureUrl,
} from './uazapi';

describe('Uazapi WhatsApp Provider Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('normalizeUazapiBaseUrl', () => {
    it('strips trailing slashes and validates protocol', () => {
      expect(normalizeUazapiBaseUrl('https://free.uazapi.com///')).toBe('https://free.uazapi.com');
      expect(normalizeUazapiBaseUrl('https://api.example.com/v2/')).toBe('https://api.example.com/v2');
    });

    it('throws on empty or invalid URLs', () => {
      expect(() => normalizeUazapiBaseUrl('')).toThrow(/obrigatória/);
      expect(() => normalizeUazapiBaseUrl('not-a-url')).toThrow(/inválida/);
      expect(() => normalizeUazapiBaseUrl('ftp://example.com')).toThrow(/protocolo/);
    });
  });

  describe('getPublicAppOrigin', () => {
    it('returns NEXT_PUBLIC_APP_URL when set to a valid public URL', () => {
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://wcloudapi.dev/');
      expect(getPublicAppOrigin()).toBe('https://wcloudapi.dev');
      vi.unstubAllEnvs();
    });

    it('falls back to x-forwarded-host if NEXT_PUBLIC_APP_URL is missing or local', () => {
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://0.0.0.0:3000');
      const req = new Request('http://0.0.0.0:3000/api/whatsapp/config', {
        headers: {
          'x-forwarded-host': 'wacrm.admx.tech',
          'x-forwarded-proto': 'https',
        },
      });
      expect(getPublicAppOrigin(req)).toBe('https://wacrm.admx.tech');
      vi.unstubAllEnvs();
    });

    it('defaults to https://wcloudapi.dev when all inputs are local/missing', () => {
      vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
      const req = new Request('http://localhost:3000/api/whatsapp/config');
      expect(getPublicAppOrigin(req)).toBe('https://wcloudapi.dev');
      vi.unstubAllEnvs();
    });
  });

  describe('formatPhoneForUazapi', () => {
    it('strips non-digits and @s.whatsapp.net suffix', () => {
      expect(formatPhoneForUazapi('+55 (11) 98888-7777')).toBe('5511988887777');
      expect(formatPhoneForUazapi('5511988887777@s.whatsapp.net')).toBe('5511988887777');
    });
  });

  describe('verifyUazapiInstance', () => {
    it('parses Uazapi v2 /instance/status response into MetaPhoneInfo shape', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            instance: {
              id: 'inst_123',
              name: 'emporio-main',
              status: 'connected',
              profileName: 'Empório Pascoto',
              owner: '5511999998888@s.whatsapp.net',
            },
            status: {
              connected: true,
              loggedIn: true,
            },
          }),
          { status: 200 }
        )
      );

      const info = await verifyUazapiInstance({
        apiUrl: 'https://free.uazapi.com',
        instanceToken: 'tok_secret_123',
      });

      expect(info.id).toBe('5511999998888');
      expect(info.display_phone_number).toBe('5511999998888');
      expect(info.verified_name).toBe('Empório Pascoto');
      expect(info.quality_rating).toBe('GREEN');
      expect(info.state).toBe('connected');
    });
  });

  describe('sendUazapiTextMessage & sendUazapiMediaMessage & sendUazapiInteractiveButtons', () => {
    it('sends text via POST /send/text with token and apikey headers', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ messageid: 'uaz_msg_001' }), { status: 200 })
      );

      const res = await sendUazapiTextMessage({
        apiUrl: 'https://free.uazapi.com',
        instanceToken: 'my-uaz-token',
        to: '+5511999998888',
        text: 'Olá pelo Uazapi!',
      });

      expect(res.messageId).toBe('uaz_msg_001');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe('https://free.uazapi.com/send/text');
      expect((calledInit?.headers as Record<string, string>).token).toBe('my-uaz-token');
      expect((calledInit?.headers as Record<string, string>).apikey).toBe('my-uaz-token');
    });

    it('sends media via POST /send/media', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'uaz_media_002' }), { status: 200 })
      );

      const res = await sendUazapiMediaMessage({
        apiUrl: 'https://free.uazapi.com',
        instanceToken: 'my-uaz-token',
        to: '5511999998888',
        kind: 'image',
        link: 'https://example.com/photo.jpg',
        caption: 'Foto do produto',
      });

      expect(res.messageId).toBe('uaz_media_002');
    });

    it('sends interactive buttons via POST /send/menu', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ messageid: 'uaz_menu_003' }), { status: 200 })
      );

      const res = await sendUazapiInteractiveButtons({
        apiUrl: 'https://free.uazapi.com',
        instanceToken: 'my-uaz-token',
        to: '5511999998888',
        bodyText: 'Escolha uma opção:',
        buttons: [
          { id: 'btn_1', title: 'Suporte' },
          { id: 'btn_2', title: 'Financeiro' },
        ],
      });

      expect(res.messageId).toBe('uaz_menu_003');
      const bodySent = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
      expect(bodySent.type).toBe('button');
      expect(bodySent.choices).toEqual(['Suporte|btn_1', 'Financeiro|btn_2']);
    });

    it('renders and sends template message via Uazapi', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ messageid: 'uaz_tpl_004' }), { status: 200 })
      );

      const res = await sendUazapiTemplateMessage({
        apiUrl: 'https://free.uazapi.com',
        instanceToken: 'my-uaz-token',
        to: '5511999998888',
        templateName: 'boas_vindas',
        template: {
          id: 'tpl_1',
          user_id: 'u_1',
          name: 'boas_vindas',
          category: 'Utility',
          header_type: 'text',
          header_content: 'Olá {{1}}',
          body_text: 'Seu pedido {{2}} foi confirmado!',
          footer_text: 'Equipe WcloudAPI',
          created_at: new Date().toISOString(),
        },
        params: ['Nader', '#9081'],
      });

      expect(res.messageId).toBe('uaz_tpl_004');
      const bodySent = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
      expect(bodySent.text).toContain('Seu pedido #9081 foi confirmado!');
      expect(bodySent.text).toContain('_Equipe WcloudAPI_');
    });
  });

  describe('Webhook detection & normalization', () => {
    it('detects Uazapi v2 webhook payload and extracts token', () => {
      const payload = {
        EventType: 'messages',
        token: 'inst_tok_999',
        message: {
          messageid: 'MSG_ABC_123',
          chatid: '5511977776666@s.whatsapp.net',
          senderName: 'Maria Silva',
          fromMe: false,
          isGroup: false,
          messageType: 'Conversation',
          text: 'Quero fazer um pedido',
          messageTimestamp: 1730000000000,
        },
      };

      expect(isUazapiWebhookPayload(payload)).toBe(true);
      const req = new Request('https://wcloudapi.dev/api/whatsapp/webhook', {
        method: 'POST',
      });
      expect(extractUazapiWebhookToken(req, payload)).toBe('inst_tok_999');

      const entries = parseUazapiWebhookToMetaEntries(payload, '5511999998888');
      expect(entries).toHaveLength(1);
      const val = entries[0].changes[0].value;
      expect(val.metadata.phone_number_id).toBe('5511999998888');
      expect(val.contacts?.[0].wa_id).toBe('5511977776666');
      expect(val.contacts?.[0].profile.name).toBe('Maria Silva');
      expect(val.messages?.[0].id).toBe('MSG_ABC_123');
      expect(val.messages?.[0].type).toBe('text');
      expect(val.messages?.[0].text?.body).toBe('Quero fazer um pedido');
    });

    it('ignores group messages and fromMe echoes', () => {
      expect(
        parseUazapiWebhookToMetaEntries(
          {
            EventType: 'messages',
            message: {
              chatid: '1203630291@g.us',
              isGroup: true,
              text: 'Mensagem de grupo',
            },
          },
          '5511999998888'
        )
      ).toEqual([]);

      expect(
        parseUazapiWebhookToMetaEntries(
          {
            EventType: 'messages',
            message: {
              chatid: '5511977776666@s.whatsapp.net',
              fromMe: true,
              text: 'Enviada por mim',
            },
          },
          '5511999998888'
        )
      ).toEqual([]);
    });

    it('normalizes Uazapi button/list interactive replies', () => {
      const entries = parseUazapiWebhookToMetaEntries(
        {
          EventType: 'messages',
          message: {
            messageid: 'MSG_BTN_1',
            chatid: '5511977776666@s.whatsapp.net',
            senderName: 'Carlos',
            fromMe: false,
            isGroup: false,
            buttonOrListid: 'opt_suporte',
            text: 'Falar com Suporte',
          },
        },
        '5511999998888'
      );

      expect(entries).toHaveLength(1);
      const msg = entries[0].changes[0].value.messages?.[0];
      expect(msg?.type).toBe('interactive');
      expect(msg?.interactive?.button_reply?.id).toBe('opt_suporte');
      expect(msg?.interactive?.button_reply?.title).toBe('Falar com Suporte');
    });

    it('normalizes Uazapi messages_update delivery/read status events', () => {
      const entries = parseUazapiWebhookToMetaEntries(
        {
          EventType: 'messages_update',
          state: 'Read',
          event: {
            MessageIDs: ['MSG_OUT_1', 'MSG_OUT_2'],
            Chat: '5511977776666@s.whatsapp.net',
            Timestamp: 1730000100,
          },
        },
        '5511999998888'
      );

      expect(entries).toHaveLength(1);
      const statuses = entries[0].changes[0].value.statuses;
      expect(statuses).toHaveLength(2);
      expect(statuses?.[0]).toEqual({
        id: 'MSG_OUT_1',
        status: 'read',
        timestamp: '1730000100',
        recipient_id: '5511977776666',
      });
    });

    it('extracts avatar_url from inbound message payload (chat.profilePicUrl)', () => {
      const avatarPic = 'https://pps.whatsapp.net/v/t61.24694-24/test.jpg';
      const entries = parseUazapiWebhookToMetaEntries(
        {
          EventType: 'messages',
          message: {
            messageid: 'MSG_AVATAR_1',
            chatid: '5511988889999@s.whatsapp.net',
            senderName: 'Juliana',
            fromMe: false,
            text: 'Olá!',
          },
          chat: {
            profilePicUrl: avatarPic,
          },
        },
        '5511999998888'
      );

      expect(entries).toHaveLength(1);
      const contact = entries[0].changes[0].value.contacts?.[0];
      expect(contact?.profile.name).toBe('Juliana');
      expect(contact?.wa_id).toBe('5511988889999');
      expect(contact?.avatar_url).toBe(avatarPic);
    });

    it('normalizes EventType: contacts into a contact entry with avatar_url', () => {
      const avatarPic = 'https://pps.whatsapp.net/v/t61.24694-24/contact.jpg';
      const entries = parseUazapiWebhookToMetaEntries(
        {
          EventType: 'contacts',
          data: {
            id: '5511977778888@s.whatsapp.net',
            name: 'Marcos Roberto',
            profilePicUrl: avatarPic,
          },
        },
        '5511999998888'
      );

      expect(entries).toHaveLength(1);
      const contact = entries[0].changes[0].value.contacts?.[0];
      expect(contact?.profile.name).toBe('Marcos Roberto');
      expect(contact?.wa_id).toBe('5511977778888');
      expect(contact?.avatar_url).toBe(avatarPic);
      expect(entries[0].changes[0].value.messages).toEqual([]);
    });
  });

  describe('extractAvatarUrlFromData', () => {
    it('finds avatar URLs across various payload nesting structures', () => {
      const direct = { profilePicUrl: 'https://pps.whatsapp.net/direct.jpg' };
      expect(extractAvatarUrlFromData(direct)).toBe('https://pps.whatsapp.net/direct.jpg');

      const nestedChat = {
        chat: {
          image: 'https://pps.whatsapp.net/nested.jpg',
        },
      };
      expect(extractAvatarUrlFromData(nestedChat)).toBe('https://pps.whatsapp.net/nested.jpg');

      const responseWrapper = {
        response: {
          profile_picture: 'https://pps.whatsapp.net/resp.jpg',
        },
      };
      expect(extractAvatarUrlFromData(responseWrapper)).toBe('https://pps.whatsapp.net/resp.jpg');

      expect(extractAvatarUrlFromData({ notAnAvatar: 'some string' })).toBeNull();
      expect(extractAvatarUrlFromData(null)).toBeNull();
    });
  });

  describe('fetchUazapiProfilePictureUrl', () => {
    it('queries candidate endpoints and returns the first valid avatar URL', async () => {
      const avatarUrl = 'https://pps.whatsapp.net/v/found.jpg';
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ profilePicUrl: avatarUrl }), { status: 200 })
      );

      const result = await fetchUazapiProfilePictureUrl({
        apiUrl: 'https://free.uazapi.com',
        instanceToken: 'tok_123',
        phone: '5511999998888',
      });

      expect(result).toBe(avatarUrl);
    });

    it('returns null if all endpoints return 404 or empty response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ code: 404, message: 'Not found' }), { status: 404 })
      );

      const result = await fetchUazapiProfilePictureUrl({
        apiUrl: 'https://free.uazapi.com',
        instanceToken: 'tok_123',
        phone: '5511999998888',
      });

      expect(result).toBeNull();
    });
  });
});
