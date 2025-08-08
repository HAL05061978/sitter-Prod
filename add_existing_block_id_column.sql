-- Add existing_block_id column to open_block_invitations table
-- This allows linking invitations to existing care blocks (not just new open blocks)

ALTER TABLE open_block_invitations 
ADD COLUMN existing_block_id UUID REFERENCES scheduled_care(id);

-- Add comment to explain the new column
COMMENT ON COLUMN open_block_invitations.existing_block_id IS 
'Links to existing scheduled_care.id when inviting to an existing block. NULL for new open blocks.';

-- Verify the column was added
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'open_block_invitations' 
AND column_name = 'existing_block_id';
