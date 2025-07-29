-- Test Corrected Invitation Logic
-- This verifies that the invitation acceptance creates the correct blocks

-- ============================================================================
-- STEP 1: Clear any existing test data
-- ============================================================================

-- Clear any existing scheduling data for clean testing
DELETE FROM public.scheduled_blocks;
DELETE FROM public.babysitting_requests;
DELETE FROM public.request_responses;
DELETE FROM public.group_invitations;

-- ============================================================================
-- STEP 2: Create test data for Parent A ↔ Parent B agreement
-- ============================================================================

-- Insert test request (Parent A needs care)
INSERT INTO public.babysitting_requests (
    id, group_id, initiator_id, child_id, requested_date, start_time, end_time, 
    duration_minutes, notes, status, created_at
) VALUES (
    gen_random_uuid(), 
    (SELECT id FROM public.groups LIMIT 1), 
    (SELECT id FROM public.profiles WHERE full_name LIKE '%Admin%' LIMIT 1), -- Parent A
    (SELECT id FROM public.children WHERE parent_id = (SELECT id FROM public.profiles WHERE full_name LIKE '%Admin%' LIMIT 1) LIMIT 1), -- Parent A's child
    '2025-01-15', '09:00:00', '11:00:00', 120, 'Test request', 'open', NOW()
) RETURNING id INTO v_request_id;

-- Insert test response (Parent B agrees with reciprocal care)
INSERT INTO public.request_responses (
    id, request_id, responder_id, response_type, reciprocal_date, reciprocal_start_time, 
    reciprocal_end_time, reciprocal_duration_minutes, reciprocal_child_id, notes, status, created_at
) VALUES (
    gen_random_uuid(),
    v_request_id,
    (SELECT id FROM public.profiles WHERE full_name NOT LIKE '%Admin%' LIMIT 1), -- Parent B
    'agree',
    '2025-01-16', '14:00:00', '16:00:00', 120,
    (SELECT id FROM public.children WHERE parent_id = (SELECT id FROM public.profiles WHERE full_name NOT LIKE '%Admin%' LIMIT 1) LIMIT 1), -- Parent B's child
    'Test response with reciprocal care', 'pending', NOW()
) RETURNING id INTO v_response_id;

-- ============================================================================
-- STEP 3: Create the initial care exchange (Parent A accepts Parent B's response)
-- ============================================================================

-- Call create_care_exchange to create the initial 4 blocks
SELECT create_care_exchange(v_request_id, v_response_id);

-- ============================================================================
-- STEP 4: Create a group invitation (Parent B invites Parent C)
-- ============================================================================

-- Insert test invitation
INSERT INTO public.group_invitations (
    id, group_id, inviter_id, invitee_id, request_id, invitation_date, 
    invitation_start_time, invitation_end_time, invitation_duration_minutes, 
    status, notes, created_at
) VALUES (
    gen_random_uuid(),
    (SELECT id FROM public.groups LIMIT 1),
    (SELECT id FROM public.profiles WHERE full_name NOT LIKE '%Admin%' LIMIT 1), -- Parent B (inviter)
    (SELECT id FROM public.profiles WHERE full_name NOT LIKE '%Admin%' AND id != (SELECT id FROM public.profiles WHERE full_name NOT LIKE '%Admin%' LIMIT 1) LIMIT 1), -- Parent C (invitee)
    v_request_id,
    '2025-01-17', '10:00:00', '12:00:00', 120, -- Different time slot
    'pending', 'Test invitation', NOW()
) RETURNING id INTO v_invitation_id;

-- ============================================================================
-- STEP 5: Simulate Parent C accepting the invitation
-- ============================================================================

-- Get Parent C's child
SELECT id INTO v_parent_c_child_id
FROM public.children 
WHERE parent_id = (SELECT id FROM public.profiles WHERE full_name NOT LIKE '%Admin%' AND id != (SELECT id FROM public.profiles WHERE full_name NOT LIKE '%Admin%' LIMIT 1) LIMIT 1)
LIMIT 1;

-- Accept the invitation
SELECT accept_group_invitation_with_time_block(
    (SELECT id FROM public.profiles WHERE full_name NOT LIKE '%Admin%' AND id != (SELECT id FROM public.profiles WHERE full_name NOT LIKE '%Admin%' LIMIT 1) LIMIT 1), -- Parent C
    v_invitation_id,
    0, -- time block index
    v_parent_c_child_id -- Parent C's child
);

-- ============================================================================
-- STEP 6: Verify the results
-- ============================================================================

-- Show all scheduled blocks with details
SELECT 
    'Scheduled Blocks After Invitation Acceptance' as test_name,
    sb.id as block_id,
    sb.block_type,
    c.full_name as child_name,
    p.full_name as parent_name,
    sb.scheduled_date,
    sb.start_time,
    sb.end_time,
    sb.care_group_id,
    sb.notes
FROM public.scheduled_blocks sb
JOIN public.children c ON sb.child_id = c.id
JOIN public.profiles p ON c.parent_id = p.id
ORDER BY sb.scheduled_date, sb.start_time, sb.block_type;

-- ============================================================================
-- STEP 7: Verify the logic is correct
-- ============================================================================

-- Check that we have the expected blocks:
-- 1. Original Parent A ↔ Parent B blocks (4 blocks)
-- 2. Parent C added to original slot (1 block - care_needed)
-- 3. Parent C provides care for Parent B's child on invitation date (1 block - care_provided)
-- Total: 6 blocks

SELECT 
    'Block Count Test' as test_name,
    CASE 
        WHEN COUNT(*) = 6 THEN '✅ PASS: Correct number of blocks (6)'
        ELSE '❌ FAIL: Expected 6 blocks, found ' || COUNT(*)
    END as status
FROM public.scheduled_blocks;

-- Check that Parent C's child is in the original time slot
SELECT 
    'Parent C Child in Original Slot Test' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.scheduled_blocks sb
            JOIN public.children c ON sb.child_id = c.id
            WHERE c.parent_id = (SELECT id FROM public.profiles WHERE full_name NOT LIKE '%Admin%' AND id != (SELECT id FROM public.profiles WHERE full_name NOT LIKE '%Admin%' LIMIT 1) LIMIT 1)
            AND sb.scheduled_date = '2025-01-15'
            AND sb.block_type = 'care_needed'
        ) THEN '✅ PASS: Parent C child added to original slot'
        ELSE '❌ FAIL: Parent C child not found in original slot'
    END as status;

-- Check that Parent C provides care for Parent B's child on invitation date
SELECT 
    'Parent C Provides Care Test' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.scheduled_blocks sb
            JOIN public.children c ON sb.child_id = c.id
            WHERE sb.parent_id = (SELECT id FROM public.profiles WHERE full_name NOT LIKE '%Admin%' AND id != (SELECT id FROM public.profiles WHERE full_name NOT LIKE '%Admin%' LIMIT 1) LIMIT 1)
            AND sb.scheduled_date = '2025-01-17'
            AND sb.block_type = 'care_provided'
            AND c.parent_id = (SELECT id FROM public.profiles WHERE full_name NOT LIKE '%Admin%' LIMIT 1) -- Parent B's child
        ) THEN '✅ PASS: Parent C provides care for Parent B child on invitation date'
        ELSE '❌ FAIL: Parent C not providing care for Parent B child on invitation date'
    END as status;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Corrected invitation logic test complete! Check the results above to verify the blocks are created correctly.' as status; 