@echo off
REM =============================================
REM DEPLOY PHOTO SUPPORT FOR CARE BLOCKS (Windows)
REM =============================================
REM This script helps deploy photo upload functionality for care blocks

echo 🚀 Starting Photo Support Deployment...

REM Check if migration file exists
if not exist "migrations\add_care_photos_support.sql" (
    echo ❌ Error: migrations\add_care_photos_support.sql not found
    echo Please run this script from the project root directory
    pause
    exit /b 1
)

echo ✅ Found migration file

REM Instructions for manual deployment
echo.
echo 📋 DEPLOYMENT INSTRUCTIONS:
echo ==================================
echo.
echo 1. Go to your Supabase Dashboard:
echo    https://supabase.com/dashboard
echo.
echo 2. Select your project
echo.
echo 3. Go to SQL Editor (left sidebar)
echo.
echo 4. Run FIRST migration - add_care_photos_support.sql:
echo    - Copy the contents of migrations\add_care_photos_support.sql
echo    - Paste the SQL into the editor and click 'Run'
echo    - Wait for completion
echo.
echo 5. Run SECOND migration - add_photo_urls_to_calendar_function.sql:
echo    - Copy the contents of migrations\add_photo_urls_to_calendar_function.sql
echo    - Paste the SQL into the editor and click 'Run'
echo    - Wait for completion
echo.
echo 6. Verify the deployment:
echo    - scheduled_care table has photo_urls column
echo    - care-photos storage bucket exists
echo    - RLS policies are created for care-photos bucket
echo    - Calendar functions return photo_urls field
echo.
echo.
echo 📸 WHAT THIS ADDS:
echo ==================
echo ✅ Photo upload capability for providing care blocks
echo ✅ Camera capture or gallery selection
echo ✅ Automatic image compression (max 1920px)
echo ✅ Photo display for receiving parents
echo ✅ Secure storage with Row Level Security
echo.
echo.
echo 💾 STORAGE INFORMATION:
echo =======================
echo - Free tier: 1GB storage
echo - Compressed photos: ~200-500KB each
echo - Estimated capacity: ~2,000-5,000 photos
echo.
echo.
echo 🎯 NEXT STEPS AFTER DEPLOYMENT:
echo ===============================
echo 1. Run the SQL migration in Supabase Dashboard
echo 2. Test photo upload on a providing care block
echo 3. Verify photos display for receiving parent
echo 4. Check storage bucket in Supabase Dashboard
echo.

echo ✅ Ready to deploy! Follow the instructions above.
pause
