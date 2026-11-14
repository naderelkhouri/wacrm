import type { SupabaseClient } from '@supabase/supabase-js'
import { loadAiConfig } from '@/lib/ai/config'

interface TranscribeAudioOptions {
  audioUrl: string
  accountId: string
  db: SupabaseClient
}

/**
 * Transcribes audio via OpenAI Whisper or Groq Whisper (if OpenAI or Groq key is configured on the account).
 * Falls back silently if no transcription provider is configured or if transcription fails,
 * ensuring zero disruption to normal message delivery.
 */
export async function transcribeAudioAttachment(
  options: TranscribeAudioOptions
): Promise<string | null> {
  const { audioUrl, accountId, db } = options

  if (!audioUrl) return null

  try {
    const aiConfig = await loadAiConfig(db, accountId, { requireActive: false })
    if (!aiConfig?.apiKey) {
      return null
    }

    // Check if account has OpenAI or a global Whisper key available
    const isOpenAi = (aiConfig.provider as string) === 'openai'
    const isGroq = (aiConfig.provider as string) === 'groq'

    if (!isGroq && !isOpenAi) {
      return null
    }

    // 1. Fetch audio binary
    const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(10000) })
    if (!audioRes.ok) {
      console.warn(`[audio-transcribe] Failed to fetch audio binary from ${audioUrl}: status ${audioRes.status}`)
      return null
    }

    const audioBuffer = await audioRes.arrayBuffer()
    const blob = new Blob([audioBuffer], { type: 'audio/ogg' })

    const formData = new FormData()
    formData.append('file', blob, 'audio.ogg')
    formData.append('model', isGroq ? 'whisper-large-v3' : 'whisper-1')
    formData.append('response_format', 'json')

    const endpoint = isGroq
      ? 'https://api.groq.com/openai/v1/audio/transcriptions'
      : 'https://api.openai.com/v1/audio/transcriptions'

    const transcribeRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${aiConfig.apiKey}`,
      },
      body: formData,
      signal: AbortSignal.timeout(15000),
    })

    if (!transcribeRes.ok) {
      const errText = await transcribeRes.text().catch(() => '')
      console.warn(`[audio-transcribe] Transcription API returned ${transcribeRes.status}: ${errText}`)
      return null
    }

    const data = (await transcribeRes.json()) as { text?: string }
    const transcript = data.text?.trim()
    return transcript || null
  } catch (err) {
    console.warn('[audio-transcribe] Failed to transcribe audio:', err)
    return null
  }
}
