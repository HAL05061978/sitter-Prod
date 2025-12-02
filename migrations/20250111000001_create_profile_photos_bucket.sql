-- Migration: Setup RLS policies for profile-photos storage bucket
-- Created: 2025-01-11
-- Description: Sets up RLS policies for the profile-photos bucket
--
-- IMPORTANT: You must create the 'profile-photos' bucket manually first!
-- See instructions below this migration.

-- Drop existing policies if they exist (for rerun safety)
DROP POLICY IF EXISTS "Users can upload their own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Profile photos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile photos" ON storage.objects;

-- Policy: Allow users to upload their own profile photos
CREATE POLICY "Users can upload their own profile photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Profile photos are publicly accessible (for viewing)
CREATE POLICY "Profile photos are publicly accessible"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'profile-photos');

-- Policy: Users can update their own profile photos
CREATE POLICY "Users can update their own profile photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'profile-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own profile photos
CREATE POLICY "Users can delete their own profile photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- MANUAL STEP REQUIRED: Create the storage bucket via Supabase Dashboard
-- ============================================================================
--
-- Before running this migration, create the bucket manually:
--
-- 1. Go to Supabase Dashboard > Storage
-- 2. Click "Create a new bucket"
-- 3. Bucket name: profile-photos
-- 4. Set to PUBLIC (check "Public bucket" option)
-- 5. Click "Create bucket"
--
-- Then run this SQL migration to set up the RLS policies.
-- ============================================================================
