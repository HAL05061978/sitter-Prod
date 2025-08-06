-- Cleanup script for testing open block feature
-- This script cleans up test data without affecting core profiles, groups, and children
-- Run this in your Supabase SQL editor

-- 1. Clean up care_responses first (due to foreign key constraints)
DELETE FROM care_responses 
WHERE request_id IN (
    SELECT id FROM care_requests 
    WHERE request_type IN ('open_block', 'reciprocal')
    AND created_at >= NOW() - INTERVAL '7 days'
);

-- 2. Clean up scheduled_care blocks related to open block requests
DELETE FROM scheduled_care 
WHERE related_request_id IN (
    SELECT id FROM care_requests 
    WHERE request_type IN ('open_block', 'reciprocal')
    AND created_at >= NOW() - INTERVAL '7 days'
);

-- 3. Clean up care_requests (open block and reciprocal requests)
DELETE FROM care_requests 
WHERE request_type IN ('open_block', 'reciprocal') 
AND created_at >= NOW() - INTERVAL '7 days';

-- 4. Clean up messages related to open block invitations
DELETE FROM messages 
WHERE subject LIKE '%Open Block%' 
AND created_at >= NOW() - INTERVAL '7 days';

-- 5. Clean up event responses (if any were created during testing)
DELETE FROM event_responses 
WHERE created_at >= NOW() - INTERVAL '7 days';

-- 6. Clean up event notifications (if any were created during testing)
DELETE FROM event_notifications 
WHERE created_at >= NOW() - INTERVAL '7 days';

-- Optional: Reset sequences if needed (uncomment if you encounter sequence issues)
-- SELECT setval('care_requests_id_seq', COALESCE((SELECT MAX(id) FROM care_requests), 1));
-- SELECT setval('care_responses_id_seq', COALESCE((SELECT MAX(id) FROM care_responses), 1));
-- SELECT setval('scheduled_care_id_seq', COALESCE((SELECT MAX(id) FROM scheduled_care), 1));

-- Show cleanup results
SELECT 
    'care_requests' as table_name,
    COUNT(*) as remaining_records
FROM care_requests 
WHERE request_type IN ('open_block', 'reciprocal')
UNION ALL
SELECT 
    'care_responses' as table_name,
    COUNT(*) as remaining_records
FROM care_responses 
WHERE request_id IN (
    SELECT id FROM care_requests 
    WHERE request_type IN ('open_block', 'reciprocal')
)
UNION ALL
SELECT 
    'scheduled_care' as table_name,
    COUNT(*) as remaining_records
FROM scheduled_care 
WHERE related_request_id IN (
    SELECT id FROM care_requests 
    WHERE request_type IN ('open_block', 'reciprocal')
)
UNION ALL
SELECT 
    'messages' as table_name,
    COUNT(*) as remaining_records
FROM messages 
WHERE subject LIKE '%Open Block%'; 