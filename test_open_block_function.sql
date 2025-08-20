-- Test script for open block function
-- This script helps debug the accept_open_block_invitation function

-- First, let's check the current state of care_responses and care_requests
SELECT '=== CURRENT CARE RESPONSES ===' as info;
SELECT 
    cr.id as care_response_id,
    cr.request_id as care_request_id,
    cr.responder_id,
    cr.status,
    cr.response_type,
    cr.block_time_id,
    cr.invited_parent_id,
    cr.reciprocal_date,
    cr.reciprocal_start_time,
    cr.reciprocal_end_time,
    cr.created_at
FROM care_responses cr
WHERE cr.status = 'pending'
ORDER BY cr.created_at DESC;

SELECT '=== CURRENT CARE REQUESTS ===' as info;
SELECT 
    cq.id as care_request_id,
    cq.requester_id,
    cq.child_id,
    cq.request_type,
    cq.status,
    cq.existing_block_id,
    cq.reciprocal_date,
    cq.reciprocal_start_time,
    cq.reciprocal_end_time,
    cq.created_at
FROM care_requests cq
WHERE cq.request_type = 'open_block'
ORDER BY cq.created_at DESC;

SELECT '=== CURRENT SCHEDULED CARE ===' as info;
SELECT 
    sc.id as scheduled_care_id,
    sc.group_id,
    sc.parent_id,
    sc.child_id,
    sc.care_date,
    sc.start_time,
    sc.end_time,
    sc.care_type,
    sc.status,
    sc.related_request_id,
    sc.created_at
FROM scheduled_care sc
WHERE sc.related_request_id IS NOT NULL
ORDER BY sc.created_at DESC;

SELECT '=== CURRENT SCHEDULED CARE CHILDREN ===' as info;
SELECT 
    scc.scheduled_care_id,
    scc.child_id,
    scc.providing_parent_id,
    scc.notes,
    scc.created_at
FROM scheduled_care_children scc
ORDER BY scc.created_at DESC
LIMIT 10;

-- Test function call (replace with actual IDs from above queries)
-- SELECT accept_open_block_invitation(
--     '21eb2980-9eb3-4058-a338-a4cf27235610'::UUID,  -- care_response_id
--     '8c7b93f6-582d-4208-9cdd-65a940a1d18d'::UUID,  -- accepting_parent_id
--     '7d88bd93-2ad1-4560-ad06-47ae9e769fa7'::UUID   -- accepted_child_id
-- );

-- Check for any recent errors in the logs
SELECT '=== RECENT FUNCTION ERRORS ===' as info;
-- This would require access to PostgreSQL logs, but we can check for any failed transactions
-- by looking for inconsistencies in the data

-- Verify the function exists and has correct signature
SELECT '=== FUNCTION SIGNATURE ===' as info;
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'accept_open_block_invitation'
AND n.nspname = 'public';
