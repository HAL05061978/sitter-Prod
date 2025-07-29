# PowerShell script to clear schedule data safely
# This script will execute the SQL to clear all scheduling-related records

Write-Host "=== Schedule Data Clearing Script ===" -ForegroundColor Yellow
Write-Host "This will delete ALL records from:" -ForegroundColor Red
Write-Host "- scheduled_blocks" -ForegroundColor Red
Write-Host "- request_responses" -ForegroundColor Red
Write-Host "- babysitting_requests" -ForegroundColor Red
Write-Host ""
Write-Host "Core app data (profiles, children, groups) will NOT be affected." -ForegroundColor Green
Write-Host ""

$confirmation = Read-Host "Are you sure you want to proceed? (y/N)"
if ($confirmation -ne "y" -and $confirmation -ne "Y") {
    Write-Host "Operation cancelled." -ForegroundColor Yellow
    exit
}

Write-Host "Executing SQL script..." -ForegroundColor Cyan

try {
    # Execute the SQL script
    psql -h db.supabase.co -p 5432 -d postgres -U postgres -f clear_schedule_data_fresh.sql
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Successfully cleared all schedule data!" -ForegroundColor Green
        Write-Host "You can now test the scheduling functionality from scratch." -ForegroundColor Green
    } else {
        Write-Host "Error executing SQL script. Exit code: $LASTEXITCODE" -ForegroundColor Red
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host "Make sure you have psql installed and configured with your Supabase credentials." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 