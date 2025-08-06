# Cleanup script for testing open block feature
# This script cleans up test data without affecting core profiles, groups, and children

Write-Host "Starting cleanup of test data..." -ForegroundColor Green

# Function to execute SQL query
function Execute-SqlQuery {
    param(
        [string]$Query
    )
    
    try {
        # You'll need to replace these with your actual Supabase connection details
        # For now, this is a template - you'll need to run these queries in your Supabase dashboard
        
        Write-Host "Executing query: $Query" -ForegroundColor Yellow
        Write-Host "Please run this query in your Supabase SQL editor:" -ForegroundColor Cyan
        Write-Host $Query -ForegroundColor White
        Write-Host ""
    }
    catch {
        Write-Host "Error executing query: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Clean up care_requests (open block and reciprocal requests)
$cleanupCareRequests = @"
-- Clean up open block and reciprocal care requests
DELETE FROM care_requests 
WHERE request_type IN ('open_block', 'reciprocal') 
AND created_at >= NOW() - INTERVAL '7 days';

-- Reset any auto-increment sequences if needed
-- SELECT setval('care_requests_id_seq', (SELECT MAX(id) FROM care_requests));
"@

# Clean up care_responses
$cleanupCareResponses = @"
-- Clean up care responses for open block and reciprocal requests
DELETE FROM care_responses 
WHERE request_id IN (
    SELECT id FROM care_requests 
    WHERE request_type IN ('open_block', 'reciprocal')
    AND created_at >= NOW() - INTERVAL '7 days'
);
"@

# Clean up scheduled_care blocks related to open block requests
$cleanupScheduledCare = @"
-- Clean up scheduled care blocks that were created from open block requests
DELETE FROM scheduled_care 
WHERE related_request_id IN (
    SELECT id FROM care_requests 
    WHERE request_type IN ('open_block', 'reciprocal')
    AND created_at >= NOW() - INTERVAL '7 days'
);
"@

# Clean up messages related to open block invitations
$cleanupMessages = @"
-- Clean up messages related to open block invitations
DELETE FROM messages 
WHERE subject LIKE '%Open Block%' 
AND created_at >= NOW() - INTERVAL '7 days';
"@

# Clean up event responses (if any were created during testing)
$cleanupEventResponses = @"
-- Clean up event responses from recent testing
DELETE FROM event_responses 
WHERE created_at >= NOW() - INTERVAL '7 days';
"@

# Clean up event notifications (if any were created during testing)
$cleanupEventNotifications = @"
-- Clean up event notifications from recent testing
DELETE FROM event_notifications 
WHERE created_at >= NOW() - INTERVAL '7 days';
"@

Write-Host "=== CLEANUP QUERIES ===" -ForegroundColor Magenta
Write-Host ""

Write-Host "1. Cleaning up care requests..." -ForegroundColor Green
Execute-SqlQuery -Query $cleanupCareRequests

Write-Host "2. Cleaning up care responses..." -ForegroundColor Green
Execute-SqlQuery -Query $cleanupCareResponses

Write-Host "3. Cleaning up scheduled care blocks..." -ForegroundColor Green
Execute-SqlQuery -Query $cleanupScheduledCare

Write-Host "4. Cleaning up messages..." -ForegroundColor Green
Execute-SqlQuery -Query $cleanupMessages

Write-Host "5. Cleaning up event responses..." -ForegroundColor Green
Execute-SqlQuery -Query $cleanupEventResponses

Write-Host "6. Cleaning up event notifications..." -ForegroundColor Green
Execute-SqlQuery -Query $cleanupEventNotifications

Write-Host ""
Write-Host "=== CLEANUP COMPLETE ===" -ForegroundColor Magenta
Write-Host ""
Write-Host "Instructions:" -ForegroundColor Yellow
Write-Host "1. Copy each query above and run it in your Supabase SQL editor" -ForegroundColor White
Write-Host "2. Run the queries in the order shown" -ForegroundColor White
Write-Host "3. This will clean up all test data from the last 7 days" -ForegroundColor White
Write-Host "4. Your profiles, groups, and children data will remain intact" -ForegroundColor White
Write-Host ""
Write-Host "After running the queries, restart your application and test the open block feature again." -ForegroundColor Green 