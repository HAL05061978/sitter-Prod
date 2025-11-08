-- Check if get_reciprocal_pet_care_responses exists
SELECT proname, pg_get_function_arguments(oid)
FROM pg_proc
WHERE proname = 'get_reciprocal_pet_care_responses';

-- If it doesn't exist, this is the problem!
