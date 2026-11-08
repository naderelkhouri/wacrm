// ============================================================
// WhatsApp Number Warm-up & Anti-Ban Protection Engine
//
// Gradually raises daily messaging capacity to protect new chips from
// Meta fraud checkpoints, rate limits, and ban triggers.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

export interface WarmupStageInfo {
  stage: number;
  stageName: string;
  daysActive: number;
  dailyLimit: number;
  isFullyWarmed: boolean;
  recommendations: string[];
}

export function calculateWarmupStage(startedAt?: string | Date | null): WarmupStageInfo {
  if (!startedAt) {
    return {
      stage: 1,
      stageName: 'Fase Inicial (Dias 1-3)',
      daysActive: 0,
      dailyLimit: 30,
      isFullyWarmed: false,
      recommendations: [
        'Converse apenas com contatos que já têm seu número salvo.',
        'Evite enviar links ou mensagens em massa nos primeiros 3 dias.',
      ],
    };
  }

  const startDate = typeof startedAt === 'string' ? new Date(startedAt) : startedAt;
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - startDate.getTime());
  const daysActive = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

  if (daysActive <= 3) {
    return {
      stage: 1,
      stageName: 'Fase 1 (Recém-conectado)',
      daysActive,
      dailyLimit: 30,
      isFullyWarmed: false,
      recommendations: [
        'Limite de 30 envios/dia.',
        'Priorize atendimento receptivo.',
      ],
    };
  }

  if (daysActive <= 7) {
    return {
      stage: 2,
      stageName: 'Fase 2 (Aquecimento Moderado)',
      daysActive,
      dailyLimit: 60,
      isFullyWarmed: false,
      recommendations: [
        'Limite de 60 envios/dia.',
        'Mantenha intervalos de pelo menos 15 a 30 segundos entre envios.',
      ],
    };
  }

  if (daysActive <= 14) {
    return {
      stage: 3,
      stageName: 'Fase 3 (Aquecimento Avançado)',
      daysActive,
      dailyLimit: 150,
      isFullyWarmed: false,
      recommendations: [
        'Limite de 150 envios/dia.',
        'Campanhas segmentadas liberadas.',
      ],
    };
  }

  if (daysActive <= 21) {
    return {
      stage: 4,
      stageName: 'Fase 4 (Pré-Graduado)',
      daysActive,
      dailyLimit: 300,
      isFullyWarmed: false,
      recommendations: [
        'Limite de 300 envios/dia.',
        'Alta reputação de entrega.',
      ],
    };
  }

  return {
    stage: 5,
    stageName: 'Graduado (Totalmente Aquecido)',
    daysActive,
    dailyLimit: 1000,
    isFullyWarmed: true,
    recommendations: [
      'Chip maturado com alta pontuação de confiança.',
      'Disparos normais de transmissões liberados.',
    ],
  };
}

/**
 * Checks and increments daily message count atomically using DB procedure.
 */
export async function verifyAndRecordMessageSend(
  db: SupabaseClient,
  configId: string,
  countToAdd: number = 1
): Promise<{
  allowed: boolean;
  messagesSentToday: number;
  dailyLimit: number;
  warmupEnabled: boolean;
  reason?: string;
}> {
  const { data, error } = await db.rpc('increment_whatsapp_daily_sent', {
    config_id: configId,
    count_to_add: countToAdd,
  });

  if (error || !data) {
    console.error('Error checking warmup quota:', error);
    // Fail-open for manual operational sends to avoid blocking emergency chats
    return { allowed: true, messagesSentToday: 0, dailyLimit: 0, warmupEnabled: false };
  }

  const res = data as {
    success: boolean;
    messages_sent_today: number;
    daily_message_limit: number;
    warmup_enabled: boolean;
    is_exceeded: boolean;
  };

  if (res.warmup_enabled && res.is_exceeded) {
    return {
      allowed: false,
      messagesSentToday: res.messages_sent_today,
      dailyLimit: res.daily_message_limit,
      warmupEnabled: true,
      reason: `Limite de aquecimento atingido: ${res.messages_sent_today}/${res.daily_message_limit} mensagens enviadas hoje.`,
    };
  }

  return {
    allowed: true,
    messagesSentToday: res.messages_sent_today,
    dailyLimit: res.daily_message_limit,
    warmupEnabled: res.warmup_enabled,
  };
}
