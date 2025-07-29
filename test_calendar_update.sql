-- Test Calendar Update After Invitation Acceptance
-- This verifies that the calendar updates properly when invitations are accepted

-- ============================================================================
-- TEST: Check if scheduled blocks exist after invitation acceptance
-- ============================================================================

-- Check if any scheduled blocks exist
SELECT 
    'Scheduled Blocks Test' as test_name,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ PASS: Found scheduled blocks'
        ELSE '❌ FAIL: No scheduled blocks found'
    END as status
FROM public.scheduled_blocks;

-- Show all scheduled blocks with details
SELECT 
    sb.id as block_id,
    sb.block_type,
    sb.child_id,
    c.full_name as child_name,
    p.full_name as parent_name,
    sb.scheduled_date,
    sb.start_time,
    sb.end_time,
    sb.care_group_id,
    br.id as request_id
FROM public.scheduled_blocks sb
JOIN public.children c ON sb.child_id = c.id
JOIN public.profiles p ON c.parent_id = p.id
LEFT JOIN public.babysitting_requests br ON sb.request_id = br.id
ORDER BY sb.scheduled_date, sb.start_time;

-- ============================================================================
-- TEST: Check if invitations were accepted
-- ============================================================================

-- Check invitation status
SELECT 
    'Invitation Status Test' as test_name,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ PASS: Found accepted invitations'
        ELSE '❌ FAIL: No accepted invitations found'
    END as status
FROM public.group_invitations
WHERE status = 'accepted';

-- Show accepted invitations
SELECT 
    gi.id as invitation_id,
    gi.status,
    gi.invitation_date,
    gi.invitation_start_time,
    gi.invitation_end_time,
    br.requested_date as original_request_date,
    br.start_time as original_start_time,
    br.end_time as original_end_time
FROM public.group_invitations gi
JOIN public.babysitting_requests br ON gi.request_id = br.id
WHERE gi.status = 'accepted'
ORDER BY gi.created_at DESC;

-- ============================================================================
-- TEST: Verify care group linking
-- ============================================================================

-- Check if blocks are properly linked by care_group_id
SELECT 
    'Care Group Linking Test' as test_name,
    care_group_id,
    COUNT(*) as block_count,
    STRING_AGG(block_type, ', ' ORDER BY block_type) as block_types,
    STRING_AGG(scheduled_date::text, ', ' ORDER BY scheduled_date) as dates
FROM public.scheduled_blocks
WHERE care_group_id IS NOT NULL
GROUP BY care_group_id
ORDER BY care_group_id;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Calendar update test complete! Check the results above to verify that blocks are created and linked properly.' as status; 