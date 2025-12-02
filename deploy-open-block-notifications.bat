@echo off
REM =============================================
REM DEPLOY OPEN BLOCK NOTIFICATIONS FIX (Windows)
REM =============================================
REM This script helps deploy the open block notifications fix

echo 🚀 Starting Open Block Notifications Fix Deployment...
echo.

REM Check if we're in the right directory
if not exist "supabase\supabase\migrations\20250130_add_open_block_notifications.sql" (
    echo ❌ Error: Migration file not found
    echo Expected: supabase\supabase\migrations\20250130_add_open_block_notifications.sql
    echo Please run this script from the project root directory
    pause
    exit /b 1
)

echo ✅ Found migration file: 20250130_add_open_block_notifications.sql
echo.

REM Display what this fixes
echo 🔧 WHAT THIS FIX DOES:
echo ====================
echo.
echo PROBLEM:
echo   • Provider receives NO notification when open block is accepted
echo   • Acceptor only sees frontend message, not real notification
echo.
echo SOLUTION:
echo   • Adds notification to Provider: "Karen accepted your open block..."
echo   • Adds notification to Acceptor: "You accepted Rosmary's open block..."
echo   • Both notifications appear in notifications panel
echo.

REM Instructions for manual deployment
echo 📋 DEPLOYMENT INSTRUCTIONS:
echo =========================
echo.
echo 1. Go to your Supabase Dashboard:
echo    https://supabase.com/dashboard
echo.
echo 2. Select your production project
echo.
echo 3. Go to SQL Editor (left sidebar)
echo.
echo 4. Click "New Query"
echo.
echo 5. Copy the ENTIRE contents of:
echo    supabase\supabase\migrations\20250130_add_open_block_notifications.sql
echo.
echo 6. Paste into the SQL Editor
echo.
echo 7. Click "Run" (or press Ctrl+Enter)
echo.
echo 8. Verify you see:
echo    - "Query executed successfully" message
echo    - No errors in the output
echo.

echo ✅ VERIFICATION STEPS:
echo ====================
echo.
echo After deployment, test by:
echo.
echo As PROVIDER (person creating open block):
echo   1. Create an open block invitation
echo   2. Wait for someone to accept it
echo   3. Check notifications panel
echo   4. Should see: "Karen accepted your open block for..."
echo.
echo As ACCEPTOR (person accepting open block):
echo   1. Accept an open block invitation
echo   2. Check notifications panel
echo   3. Should see: "You accepted Rosmary's open block for..."
echo   4. Check calendar - blocks should be created
echo.

echo 📄 ADDITIONAL DOCUMENTATION:
echo ==========================
echo See DEPLOY_OPEN_BLOCK_NOTIFICATIONS.md for:
echo   • Detailed explanation
echo   • Rollback instructions
echo   • Full technical details
echo.

echo 🎯 IMPORTANT NOTES:
echo ==================
echo • Zero breaking changes - only adds notifications
echo • All existing block creation logic preserved
echo • Matches reciprocal care notification pattern
echo • Safe to deploy in production
echo.

REM Check if we can detect the Supabase URL from environment
if exist ".env.local" (
    echo 🔍 Found .env.local file
    for /f "tokens=2 delims==" %%i in ('findstr "NEXT_PUBLIC_SUPABASE_URL" .env.local') do set SUPABASE_URL=%%i
    if not "!SUPABASE_URL!"=="" (
        echo 📍 Supabase URL: !SUPABASE_URL!
        echo    Dashboard: https://supabase.com/dashboard
    )
    echo.
)

echo ✅ Ready to deploy! Follow the instructions above.
echo.
pause
