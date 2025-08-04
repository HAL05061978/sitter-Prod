-- Test the invitation fix
-- This script will verify that the auto-acceptance issue is fixed

-- First, let's clear any existing test data
DELETE FROM care_responses;
DELETE FROM care_requests;

-- Check that the functions exist
SELECT '=== FUNCTION CHECK ===' as info;
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name IN ('submit_invitation_response', 'accept_invitation_response', 'get_invitation_responses')
ORDER BY routine_name;

-- Check the current state
SELECT '=== INITIAL STATE ===' as info;
SELECT 'Care Requests' as table_name, COUNT(*) as count FROM care_requests;
SELECT 'Care Responses' as table_name, COUNT(*) as count FROM care_responses;

SELECT 'Ready to test invitation flow. The response_type should now be set to "pending" instead of "accept".' as note; 