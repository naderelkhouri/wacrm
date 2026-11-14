-- ============================================================
-- 048_business_hours_and_auto_triage.sql
--
-- 1. Business Hours & Away Message Support (accounts)
-- 2. AI Auto-Triage & Classification (conversations priority & labels)
-- ============================================================

-- 1. Add business_hours_config to accounts
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS business_hours_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS business_hours_config JSONB NOT NULL DEFAULT '{
  "timezone": "America/Sao_Paulo",
  "schedule": {
    "0": null,
    "1": [{"start": "09:00", "end": "12:00"}, {"start": "13:00", "end": "18:00"}],
    "2": [{"start": "09:00", "end": "12:00"}, {"start": "13:00", "end": "18:00"}],
    "3": [{"start": "09:00", "end": "12:00"}, {"start": "13:00", "end": "18:00"}],
    "4": [{"start": "09:00", "end": "12:00"}, {"start": "13:00", "end": "18:00"}],
    "5": [{"start": "09:00", "end": "12:00"}, {"start": "13:00", "end": "18:00"}],
    "6": null
  },
  "away_message": "Olá! No momento estamos fora do nosso horário de atendimento. Responderemos assim que retornarmos no próximo dia útil!",
  "auto_away_enabled": false
}'::jsonb;

-- 2. Add priority and auto_triage metadata to conversations
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
ADD COLUMN IF NOT EXISTS auto_triage_metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_conversations_priority ON public.conversations(account_id, priority);
