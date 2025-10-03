@echo off
REM Quick Deploy Script for Vercel
REM This script helps you deploy your app to Vercel quickly

echo 🚀 Quick Deploy to Vercel
echo ========================

REM Check if Vercel CLI is installed
vercel --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Vercel CLI not found!
    echo Please install it with: npm install -g vercel
    pause
    exit /b 1
)

echo ✅ Vercel CLI found

REM Check if user is logged in
vercel whoami >nul 2>&1
if errorlevel 1 (
    echo 🔐 Please login to Vercel first...
    vercel login
)

echo 📦 Building application...
call npm run build

if errorlevel 1 (
    echo ❌ Build failed! Please fix errors and try again.
    pause
    exit /b 1
)

echo ✅ Build successful

echo 🚀 Deploying to Vercel...
vercel --prod

if errorlevel 1 (
    echo ❌ Deployment failed!
    pause
    exit /b 1
)

echo ✅ Deployment successful!
echo.
echo 📋 Next steps:
echo 1. Configure your domain in Vercel dashboard
echo 2. Update DNS settings in Bluehost
echo 3. Set up environment variables in Vercel
echo 4. Deploy Supabase Edge Functions
echo 5. Configure SMTP settings
echo.
echo 📖 See VERCEL_DEPLOYMENT_GUIDE.md for detailed instructions
pause
