-- Fix RLS policies for messages table to allow status updates
-- The issue is that the messages table likely has RLS enabled but no update policy

-- First, let's check if RLS is enabled and what policies exist
-- (This is for reference - you can run this to see current policies)
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename = 'messages';

-- Enable RLS if not already enabled
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
DROP POLICY IF EXISTS "Users can update message status" ON messages;

-- Create a policy that allows users to update messages they received
CREATE POLICY "Users can update their own messages" ON messages
    FOR UPDATE
    USING (recipient_id = auth.uid())
    WITH CHECK (recipient_id = auth.uid());

-- Create a policy that allows users to update message status specifically
CREATE POLICY "Users can update message status" ON messages
    FOR UPDATE
    USING (recipient_id = auth.uid())
    WITH CHECK (recipient_id = auth.uid());

-- Grant necessary permissions
GRANT UPDATE ON messages TO authenticated;

-- Test the update (this should work now)
-- UPDATE messages SET status = 'test' WHERE id = 'your-message-id' AND recipient_id = auth.uid(); 