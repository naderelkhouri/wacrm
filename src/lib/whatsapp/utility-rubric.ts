// ============================================================
// Meta Template Utility vs Marketing Rubric
// Ported & Enhanced from Chatwoot's CsatTemplateUtilityRubric
// (app/services/csat_template_utility_rubric.rb)
// ============================================================

export interface UtilityEvaluationResult {
  isCompliantUtility: boolean;
  marketingRiskScore: number; // 0 (puro utility) a 100 (marketing evidente)
  detectedMarketingTriggers: string[];
  detectedTransactionalTriggers: string[];
  detectedProhibitedTriggers: string[];
  hasActionableStep: boolean;
  suggestedCategory: 'UTILITY' | 'MARKETING';
  reasons: string[];
}

export const MARKETING_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  { regex: /\b(descontos?|promoc(?:ao|oes|ão|ões)|ofertas?|cupom|cupons|liquida(?:cao|ção)|imperd[ií]vel)\b/i, label: 'Palavras promocionais/desconto' },
  { regex: /\b(compre|adquira|assine|aproveite|garanta|compre\s+agora|peça\s+já|levar)\b/i, label: 'Chamada para compra comercial (CTA)' },
  { regex: /\b(black\s*friday|cyber\s*monday|natal|dia\s+das\s+m[aã]es|dia\s+dos\s+pais)\b/i, label: 'Campanhas sazonais' },
  { regex: /\b(tempo\s+limitado|n[aã]o\s+perca|exclusiv[oa]|por\s+tempo\s+limitado|últim[ao]s\s+unidades?)\b/i, label: 'Gatilho de urgência comercial' },
  { regex: /\b(nov[oa]s?\s+(planos?|produtos?|servi[cç]os?|cole[cç][aã]o)|lan[cç]amento)\b/i, label: 'Anúncio de novos produtos/planos' },
  { regex: /\b(frete\s+gr[aá]tis|cashback|b[oô]nus)\b/i, label: 'Benefícios financeiros comerciais' },
  { regex: /\b(discounts?|promotions?|special\s+offer|limited\s+time|shop\s+now|sale|subscribe)\b/i, label: 'Termos comerciais em inglês' },
];

export const TRANSACTIONAL_TRIGGERS: Array<{ regex: RegExp; label: string }> = [
  { regex: /\b(fechado|encerrad[oa]|resolvid[oa]|conclu[ií]d[oa]|finalizad[oa])\b/i, label: 'Status de atendimento' },
  { regex: /\b(pedido|ordem|compra|fatura|pagamento|boleto|pix|rastreio|envio|entrega)\b/i, label: 'Contexto transacional/pedido' },
  { regex: /\b(protocolo|chamado|atendimento|suporte|ticket|solicita[cç][aã]o)\b/i, label: 'Identificador de suporte' },
  { regex: /\b(agendamento|sess[aã]o|reserva|consulta|hor[aá]rio)\b/i, label: 'Confirmação de agenda' },
];

export const ACTIONABLE_STEPS: Array<{ regex: RegExp; label: string }> = [
  { regex: /\b(responda\s+a\s+est[ae]\s+mensagem|se\s+ainda\s+precisar\s+de\s+ajuda|avalie\s+este\s+atendimento)\b/i, label: 'Instrução clara de suporte' },
  { regex: /\b(clique\s+abaixo\s+para\s+ver\s+(o\s+rastreio|a\s+fatura|o\s+comprovante))\b/i, label: 'Ação transacional objetiva' },
  { regex: /\b(reply\s+to\s+this\s+message|if\s+you\s+still\s+need\s+help|rate\s+this\s+interaction)\b/i, label: 'Instrução de suporte em inglês' },
];

export const PROHIBITED_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  { regex: /\b(sorteio|rifa|loteria|concurso|aposta|bet)\b/i, label: 'Jogos/Sorteios (Proibido)' },
  { regex: /\b(senha|token\s+secreto|cvv|c[oó]digo\s+de\s+seguran[cç]a|cart[aã]o\s+de\s+cr[eé]dito)\b/i, label: 'Dados bancários sensíveis em texto' },
  { regex: /\b(armas?|drogas?|rem[eé]dios?\s+controlados?)\b/i, label: 'Conteúdo restrito Meta' },
];

export function evaluateUtilityRubric(bodyText: string): UtilityEvaluationResult {
  const text = bodyText || '';
  const detectedMarketing: string[] = [];
  const detectedTransactional: string[] = [];
  const detectedProhibited: string[] = [];
  const reasons: string[] = [];

  // 1. Scan marketing patterns
  for (const { regex, label } of MARKETING_PATTERNS) {
    if (regex.test(text)) {
      detectedMarketing.push(label);
    }
  }

  // 2. Scan transactional indicators
  for (const { regex, label } of TRANSACTIONAL_TRIGGERS) {
    if (regex.test(text)) {
      detectedTransactional.push(label);
    }
  }

  // 3. Scan prohibited elements
  for (const { regex, label } of PROHIBITED_PATTERNS) {
    if (regex.test(text)) {
      detectedProhibited.push(label);
    }
  }

  // 4. Actionable next step
  const hasActionable = ACTIONABLE_STEPS.some(({ regex }) => regex.test(text));

  // Calculate score
  let marketingRiskScore = 0;
  if (detectedMarketing.length > 0) {
    marketingRiskScore += Math.min(80, detectedMarketing.length * 30);
    reasons.push(`Contém termos promocionais (${detectedMarketing.join(', ')}) que acionam a reclassificação automática pela Meta.`);
  }

  if (detectedProhibited.length > 0) {
    marketingRiskScore = 100;
    reasons.push(`Contém conteúdo expressamente proibido pela Meta (${detectedProhibited.join(', ')}).`);
  }

  if (detectedTransactional.length === 0) {
    marketingRiskScore += 25;
    reasons.push('Falta contexto transacional explícito (como pedido, status, chamado ou confirmação de agenda).');
  }

  if (!hasActionable) {
    marketingRiskScore += 15;
    reasons.push('Recomendado incluir instrução de próximo passo claro (ex: "Se precisar de ajuda, responda a esta mensagem").');
  }

  const isCompliantUtility = detectedMarketing.length === 0 && detectedProhibited.length === 0 && detectedTransactional.length > 0;
  const suggestedCategory: 'UTILITY' | 'MARKETING' = detectedMarketing.length > 0 || marketingRiskScore >= 50 ? 'MARKETING' : 'UTILITY';

  return {
    isCompliantUtility,
    marketingRiskScore: Math.min(100, marketingRiskScore),
    detectedMarketingTriggers: detectedMarketing,
    detectedTransactionalTriggers: detectedTransactional,
    detectedProhibitedTriggers: detectedProhibited,
    hasActionableStep: hasActionable,
    suggestedCategory,
    reasons,
  };
}
