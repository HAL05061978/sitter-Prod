-- Add group_id column to existing open_block_invitations table
-- This links related invitations (same time slot, different parents)

-- Add the group_id column
ALTER TABLE open_block_invitations 
ADD COLUMN IF NOT EXISTS group_id UUID;

-- Update existing records to have unique group_ids (if any exist)
UPDATE open_block_invitations 
SET group_id = gen_random_uuid() 
WHERE group_id IS NULL;

-- Make group_id NOT NULL after setting values
ALTER TABLE open_block_invitations 
ALTER COLUMN group_id SET NOT NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_open_block_invitations_group_id ON open_block_invitations(group_id);

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'open_block_invitations' 
AND column_name = 'group_id';

-- Success message
SELECT 'Group ID column added successfully!' as status; 