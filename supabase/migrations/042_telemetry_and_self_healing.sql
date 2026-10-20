-- ============================================================
-- 042_telemetry_and_self_healing.sql
--
-- Autonomous Telemetry, Self-Healing Remediations & Smart Optimization
-- Engine for WcloudAPI / WACRM Platform Governance.
-- ============================================================

-- 1. System Telemetry Events Table
CREATE TABLE IF NOT EXISTS public.system_telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN (
    'api_latency',
    'webhook_inbound',
    'webhook_error',
    'database_query',
    'meta_api',
    'system_resource',
    'broadcast_queue',
    'billing',
    'circuit_breaker'
  )),
  metric_name TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical', 'fatal')),
  value NUMERIC NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for high-frequency telemetry lookups
CREATE INDEX IF NOT EXISTS idx_telemetry_events_created_at
  ON public.system_telemetry_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_category_created
  ON public.system_telemetry_events(category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_severity_created
  ON public.system_telemetry_events(severity, created_at DESC)
  WHERE severity IN ('warning', 'critical', 'fatal');

-- 2. System Remediation Actions Table (Audit trail of self-healing operations)
CREATE TABLE IF NOT EXISTS public.system_remediation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('automated', 'manual', 'scheduled')),
  action_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'rolled_back')),
  target_service TEXT NOT NULL,
  reason TEXT NOT NULL,
  execution_log JSONB NOT NULL DEFAULT '{}'::jsonb,
  executed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_remediation_actions_created_at
  ON public.system_remediation_actions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_remediation_actions_status
  ON public.system_remediation_actions(status, created_at DESC);

-- 3. System Optimization Recommendations Table (AI & Heuristic improvement suggestions)
CREATE TABLE IF NOT EXISTS public.system_optimization_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  impact TEXT NOT NULL CHECK (impact IN ('low', 'medium', 'high', 'critical')),
  auto_executable BOOLEAN NOT NULL DEFAULT false,
  action_type TEXT,
  action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('active', 'applied', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_optimization_recs_status
  ON public.system_optimization_recommendations(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_optimization_recs_rule_id
  ON public.system_optimization_recommendations(rule_id);

-- 4. Enable Row Level Security
ALTER TABLE public.system_telemetry_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_remediation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_optimization_recommendations ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: Restricted to Super Admins & Service Role
DROP POLICY IF EXISTS "Super admins can view telemetry events" ON public.system_telemetry_events;
CREATE POLICY "Super admins can view telemetry events"
  ON public.system_telemetry_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.is_super_admin = true
    )
  );

DROP POLICY IF EXISTS "Super admins can manage telemetry events" ON public.system_telemetry_events;
CREATE POLICY "Super admins can manage telemetry events"
  ON public.system_telemetry_events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.is_super_admin = true
    )
  );

DROP POLICY IF EXISTS "Super admins can view remediation actions" ON public.system_remediation_actions;
CREATE POLICY "Super admins can view remediation actions"
  ON public.system_remediation_actions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.is_super_admin = true
    )
  );

DROP POLICY IF EXISTS "Super admins can manage remediation actions" ON public.system_remediation_actions;
CREATE POLICY "Super admins can manage remediation actions"
  ON public.system_remediation_actions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.is_super_admin = true
    )
  );

DROP POLICY IF EXISTS "Super admins can view optimization recommendations" ON public.system_optimization_recommendations;
CREATE POLICY "Super admins can view optimization recommendations"
  ON public.system_optimization_recommendations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.is_super_admin = true
    )
  );

DROP POLICY IF EXISTS "Super admins can manage optimization recommendations" ON public.system_optimization_recommendations;
CREATE POLICY "Super admins can manage optimization recommendations"
  ON public.system_optimization_recommendations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.is_super_admin = true
    )
  );
