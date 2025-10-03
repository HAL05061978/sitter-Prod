@echo off
REM Environment Setup Script (Windows)
REM This script helps set up development and production environments

echo 🔧 Setting up development and production environments...

REM Create .env.local if it doesn't exist
if not exist ".env.local" (
    echo 📝 Creating .env.local from template...
    copy env.local.example .env.local
    echo ✅ .env.local created. Please update with your development Supabase credentials.
) else (
    echo ℹ️  .env.local already exists.
)

REM Create .env.production if it doesn't exist
if not exist ".env.production" (
    echo 📝 Creating .env.production from template...
    copy env.production.example .env.production
    echo ✅ .env.production created. Please update with your production Supabase credentials.
) else (
    echo ℹ️  .env.production already exists.
)

REM Create .gitignore entry for environment files
findstr /C:".env.local" .gitignore >nul
if errorlevel 1 (
    echo 📝 Adding environment files to .gitignore...
    echo. >> .gitignore
    echo # Environment files >> .gitignore
    echo .env.local >> .gitignore
    echo .env.production >> .gitignore
    echo ✅ .gitignore updated.
) else (
    echo ℹ️  Environment files already in .gitignore.
)

echo.
echo 🎉 Environment setup complete!
echo.
echo 📋 Next steps:
echo    1. Update .env.local with your development Supabase credentials
echo    2. Create a production Supabase project
echo    3. Update .env.production with your production Supabase credentials
echo    4. Run 'npm run dev' to start development
echo    5. Run 'npm run deploy:prod' to deploy to production
pause
