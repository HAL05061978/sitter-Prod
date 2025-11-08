-- Test both pet care functions to see which one has the error
-- Replace YOUR-USER-ID with a real user ID from profiles table

-- Test 1: get_reciprocal_pet_care_requests
-- Uncomment and add your user ID:
-- SELECT * FROM get_reciprocal_pet_care_requests('YOUR-USER-ID'::uuid);

-- Test 2: get_reciprocal_pet_care_responses
-- Uncomment and add your user ID:
-- SELECT * FROM get_reciprocal_pet_care_responses('YOUR-USER-ID'::uuid);

-- To get a user ID to test with:
SELECT id, email FROM profiles LIMIT 1;
