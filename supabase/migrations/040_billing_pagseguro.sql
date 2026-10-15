-- ============================================================
-- 040_billing_pagseguro.sql
--
-- SaaS Billing & Subscription Management (PagSeguro / PagBank API v4):
--   1. subscription_plans: Pre-configured plans with quotas (members, WABA, messages, AI)
--   2. account_subscriptions: Single subscription record per account with lifecycle status
--   3. payment_transactions: Audit ledger of gateway events with idempotency constraint
--   4. handle_new_user() enhancement: Bootstrap default 7-day trial on Starter plan
--   5. Backfill for existing accounts
-- ============================================================

-- 1. Create subscription_plans table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  interval TEXT NOT NULL DEFAULT 'month',
  max_members INTEGER NOT NULL DEFAULT 3,
  max_whatsapp_numbers INTEGER NOT NULL DEFAULT 1,
  monthly_messages_quota INTEGER NOT NULL DEFAULT 5000,
  monthly_ai_tokens_quota INTEGER NOT NULL DEFAULT 500000,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscription_plans_read_all" ON public.subscription_plans;
CREATE POLICY "subscription_plans_read_all"
  ON public.subscription_plans
  FOR SELECT
  USING (true);

-- Seed default plans
INSERT INTO public.subscription_plans (
  id, name, description, price_cents, interval,
  max_members, max_whatsapp_numbers, monthly_messages_quota, monthly_ai_tokens_quota, features
) VALUES
(
  'starter',
  'Starter',
  'Ideal para pequenas empresas e times enxutos iniciando atendimento via WhatsApp.',
  14700,
  'month',
  3,
  1,
  5000,
  500000,
  '["1 Conexão WhatsApp Oficial", "Até 3 Atendentes", "5.000 Mensagens/mês", "500k Tokens de IA/mês", "Pipelines e Tags ilimitados", "Suporte Padrão"]'::jsonb
),
(
  'pro',
  'Professional',
  'Para operações em crescimento que precisam de automação avançada e agentes de IA.',
  29700,
  'month',
  10,
  3,
  25000,
  2000000,
  '["Até 3 Conexões WhatsApp", "Até 10 Atendentes", "25.000 Mensagens/mês", "2M Tokens de IA/mês", "Agentes de IA e Base de Conhecimento RAG", "Campanhas e Broadcasts em Lote", "Suporte Prioritário"]'::jsonb
),
(
  'scale',
  'Scale Enterprise',
  'Para grandes volumes, múltiplos departamentos e automações de alta escala.',
  59700,
  'month',
  30,
  10,
  100000,
  10000000,
  '["Até 10 Conexões WhatsApp", "Até 30 Atendentes", "100.000 Mensagens/mês", "10M Tokens de IA/mês", "Acesso Total ao Servidor MCP de IA", "Webhooks e Integração API v1", "Gerente de Conta Dedicado"]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  max_members = EXCLUDED.max_members,
  max_whatsapp_numbers = EXCLUDED.max_whatsapp_numbers,
  monthly_messages_quota = EXCLUDED.monthly_messages_quota,
  monthly_ai_tokens_quota = EXCLUDED.monthly_ai_tokens_quota,
  features = EXCLUDED.features;

-- 2. Create account_subscriptions table
CREATE TABLE IF NOT EXISTS public.account_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'trialing', -- 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid'
  payment_method TEXT,                     -- 'pix' | 'credit_card' | 'boleto'
  pagseguro_customer_id TEXT,
  pagseguro_order_id TEXT,
  pagseguro_subscription_id TEXT,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_account_subscription UNIQUE(account_id)
);

ALTER TABLE public.account_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account_subscriptions_select_member" ON public.account_subscriptions;
CREATE POLICY "account_subscriptions_select_member"
  ON public.account_subscriptions
  FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS "account_subscriptions_update_owner" ON public.account_subscriptions;
CREATE POLICY "account_subscriptions_update_owner"
  ON public.account_subscriptions
  FOR UPDATE
  USING (is_account_member(account_id, 'owner'))
  WITH CHECK (is_account_member(account_id, 'owner'));

-- 3. Create payment_transactions table (Ledger with Idempotency)
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL DEFAULT 'pagseguro',
  gateway_reference_id TEXT NOT NULL UNIQUE, -- PagSeguro Order ID / Charge ID for idempotency
  amount_cents INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL,                      -- 'PAID' | 'WAITING' | 'DECLINED' | 'CANCELED'
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_account ON public.payment_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_ref ON public.payment_transactions(gateway_reference_id);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_transactions_select_admin" ON public.payment_transactions;
CREATE POLICY "payment_transactions_select_admin"
  ON public.payment_transactions
  FOR SELECT
  USING (is_account_member(account_id, 'admin'));

-- 4. Backfill existing accounts with a Starter trial subscription if missing
INSERT INTO public.account_subscriptions (account_id, plan_id, status, current_period_end)
SELECT
  a.id,
  'starter',
  'trialing',
  NOW() + INTERVAL '14 days'
FROM public.accounts a
LEFT JOIN public.account_subscriptions s ON s.account_id = a.id
WHERE s.id IS NULL
ON CONFLICT (account_id) DO NOTHING;

-- Synchronize accounts.max_members with the initial plan limit
UPDATE public.accounts a
SET max_members = COALESCE(p.max_members, 3)
FROM public.account_subscriptions s
JOIN public.subscription_plans p ON p.id = s.plan_id
WHERE a.id = s.account_id
  AND (a.max_members IS NULL OR a.max_members < p.max_members);

-- 5. Update handle_new_user() trigger to automatically provision the subscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_account_id UUID;
  v_signup_mode TEXT;
  v_invite_token TEXT;
  v_token_hash TEXT;
  v_invite_found BOOLEAN;
BEGIN
  -- Read platform signup mode
  SELECT COALESCE(value->>'mode', 'open') INTO v_signup_mode
  FROM public.platform_settings
  WHERE key = 'signup_mode';

  v_signup_mode := COALESCE(v_signup_mode, 'open');
  v_invite_token := NEW.raw_user_meta_data->>'invite_token';

  -- If platform signups are closed, prevent profile/account creation
  IF v_signup_mode = 'closed' THEN
    RAISE EXCEPTION 'A criação de novas contas está desativada no momento.';
  END IF;

  -- If platform signups are invite_only, verify invite token
  IF v_signup_mode = 'invite_only' THEN
    IF v_invite_token IS NULL OR trim(v_invite_token) = '' THEN
      RAISE EXCEPTION 'A criação de novas contas requer um convite válido (modo exclusivo por convite).';
    END IF;

    v_token_hash := encode(digest(trim(v_invite_token), 'sha256'), 'hex');

    SELECT EXISTS (
      SELECT 1 FROM public.account_invitations
      WHERE token_hash = v_token_hash
        AND accepted_at IS NULL
        AND expires_at > NOW()
    ) INTO v_invite_found;

    IF NOT v_invite_found THEN
      RAISE EXCEPTION 'Convite inválido ou expirado.';
    END IF;
  END IF;

  -- Bootstrap personal account and owner profile
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  INSERT INTO public.accounts (name, owner_user_id, max_members, allow_member_invites)
  VALUES (COALESCE(NULLIF(v_full_name, ''), NEW.email, 'My account'), NEW.id, 3, true)
  RETURNING id INTO v_account_id;

  INSERT INTO public.profiles (user_id, full_name, email, account_id, account_role)
  VALUES (NEW.id, v_full_name, NEW.email, v_account_id, 'owner');

  -- Provision initial 7-day trialing subscription on Starter plan
  INSERT INTO public.account_subscriptions (account_id, plan_id, status, current_period_end)
  VALUES (v_account_id, 'starter', 'trialing', NOW() + INTERVAL '7 days')
  ON CONFLICT (account_id) DO NOTHING;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
