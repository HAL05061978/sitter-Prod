-- Simplified Scheduling System - Usage Examples
-- This shows how to use the new simplified functions

-- ============================================================================
-- EXAMPLE 1: BASIC CARE EXCHANGE (Parent A ↔ Parent B)
-- ============================================================================

-- Step 1: Parent A creates a babysitting request
INSERT INTO public.babysitting_requests (
    group_id, initiator_id, child_id, requested_date, start_time, end_time, 
    duration_minutes, notes, status
) VALUES (
    'your-group-id-here', 'parent-a-user-id', 'parent-a-child-id',
    '2024-01-15', '14:00:00', '16:00:00', 120, 'Need care for my child', 'pending'
);

-- Step 2: Parent B responds with agreement and reciprocal care details
INSERT INTO public.request_responses (
    request_id, responder_id, response_type, 
    reciprocal_date, reciprocal_start_time, reciprocal_end_time, 
    reciprocal_duration_minutes, reciprocal_child_id, notes, status
) VALUES (
    'request-id-from-step-1', 'parent-b-user-id', 'agree',
    '2024-01-16', '15:00:00', '17:00:00', 120, 'parent-b-child-id',
    'I can help and need care tomorrow', 'pending'
);

-- Step 3: Process the care exchange (this creates all 4 scheduled blocks)
SELECT create_care_exchange('request-id-from-step-1', 'response-id-from-step-2');

-- ============================================================================
-- EXAMPLE 2: ADDITIONAL PARENT JOINING (Parent C joins Parent A + Parent B)
-- ============================================================================

-- Parent C wants to join the existing care block
-- They provide care for Parent B's child at a different time
SELECT join_care_block(
    'request-id-from-step-1',           -- The original request ID
    'parent-c-user-id',                 -- Parent C's user ID
    'parent-c-child-id',                -- Parent C's child who needs care
    '2024-01-17',                       -- Date when Parent C needs care
    '13:00:00',                         -- Start time for Parent C's care
    '15:00:00',                         -- End time for Parent C's care
    'parent-c-child-id'                 -- Parent C's child who needs care
);

-- ============================================================================
-- EXAMPLE 3: QUERYING AVAILABLE CARE BLOCKS
-- ============================================================================

-- Get all available care blocks that can accept additional children
SELECT * FROM get_available_care_blocks('your-group-id-here');

-- Get available children for joining a specific care block
SELECT * FROM get_available_children_for_care_block('request-id-here');

-- ============================================================================
-- EXAMPLE 4: VIEWING SCHEDULED BLOCKS
-- ============================================================================

-- View all scheduled blocks for a group
SELECT 
    sb.*,
    p.full_name as parent_name,
    c.full_name as child_name,
    g.name as group_name
FROM public.scheduled_blocks sb
JOIN public.profiles p ON sb.parent_id = p.id
JOIN public.children c ON sb.child_id = c.id
JOIN public.groups g ON sb.group_id = g.id
WHERE sb.group_id = 'your-group-id-here'
ORDER BY sb.scheduled_date, sb.start_time;

-- ============================================================================
-- EXAMPLE 5: FRONTEND INTEGRATION PATTERNS
-- ============================================================================

-- Pattern 1: Create request and wait for responses
-- 1. Insert babysitting_request
-- 2. Frontend polls for responses
-- 3. When user selects a response, call create_care_exchange()

-- Pattern 2: Join existing care block
-- 1. Call get_available_care_blocks() to show opportunities
-- 2. User selects a block and provides reciprocal details
-- 3. Call join_care_block() with the details

-- Pattern 3: View schedule
-- 1. Query scheduled_blocks with group filter
-- 2. Display in calendar view
-- 3. Allow users to see care_needed vs care_provided blocks

-- ============================================================================
-- EXAMPLE 6: ERROR HANDLING
-- ============================================================================

-- The functions will raise exceptions for:
-- - Invalid request/response IDs
-- - Time conflicts
-- - Users not in the same group
-- - Children not in the group
-- - Missing reciprocal care details

-- Example error handling in your application:
/*
try {
    const result = await supabase.rpc('create_care_exchange', {
        p_request_id: requestId,
        p_response_id: responseId
    });
} catch (error) {
    console.error('Care exchange failed:', error.message);
    // Handle specific error cases
}
*/

-- ============================================================================
-- COMPARISON: OLD vs NEW SYSTEM
-- ============================================================================

/*
OLD SYSTEM (Complex):
- Multiple trigger functions
- Complex state management (keep_open_to_others, initiator_agreed)
- Multiple functions doing similar things
- RLS issues with triggers
- Hard to debug and maintain

NEW SYSTEM (Simplified):
- Single function for care exchange (create_care_exchange)
- Single function for joining (join_care_block)
- Clear, linear flow
- No complex triggers
- Easy to debug and maintain
- Same functionality, cleaner code
*/

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================

/*
To migrate from the old system:

1. Run the simplified_scheduling_system.sql script
2. Update your frontend to use the new function names:
   - Old: select_response_and_reject_others()
   - New: create_care_exchange()
   
3. Update your frontend to use the new joining function:
   - Old: join_existing_care_block()
   - New: join_care_block()
   
4. Remove any references to:
   - keep_open_to_others
   - initiator_agreed
   - Complex trigger functions
   
5. Test the new functions with the examples above
*/