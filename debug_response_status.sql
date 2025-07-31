-- Debug script to check the actual status values in care_responses table
-- This will help us understand why the frontend is not finding accepted responses

-- Check all care_responses with their status values
SELECT 
    id,
    request_id,
    responder_id,
    response_type,
    status,
    created_at
FROM public.care_responses
ORDER BY created_at DESC;

-- Check care_requests status values
SELECT 
    id,
    requester_id,
    status,
    created_at
FROM public.care_requests
ORDER BY created_at DESC;

-- Check if there are any responses with status 'accepted'
SELECT 
    COUNT(*) as accepted_responses_count
FROM public.care_responses
WHERE status = 'accepted';

-- Check if there are any requests with status 'accepted'
SELECT 
    COUNT(*) as accepted_requests_count
FROM public.care_requests
WHERE status = 'accepted';

-- Check the most recent responses and their status
SELECT 
    cr.id as request_id,
    cr.status as request_status,
    cresp.id as response_id,
    cresp.status as response_status,
    cresp.response_type,
    cresp.responder_id
FROM public.care_requests cr
LEFT JOIN public.care_responses cresp ON cr.id = cresp.request_id
ORDER BY cr.created_at DESC
LIMIT 10; 