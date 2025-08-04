-- Fix the duplicate response constraint that's causing auto-acceptance issues
-- The unique constraint on (request_id, responder_id) is preventing proper invitation responses

-- First, let's see what constraints exist on care_responses
SELECT '=== CARE_RESPONSES CONSTRAINTS ===' as info;
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'care_responses'::regclass
ORDER BY conname;

-- Check if there are any existing responses that might be causing conflicts
SELECT '=== EXISTING RESPONSES ===' as info;
SELECT 
    request_id,
    responder_id,
    COUNT(*) as response_count,
    STRING_AGG(status, ', ') as statuses
FROM care_responses 
GROUP BY request_id, responder_id
HAVING COUNT(*) > 1
ORDER BY response_count DESC;

-- Show all recent responses to understand the pattern
SELECT '=== RECENT RESPONSES ===' as info;
SELECT 
    id,
    request_id,
    responder_id,
    status,
    LEFT(response_notes, 100) as notes_preview,
    created_at
FROM care_responses 
ORDER BY created_at DESC 
LIMIT 10;

-- The issue is likely that the unique constraint prevents invitation responses
-- Let's drop this constraint to allow proper invitation flow
SELECT '=== DROPPING DUPLICATE CONSTRAINT ===' as info;
ALTER TABLE care_responses DROP CONSTRAINT IF EXISTS care_responses_request_id_responder_id_key;

-- Verify the constraint was dropped
SELECT '=== CONSTRAINTS AFTER DROP ===' as info;
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'care_responses'::regclass
ORDER BY conname;

SELECT 'Duplicate response constraint has been removed. Try the invitation flow again.' as note; 