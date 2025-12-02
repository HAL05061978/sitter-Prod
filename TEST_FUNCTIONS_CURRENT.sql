-- Test to see what the current production functions are actually doing
-- Run these queries in Supabase SQL Editor to see what data is being returned

-- Test get_reciprocal_care_responses for Hugo (requester)
-- This should return INVITATIONS Hugo needs to respond to (where he's responder)
-- NOT responses to his own requests
SELECT 'get_reciprocal_care_responses for Hugo:' as test;
SELECT * FROM get_reciprocal_care_responses('1f66fb72-ccfb-4a55-8738-716a12543421');

-- Test get_reciprocal_pet_care_responses for Hugo (requester)
-- This should return INVITATIONS Hugo needs to respond to (where he's responder)
-- NOT responses to his own requests
SELECT 'get_reciprocal_pet_care_responses for Hugo:' as test;
SELECT * FROM get_reciprocal_pet_care_responses('1f66fb72-ccfb-4a55-8738-716a12543421');

-- Check the actual data in pet_care_responses
SELECT 'All pet_care_responses:' as test;
SELECT
  pcr.id as response_id,
  pcr.request_id,
  pcr.responder_id,
  pcr.status,
  pcrq.requester_id,
  pcrq.requested_date
FROM pet_care_responses pcr
JOIN pet_care_requests pcrq ON pcr.request_id = pcrq.id
WHERE pcrq.request_type = 'reciprocal'
ORDER BY pcr.created_at DESC;
