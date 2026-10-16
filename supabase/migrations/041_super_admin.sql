-- ============================================================
-- 041_super_admin.sql
--
-- Platform Super Admin (Master Area) Governance:
--   1. Add is_super_admin column to public.profiles.
--   2. Grant initial Super Admin privileges to primary platform owners.
-- ============================================================

-- 1. Add is_super_admin column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_super_admin
  ON public.profiles(is_super_admin)
  WHERE is_super_admin = true;

-- 2. Grant super admin to platform owners
UPDATE public.profiles
SET is_super_admin = true
WHERE email IN (
  'admin@admx.tech',
  'nader.admx@gmail.com',
  'nader@admx.tech',
  'progredindosempre@gmail.com'
);
