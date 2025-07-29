-- Restore reciprocal care fields to request_responses table
-- This script adds back the columns that were removed in the "simplify_scheduling_system.sql"

ALTER TABLE request_responses 
ADD COLUMN IF NOT EXISTS reciprocal_date DATE,
ADD COLUMN IF NOT EXISTS reciprocal_start_time TIME,
ADD COLUMN IF NOT EXISTS reciprocal_end_time TIME,
ADD COLUMN IF NOT EXISTS reciprocal_duration_minutes INTEGER,
ADD COLUMN IF NOT EXISTS reciprocal_child_id UUID REFERENCES children(id),
ADD COLUMN IF NOT EXISTS keep_open_to_others BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS initiator_agreed BOOLEAN DEFAULT false;

-- Add comments to document the purpose of these fields
COMMENT ON COLUMN request_responses.reciprocal_date IS 'Date when the responder needs reciprocal care for their child';
COMMENT ON COLUMN request_responses.reciprocal_start_time IS 'Start time for reciprocal care';
COMMENT ON COLUMN request_responses.reciprocal_end_time IS 'End time for reciprocal care';
COMMENT ON COLUMN request_responses.reciprocal_duration_minutes IS 'Duration of reciprocal care in minutes';
COMMENT ON COLUMN request_responses.reciprocal_child_id IS 'ID of the responder''s child who needs reciprocal care';
COMMENT ON COLUMN request_responses.keep_open_to_others IS 'Whether to keep the request open for other group members to join';
COMMENT ON COLUMN request_responses.initiator_agreed IS 'Whether the original requester has agreed to the reciprocal care proposal'; 