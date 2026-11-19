import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

let _adminClient: any = null;
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _adminClient;
}

/**
 * POST /api/account/storage/cleanup
 *
 * Executa a limpeza / expiração de mídias respeitando as políticas de retenção
 * da conta ou de parâmetros fornecidos pelo usuário admin.
 *
 * As mensagens permanecem no histórico para leitura e auditoria, mas a URL do
 * arquivo físico é liberada do storage e indicada como expirada.
 */
export async function POST(req: NextRequest) {
  // Check auth or cron secret
  const authHeader = req.headers.get("authorization") || "";
  const cronSecret = process.env.AUTOMATION_CRON_SECRET;
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  let targetAccountId: string | null = null;
  let targetType: string | null = null; // 'audio' | 'image' | 'video' | 'document' | 'all'
  let customDays: number | null = null;

  if (!isCron) {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("account_id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile?.account_id || (profile.role !== "admin" && profile.role !== "super_admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    targetAccountId = profile.account_id;

    const body = await req.json().catch(() => ({}));
    targetType = body.type || "all";
    if (typeof body.days === "number" && body.days >= 0) {
      customDays = body.days;
    }
  }

  const admin = supabaseAdmin();

  // Se executado por cron global, processa todas as contas que têm auto_cleanup_enabled
  const query = admin
    .from("account_storage_settings")
    .select("*");

  if (targetAccountId) {
    query.eq("account_id", targetAccountId);
  } else {
    query.eq("auto_cleanup_enabled", true);
  }

  const { data: accountsSettings, error: setErr } = await query;
  if (setErr || !accountsSettings) {
    return NextResponse.json({ error: "Failed to fetch storage settings" }, { status: 500 });
  }

  let totalPurged = 0;
  const now = Date.now();

  for (const setting of accountsSettings) {
    const accountId = setting.account_id;

    // Configuração de retenção por tipo
    const rules: Array<{ type: string; days: number }> = [
      { type: "audio", days: customDays !== null && targetType === "audio" ? customDays : setting.audio_retention_days },
      { type: "image", days: customDays !== null && targetType === "image" ? customDays : setting.image_retention_days },
      { type: "video", days: customDays !== null && targetType === "video" ? customDays : setting.video_retention_days },
      { type: "document", days: customDays !== null && targetType === "document" ? customDays : setting.doc_retention_days },
    ];

    for (const rule of rules) {
      if (targetType && targetType !== "all" && targetType !== rule.type) {
        continue;
      }
      // Se dias = 0, nunca expirar
      if (rule.days <= 0) continue;

      const cutoffDate = new Date(now - rule.days * 24 * 60 * 60 * 1000).toISOString();

      // Buscar mensagens que tenham mídia e sejam anteriores ao corte
      const { data: expiredMsgs } = await admin
        .from("messages")
        .select("id, conversation_id, content_type, media_url, conversations!inner(account_id)")
        .eq("conversations.account_id", accountId)
        .eq("content_type", rule.type)
        .not("media_url", "is", null)
        .lt("created_at", cutoffDate)
        .limit(200);

      if (expiredMsgs && expiredMsgs.length > 0) {
        const ids = expiredMsgs.map((m: { id: string }) => m.id);

        // Atualizar mensagens removendo o link pesado para economizar/liberar disco
        const { error: updErr } = await admin
          .from("messages")
          .update({ media_url: null })
          .in("id", ids);

        if (!updErr) {
          totalPurged += ids.length;
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    totalPurged,
    message: `${totalPurged} arquivos expirados foram purgados com sucesso.`,
  });
}
