-- Clear Open Block Test Data
-- This script removes all open block related records for clean testing
-- Preserves: profiles, children, groups, and other fundamental data

BEGIN;

-- Clear open block responses first (due to foreign key constraints)
DELETE FROM open_block_responses;

-- Clear open block invitations
DELETE FROM open_block_invitations;

-- Clear scheduled_care_children entries that were created by open block acceptances
DELETE FROM scheduled_care_children 
WHERE notes LIKE '%Open block acceptance%';

-- Clear scheduled_care entries that were created by open block acceptances
DELETE FROM scheduled_care 
WHERE notes LIKE '%Open block acceptance%' 
   OR notes LIKE '%Open block invitation%';

-- Clear messages related to open block notifications
DELETE FROM messages 
WHERE subject LIKE '%Open Block%' 
   OR content LIKE '%open block%';

COMMIT;

-- Verification queries
SELECT 'open_block_responses' as table_name, COUNT(*) as remaining_count FROM open_block_responses
UNION ALL
SELECT 'open_block_invitations' as table_name, COUNT(*) as remaining_count FROM open_block_invitations
UNION ALL
SELECT 'scheduled_care (open block notes)' as table_name, COUNT(*) as remaining_count FROM scheduled_care WHERE notes LIKE '%Open block%'
UNION ALL
SELECT 'scheduled_care_children (open block notes)' as table_name, COUNT(*) as remaining_count FROM scheduled_care_children WHERE notes LIKE '%Open block%'
UNION ALL
SELECT 'messages (open block related)' as table_name, COUNT(*) as remaining_count FROM messages WHERE subject LIKE '%Open Block%' OR content LIKE '%open block%';

-- Show remaining scheduled_care entries (should be your original reciprocal blocks)
SELECT 
    id,
    parent_id,
    care_date,
    start_time,
    end_time,
    notes,
    created_at
FROM scheduled_care 
ORDER BY created_at DESC
LIMIT 10;
