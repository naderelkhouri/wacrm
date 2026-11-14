// ============================================================
// AI Auto-Triage & Conversation Classifier
// Inspired by Chatwoot's Captain::ConversationClassifierService
// (app/services/captain/conversation_classifier_service.rb)
// ============================================================

export type ConversationPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface AutoTriageResult {
  priority: ConversationPriority;
  confidence: number;
  reason: string;
  suggestedTags: string[];
}

export const URGENT_PATTERNS = [
  /\b(urgente|emerg[eê]ncia|socorro|parou|fora\s+do\s+ar|bloquead[oa]|fraude|golpe|preju[ií]zo|cancelar\s+imediatamente)\b/i,
  /\b(urgent|emergency|outage|blocked|data\s+loss)\b/i,
];

export const HIGH_PATTERNS = [
  /\b(problema\s+grave|n[aã]o\s+consigo\s+pagar|erro\s+no\s+pix|cobran[cç]a\s+indevida|falha|estorno|devolu[cç][aã]o)\b/i,
  /\b(failing\s+payment|billing\s+error|refund\s+request)\b/i,
];

export const LOW_PATTERNS = [
  /\b(obrigad[oa]|valeu|bom\s+dia|boa\s+tarde|boa\s+noite|tudo\s+bem|s[oó]\s+um\s+feedback|elogio)\b/i,
  /\b(thanks|thank\s+you|just\s+feedback)\b/i,
];

/**
 * Fast deterministic triage heuristic (zero token cost)
 * Can be complemented by LLM provider if configured.
 */
export function classifyConversationUrgency(text: string): AutoTriageResult {
  const content = text || '';

  // 1. Check Urgent
  for (const regex of URGENT_PATTERNS) {
    if (regex.test(content)) {
      return {
        priority: 'urgent',
        confidence: 0.95,
        reason: 'Palavras-chave de bloqueio crítico, indisponibilidade ou urgência imediata detectadas.',
        suggestedTags: ['Urgente', 'Crítico'],
      };
    }
  }

  // 2. Check High
  for (const regex of HIGH_PATTERNS) {
    if (regex.test(content)) {
      return {
        priority: 'high',
        confidence: 0.85,
        reason: 'Problema financeiro, falha transacional ou solicitação de estorno.',
        suggestedTags: ['Financeiro', 'Atenção'],
      };
    }
  }

  // 3. Check Low
  for (const regex of LOW_PATTERNS) {
    if (regex.test(content) && content.length < 50) {
      return {
        priority: 'low',
        confidence: 0.8,
        reason: 'Mensagem de cortesia, agradecimento ou saudação curta.',
        suggestedTags: ['Cortesia'],
      };
    }
  }

  // Default normal support request
  return {
    priority: 'medium',
    confidence: 0.75,
    reason: 'Solicitação de suporte ou dúvida comercial regular.',
    suggestedTags: ['Dúvida'],
  };
}
