import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { evaluateUtilityRubric } from '@/lib/whatsapp/utility-rubric'

interface ComplianceRisk {
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  rule: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      category,
      bodyText = '',
    } = body

    if (!bodyText) {
      return NextResponse.json({ error: 'bodyText is required' }, { status: 400 })
    }

    const risks: ComplianceRisk[] = []
    let score = 100

    // 1. Check Variable Syntax
    const singleBraceMatches = bodyText.match(/(?<!\{)\{([^{}]+)\}(?!\})/g)
    if (singleBraceMatches) {
      risks.push({
        severity: 'critical',
        title: 'Formato de Variável Inválido',
        description: `Encontrado ${singleBraceMatches.join(', ')}. A Meta exige chaves duplas numeradas, ex: {{1}}, {{2}}.`,
        rule: 'META_VARIABLE_DOUBLE_BRACES',
      })
      score -= 30
    }

    // Check consecutive variables e.g. {{1}}{{2}}
    if (/\{\{\d+\}\}\s*\{\{\d+\}\}/.test(bodyText)) {
      risks.push({
        severity: 'critical',
        title: 'Variáveis Consecutivas Sem Texto Intermediário',
        description: 'A Meta rejeita variáveis coladas (ex: {{1}}{{2}}). Adicione espaço ou texto entre elas.',
        rule: 'META_NO_CONSECUTIVE_VARIABLES',
      })
      score -= 25
    }

    // Check variable at start or end
    if (/^\s*\{\{\d+\}\}/.test(bodyText) || /\{\{\d+\}\}\s*$/.test(bodyText)) {
      risks.push({
        severity: 'warning',
        title: 'Variável no Início ou Fim da Mensagem',
        description: 'Variáveis isoladas na primeira ou última palavra aumentam a taxa de rejeição.',
        rule: 'META_VARIABLE_SURROUNDING_CONTEXT',
      })
      score -= 10
    }

    // 2. Chatwoot Utility vs Marketing Rubric Analysis
    const rubric = evaluateUtilityRubric(bodyText)

    if (category === 'UTILITY' && !rubric.isCompliantUtility) {
      if (rubric.detectedMarketingTriggers.length > 0) {
        risks.push({
          severity: 'critical',
          title: 'Risco de Reclassificação para MARKETING (Aumento de Custo)',
          description: `Gatilhos comerciais detectados: ${rubric.detectedMarketingTriggers.join(', ')}. A Meta reclassificará ou rejeitará.`,
          rule: 'META_RUBRIC_MARKETING_TRIGGER',
        })
        score -= 40
      }
      if (rubric.detectedTransactionalTriggers.length === 0) {
        risks.push({
          severity: 'warning',
          title: 'Ausência de Contexto Transacional Claro',
          description: 'Modelos de Utilidade devem conter referência explícita a status de pedido, fatura, chamado ou agendamento.',
          rule: 'META_RUBRIC_TRANSACTION_CONTEXT_MISSING',
        })
        score -= 15
      }
      if (!rubric.hasActionableStep) {
        risks.push({
          severity: 'info',
          title: 'Recomendação de Próximo Passo',
          description: 'A Meta recomenda incluir instruções diretas de suporte (ex: "Se precisar de ajuda, responda a esta mensagem").',
          rule: 'META_RUBRIC_ACTIONABLE_STEP_RECOMMENDED',
        })
      }
    }

    // 3. Prohibited Content Check
    if (rubric.detectedProhibitedTriggers.length > 0) {
      risks.push({
        severity: 'critical',
        title: 'Conteúdo Proibido pelas Diretrizes da Meta',
        description: `Detectado: ${rubric.detectedProhibitedTriggers.join(', ')}. Risco imediato de bloqueio da WABA.`,
        rule: 'META_PROHIBITED_CONTENT',
      })
      score -= 50
    }

    // 4. Check URL Shorteners (bit.ly, tinyurl, etc.)
    if (/(bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|cutt\.ly)/i.test(bodyText)) {
      risks.push({
        severity: 'critical',
        title: 'Encurtador de Link Detectado',
        description: 'A Meta proíbe terminantemente encurtadores genéricos (bit.ly, tinyurl) por risco de phishing/spam.',
        rule: 'META_NO_URL_SHORTENERS',
      })
      score -= 30
    }

    // 5. Excessive Punctuation & Emojis
    if (/([!?]){3,}/.test(bodyText)) {
      risks.push({
        severity: 'warning',
        title: 'Pontuação Excessiva',
        description: 'Evite múltiplos pontos de exclamação ou interrogação seguidos (ex: !!! ou ???).',
        rule: 'META_EXCESSIVE_PUNCTUATION',
      })
      score -= 10
    }

    // Generate Optimized Text
    const optimizedText = bodyText
      .replace(/\{(\d+)\}/g, '{{$1}}')
      .replace(/!{2,}/g, '!')
      .replace(/\?{2,}/g, '?')

    const suggestedCategory = category === 'UTILITY' && rubric.suggestedCategory === 'MARKETING'
      ? 'MARKETING'
      : category

    const finalScore = Math.max(0, Math.min(100, score))
    const passed = finalScore >= 70 && !risks.some((r) => r.severity === 'critical')

    return NextResponse.json({
      score: finalScore,
      passed,
      risks,
      suggestedCategory,
      optimizedText,
      rubric,
    })
  } catch (error: unknown) {
    console.error('[/api/whatsapp/templates/analyze-compliance] Error:', error)
    const message = error instanceof Error ? error.message : 'Failed to analyze template compliance'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
