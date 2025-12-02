-- Migration: Create RLS policies for children-photos storage bucket
-- Created: 2025-01-11
-- Description: Sets up Row Level Security policies for the children-photos storage bucket
-- IMPORTANT: The storage bucket 'children-photos' must be created manually via Supabase UI first (see deployment guide)

-- Drop existing policies if they exist (for rerun safety)
DROP POLICY IF EXISTS "Users can upload their own children photos" ON storage.objects;
DROP POLICY IF EXISTS "Children photos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own children photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own children photos" ON storage.objects;

-- Policy 1: Users can upload their own children photos
CREATE POLICY "Users can upload their own children photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'children-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Children photos are publicly accessible (for viewing)
CREATE POLICY "Children photos are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'children-photos');

-- Policy 3: Users can update their own children photos
CREATE POLICY "Users can update their own children photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'children-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'children-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 4: Users can delete their own children photos
CREATE POLICY "Users can delete their own children photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'children-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
