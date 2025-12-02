@echo off
echo ============================================
echo Deploying Enhanced Open Block Messages
echo ============================================
echo.

echo This will update the accept_open_block_invitation function
echo to include reciprocal block information in notifications.
echo.

set /p confirm="Deploy to production? (y/n): "
if /i not "%confirm%"=="y" (
    echo Deployment cancelled.
    exit /b 0
)

echo.
echo Deploying SQL function...
echo.

supabase db execute --file DEPLOY_THIS_open_block_notifications.sql

if %errorlevel% equ 0 (
    echo.
    echo ============================================
    echo Deployment completed successfully!
    echo ============================================
    echo.
    echo Next steps:
    echo 1. Test by creating and accepting an open block
    echo 2. Check Messages/Schedule page for enhanced display
    echo 3. Verify both blocks appear when expanding message
    echo.
) else (
    echo.
    echo ============================================
    echo Deployment failed!
    echo ============================================
    echo.
    echo Please check the error message above and try again.
    echo.
)

pause
