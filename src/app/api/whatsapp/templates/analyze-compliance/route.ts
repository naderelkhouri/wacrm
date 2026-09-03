import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
      name,
      category,
      language = 'pt_BR',
      headerText = '',
      bodyText = '',
      footerText = '',
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

    // 2. Check Category Misclassification (Utility vs Marketing)
    const promotionalKeywords = [
      'desconto', 'promocao', 'promoção', 'oferta', 'compre', 'aproveite',
      'cupom', 'black friday', 'frete gratis', 'frete grátis', 'imperdivel',
      'discount', 'sale', 'offer', 'coupon', 'free shipping', 'special price'
    ]

    const lowerBody = bodyText.toLowerCase()
    const hasPromoKeyword = promotionalKeywords.some((kw) => lowerBody.includes(kw))

    if (category === 'UTILITY' && hasPromoKeyword) {
      risks.push({
        severity: 'critical',
        title: 'Conflito de Categoria: Conteúdo Promocional em UTILITY',
        description: 'O texto contém palavras de promoção/vendas, mas a categoria selecionada é UTILITY. A Meta rejeitará o modelo ou reclassificará para MARKETING com custo maior.',
        rule: 'META_CATEGORY_MISMATCH',
      })
      score -= 35
    }

    // 3. Check URL Shorteners (bit.ly, tinyurl, etc.)
    if (/(bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|cutt\.ly)/i.test(bodyText)) {
      risks.push({
        severity: 'critical',
        title: 'Encurtador de Link Detectado',
        description: 'A Meta proíbe terminantemente encurtadores genéricos (bit.ly, tinyurl) por risco de phishing/spam.',
        rule: 'META_NO_URL_SHORTENERS',
      })
      score -= 30
    }

    // 4. Excessive Punctuation & Emojis
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
    let optimizedText = bodyText
      // Fix single braces {1} -> {{1}}
      .replace(/\{(\d+)\}/g, '{{$1}}')
      // Fix multiple exclamation marks
      .replace(/!{2,}/g, '!')
      .replace(/\?{2,}/g, '?')

    const suggestedCategory = category === 'UTILITY' && hasPromoKeyword ? 'MARKETING' : category

    const finalScore = Math.max(0, Math.min(100, score))
    const passed = finalScore >= 70 && !risks.some((r) => r.severity === 'critical')

    return NextResponse.json({
      score: finalScore,
      passed,
      risks,
      suggestedCategory,
      optimizedText,
    })
  } catch (error: any) {
    console.error('[/api/whatsapp/templates/analyze-compliance] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to analyze template compliance' },
      { status: 500 }
    )
  }
}
