-- Test to see what's wrong with get_reciprocal_pet_care_requests

-- First, check if the function exists
SELECT
    proname as function_name,
    pg_get_function_arguments(oid) as arguments,
    pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'get_reciprocal_pet_care_requests';

-- If you get results, the function exists
-- If you get no results, the function doesn't exist and needs to be created

-- To test the function with a real user ID, replace 'your-uuid-here' with an actual user ID:
-- SELECT * FROM get_reciprocal_pet_care_requests('your-uuid-here');
