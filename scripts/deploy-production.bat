@echo off
REM Production Deployment Script (Windows)
REM This script deploys the Care-N-Care app to production

echo 🚀 Starting production deployment...

REM Check if .env.production exists
if not exist ".env.production" (
    echo ❌ .env.production file not found!
    echo Please create .env.production from env.production.template and update with your production values.
    pause
    exit /b 1
)

REM Check if Supabase CLI is installed
supabase --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Supabase CLI not found!
    echo Please install it with: npm install -g supabase
    pause
    exit /b 1
)

REM Check if Vercel CLI is installed
vercel --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Vercel CLI not found!
    echo Please install it with: npm install -g vercel
    pause
    exit /b 1
)

echo 📦 Building application...
call npm run build:prod

echo 🗄️ Deploying database migrations...
supabase db push --project-ref %SUPABASE_PROJECT_REF%

echo 🔧 Deploying Edge Functions...
supabase functions deploy send-group-invite --project-ref %SUPABASE_PROJECT_REF%
supabase functions deploy send-confirmation --project-ref %SUPABASE_PROJECT_REF%
supabase functions deploy send-welcome --project-ref %SUPABASE_PROJECT_REF%

echo 🌐 Deploying to Vercel...
vercel --prod

echo ✅ Production deployment complete!
echo 🔗 Your app is now live at: https://care-n-care.com
echo 📧 Make sure to configure your SMTP settings in Supabase dashboard
echo 🔔 Test the notification system to ensure everything is working
pause