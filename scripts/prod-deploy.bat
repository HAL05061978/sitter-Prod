@echo off
REM Enhanced Production Deployment Script
REM This script provides a comprehensive production deployment process

echo.
echo ========================================
echo 🚀 CARE-N-CARE PRODUCTION DEPLOYMENT
echo ========================================
echo.

REM Check if .env.production exists
if not exist ".env.production" (
    echo ❌ .env.production file not found!
    echo.
    echo 📝 Please create .env.production with your production values:
    echo    - Copy from env.production.example
    echo    - Update with your actual Supabase production credentials
    echo    - Set your production domain URL
    echo.
    pause
    exit /b 1
)

echo ✅ Environment file found

REM Check if Vercel CLI is installed
vercel --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Vercel CLI not found!
    echo.
    echo 📦 Installing Vercel CLI...
    npm install -g vercel
    if errorlevel 1 (
        echo ❌ Failed to install Vercel CLI
        pause
        exit /b 1
    )
)

echo ✅ Vercel CLI ready

REM Check if user is logged in to Vercel
vercel whoami >nul 2>&1
if errorlevel 1 (
    echo 🔐 Please login to Vercel...
    vercel login
    if errorlevel 1 (
        echo ❌ Vercel login failed
        pause
        exit /b 1
    )
)

echo ✅ Vercel authentication ready

REM Clean previous builds
echo 🧹 Cleaning previous builds...
if exist .next rmdir /s /q .next
if exist node_modules\.cache rmdir /s /q node_modules\.cache

echo ✅ Cleanup complete

REM Build the application for production
echo 📦 Building application for production...
call npm run build:prod

if errorlevel 1 (
    echo ❌ Build failed! Please fix errors and try again.
    echo.
    echo 💡 Common fixes:
    echo    - Check your .env.production file
    echo    - Ensure all dependencies are installed
    echo    - Run 'npm run type-check' to check for TypeScript errors
    echo.
    pause
    exit /b 1
)

echo ✅ Build successful

REM Deploy to Vercel
echo 🌐 Deploying to Vercel...
vercel --prod --yes

if errorlevel 1 (
    echo ❌ Deployment failed!
    echo.
    echo 💡 Troubleshooting:
    echo    - Check your Vercel project settings
    echo    - Verify environment variables in Vercel dashboard
    echo    - Ensure your domain is properly configured
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ PRODUCTION DEPLOYMENT SUCCESSFUL!
echo ========================================
echo.
echo 🌐 Your app is now live!
echo 📧 Don't forget to:
echo    - Configure SMTP settings in Supabase dashboard
echo    - Test all functionality with real users
echo    - Monitor your app's performance
echo    - Set up error tracking and analytics
echo.
echo 🔗 Check your Vercel dashboard for the live URL
echo.
pause
