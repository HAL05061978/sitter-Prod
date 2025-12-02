@echo off
echo ========================================
echo Pet Care Functions Fix - Deployment
echo ========================================
echo.
echo This script will guide you through deploying the pet care function fixes.
echo.
echo IMPORTANT: You need to have your Supabase project URL and service key ready.
echo.
pause

echo.
echo Step 1: Creating combined deployment file...
echo.

(
echo -- =====================================================
echo -- PET CARE FUNCTIONS FIX - COMBINED DEPLOYMENT
echo -- =====================================================
echo -- This file combines all necessary migrations to fix
echo -- the pet care workflow issues.
echo -- =====================================================
echo.
type migrations\20250123000005_add_pet_care_query_functions.sql
echo.
echo -- =====================================================
echo.
type migrations\20250123000006_fix_accept_pet_care_response.sql
echo.
echo -- =====================================================
echo.
type migrations\20250123000007_fix_pet_care_request_visibility.sql
) > pet_care_combined_fix.sql

echo Combined deployment file created: pet_care_combined_fix.sql
echo.
echo Step 2: Deploying to Supabase...
echo.
echo Please follow these steps:
echo 1. Open your Supabase Dashboard
echo 2. Go to SQL Editor
echo 3. Create a new query
echo 4. Copy the contents of 'pet_care_combined_fix.sql' and paste it
echo 5. Run the query
echo.
echo Opening the combined SQL file...
notepad pet_care_combined_fix.sql
echo.
pause

echo.
echo Step 3: Verifying deployment...
echo.
echo Run this query in Supabase SQL Editor to verify:
echo.
echo SELECT routine_name FROM information_schema.routines
echo WHERE routine_schema = 'public'
echo AND routine_name IN ('get_reciprocal_pet_care_requests', 'get_reciprocal_pet_care_responses', 'accept_pet_care_response');
echo.
echo You should see all 3 functions listed.
echo.
pause

echo.
echo Step 4: Fix current response status (if needed)...
echo.
echo If you have a pending response that needs to be submitted, run:
echo.
echo UPDATE pet_care_responses
echo SET status = 'submitted', response_type = 'pending', updated_at = NOW()
echo WHERE id = '4421957a-334f-4e16-9b5f-c614902eab32';
echo.
pause

echo.
echo ========================================
echo Deployment Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Test the pet care workflow in your application
echo 2. Check console for 404 errors (should be gone)
echo 3. Try accepting a pet care response
echo 4. Verify notifications are created
echo.
echo See DEPLOY_PET_CARE_FUNCTIONS_FIX.md for detailed information.
echo.
pause
