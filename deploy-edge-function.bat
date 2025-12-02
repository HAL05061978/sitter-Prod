@echo off
echo 🚀 Deploying Supabase Edge Function...

REM Check if Supabase CLI is installed
supabase --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Supabase CLI not found. Installing...
    npm install -g supabase
    if errorlevel 1 (
        echo ❌ Failed to install Supabase CLI
        pause
        exit /b 1
    )
)

REM Check if user is logged in
supabase status >nul 2>&1
if errorlevel 1 (
    echo 🔐 Please login to Supabase...
    supabase login
    if errorlevel 1 (
        echo ❌ Supabase login failed
        pause
        exit /b 1
    )
)

REM Deploy the function
echo 📦 Deploying send-group-invite function...
supabase functions deploy send-group-invite

if errorlevel 1 (
    echo ❌ Failed to deploy Edge Function
    pause
    exit /b 1
)

echo ✅ Edge Function deployed successfully!
echo 📧 Group invitation emails are now enabled in production!
echo 🎉 Setup complete! Test your invitation system now.
pause




