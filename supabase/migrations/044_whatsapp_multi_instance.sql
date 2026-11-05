-- ============================================================
-- Migration 044: Multi-instance WhatsApp Support per Account
-- ============================================================

-- 1. Relax whatsapp_config unique constraint on account_id
ALTER TABLE public.whatsapp_config
  DROP CONSTRAINT IF EXISTS whatsapp_config_account_id_key;

-- 2. Add multi-instance metadata to whatsapp_config
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'WhatsApp Principal',
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS color text DEFAULT '#25D366';

-- 3. Set existing instances as default if none is default
UPDATE public.whatsapp_config
SET is_default = true
WHERE id IN (
  SELECT DISTINCT ON (account_id) id
  FROM public.whatsapp_config
  ORDER BY account_id, created_at ASC
);

-- 4. Add index for fast default lookup
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_account_default
  ON public.whatsapp_config (account_id, is_default);

-- 5. Link conversations to whatsapp_config
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS whatsapp_config_id uuid
    REFERENCES public.whatsapp_config(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_whatsapp_config
  ON public.conversations (whatsapp_config_id);

-- 6. Backfill existing conversations to point to the account's default WhatsApp config
UPDATE public.conversations c
SET whatsapp_config_id = wc.id
FROM public.whatsapp_config wc
WHERE wc.account_id = c.account_id
  AND wc.is_default = true
  AND c.whatsapp_config_id IS NULL;

-- 7. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
