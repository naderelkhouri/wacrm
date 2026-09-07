import { AiError, type ChatMessage, type ProviderResult } from '../types'
import { MAX_OUTPUT_TOKENS } from '../defaults'
import {
  mergeConsecutive,
  normalizeUsage,
  providerHttpError,
  toNetworkError,
  type ProviderArgs,
} from './shared'

const GOOGLE_AI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

interface GoogleAiResponse {
  candidates?: {
    content?: {
      parts?: { text?: string }[]
      role?: string
    }
    finishReason?: string
  }[]
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
  }
}

/**
 * Google AI Gemini API requires alternating turns between 'user' and 'model'.
 * Merge consecutive turns, then drop any leading assistant (model) turns
 * so the conversation always starts with a user message.
 */
function normalizeForGoogle(messages: ChatMessage[]): { role: 'user' | 'model'; parts: { text: string }[] }[] {
  const merged = mergeConsecutive(messages)
  while (merged.length > 0 && merged[0].role === 'assistant') {
    merged.shift()
  }
  if (merged.length === 0) {
    return [{ role: 'user', parts: [{ text: '(The customer has not sent a message yet.)' }] }]
  }
  return merged.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
}

/**
 * Call Google AI's generateContent endpoint with the caller's own API key.
 * Returns the raw text response + token usage (handoff parsing happens in `generateReply`).
 */
export async function generateGoogle(args: ProviderArgs): Promise<ProviderResult> {
  const { apiKey, model, systemPrompt, messages, timeoutMs } = args
  const url = `${GOOGLE_AI_BASE_URL}/${encodeURIComponent(model)}:generateContent`

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: normalizeForGoogle(messages),
        generationConfig: {
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          temperature: 0.7,
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    throw toNetworkError(err)
  }

  if (!res.ok) {
    throw await providerHttpError('Google AI', res)
  }

  const data = (await res.json().catch(() => null)) as GoogleAiResponse | null
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p) => (typeof p.text === 'string' ? p.text : ''))
    .join('')
    .trim()

  if (!text) {
    throw new AiError('Google AI returned an empty response.', {
      code: 'empty_response',
    })
  }

  const usage = normalizeUsage({
    prompt: data?.usageMetadata?.promptTokenCount,
    completion: data?.usageMetadata?.candidatesTokenCount,
    total: data?.usageMetadata?.totalTokenCount,
  })

  return { text, usage }
}
