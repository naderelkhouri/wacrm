-- ============================================================
-- 047_usage_analytics_and_product_radar.sql
--
-- SuperAdmin Usage Telemetry (LGPD-Compliant) & Product Radar
-- (Bugs, Improvements & AI Growth Opportunities with 0-5★ Rating
-- and 5-Stage Funnel — based on agency-landing-page-admin).
-- ============================================================

-- 1. TELEMETRIA DE ACESSOS & USO DE MÓDULOS (LGPD-COMPLIANT)
CREATE TABLE IF NOT EXISTS public.system_page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT NOT NULL,
  module_name TEXT NOT NULL DEFAULT 'Outro',
  referrer TEXT,
  device TEXT NOT NULL DEFAULT 'desktop' CHECK (device IN ('mobile', 'desktop', 'tablet')),
  browser TEXT DEFAULT 'Chrome',
  city TEXT,
  region TEXT,
  country TEXT DEFAULT 'BR',
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  account_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_page_views_created_at
  ON public.system_page_views(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_page_views_path
  ON public.system_page_views(path);

CREATE INDEX IF NOT EXISTS idx_system_page_views_device
  ON public.system_page_views(device);

CREATE INDEX IF NOT EXISTS idx_system_page_views_account
  ON public.system_page_views(account_id);

-- 2. RADAR DE PRODUTO: BUGS, MELHORIAS & OPORTUNIDADES (0-5★ & FUNIL DE 5 FASES)
CREATE TABLE IF NOT EXISTS public.system_product_backlog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('bug', 'melhoria', 'oportunidade')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'auto_detector', 'usage_heuristic', 'auto_heal')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  module_path TEXT DEFAULT '/dashboard',
  status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'analise', 'desenvolvimento', 'concluido', 'arquivado')),
  rating INTEGER NOT NULL DEFAULT 3 CHECK (rating >= 0 AND rating <= 5),
  notes TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_product_backlog_created_at
  ON public.system_product_backlog(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_product_backlog_status
  ON public.system_product_backlog(status);

CREATE INDEX IF NOT EXISTS idx_system_product_backlog_rating
  ON public.system_product_backlog(rating DESC);

CREATE INDEX IF NOT EXISTS idx_system_product_backlog_type
  ON public.system_product_backlog(type);

-- 3. RLS POLICIES
ALTER TABLE public.system_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_product_backlog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can manage page views" ON public.system_page_views;
CREATE POLICY "Super admins can manage page views"
  ON public.system_page_views
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.is_super_admin = true
    )
  );

DROP POLICY IF EXISTS "Authenticated users can insert page views" ON public.system_page_views;
CREATE POLICY "Authenticated users can insert page views"
  ON public.system_page_views
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Super admins can manage product backlog" ON public.system_product_backlog;
CREATE POLICY "Super admins can manage product backlog"
  ON public.system_product_backlog
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.is_super_admin = true
    )
  );
