-- ============================================================
-- 034_ai_google_provider.sql — Allow Google AI as a provider in ai_configs
--
-- Extends the provider check constraint on ai_configs to support
-- 'google' (Google AI Gemini API).
--
-- Idempotent — safe to run multiple times.
-- ============================================================

DO $$
BEGIN
  ALTER TABLE ai_configs DROP CONSTRAINT IF EXISTS ai_configs_provider_check;
  ALTER TABLE ai_configs ADD CONSTRAINT ai_configs_provider_check CHECK (provider IN ('openai', 'anthropic', 'google'));
END $$;
