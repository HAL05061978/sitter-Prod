@echo off
echo =====================================================
echo Deploying Reschedule Action Type Fix
echo =====================================================
echo.
echo This script will apply the migration to fix the action_type constraint
echo and update the initiate_improved_reschedule function.
echo.
echo MANUAL DEPLOYMENT REQUIRED:
echo.
echo 1. Go to your Supabase Dashboard: https://hilkelodfneancwwzvoh.supabase.co
echo 2. Navigate to SQL Editor
echo 3. Copy and paste the contents of:
echo    supabase\supabase\migrations\20251024120000_fix_reschedule_action_type.sql
echo 4. Execute the SQL
echo.
echo Alternatively, you can run:
echo   npx supabase db push --db-url "postgresql://postgres:[PASSWORD]@db.hilkelodfneancwwzvoh.supabase.co:5432/postgres"
echo.
pause
