-- ============================================================
-- Migration 046: WhatsApp Geo-Location Metadata & Anti-Ban Warmup Engine
-- ============================================================

-- 1. Add Geo-Location and Warmup columns to whatsapp_config
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'BR',
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS warmup_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS warmup_started_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS daily_message_limit integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS messages_sent_today integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_sent_date date DEFAULT CURRENT_DATE;

-- 2. Add Stripe columns to account_subscriptions
ALTER TABLE public.account_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- 3. Add index on country and state
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_geo
  ON public.whatsapp_config (country, state);

-- 4. Backfill existing Brazilian numbers with state based on DDD
UPDATE public.whatsapp_config
SET 
  country = 'BR',
  state = CASE
    WHEN phone_number_id LIKE '5511%' OR phone_number_id LIKE '5512%' OR phone_number_id LIKE '5513%' 
      OR phone_number_id LIKE '5514%' OR phone_number_id LIKE '5515%' OR phone_number_id LIKE '5516%'
      OR phone_number_id LIKE '5517%' OR phone_number_id LIKE '5518%' OR phone_number_id LIKE '5519%' THEN 'SP'
    WHEN phone_number_id LIKE '5521%' OR phone_number_id LIKE '5522%' OR phone_number_id LIKE '5524%' THEN 'RJ'
    WHEN phone_number_id LIKE '5531%' OR phone_number_id LIKE '5532%' OR phone_number_id LIKE '5533%'
      OR phone_number_id LIKE '5534%' OR phone_number_id LIKE '5535%' OR phone_number_id LIKE '5537%'
      OR phone_number_id LIKE '5538%' THEN 'MG'
    WHEN phone_number_id LIKE '5541%' OR phone_number_id LIKE '5542%' OR phone_number_id LIKE '5543%'
      OR phone_number_id LIKE '5544%' OR phone_number_id LIKE '5545%' OR phone_number_id LIKE '5546%' THEN 'PR'
    WHEN phone_number_id LIKE '5551%' OR phone_number_id LIKE '5553%' OR phone_number_id LIKE '5554%'
      OR phone_number_id LIKE '5555%' THEN 'RS'
    WHEN phone_number_id LIKE '5561%' THEN 'DF'
    WHEN phone_number_id LIKE '5571%' OR phone_number_id LIKE '5573%' OR phone_number_id LIKE '5574%'
      OR phone_number_id LIKE '5575%' OR phone_number_id LIKE '5577%' THEN 'BA'
    ELSE 'SP'
  END,
  city = CASE
    WHEN phone_number_id LIKE '5511%' THEN 'São Paulo'
    WHEN phone_number_id LIKE '5521%' THEN 'Rio de Janeiro'
    WHEN phone_number_id LIKE '5531%' THEN 'Belo Horizonte'
    WHEN phone_number_id LIKE '5541%' THEN 'Curitiba'
    WHEN phone_number_id LIKE '5551%' THEN 'Porto Alegre'
    WHEN phone_number_id LIKE '5561%' THEN 'Brasília'
    WHEN phone_number_id LIKE '5571%' THEN 'Salvador'
    ELSE 'São Paulo'
  END
WHERE country = 'BR' AND (state IS NULL OR city IS NULL);

-- 5. Function to atomically increment and check daily warmup count
CREATE OR REPLACE FUNCTION public.increment_whatsapp_daily_sent(
  config_id uuid,
  count_to_add integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cfg RECORD;
  today_date date := CURRENT_DATE;
  new_count integer;
  is_exceeded boolean := false;
BEGIN
  SELECT * INTO cfg FROM public.whatsapp_config WHERE id = config_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'config_not_found');
  END IF;

  IF cfg.last_sent_date IS NULL OR cfg.last_sent_date < today_date THEN
    new_count := count_to_add;
  ELSE
    new_count := COALESCE(cfg.messages_sent_today, 0) + count_to_add;
  END IF;

  IF cfg.warmup_enabled = true AND cfg.daily_message_limit > 0 AND new_count > cfg.daily_message_limit THEN
    is_exceeded := true;
  END IF;

  UPDATE public.whatsapp_config
  SET 
    messages_sent_today = new_count,
    last_sent_date = today_date,
    updated_at = now()
  WHERE id = config_id;

  RETURN jsonb_build_object(
    'success', true,
    'messages_sent_today', new_count,
    'daily_message_limit', cfg.daily_message_limit,
    'warmup_enabled', cfg.warmup_enabled,
    'is_exceeded', is_exceeded
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_whatsapp_daily_sent(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_whatsapp_daily_sent(uuid, integer) TO service_role;

-- 6. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
