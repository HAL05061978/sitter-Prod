# Clear Schedule Data Script
# This script safely clears schedule-related records from the database

Write-Host "=== Schedule Data Clear Script ===" -ForegroundColor Yellow
Write-Host "This will clear ALL schedule-related data including:" -ForegroundColor Red
Write-Host "- Babysitting requests" -ForegroundColor Red
Write-Host "- Request responses" -ForegroundColor Red
Write-Host "- Scheduled blocks" -ForegroundColor Red
Write-Host ""
Write-Host "Core app data (profiles, children, groups) will NOT be affected." -ForegroundColor Green
Write-Host ""

# Ask for confirmation
$confirmation = Read-Host "Are you sure you want to proceed? (yes/no)"
if ($confirmation -ne "yes") {
    Write-Host "Operation cancelled." -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "Executing SQL script..." -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "clear_schedule_data.sql")) {
    Write-Host "Error: clear_schedule_data.sql not found in current directory" -ForegroundColor Red
    Write-Host "Please run this script from the project root directory" -ForegroundColor Red
    exit 1
}

# Execute the SQL script using psql (if available)
try {
    # Try to execute using psql if available
    $psqlResult = & psql -d postgres -f "clear_schedule_data.sql" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Schedule data cleared successfully!" -ForegroundColor Green
    } else {
        Write-Host "Error executing SQL script:" -ForegroundColor Red
        Write-Host $psqlResult -ForegroundColor Red
        Write-Host ""
        Write-Host "Alternative: You can manually run the SQL script in your database management tool" -ForegroundColor Yellow
        Write-Host "The SQL file is: clear_schedule_data.sql" -ForegroundColor Yellow
    }
} catch {
    Write-Host "psql not found or not in PATH" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please execute the SQL script manually:" -ForegroundColor Cyan
    Write-Host "1. Open your database management tool (pgAdmin, DBeaver, etc.)" -ForegroundColor Cyan
    Write-Host "2. Connect to your database" -ForegroundColor Cyan
    Write-Host "3. Open and execute the file: clear_schedule_data.sql" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or copy and paste the contents of clear_schedule_data.sql into your SQL editor" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Script completed." -ForegroundColor Green 