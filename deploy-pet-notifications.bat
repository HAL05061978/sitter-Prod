@echo off
echo =====================================================
echo Deploying Pet Care Notifications Fix
echo =====================================================
echo.
echo This will update the send_pet_care_request function
echo to create notification records so requests appear in UI.
echo.
pause

REM Deploy to Supabase
supabase db push --file DEPLOY_PET_CARE_NOTIFICATIONS_FIX.sql

echo.
echo =====================================================
echo Deployment Complete!
echo =====================================================
echo.
echo Next steps:
echo 1. Test creating a new pet care request
echo 2. Login as responder - request should now appear in Messages
echo 3. Verify notification appears in Scheduler page
echo.
pause
