# Care-N-Care Production Database Setup Script
# This script helps you set up your production database

Write-Host "Care-N-Care Production Database Setup" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "PRODUCTION_DATABASE_SETUP.sql")) {
    Write-Host "Error: PRODUCTION_DATABASE_SETUP.sql not found." -ForegroundColor Red
    Write-Host "Please run this script from the project root directory." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "This script will help you set up your production database." -ForegroundColor Yellow
Write-Host ""
Write-Host "Steps to complete:"
Write-Host "1. Go to your Supabase Dashboard"
Write-Host "2. Navigate to your Care-N-Care project"
Write-Host "3. Go to SQL Editor"
Write-Host "4. Copy and paste the contents of PRODUCTION_DATABASE_SETUP.sql"
Write-Host "5. Click Run to execute the script"
Write-Host ""

# Open the SQL file in the default editor
Write-Host "Opening PRODUCTION_DATABASE_SETUP.sql for you to copy..." -ForegroundColor Cyan
Start-Process "PRODUCTION_DATABASE_SETUP.sql"

Write-Host ""
Write-Host "SQL file opened! Copy the contents and paste into your Supabase SQL Editor." -ForegroundColor Green
Write-Host ""
Write-Host "Quick links:"
Write-Host "   Supabase Dashboard: https://supabase.com/dashboard" -ForegroundColor Blue
Write-Host "   Your Project: https://supabase.com/dashboard/project/hilkelodfneancwwzvoh" -ForegroundColor Blue
Write-Host ""

# Wait for user to complete the setup
Read-Host "Press Enter when you have completed the database setup in Supabase"

Write-Host ""
Write-Host "Production database setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Test your production environment"
Write-Host "2. Deploy your application: npm run deploy:prod"
Write-Host "3. Configure your domain: care-n-care.com"
Write-Host ""

Read-Host "Press Enter to exit"