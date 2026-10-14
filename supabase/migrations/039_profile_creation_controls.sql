-- ============================================================
-- 039_profile_creation_controls.sql
--
-- Governance & access control for profile creation:
--   1. Global Platform Registration Mode:
--      - 'open': public registration open to anyone.
--      - 'invite_only': registration requires a valid, unexpired invite token.
--      - 'closed': new user signups completely disabled platform-wide.
--   2. Account-Level Member Invitation Controls:
--      - accounts.allow_member_invites (BOOLEAN DEFAULT TRUE):
--        Allows owners/admins to pause or resume new teammate invites.
--      - accounts.max_members (INTEGER DEFAULT NULL):
--        Optional seat limit per organization.
--   3. Database-level trigger enforcement on handle_new_user().
-- ============================================================

-- 1. Create platform_settings table
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated or anonymous can read public platform settings (like signup_mode)
DROP POLICY IF EXISTS "platform_settings_select_all" ON public.platform_settings;
CREATE POLICY "platform_settings_select_all"
  ON public.platform_settings
  FOR SELECT
  USING (true);

-- Only platform owners can insert/update platform settings
DROP POLICY IF EXISTS "platform_settings_update_owner" ON public.platform_settings;
CREATE POLICY "platform_settings_update_owner"
  ON public.platform_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.account_role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.account_role = 'owner'
    )
  );

-- Seed default signup_mode: 'open' if not exists
INSERT INTO public.platform_settings (key, value)
VALUES ('signup_mode', '{"mode": "open"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2. Add member invitation control columns to accounts
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS allow_member_invites BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_members INTEGER DEFAULT NULL;

-- 3. Replace handle_new_user() trigger function to enforce platform signup mode
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

  INSERT INTO public.accounts (name, owner_user_id)
  VALUES (COALESCE(NULLIF(v_full_name, ''), NEW.email, 'My account'), NEW.id)
  RETURNING id INTO v_account_id;

  INSERT INTO public.profiles (user_id, full_name, email, account_id, account_role)
  VALUES (NEW.id, v_full_name, NEW.email, v_account_id, 'owner');

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
