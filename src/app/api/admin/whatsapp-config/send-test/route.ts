// ============================================================
// POST /api/admin/whatsapp-config/send-test
//
// Sends a real test WhatsApp text message using the global connection.
// ============================================================

import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { toErrorResponse } from '@/lib/auth/account';
import { decrypt } from '@/lib/whatsapp/encryption';
import { sendTextMessage } from '@/lib/whatsapp/meta-api';
import { sanitizePhoneForMeta, isValidE164 } from '@/lib/whatsapp/phone-utils';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { supabaseAdmin } = await requireSuperAdmin();

    const body = (await request.json().catch(() => ({}))) as {
      to?: string;
      message?: string;
    };

    const toRaw = body.to?.trim();
    if (!toRaw) {
      return NextResponse.json({ error: 'Número de telefone do destinatário é obrigatório.' }, { status: 400 });
    }

    const sanitizedPhone = sanitizePhoneForMeta(toRaw);
    if (!isValidE164(sanitizedPhone)) {
      return NextResponse.json(
        { error: 'Formato de telefone inválido. Use o padrão internacional (ex: +5511999998888).' },
        { status: 400 }
      );
    }

    // Load global configuration
    const { data } = await supabaseAdmin
      .from('platform_settings')
      .select('value')
      .eq('key', 'global_whatsapp_config')
      .maybeSingle();

    const val = (data?.value as Record<string, unknown>) || {};
    const phoneNumberId = val.phone_number_id as string;
    const encryptedToken = val.encrypted_access_token as string;

    if (!phoneNumberId || !encryptedToken) {
      return NextResponse.json(
        { error: 'A Conexão Global do WhatsApp ainda não foi salva e configurada.' },
        { status: 400 }
      );
    }

    const token = decrypt(encryptedToken);
    const messageText =
      body.message?.trim() ||
      `🚀 *WcloudAPI — Teste de Conexão Global*\n\nSeu número de WhatsApp está conectado com sucesso à plataforma!\n\n🕒 ${new Date().toLocaleString('pt-BR')}`;

    const result = await sendTextMessage({
      phoneNumberId,
      accessToken: token,
      to: sanitizedPhone,
      text: messageText,
    });

    return NextResponse.json({
      success: true,
      message_id: result.messageId,
      message: `Mensagem de teste enviada com sucesso para ${sanitizedPhone}!`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Falha no envio da mensagem';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
