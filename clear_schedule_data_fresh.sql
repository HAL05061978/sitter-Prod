-- Clear all scheduling-related records safely
-- This script will delete records from scheduling tables without affecting core app data
-- Run this within a transaction for safety

BEGIN;

-- Delete all scheduled blocks
DELETE FROM scheduled_blocks;

-- Delete all request responses
DELETE FROM request_responses;

-- Delete all babysitting requests
DELETE FROM babysitting_requests;

-- Reset any auto-increment sequences if they exist
-- (PostgreSQL doesn't have auto-increment, but this is for completeness)

COMMIT;

-- Verify the tables are empty
SELECT 'scheduled_blocks count:' as table_name, COUNT(*) as record_count FROM scheduled_blocks
UNION ALL
SELECT 'request_responses count:', COUNT(*) FROM request_responses
UNION ALL
SELECT 'babysitting_requests count:', COUNT(*) FROM babysitting_requests; 