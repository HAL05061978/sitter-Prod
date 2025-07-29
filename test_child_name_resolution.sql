-- Test Child Name Resolution
-- This verifies that child names are being resolved correctly

-- ============================================================================
-- TEST: Check child data in scheduled blocks
-- ============================================================================

-- Check what children are in scheduled blocks
SELECT 
    'Child Data Test' as test_name,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ PASS: Found children in scheduled blocks'
        ELSE '❌ FAIL: No children found in scheduled blocks'
    END as status
FROM public.scheduled_blocks sb
JOIN public.children c ON sb.child_id = c.id
WHERE sb.care_group_id IS NOT NULL;

-- Show the actual child data in scheduled blocks
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
WHERE sb.care_group_id IS NOT NULL
ORDER BY sb.scheduled_date, sb.start_time;

-- ============================================================================
-- TEST: Check if all children have full_name
-- ============================================================================

-- Check if any children are missing full_name
SELECT 
    'Missing Names Test' as test_name,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ PASS: All children have full_name'
        ELSE '❌ FAIL: Some children missing full_name'
    END as status
FROM public.children c
WHERE c.full_name IS NULL OR c.full_name = '';

-- Show children that might be missing names
SELECT 
    id,
    full_name
FROM public.children
WHERE full_name IS NULL OR full_name = '';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Child name resolution test complete! Check the results above to see if child names are available.' as status; 