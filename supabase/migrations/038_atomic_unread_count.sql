-- ============================================================
-- 038_atomic_unread_count.sql
--
-- Atomic increment of conversations.unread_count and last_message_*
-- summary fields upon customer message insertion.
--
-- Prior to this migration, the WhatsApp webhook calculated unread_count
-- in JavaScript via a read-modify-write:
--   unread_count: (conversation.unread_count || 0) + 1
-- When multiple messages arrived concurrently, or when webhook retries
-- occurred, unread counts were clobbered or drifted due to race conditions.
--
-- This migration:
--   1. De-duplicates any existing duplicate messages per conversation/message_id.
--   2. Adds a partial UNIQUE index on (conversation_id, message_id) to
--      strictly prevent duplicate insertions / replays from Meta.
--   3. Implements an AFTER INSERT trigger on public.messages for customer
--      inbound messages that atomically updates:
--        - unread_count = COALESCE(unread_count, 0) + 1
--        - last_message_text = COALESCE(NULLIF(NEW.content_text, ''), '[' || NEW.content_type || ']')
--        - last_message_at = NEW.created_at
--        - updated_at = NOW()
--   4. Provides an explicit helper function `mark_conversation_as_read(UUID)`
--      for atomic mark-as-read operations.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- 1. Deduplicate any existing duplicate messages before adding unique index
DELETE FROM public.messages m1
WHERE m1.message_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.messages m2
    WHERE m2.conversation_id = m1.conversation_id
      AND m2.message_id = m1.message_id
      AND (m2.created_at < m1.created_at OR (m2.created_at = m1.created_at AND m2.id < m1.id))
  );

-- 2. Unique index on (conversation_id, message_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_conversation_message_id_uniq
  ON public.messages (conversation_id, message_id)
  WHERE message_id IS NOT NULL;

-- 3. Trigger function to atomically bump unread_count and conversation summary
CREATE OR REPLACE FUNCTION public.handle_inbound_message_unread_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sender_type = 'customer' THEN
    UPDATE public.conversations
    SET
      unread_count = COALESCE(unread_count, 0) + 1,
      last_message_text = COALESCE(
        NULLIF(NEW.content_text, ''),
        '[' || COALESCE(NEW.content_type, 'message') || ']'
      ),
      last_message_at = COALESCE(NEW.created_at, NOW()),
      updated_at = NOW()
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop trigger if already exists so script is idempotent
DROP TRIGGER IF EXISTS trg_increment_unread_count_on_customer_message ON public.messages;

CREATE TRIGGER trg_increment_unread_count_on_customer_message
AFTER INSERT ON public.messages
FOR EACH ROW
WHEN (NEW.sender_type = 'customer')
EXECUTE FUNCTION public.handle_inbound_message_unread_count();

-- 4. Helper RPC for resetting unread count safely
CREATE OR REPLACE FUNCTION public.mark_conversation_as_read(p_conversation_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.conversations
  SET
    unread_count = 0,
    updated_at = NOW()
  WHERE id = p_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
