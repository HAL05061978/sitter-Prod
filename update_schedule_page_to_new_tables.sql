-- Update Schedule Page to New Tables
-- This script identifies the changes needed in app/schedule/page.tsx

-- ============================================================================
-- OLD TABLE REFERENCES TO REPLACE:
-- ============================================================================

/*
OLD REFERENCES IN app/schedule/page.tsx:

1. "scheduled_blocks" → "scheduled_care"
2. "babysitting_requests" → "care_requests" 
3. "request_responses" → "care_responses"

SPECIFIC CHANGES NEEDED:

1. Line ~339: .from("scheduled_blocks") → .from("scheduled_care")
2. Line ~363: .from("scheduled_blocks") → .from("scheduled_care")
3. Line ~400+: .from("babysitting_requests") → .from("care_requests")
4. Line ~420+: .from("request_responses") → .from("care_responses")

COLUMN NAME CHANGES:
- "scheduled_date" → "care_date"
- "block_type" → "care_type"
- "initiator_id" → "requester_id"
- "requested_date" → "requested_date" (same)
- "response_type" → "response_type" (same)
- "responder_id" → "responder_id" (same)
*/

-- ============================================================================
-- VERIFY NEW TABLES EXIST
-- ============================================================================

SELECT 'New scheduling tables status:' as info;
SELECT 
    table_name,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = table_name AND table_schema = 'public') 
         THEN '✅ EXISTS' 
         ELSE '❌ MISSING' 
    END as status
FROM (VALUES 
    ('care_requests'),
    ('scheduled_care'),
    ('care_responses')
) as t(table_name);

-- ============================================================================
-- SHOW NEW TABLE STRUCTURES
-- ============================================================================

SELECT 'care_requests table columns:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'care_requests' 
AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'scheduled_care table columns:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'scheduled_care' 
AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'care_responses table columns:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'care_responses' 
AND table_schema = 'public'
ORDER BY ordinal_position; 