-- Check invitation_time_blocks table structure
-- Run this in Supabase SQL editor

-- Check all columns in invitation_time_blocks table
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'invitation_time_blocks' 
ORDER BY ordinal_position;

-- Check sample data
SELECT * FROM invitation_time_blocks LIMIT 2;