-- Fix RLS Policies for scheduled_care table
-- This script checks and updates RLS policies to allow proper inserts

-- First, let's see what RLS policies exist
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
WHERE tablename = 'scheduled_care';

-- Check if RLS is enabled on the table
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'scheduled_care';

-- Drop existing policies if they're too restrictive
DROP POLICY IF EXISTS "Users can view their own scheduled care" ON scheduled_care;
DROP POLICY IF EXISTS "Users can insert their own scheduled care" ON scheduled_care;
DROP POLICY IF EXISTS "Users can update their own scheduled care" ON scheduled_care;
DROP POLICY IF EXISTS "Users can delete their own scheduled care" ON scheduled_care;

-- Create new, more permissive policies
-- Policy for viewing scheduled care
CREATE POLICY "Users can view scheduled care" ON scheduled_care
    FOR SELECT USING (
        auth.uid() = parent_id OR 
        auth.uid() IN (
            SELECT requester_id FROM care_requests WHERE id = related_request_id
        )
    );

-- Policy for inserting scheduled care
CREATE POLICY "Users can insert scheduled care" ON scheduled_care
    FOR INSERT WITH CHECK (
        auth.uid() = parent_id OR 
        auth.uid() IN (
            SELECT requester_id FROM care_requests WHERE id = related_request_id
        )
    );

-- Policy for updating scheduled care
CREATE POLICY "Users can update scheduled care" ON scheduled_care
    FOR UPDATE USING (
        auth.uid() = parent_id OR 
        auth.uid() IN (
            SELECT requester_id FROM care_requests WHERE id = related_request_id
        )
    );

-- Policy for deleting scheduled care
CREATE POLICY "Users can delete scheduled care" ON scheduled_care
    FOR DELETE USING (
        auth.uid() = parent_id OR 
        auth.uid() IN (
            SELECT requester_id FROM care_requests WHERE id = related_request_id
        )
    );

-- Verify the policies were created
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
WHERE tablename = 'scheduled_care';

SELECT 'RLS policies updated for scheduled_care table' as status; 