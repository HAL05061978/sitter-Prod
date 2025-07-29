-- Complete Fresh Start
-- This script completely resets everything and recreates all functions properly
-- Run this in your Supabase SQL editor

-- ============================================================================
-- STEP 1: Clear all scheduling data
-- ============================================================================

-- Clear all scheduling-related data
DELETE FROM public.scheduled_blocks;
DELETE FROM public.babysitting_requests;
DELETE FROM public.request_responses;
DELETE FROM public.group_invitations;

-- Clear invitation time blocks if table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invitation_time_blocks') THEN
        DELETE FROM public.invitation_time_blocks;
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Drop all scheduling functions
-- ============================================================================

DROP FUNCTION IF EXISTS create_care_exchange(UUID, UUID);
DROP FUNCTION IF EXISTS get_children_in_care_block(UUID);
DROP FUNCTION IF EXISTS get_user_children_for_group(UUID, UUID);
DROP FUNCTION IF EXISTS get_available_time_blocks_for_invitation(UUID);
DROP FUNCTION IF EXISTS accept_group_invitation_with_time_block(UUID, UUID, INTEGER, UUID);
DROP FUNCTION IF EXISTS get_children_for_specific_block(UUID);

-- ============================================================================
-- STEP 3: Recreate all functions properly
-- ============================================================================

-- Create the main care exchange function
CREATE OR REPLACE FUNCTION create_care_exchange(
  p_request_id UUID,
  p_response_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_response RECORD;
  v_request RECORD;
  v_initiator_child_id UUID;
  v_responder_child_id UUID;
  v_care_group_id UUID;
  v_reciprocal_duration_minutes INTEGER;
BEGIN
  -- Get the response details
  SELECT * INTO v_response FROM public.request_responses WHERE id = p_response_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Response not found';
  END IF;
  
  -- Get the request details
  SELECT * INTO v_request FROM public.babysitting_requests WHERE id = p_request_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  
  -- Get child IDs
  v_initiator_child_id := v_request.child_id;
  v_responder_child_id := v_response.reciprocal_child_id;
  
  -- Generate a care group ID to link related blocks
  v_care_group_id := gen_random_uuid();
  
  -- Calculate reciprocal duration if provided
  IF v_response.reciprocal_start_time IS NOT NULL AND v_response.reciprocal_end_time IS NOT NULL THEN
    v_reciprocal_duration_minutes := EXTRACT(EPOCH FROM (v_response.reciprocal_end_time::time - v_response.reciprocal_start_time::time)) / 60;
  ELSE
    v_reciprocal_duration_minutes := v_request.duration_minutes;
  END IF;
  
  -- Create scheduled blocks for the original request (Parent A needs care, Parent B provides)
  INSERT INTO public.scheduled_blocks (
    group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
    duration_minutes, block_type, status, request_id, notes, care_group_id
  ) VALUES (
    v_request.group_id, v_request.initiator_id, v_initiator_child_id,
    v_request.requested_date, v_request.start_time, v_request.end_time,
    v_request.duration_minutes, 'care_needed', 'confirmed', v_request.id, v_request.notes, v_care_group_id
  );
  
  INSERT INTO public.scheduled_blocks (
    group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
    duration_minutes, block_type, status, request_id, notes, care_group_id
  ) VALUES (
    v_request.group_id, v_response.responder_id, v_initiator_child_id,
    v_request.requested_date, v_request.start_time, v_request.end_time,
    v_request.duration_minutes, 'care_provided', 'confirmed', v_request.id, v_response.notes, v_care_group_id
  );
  
  -- Create scheduled blocks for reciprocal care (Parent B needs care, Parent A provides)
  -- Only create reciprocal blocks if the responder specified reciprocal care details
  IF v_responder_child_id IS NOT NULL AND v_response.reciprocal_date IS NOT NULL 
     AND v_response.reciprocal_start_time IS NOT NULL AND v_response.reciprocal_end_time IS NOT NULL THEN
    
    INSERT INTO public.scheduled_blocks (
      group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
      duration_minutes, block_type, status, request_id, notes, care_group_id
    ) VALUES (
      v_request.group_id, v_response.responder_id, v_responder_child_id,
      v_response.reciprocal_date, v_response.reciprocal_start_time, v_response.reciprocal_end_time,
      v_reciprocal_duration_minutes, 'care_needed', 'confirmed', v_request.id, v_response.notes, v_care_group_id
    );
    
    INSERT INTO public.scheduled_blocks (
      group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
      duration_minutes, block_type, status, request_id, notes, care_group_id
    ) VALUES (
      v_request.group_id, v_request.initiator_id, v_responder_child_id,
      v_response.reciprocal_date, v_response.reciprocal_start_time, v_response.reciprocal_end_time,
      v_reciprocal_duration_minutes, 'care_provided', 'confirmed', v_request.id, v_request.notes, v_care_group_id
    );
    
    RAISE NOTICE 'Created reciprocal care blocks for child % on date %', v_responder_child_id, v_response.reciprocal_date;
  ELSE
    RAISE NOTICE 'No reciprocal care details provided, skipping reciprocal blocks';
  END IF;
  
  -- Mark response as accepted
  UPDATE public.request_responses 
  SET status = 'accepted'
  WHERE id = p_response_id;
  
  -- Reject all other pending responses for this request
  UPDATE public.request_responses 
  SET status = 'rejected'
  WHERE request_id = p_request_id 
    AND id != p_response_id 
    AND status = 'pending';
  
  -- Close the request
  UPDATE public.babysitting_requests 
  SET status = 'closed'
  WHERE id = p_request_id;
  
  RAISE NOTICE 'Successfully processed care exchange for request % and response % with care group %', p_request_id, p_response_id, v_care_group_id;
END;
$$;

-- Create function to get user's children for a group
CREATE OR REPLACE FUNCTION get_user_children_for_group(
  p_user_id UUID,
  p_group_id UUID
)
RETURNS TABLE (
  id UUID,
  full_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.full_name
  FROM public.children c
  JOIN public.child_group_members cgm ON c.id = cgm.child_id
  WHERE c.parent_id = p_user_id
    AND cgm.group_id = p_group_id
  ORDER BY c.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get available time blocks for invitation
CREATE OR REPLACE FUNCTION get_available_time_blocks_for_invitation(
  p_invitation_id UUID
)
RETURNS TABLE (
  block_index INTEGER,
  block_date DATE,
  block_start_time TIME,
  block_end_time TIME,
  block_duration_minutes INTEGER,
  is_available BOOLEAN
) AS $$
DECLARE
  v_invitation group_invitations%ROWTYPE;
BEGIN
  -- Get the invitation details
  SELECT * INTO v_invitation FROM group_invitations WHERE id = p_invitation_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Return a single time block based on the invitation data
  RETURN QUERY
  SELECT 
    0 as block_index,
    v_invitation.invitation_date as block_date,
    v_invitation.invitation_start_time as block_start_time,
    v_invitation.invitation_end_time as block_end_time,
    v_invitation.invitation_duration_minutes as block_duration_minutes,
    (v_invitation.status = 'pending') as is_available;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get children in care block (simplified)
CREATE OR REPLACE FUNCTION get_children_in_care_block(
    p_care_group_id UUID
) RETURNS TABLE (
    child_id UUID,
    child_name TEXT,
    parent_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        c.id as child_id,
        c.full_name as child_name,
        p.full_name as parent_name
    FROM public.scheduled_blocks sb
    JOIN public.children c ON sb.child_id = c.id
    JOIN public.profiles p ON c.parent_id = p.id
    WHERE sb.care_group_id = p_care_group_id
    ORDER BY c.full_name
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to accept group invitation with time block (FIXED VERSION)
CREATE OR REPLACE FUNCTION accept_group_invitation_with_time_block(
    p_accepting_user_id UUID,
    p_invitation_id UUID,
    p_selected_time_block_index INTEGER,
    p_selected_child_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invitation group_invitations%ROWTYPE;
    v_request babysitting_requests%ROWTYPE;
    v_duration_minutes INTEGER;
    v_existing_care_group_id UUID;
BEGIN
    -- Get the invitation details
    SELECT * INTO v_invitation FROM group_invitations WHERE id = p_invitation_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation not found';
    END IF;
    
    -- Get the original request details
    SELECT * INTO v_request FROM babysitting_requests WHERE id = v_invitation.request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Original request not found';
    END IF;
    
    -- Validate that the selected child belongs to the accepting user
    IF NOT EXISTS (
        SELECT 1 FROM children 
        WHERE id = p_selected_child_id 
        AND parent_id = p_accepting_user_id
    ) THEN
        RAISE EXCEPTION 'Selected child does not belong to the accepting user';
    END IF;
    
    -- Find existing care group ID from the original blocks (Parent A ↔ Parent B)
    SELECT care_group_id INTO v_existing_care_group_id
    FROM scheduled_blocks 
    WHERE request_id = v_request.id 
    AND block_type = 'care_needed'
    LIMIT 1;
    
    IF v_existing_care_group_id IS NULL THEN
        RAISE EXCEPTION 'No existing care group found for the original request';
    END IF;
    
    -- Calculate duration for the invitation time
    v_duration_minutes := EXTRACT(EPOCH FROM (v_invitation.invitation_end_time::time - v_invitation.invitation_start_time::time)) / 60;
    
    -- Create 2 new scheduled blocks for the reciprocal arrangement:
    -- 1. Parent B (inviter) needs care for their child on the invitation date
    INSERT INTO scheduled_blocks (
        group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
        duration_minutes, block_type, status, request_id, notes, care_group_id
    ) VALUES (
        v_invitation.group_id, v_invitation.inviter_id, p_selected_child_id,
        v_invitation.invitation_date, v_invitation.invitation_start_time, v_invitation.invitation_end_time,
        v_duration_minutes, 'care_needed', 'confirmed', v_request.id, v_invitation.notes, v_existing_care_group_id
    );
    
    -- 2. Parent C (accepting user) provides care for Parent B's child on the invitation date
    INSERT INTO scheduled_blocks (
        group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
        duration_minutes, block_type, status, request_id, notes, care_group_id
    ) VALUES (
        v_invitation.group_id, p_accepting_user_id, p_selected_child_id,
        v_invitation.invitation_date, v_invitation.invitation_start_time, v_invitation.invitation_end_time,
        v_duration_minutes, 'care_provided', 'confirmed', v_request.id, v_request.notes, v_existing_care_group_id
    );
    
    -- Mark invitation as accepted
    UPDATE group_invitations 
    SET status = 'accepted',
        selected_time_block_index = p_selected_time_block_index
    WHERE id = p_invitation_id;
    
    RAISE NOTICE 'Successfully accepted group invitation % with existing care group %', p_invitation_id, v_existing_care_group_id;
END;
$$;

-- ============================================================================
-- STEP 4: Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION create_care_exchange(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_children_for_group(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_time_blocks_for_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_children_in_care_block(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_group_invitation_with_time_block(UUID, UUID, INTEGER, UUID) TO authenticated;

-- ============================================================================
-- STEP 5: Verify everything is set up correctly
-- ============================================================================

-- Check that all functions exist
SELECT 
    'Function Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'create_care_exchange'
            AND routine_type = 'FUNCTION'
        ) THEN '✅ PASS: create_care_exchange exists'
        ELSE '❌ FAIL: create_care_exchange missing'
    END as status
UNION ALL
SELECT 
    'Function Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'get_user_children_for_group'
            AND routine_type = 'FUNCTION'
        ) THEN '✅ PASS: get_user_children_for_group exists'
        ELSE '❌ FAIL: get_user_children_for_group missing'
    END as status
UNION ALL
SELECT 
    'Function Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'get_available_time_blocks_for_invitation'
            AND routine_type = 'FUNCTION'
        ) THEN '✅ PASS: get_available_time_blocks_for_invitation exists'
        ELSE '❌ FAIL: get_available_time_blocks_for_invitation missing'
    END as status
UNION ALL
SELECT 
    'Function Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'get_children_in_care_block'
            AND routine_type = 'FUNCTION'
        ) THEN '✅ PASS: get_children_in_care_block exists'
        ELSE '❌ FAIL: get_children_in_care_block missing'
    END as status
UNION ALL
SELECT 
    'Function Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'accept_group_invitation_with_time_block'
            AND routine_type = 'FUNCTION'
        ) THEN '✅ PASS: accept_group_invitation_with_time_block exists'
        ELSE '❌ FAIL: accept_group_invitation_with_time_block missing'
    END as status;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Complete fresh start successful! You can now test the full workflow from scratch.' as status; 