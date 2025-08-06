-- Add missing reciprocal columns to existing open_block_invitations table
-- Run this if you get "Could not find the 'reciprocal_date' column" error

-- Add the missing reciprocal columns
ALTER TABLE open_block_invitations 
ADD COLUMN IF NOT EXISTS reciprocal_date DATE,
ADD COLUMN IF NOT EXISTS reciprocal_start_time TIME,
ADD COLUMN IF NOT EXISTS reciprocal_end_time TIME;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'open_block_invitations' 
AND column_name IN ('reciprocal_date', 'reciprocal_start_time', 'reciprocal_end_time');

-- Success message
SELECT 'Reciprocal columns added successfully!' as status; 