-- Test script to examine scheduled_care data and parent relationships
-- This will help us understand how parent_id is being used in the calendar display

-- ============================================================================
-- STEP 1: EXAMINE SCHEDULED_CARE DATA STRUCTURE
-- ============================================================================

-- Check the current scheduled_care data
SELECT 
    id,
    group_id,
    parent_id,
    child_id,
    care_date,
    start_time,
    end_time,
    care_type,
    status,
    related_request_id,
    notes
FROM public.scheduled_care
ORDER BY care_date DESC, start_time
LIMIT 10;

-- ============================================================================
-- STEP 2: EXAMINE PARENT-CHILD RELATIONSHIPS
-- ============================================================================

-- Check which children belong to which parents
SELECT 
    c.id as child_id,
    c.full_name as child_name,
    c.parent_id as child_parent_id,
    p.full_name as child_parent_name
FROM public.children c
JOIN public.profiles p ON c.parent_id = p.id
ORDER BY c.full_name;

-- ============================================================================
-- STEP 3: EXAMINE CARE REQUESTS AND RESPONSES
-- ============================================================================

-- Check care requests
SELECT 
    id,
    requester_id,
    child_id,
    requested_date,
    start_time,
    end_time,
    request_type,
    status
FROM public.care_requests
ORDER BY created_at DESC
LIMIT 5;

-- Check care responses
SELECT 
    id,
    request_id,
    responder_id,
    response_type,
    status
FROM public.care_responses
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- STEP 4: ANALYZE THE RELATIONSHIP BETWEEN SCHEDULED_CARE AND REQUESTS/RESPONSES
-- ============================================================================

-- Join scheduled_care with care_requests to understand the relationship
SELECT 
    sc.id as scheduled_care_id,
    sc.parent_id as scheduled_care_parent_id,
    sc.care_type,
    sc.child_id as scheduled_care_child_id,
    cr.requester_id as request_requester_id,
    cr.child_id as request_child_id,
    cr.status as request_status
FROM public.scheduled_care sc
LEFT JOIN public.care_requests cr ON sc.related_request_id = cr.id
ORDER BY sc.care_date DESC, sc.start_time
LIMIT 10;

-- ============================================================================
-- STEP 5: CHECK PROFILES FOR PARENT NAMES
-- ============================================================================

-- Get all profiles to understand parent names
SELECT 
    id,
    full_name,
    email
FROM public.profiles
ORDER BY full_name;

-- ============================================================================
-- STEP 6: UNDERSTAND THE ISSUE
-- ============================================================================

-- For "needed" care blocks, the parent_id should be the parent who NEEDS care
-- For "provided" care blocks, the parent_id should be the parent who PROVIDES care
-- But in the frontend, we're using parent_id for both cases, which is incorrect

-- Let's see what the actual data looks like:
SELECT 
    sc.id,
    sc.care_type,
    sc.parent_id,
    p.full_name as parent_name,
    sc.child_id,
    c.full_name as child_name,
    sc.care_date,
    sc.start_time,
    sc.end_time
FROM public.scheduled_care sc
JOIN public.profiles p ON sc.parent_id = p.id
JOIN public.children c ON sc.child_id = c.id
ORDER BY sc.care_date DESC, sc.start_time
LIMIT 10;

-- ============================================================================
-- STEP 7: SUMMARY
-- ============================================================================

SELECT 
    'Analysis Complete' as status,
    'For red blocks (care needed), parent_id should be the parent who NEEDS care' as note1,
    'For green blocks (care provided), parent_id should be the parent who PROVIDES care' as note2,
    'The frontend logic needs to be updated to handle this correctly' as note3; 