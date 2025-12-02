-- Test the get_reciprocal_care_requests function for the logged-in user
SELECT * FROM get_reciprocal_care_requests('1ddffe94-817a-4fad-859e-df7adae45e31');

-- Also check if the function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%reciprocal_care%';

-- Check the actual data in the tables
SELECT
    cr.id as response_id,
    cr.responder_id,
    cr.response_type,
    cr.status,
    cq.id as request_id,
    cq.requester_id,
    cq.request_type
FROM care_responses cr
JOIN care_requests cq ON cr.request_id = cq.id
WHERE cr.responder_id = '1ddffe94-817a-4fad-859e-df7adae45e31';
