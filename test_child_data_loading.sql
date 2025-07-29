-- Test Child Data Loading
-- This verifies that child data is being loaded correctly with scheduled blocks and requests

-- ============================================================================
-- TEST: Check if scheduled blocks have child data
-- ============================================================================

-- Check if any scheduled blocks exist
SELECT 
    'Scheduled Blocks Test' as test_name,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ PASS: Found scheduled blocks'
        ELSE '❌ FAIL: No scheduled blocks found'
    END as status
FROM public.scheduled_blocks;

-- Show scheduled blocks with child data
SELECT 
    sb.id as block_id,
    sb.block_type,
    sb.child_id,
    c.full_name as child_name,
    p.full_name as parent_name,
    sb.scheduled_date,
    sb.start_time,
    sb.end_time
FROM public.scheduled_blocks sb
JOIN public.children c ON sb.child_id = c.id
JOIN public.profiles p ON c.parent_id = p.id
ORDER BY sb.scheduled_date, sb.start_time;

-- ============================================================================
-- TEST: Check if requests have child data
-- ============================================================================

-- Check if any requests exist
SELECT 
    'Requests Test' as test_name,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ PASS: Found requests'
        ELSE '❌ FAIL: No requests found'
    END as status
FROM public.babysitting_requests;

-- Show requests with child data
SELECT 
    br.id as request_id,
    br.status,
    br.child_id,
    c.full_name as child_name,
    p.full_name as parent_name,
    br.requested_date,
    br.start_time,
    br.end_time
FROM public.babysitting_requests br
JOIN public.children c ON br.child_id = c.id
JOIN public.profiles p ON c.parent_id = p.id
ORDER BY br.created_at DESC;

-- ============================================================================
-- TEST: Check if responses have reciprocal child data
-- ============================================================================

-- Check if any responses exist
SELECT 
    'Responses Test' as test_name,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ PASS: Found responses'
        ELSE '❌ FAIL: No responses found'
    END as status
FROM public.request_responses;

-- Show responses with reciprocal child data
SELECT 
    rr.id as response_id,
    rr.response_type,
    rr.status,
    rr.reciprocal_child_id,
    c.full_name as reciprocal_child_name,
    p.full_name as reciprocal_parent_name,
    rr.reciprocal_date,
    rr.reciprocal_start_time,
    rr.reciprocal_end_time
FROM public.request_responses rr
LEFT JOIN public.children c ON rr.reciprocal_child_id = c.id
LEFT JOIN public.profiles p ON c.parent_id = p.id
WHERE rr.reciprocal_child_id IS NOT NULL
ORDER BY rr.created_at DESC;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Child data loading test complete! Check the results above to see if child names are available in the database.' as status; 