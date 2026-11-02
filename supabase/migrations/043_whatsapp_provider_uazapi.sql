-- ============================================================
-- Migration 043: Add Uazapi provider support to whatsapp_config
-- ============================================================
-- Adds `provider` ('meta' | 'uazapi'), `api_url` (Uazapi server base URL),
-- and `instance_name` (optional instance identifier) to `whatsapp_config`
-- so accounts can connect via either Meta Cloud API or Uazapi.

ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'meta'
    CHECK (provider IN ('meta', 'uazapi')),
  ADD COLUMN IF NOT EXISTS api_url text,
  ADD COLUMN IF NOT EXISTS instance_name text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_config_provider
  ON public.whatsapp_config (provider);

NOTIFY pgrst, 'reload schema';
