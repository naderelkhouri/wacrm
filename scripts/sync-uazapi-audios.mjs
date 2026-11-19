#!/usr/bin/env node
/**
 * scripts/sync-uazapi-audios.mjs
 *
 * Sincroniza retroativamente os áudios gravados na instância da Uazapi
 * com as mensagens do banco de dados do CRM.
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://api-db.admx.tech";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!SERVICE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is required");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function decryptToken(encryptedText) {
  if (!ENCRYPTION_KEY) return encryptedText;
  const parts = encryptedText.split(":");
  if (parts.length === 3) {
    const key = Buffer.from(ENCRYPTION_KEY, "hex");
    const [ivHex, ctHex, tagHex] = parts;
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    let dec = decipher.update(ctHex, "hex", "utf8");
    dec += decipher.final("utf8");
    return dec;
  }
  return encryptedText;
}

async function run() {
  console.log("=== Sincronização Retroativa de Áudios Uazapi ===");

  const { data: configs, error: cfgErr } = await supabase
    .from("whatsapp_config")
    .select("id, provider, api_url, access_token, instance_name, phone_number_id")
    .eq("provider", "uazapi");

  if (cfgErr || !configs || configs.length === 0) {
    console.error("Nenhuma configuração Uazapi encontrada:", cfgErr);
    process.exit(1);
  }

  for (const cfg of configs) {
    console.log(`\nProcessando instância: ${cfg.instance_name || cfg.phone_number_id} (${cfg.api_url})`);
    const token = decryptToken(cfg.access_token);
    const apiUrl = (cfg.api_url || "").replace(/\/+$/, "");

    try {
      const res = await fetch(`${apiUrl}/message/find`, {
        method: "POST",
        headers: { "Content-Type": "application/json", token },
        body: JSON.stringify({ messageType: "AudioMessage", limit: 100 }),
      });

      if (!res.ok) {
        console.warn(`Falha ao buscar mensagens da instância: HTTP ${res.status}`);
        continue;
      }

      const payload = await res.json().catch(() => ({}));
      const audioMessages = payload.messages || [];
      console.log(`Encontradas ${audioMessages.length} mensagens de áudio na Uazapi.`);

      let updatedCount = 0;

      for (const msg of audioMessages) {
        const msgId = msg.messageid || msg.id;
        if (!msgId) continue;

        // Verificar se a mensagem existe no banco
        const { data: dbMsgs } = await supabase
          .from("messages")
          .select("id, content_type, media_url")
          .eq("message_id", msgId);

        if (!dbMsgs || dbMsgs.length === 0) continue;

        for (const dbMsg of dbMsgs) {
          // Se já tem media_url válida de áudio, pula
          if (dbMsg.content_type === "audio" && dbMsg.media_url) continue;

          // Baixar / descriptografar áudio na Uazapi
          const dlRes = await fetch(`${apiUrl}/message/download`, {
            method: "POST",
            headers: { "Content-Type": "application/json", token },
            body: JSON.stringify({ id: msgId }),
          });

          if (!dlRes.ok) continue;
          const dlData = await dlRes.json().catch(() => ({}));
          if (dlData.fileURL) {
            await supabase
              .from("messages")
              .update({
                content_type: "audio",
                media_url: dlData.fileURL,
              })
              .eq("id", dbMsg.id);

            updatedCount++;
            console.log(`✓ Áudio atualizado no DB: ${msgId} -> ${dlData.fileURL}`);
          }
        }
      }

      console.log(`Total de áudios recuperados e atualizados nesta instância: ${updatedCount}`);
    } catch (err) {
      console.error(`Erro ao processar instância ${cfg.instance_name}:`, err);
    }
  }

  console.log("\n=== Sincronização Concluída com Sucesso ===");
}

run().catch((err) => {
  console.error("Erro fatal na sincronização:", err);
  process.exit(1);
});
