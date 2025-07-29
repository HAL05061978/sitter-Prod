-- Fix RLS policy for scheduled_blocks table
-- Run this in Supabase SQL editor

-- First, let's see what RLS policies exist on scheduled_blocks
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'scheduled_blocks';

-- Option 1: Disable RLS on scheduled_blocks (simplest solution)
ALTER TABLE scheduled_blocks DISABLE ROW LEVEL SECURITY;

-- Option 2: If you want to keep RLS, create a policy that allows the function to insert
-- (Uncomment the lines below if you prefer this approach)

-- CREATE POLICY "Allow function to insert scheduled blocks" ON scheduled_blocks
-- FOR INSERT 
-- WITH CHECK (true);

-- CREATE POLICY "Allow users to view their own blocks" ON scheduled_blocks
-- FOR SELECT 
-- USING (
--   parent_id = auth.uid() OR 
--   child_id IN (
--     SELECT id FROM children WHERE parent_id = auth.uid()
--   )
-- );

-- Verify the change
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'scheduled_blocks';