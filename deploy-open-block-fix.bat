@echo off
echo ========================================
echo Deploying Open Block Return Type Fix
echo ========================================
echo.

REM Check if Supabase CLI is installed
where supabase >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Supabase CLI is not installed or not in PATH
    echo Please install it from: https://supabase.com/docs/guides/cli
    pause
    exit /b 1
)

echo Step 1: Applying database migration fix...
echo.

REM Apply the SQL fix to production
supabase db push --db-url "postgresql://postgres.amxaekuduhfwxzhngpry:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres" --file fix_open_block_return_type.sql

if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Failed to apply database migration
    pause
    exit /b 1
)

echo.
echo ========================================
echo Fix deployed successfully!
echo ========================================
echo.
echo Changes made:
echo - Modified create_open_block_invitation function to return INTEGER (count of invitations)
echo - Function now returns the actual number of invitations created
echo - Frontend will display correct count in success message
echo.
echo Next steps:
echo 1. Test the open block functionality in production
echo 2. Verify console logs show all steps
echo 3. Check care_requests and care_responses tables for new records
echo.
pause
