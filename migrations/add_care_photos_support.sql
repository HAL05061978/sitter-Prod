-- Migration: Add photo support for care blocks
-- This adds photo_urls field to scheduled_care table and creates storage bucket

-- Add photo_urls column to scheduled_care table
ALTER TABLE scheduled_care
ADD COLUMN IF NOT EXISTS photo_urls text[];

-- Create storage bucket for care photos (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('care-photos', 'care-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for care-photos bucket
-- Drop existing policies first to allow re-running the migration

DROP POLICY IF EXISTS "Users can upload photos for their provided care blocks" ON storage.objects;
DROP POLICY IF EXISTS "Users can view photos from their care blocks" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own care photos" ON storage.objects;

-- Policy: Users can upload photos to their own care blocks
CREATE POLICY "Users can upload photos for their provided care blocks"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'care-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can view photos from care blocks they're involved in
CREATE POLICY "Users can view photos from their care blocks"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'care-photos'
  AND (
    -- User is the care provider (uploader)
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- User is involved in the care block (as parent_id or through scheduled_care_children)
    EXISTS (
      SELECT 1 FROM scheduled_care sc
      WHERE sc.id::text = (storage.foldername(name))[2]
      AND sc.parent_id = auth.uid()
    )
    OR
    -- User is receiving parent (through scheduled_care_children)
    EXISTS (
      SELECT 1 FROM scheduled_care_children scc
      JOIN scheduled_care sc ON scc.scheduled_care_id = sc.id
      WHERE sc.id::text = (storage.foldername(name))[2]
      AND scc.child_id IN (
        SELECT id FROM children WHERE parent_id = auth.uid()
      )
    )
  )
);

-- Policy: Users can delete their own uploaded photos
CREATE POLICY "Users can delete their own care photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'care-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add comment for documentation
COMMENT ON COLUMN scheduled_care.photo_urls IS 'Array of Supabase Storage URLs for photos uploaded by care provider';
