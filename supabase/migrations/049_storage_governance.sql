-- ============================================================
-- 049_storage_governance.sql
--
-- Governança de Armazenamento, Cotas e Políticas de Retenção (TTL)
-- para Áudios, Imagens, Vídeos e Documentos no WACRM.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.account_storage_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  -- Políticas de Retenção em Dias (0 = nunca expirar / vitalício)
  audio_retention_days INTEGER NOT NULL DEFAULT 60,
  image_retention_days INTEGER NOT NULL DEFAULT 90,
  video_retention_days INTEGER NOT NULL DEFAULT 30,
  doc_retention_days INTEGER NOT NULL DEFAULT 365,
  -- Limite / Cota de Armazenamento (em Bytes). Default: 10 GB
  max_storage_bytes BIGINT NOT NULL DEFAULT 10737418240,
  -- Flag para automação de purga diária
  auto_cleanup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  -- Salvar permanentemente no bucket próprio (chat-media) em vez de manter link externo
  persist_in_storage BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_account_storage_settings UNIQUE(account_id)
);

-- RLS para account_storage_settings
ALTER TABLE public.account_storage_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view their account storage settings" ON public.account_storage_settings;
CREATE POLICY "Members can view their account storage settings"
  ON public.account_storage_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.account_id = account_storage_settings.account_id
    )
  );

DROP POLICY IF EXISTS "Admins can update their account storage settings" ON public.account_storage_settings;
CREATE POLICY "Admins can update their account storage settings"
  ON public.account_storage_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.account_id = account_storage_settings.account_id
        AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can insert their account storage settings" ON public.account_storage_settings;
CREATE POLICY "Admins can insert their account storage settings"
  ON public.account_storage_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.account_id = account_storage_settings.account_id
        AND p.role IN ('admin', 'super_admin')
    )
  );

-- Inicializar settings padrão para contas existentes que ainda não possuem
INSERT INTO public.account_storage_settings (account_id)
SELECT id FROM public.accounts a
WHERE NOT EXISTS (
  SELECT 1 FROM public.account_storage_settings s WHERE s.account_id = a.id
)
ON CONFLICT (account_id) DO NOTHING;

-- Função auxiliar para estatísticas agregadas de armazenamento por conta
CREATE OR REPLACE FUNCTION public.get_account_storage_usage(p_account_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_audio_count BIGINT;
  v_image_count BIGINT;
  v_video_count BIGINT;
  v_doc_count BIGINT;
  v_total_messages BIGINT;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE m.content_type = 'audio' AND m.media_url IS NOT NULL),
    COUNT(*) FILTER (WHERE m.content_type = 'image' AND m.media_url IS NOT NULL),
    COUNT(*) FILTER (WHERE m.content_type = 'video' AND m.media_url IS NOT NULL),
    COUNT(*) FILTER (WHERE m.content_type = 'document' AND m.media_url IS NOT NULL),
    COUNT(*)
  INTO
    v_audio_count,
    v_image_count,
    v_video_count,
    v_doc_count,
    v_total_messages
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  WHERE c.account_id = p_account_id;

  RETURN jsonb_build_object(
    'audio_count', COALESCE(v_audio_count, 0),
    'image_count', COALESCE(v_image_count, 0),
    'video_count', COALESCE(v_video_count, 0),
    'doc_count', COALESCE(v_doc_count, 0),
    'total_messages', COALESCE(v_total_messages, 0)
  );
END;
$$;
