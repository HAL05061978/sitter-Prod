-- Clear Schedule Related Records
-- This script clears all schedule-related data without touching core app records
-- like profiles, children, groups, etc.

-- Start a transaction to ensure all operations succeed or fail together
BEGIN;

-- Clear scheduled blocks (care provided and care needed)
DELETE FROM scheduled_blocks;

-- Clear request responses
DELETE FROM request_responses;

-- Clear babysitting requests
DELETE FROM babysitting_requests;

-- Reset any auto-increment sequences if they exist
-- (This is optional but helps keep the database clean)

-- Commit the transaction
COMMIT;

-- Display confirmation
SELECT 'Schedule data cleared successfully!' as message; 