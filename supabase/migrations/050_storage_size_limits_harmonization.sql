-- ============================================================
-- 050_storage_size_limits_harmonization.sql
--
-- Harmonizes storage bucket limits with native WhatsApp/Uazapi specifications:
-- 1. avatars: raises file_size_limit from 2 MB to 5 MB (5242880 bytes)
--    so profile and contact avatar uploads are consistent and don't fail RLS.
-- 2. chat-media: raises file_size_limit from 16 MB to 100 MB (104857600 bytes)
--    to support WhatsApp native document sending (PDFs, catalogues, contracts)
--    and adds text/csv, application/zip, application/x-zip-compressed.
-- 3. flow-media: raises file_size_limit from 16 MB to 100 MB (104857600 bytes)
--    and adds text/csv, application/zip, application/x-zip-compressed.
-- ============================================================

-- 1. Avatars bucket (5 MB)
UPDATE storage.buckets
SET
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif'
  ]
WHERE id = 'avatars';

-- 2. Chat-media bucket (100 MB)
UPDATE storage.buckets
SET
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY[
    -- Images
    'image/png', 'image/jpeg', 'image/webp',
    -- Videos
    'video/mp4', 'video/3gpp',
    -- Documents
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed',
    -- Audio (voice notes)
    'audio/ogg',
    'audio/mpeg',
    'audio/aac',
    'audio/mp4',
    'audio/amr'
  ]
WHERE id = 'chat-media';

-- 3. Flow-media bucket (100 MB)
UPDATE storage.buckets
SET
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY[
    -- Images
    'image/png', 'image/jpeg', 'image/webp',
    -- Videos
    'video/mp4', 'video/3gpp',
    -- Documents
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed'
  ]
WHERE id = 'flow-media';
