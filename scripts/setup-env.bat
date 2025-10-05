@echo off
REM Environment Setup Script
REM This script helps you set up your environment files

echo.
echo ========================================
echo 🔧 ENVIRONMENT SETUP
echo ========================================
echo.

REM Check if .env.local exists
if not exist ".env.local" (
    echo 📝 Creating .env.local from template...
    copy "env.local.example" ".env.local" >nul
    if errorlevel 1 (
        echo ❌ Failed to create .env.local
        pause
        exit /b 1
    )
    echo ✅ .env.local created
) else (
    echo ✅ .env.local already exists
)

REM Check if .env.production exists
if not exist ".env.production" (
    echo 📝 Creating .env.production from template...
    copy "env.production.example" ".env.production" >nul
    if errorlevel 1 (
        echo ❌ Failed to create .env.production
        pause
        exit /b 1
    )
    echo ✅ .env.production created
) else (
    echo ✅ .env.production already exists
)

echo.
echo ========================================
echo 📋 NEXT STEPS
echo ========================================
echo.
echo 1. Update .env.local with your development Supabase credentials
echo 2. Update .env.production with your production Supabase credentials
echo 3. Make sure to replace [PROJECT_REF] with your actual project reference
echo 4. Set your production domain URL
echo.
echo 🚀 Then you can run:
echo    - npm run dev (for development)
echo    - npm run prod (for production deployment)
echo.
pause
