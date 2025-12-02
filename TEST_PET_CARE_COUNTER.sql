-- =====================================================
-- TEST PET CARE COUNTER
-- =====================================================
-- Run these queries to diagnose why counter is not updating

-- =====================================================
-- TEST 1: Check if function exists
-- =====================================================
SELECT
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'get_pet_care_responses_for_requester';

-- EXPECTED: 1 row showing the function exists
-- IF EMPTY: Function not deployed - deploy migration #2

-- =====================================================
-- TEST 2: Check raw response data for your request
-- =====================================================
-- Replace YOUR_REQUESTER_ID with: 1f66fb72-ccfb-4a55-8738-716a12543421
SELECT
    pcr.id as response_id,
    pcr.status,
    pcr.response_type,
    pcrq.request_type,
    pcrq.requester_id,
    pcr.created_at
FROM pet_care_responses pcr
JOIN pet_care_requests pcrq ON pcr.request_id = pcrq.id
WHERE pcrq.requester_id = '1f66fb72-ccfb-4a55-8738-716a12543421'
ORDER BY pcr.created_at DESC;

-- EXPECTED: See response d827ae9e... with status='submitted'

-- =====================================================
-- TEST 3: Call the function directly
-- =====================================================
-- Replace YOUR_REQUESTER_ID with: 1f66fb72-ccfb-4a55-8738-716a12543421
SELECT * FROM get_pet_care_responses_for_requester('1f66fb72-ccfb-4a55-8738-716a12543421');

-- EXPECTED: Should return 1 row for the submitted response
-- IF EMPTY: Function filters are wrong - re-deploy migration #2
-- IF ERROR: Function has syntax error - check error message

-- =====================================================
-- TEST 4: Check what filters are applied
-- =====================================================
-- This shows the submitted response that SHOULD be returned
SELECT
    pcr.id,
    pcr.status,
    pcr.response_type,
    pcrq.request_type,
    -- These are the filters the function uses:
    (pcrq.requester_id = '1f66fb72-ccfb-4a55-8738-716a12543421') as matches_requester,
    (pcr.response_type = 'pending') as matches_response_type,
    (pcr.status IN ('submitted', 'accepted', 'declined')) as matches_status,
    (pcrq.request_type = 'reciprocal') as matches_request_type,
    -- All should be TRUE for the submitted response
    (
        pcrq.requester_id = '1f66fb72-ccfb-4a55-8738-716a12543421' AND
        pcr.response_type = 'pending' AND
        pcr.status IN ('submitted', 'accepted', 'declined') AND
        pcrq.request_type = 'reciprocal'
    ) as should_be_returned
FROM pet_care_responses pcr
JOIN pet_care_requests pcrq ON pcr.request_id = pcrq.id
WHERE pcrq.requester_id = '1f66fb72-ccfb-4a55-8738-716a12543421'
ORDER BY pcr.created_at DESC;

-- EXPECTED: The submitted response should have should_be_returned = TRUE
-- This confirms it matches all filters

-- =====================================================
-- DIAGNOSIS RESULTS
-- =====================================================
-- If TEST 1 is empty → Deploy migration #2
-- If TEST 2 shows data but TEST 3 is empty → Re-deploy migration #2 (filters wrong)
-- If TEST 3 returns data → Frontend issue (check browser console)
-- If TEST 4 shows should_be_returned = FALSE → Data issue (check status/type values)

-- =====================================================
-- QUICK FIX
-- =====================================================
-- 1. Re-deploy migration #2:
--    migrations/20250115000026_add_get_pet_care_responses_for_requester.sql
--
-- 2. Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)
--
-- 3. Check browser console for CounterDebugger errors
--
-- 4. Test counter:
--    - Counter should show 1 for the submitted response
