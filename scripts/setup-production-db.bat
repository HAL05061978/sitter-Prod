@echo off
REM Production Database Setup Script (Windows)
REM This script helps set up your production database with the same schema as development

echo 🗄️ Setting up production database...

REM Check if Supabase CLI is installed
supabase --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: Supabase CLI not found. Please install it first:
    echo    npm install -g supabase
    pause
    exit /b 1
)

echo.
echo 📋 This script will help you sync your development database to production.
echo.
echo 🔧 Step 1: Link to your production project
echo    Run: supabase link --project-ref YOUR_PRODUCTION_PROJECT_REF
echo    (Get your project ref from your Supabase dashboard URL)
echo.
echo 🔧 Step 2: Generate migration from current development state
echo    Run: supabase db diff --schema public > migrations/sync_to_production.sql
echo.
echo 🔧 Step 3: Apply migration to production
echo    Run: supabase db push --project-ref YOUR_PRODUCTION_PROJECT_REF
echo.
echo 🔧 Step 4: Copy any seed data if needed
echo    Run: supabase db seed --project-ref YOUR_PRODUCTION_PROJECT_REF
echo.

set /p project_ref="Enter your production project ref: "
if "%project_ref%"=="" (
    echo ❌ Error: Project ref is required.
    pause
    exit /b 1
)

echo.
echo 🔗 Linking to production project...
supabase link --project-ref %project_ref%

echo.
echo 📋 Generating migration from development state...
supabase db diff --schema public > migrations/sync_to_production_%date:~-4,4%%date:~-10,2%%date:~-7,2%.sql

echo.
echo 🚀 Applying migration to production...
supabase db push --project-ref %project_ref%

echo.
echo ✅ Production database setup complete!
echo.
echo 📋 Next steps:
echo    1. Verify your production database in the Supabase dashboard
echo    2. Test your production environment
echo    3. Deploy your application
echo.
pause
