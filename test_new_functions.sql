-- Test script to check if the new invitation functions exist
-- Run this in your Supabase database to verify the functions were created

-- Check if submit_invitation_response function exists
SELECT 
    'Function Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'submit_invitation_response'
            AND routine_type = 'FUNCTION'
        ) THEN '✅ PASS: submit_invitation_response exists'
        ELSE '❌ FAIL: submit_invitation_response missing'
    END as status;

-- Check if accept_invitation_response function exists
SELECT 
    'Function Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'accept_invitation_response'
            AND routine_type = 'FUNCTION'
        ) THEN '✅ PASS: accept_invitation_response exists'
        ELSE '❌ FAIL: accept_invitation_response missing'
    END as status;

-- Check if get_invitation_responses function exists
SELECT 
    'Function Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'get_invitation_responses'
            AND routine_type = 'FUNCTION'
        ) THEN '✅ PASS: get_invitation_responses exists'
        ELSE '❌ FAIL: get_invitation_responses missing'
    END as status;

-- Check if the old accept_group_invitation_with_time_block function is deprecated
SELECT 
    'Deprecated Function Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'accept_group_invitation_with_time_block'
            AND routine_type = 'FUNCTION'
        ) THEN '⚠️ WARNING: accept_group_invitation_with_time_block still exists (should be deprecated)'
        ELSE '✅ PASS: accept_group_invitation_with_time_block properly deprecated'
    END as status;

SELECT 'If any functions are missing, run the fix_invitation_auto_accept_actual.sql script first.' as note; 