-- Add status column to messages table
-- This column will track the status of invite messages: 'pending', 'accepted', 'rejected'

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Add a comment to explain the status values
COMMENT ON COLUMN messages.status IS 'Status for invite messages: pending, accepted, rejected. Default is pending.';

-- Create an index on status for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);

-- Update existing invite messages to have 'pending' status
UPDATE messages 
SET status = 'pending' 
WHERE role = 'invite' AND status IS NULL; 