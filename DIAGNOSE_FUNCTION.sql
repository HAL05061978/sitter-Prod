-- =====================================================
-- DIAGNOSE PET CARE FUNCTION
-- =====================================================
-- Run this in Supabase SQL Editor to see what's wrong
-- =====================================================

-- Step 1: Check if function exists
SELECT
    proname as function_name,
    pg_get_function_arguments(oid) as parameters
FROM pg_proc
WHERE proname = 'get_reciprocal_pet_care_requests';

-- If you get NO RESULTS, the function doesn't exist!
-- If you get results, continue to Step 2

-- Step 2: Try to run the function with a real user ID
-- Replace 'YOUR-USER-ID-HERE' with an actual UUID from your profiles table
-- SELECT * FROM get_reciprocal_pet_care_requests('YOUR-USER-ID-HERE');

-- Step 3: Check if the tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('pet_care_requests', 'pet_care_responses', 'pets');

-- All three should show up. If not, tables are missing!

-- Step 4: Check if pet_care_responses has the columns we need
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'pet_care_responses'
ORDER BY ordinal_position;
