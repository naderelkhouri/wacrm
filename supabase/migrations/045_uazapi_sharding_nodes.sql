-- ============================================================
-- Migration 045: Uazapi Sharding Pools & Node Capacity Governance
-- ============================================================

-- 1. Create table public.uazapi_nodes
CREATE TABLE IF NOT EXISTS public.uazapi_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  api_url text NOT NULL UNIQUE,
  admin_token text,
  max_capacity integer NOT NULL DEFAULT 300,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'near_capacity', 'full', 'maintenance', 'offline')),
  is_accepting_new boolean NOT NULL DEFAULT true,
  region text DEFAULT 'eu-central',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Add node_id reference to whatsapp_config
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS node_id uuid
    REFERENCES public.uazapi_nodes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_config_node_id
  ON public.whatsapp_config (node_id);

-- 3. Seed Default Node 01
INSERT INTO public.uazapi_nodes (name, api_url, max_capacity, status, is_accepting_new, region)
VALUES (
  'Bloco 01 - Principal',
  'https://uazapi.admx.tech',
  300,
  'active',
  true,
  'Falkenstein (Hetzner)'
)
ON CONFLICT (api_url) DO UPDATE
SET updated_at = now();

-- 4. Associate existing uazapi whatsapp_config instances to Bloco 01
UPDATE public.whatsapp_config
SET node_id = (SELECT id FROM public.uazapi_nodes WHERE api_url = 'https://uazapi.admx.tech' LIMIT 1)
WHERE provider = 'uazapi'
  AND (node_id IS NULL OR api_url ILIKE '%uazapi.admx.tech%');

-- 5. Enable RLS on uazapi_nodes
ALTER TABLE public.uazapi_nodes ENABLE ROW LEVEL SECURITY;

-- Super Admins can manage nodes
DROP POLICY IF EXISTS "super_admins_manage_uazapi_nodes" ON public.uazapi_nodes;
CREATE POLICY "super_admins_manage_uazapi_nodes"
  ON public.uazapi_nodes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.is_super_admin = true
    )
  );

-- Authenticated users can read active nodes
DROP POLICY IF EXISTS "authenticated_read_active_uazapi_nodes" ON public.uazapi_nodes;
CREATE POLICY "authenticated_read_active_uazapi_nodes"
  ON public.uazapi_nodes
  FOR SELECT
  TO authenticated
  USING (status IN ('active', 'near_capacity'));

-- 6. Function / view for node occupancy
CREATE OR REPLACE VIEW public.uazapi_nodes_telemetry AS
SELECT 
  n.id,
  n.name,
  n.api_url,
  n.max_capacity,
  n.status,
  n.is_accepting_new,
  n.region,
  n.created_at,
  n.updated_at,
  COUNT(wc.id)::int AS total_instances,
  COUNT(CASE WHEN wc.status = 'connected' THEN 1 END)::int AS connected_instances,
  (n.max_capacity - COUNT(wc.id)::int) AS remaining_slots,
  ROUND((COUNT(wc.id)::numeric / NULLIF(n.max_capacity, 0)::numeric) * 100, 1) AS occupancy_pct
FROM public.uazapi_nodes n
LEFT JOIN public.whatsapp_config wc ON wc.node_id = n.id OR (wc.provider = 'uazapi' AND wc.api_url = n.api_url)
GROUP BY n.id;

GRANT SELECT ON public.uazapi_nodes_telemetry TO authenticated;
GRANT SELECT ON public.uazapi_nodes_telemetry TO service_role;

-- 7. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
