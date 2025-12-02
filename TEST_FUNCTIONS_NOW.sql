-- Test both functions to see what they return for the invited parent

-- Test 1: Check raw data exists
SELECT
    'Raw Data Check' as test,
    cr.id as response_id,
    cr.responder_id,
    cr.status,
    cr.response_type,
    cq.id as request_id,
    cq.requester_id,
    cq.request_type
FROM care_responses cr
JOIN care_requests cq ON cr.request_id = cq.id
WHERE cr.responder_id = '1ddffe94-817a-4fad-859e-df7adae45e31'
AND cq.request_type = 'reciprocal';

-- Test 2: Call get_reciprocal_care_requests (should return child care invitation)
SELECT
    'Function Test - Requests' as test,
    *
FROM get_reciprocal_care_requests('1ddffe94-817a-4fad-859e-df7adae45e31');

-- Test 3: Call get_reciprocal_care_responses (should return NOTHING for this user)
SELECT
    'Function Test - Responses' as test,
    *
FROM get_reciprocal_care_responses('1ddffe94-817a-4fad-859e-df7adae45e31');
