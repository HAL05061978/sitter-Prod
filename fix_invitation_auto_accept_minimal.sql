-- Minimal Fix for Invitation Auto-Accept Bug
-- This works WITHOUT any invitation tables - uses only existing tables
-- The correct flow should be: Parent A invites → Parent B accepts (creates response) → Parent A chooses response

-- ============================================================================
-- STEP 1: Create function to submit invitation response (proposal)
-- ============================================================================

CREATE OR REPLACE FUNCTION submit_invitation_response(
    p_accepting_user_id UUID,
    p_request_id UUID,
    p_inviter_id UUID,
    p_selected_time_block_index INTEGER,
    p_selected_child_id UUID,
    p_invitation_date DATE,
    p_invitation_start_time TIME,
    p_invitation_end_time TIME,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request babysitting_requests%ROWTYPE;
    v_response_id UUID;
    v_invitation_id UUID;
BEGIN
    -- Get the original request details
    SELECT * INTO v_request FROM babysitting_requests WHERE id = p_request_id;
    
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
    
    -- Check if a response already exists for this invitation and user
    IF EXISTS (
        SELECT 1 FROM care_responses 
        WHERE request_id = p_request_id 
        AND responder_id = p_accepting_user_id
        AND response_notes LIKE '%Inviter: ' || p_inviter_id || '%'
    ) THEN
        RAISE EXCEPTION 'You have already submitted a response for this invitation';
    END IF;
    
    -- Create a unique invitation ID for this response
    v_invitation_id := gen_random_uuid();
    
    -- Create the response (proposal) using existing care_responses table
    INSERT INTO care_responses (
        request_id,
        responder_id,
        response_type,
        response_notes,
        status,
        reciprocal_child_id
    ) VALUES (
        p_request_id,
        p_accepting_user_id,
        'accept',
        COALESCE(p_notes, '') || ' | Time Block: ' || p_selected_time_block_index || 
        ' | Inviter: ' || p_inviter_id || 
        ' | Invitation ID: ' || v_invitation_id ||
        ' | Invitation Date: ' || p_invitation_date ||
        ' | Invitation Time: ' || p_invitation_start_time || '-' || p_invitation_end_time,
        'pending',
        p_selected_child_id
    );
    
    -- Get the ID of the newly created response
    SELECT id INTO v_response_id 
    FROM care_responses 
    WHERE request_id = p_request_id 
    AND responder_id = p_accepting_user_id 
    AND response_notes LIKE '%Invitation ID: ' || v_invitation_id || '%'
    ORDER BY created_at DESC 
    LIMIT 1;
    
    RAISE NOTICE 'Successfully created response % for invitation %', v_response_id, v_invitation_id;
    
    RETURN v_response_id;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_invitation_response(UUID, UUID, UUID, INTEGER, UUID, DATE, TIME, TIME, TEXT) TO authenticated;

-- ============================================================================
-- STEP 2: Create function to accept invitation response
-- ============================================================================

CREATE OR REPLACE FUNCTION accept_invitation_response(
    p_response_id UUID,
    p_acceptor_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_response care_responses%ROWTYPE;
    v_request babysitting_requests%ROWTYPE;
    v_duration_minutes INTEGER;
    v_existing_care_group_id UUID;
    v_inviter_child_id UUID;
    v_selected_time_block_index INTEGER;
    v_inviter_id UUID;
    v_invitation_date DATE;
    v_invitation_start_time TIME;
    v_invitation_end_time TIME;
BEGIN
    -- Get the response details
    SELECT * INTO v_response FROM care_responses WHERE id = p_response_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Response not found';
    END IF;
    
    -- Extract inviter ID from response_notes
    v_inviter_id := (
        SELECT SUBSTRING(response_notes FROM 'Inviter: ([a-f0-9-]+)')
        FROM care_responses 
        WHERE id = p_response_id
    );
    
    IF v_inviter_id IS NULL THEN
        RAISE EXCEPTION 'Could not extract inviter ID from response';
    END IF;
    
    -- Validate that the acceptor is the original inviter
    IF v_inviter_id::UUID != p_acceptor_id THEN
        RAISE EXCEPTION 'Only the original inviter can accept responses';
    END IF;
    
    -- Get the original request details
    SELECT * INTO v_request FROM babysitting_requests WHERE id = v_response.request_id;
    
    -- Validate that the response is pending
    IF v_response.status != 'pending' THEN
        RAISE EXCEPTION 'Response is not pending';
    END IF;
    
    -- Extract time block index from response_notes
    v_selected_time_block_index := (
        SELECT CAST(SUBSTRING(response_notes FROM 'Time Block: (\d+)') AS INTEGER)
        FROM care_responses 
        WHERE id = p_response_id
    );
    
    IF v_selected_time_block_index IS NULL THEN
        RAISE EXCEPTION 'Could not extract time block index from response';
    END IF;
    
    -- Extract invitation details from response_notes
    v_invitation_date := (
        SELECT CAST(SUBSTRING(response_notes FROM 'Invitation Date: ([0-9-]+)') AS DATE)
        FROM care_responses 
        WHERE id = p_response_id
    );
    
    v_invitation_start_time := (
        SELECT CAST(SUBSTRING(response_notes FROM 'Invitation Time: ([0-9:]+)') AS TIME)
        FROM care_responses 
        WHERE id = p_response_id
    );
    
    v_invitation_end_time := (
        SELECT CAST(SUBSTRING(response_notes FROM 'Invitation Time: [0-9:]+-([0-9:]+)') AS TIME)
        FROM care_responses 
        WHERE id = p_response_id
    );
    
    -- Find existing care group ID from the original blocks (Parent A ↔ Parent B)
    SELECT care_group_id INTO v_existing_care_group_id
    FROM scheduled_blocks 
    WHERE request_id = v_request.id 
    AND block_type = 'care_needed'
    LIMIT 1;
    
    IF v_existing_care_group_id IS NULL THEN
        RAISE EXCEPTION 'No existing care group found for the original request';
    END IF;
    
    -- Get the inviter's child ID (Parent B's child)
    SELECT child_id INTO v_inviter_child_id
    FROM scheduled_blocks 
    WHERE request_id = v_request.id 
    AND parent_id = v_inviter_id::UUID
    AND block_type = 'care_needed'
    LIMIT 1;
    
    IF v_inviter_child_id IS NULL THEN
        RAISE EXCEPTION 'Could not find inviter child for the original request';
    END IF;
    
    -- Calculate duration for the invitation time
    v_duration_minutes := EXTRACT(EPOCH FROM (v_invitation_end_time::time - v_invitation_start_time::time)) / 60;
    
    -- Get the group_id from the original request
    DECLARE
        v_group_id UUID;
    BEGIN
        SELECT group_id INTO v_group_id FROM babysitting_requests WHERE id = v_request.id;
        
        -- Create 2 new scheduled blocks for the reciprocal arrangement:
        
        -- 1. Parent C (responder) needs care for their child on the ORIGINAL time slot
        INSERT INTO scheduled_blocks (
            group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
            duration_minutes, block_type, status, request_id, notes, care_group_id
        ) VALUES (
            v_group_id, v_response.responder_id, v_response.reciprocal_child_id,
            v_request.requested_date, v_request.start_time, v_request.end_time,
            v_request.duration_minutes, 'care_needed', 'confirmed', v_request.id, 
            'Added via accepted invitation response', v_existing_care_group_id
        );
        
        -- 2. Parent C (responder) provides care for Parent B's child on the INVITATION time slot
        INSERT INTO scheduled_blocks (
            group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
            duration_minutes, block_type, status, request_id, notes, care_group_id
        ) VALUES (
            v_group_id, v_response.responder_id, v_inviter_child_id,
            v_invitation_date, v_invitation_start_time, v_invitation_end_time,
            v_duration_minutes, 'care_provided', 'confirmed', v_request.id, 
            'Reciprocal care via accepted invitation response', v_existing_care_group_id
        );
    END;
    
    -- Mark response as accepted
    UPDATE care_responses 
    SET status = 'accepted'
    WHERE id = p_response_id;
    
    -- Reject all other pending responses for this request from the same inviter
    -- This ensures only one response is accepted, others are declined but not deleted for auditing
    UPDATE care_responses 
    SET status = 'declined'
    WHERE request_id = v_request.id 
    AND response_notes LIKE '%Inviter: ' || v_inviter_id || '%'
    AND id != p_response_id 
    AND status = 'pending';
    
    RAISE NOTICE 'Successfully accepted response % for inviter %. Created care blocks for Parent C child % and Parent B child %', 
        p_response_id, v_inviter_id, v_response.reciprocal_child_id, v_inviter_child_id;
END;
$$;

GRANT EXECUTE ON FUNCTION accept_invitation_response(UUID, UUID) TO authenticated;

-- ============================================================================
-- STEP 3: Create function to get responses for an inviter
-- ============================================================================

CREATE OR REPLACE FUNCTION get_invitation_responses(p_inviter_id UUID, p_request_id UUID)
RETURNS TABLE (
    id UUID,
    responder_id UUID,
    responder_name TEXT,
    selected_time_block_index INTEGER,
    selected_child_name TEXT,
    status VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE,
    response_notes TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cr.id,
        cr.responder_id,
        p.full_name as responder_name,
        CAST(SUBSTRING(cr.response_notes FROM 'Time Block: (\d+)') AS INTEGER) as selected_time_block_index,
        c.full_name as selected_child_name,
        cr.status,
        cr.created_at,
        cr.response_notes
    FROM care_responses cr
    JOIN profiles p ON cr.responder_id = p.id
    JOIN children c ON cr.reciprocal_child_id = c.id
    WHERE cr.request_id = p_request_id
    AND cr.response_notes LIKE '%Inviter: ' || p_inviter_id || '%'
    AND cr.status != 'declined'
    ORDER BY cr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_invitation_responses(UUID, UUID) TO authenticated;

-- ============================================================================
-- STEP 4: Update the old accept_group_invitation_with_time_block function
-- ============================================================================

-- This function is now deprecated - it should not be used directly
-- Instead, use submit_invitation_response and accept_invitation_response

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
BEGIN
    -- This function is deprecated - use submit_invitation_response instead
    RAISE EXCEPTION 'This function is deprecated. Use submit_invitation_response instead to create a response, then accept_invitation_response to accept it.';
END;
$$;

-- ============================================================================
-- STEP 5: Verification queries
-- ============================================================================

SELECT 
    'Function Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'submit_invitation_response'
            AND routine_type = 'FUNCTION'
        ) THEN '✅ PASS: submit_invitation_response exists'
        ELSE '❌ FAIL: submit_invitation_response missing'
    END as status;

SELECT 
    'Function Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'accept_invitation_response'
            AND routine_type = 'FUNCTION'
        ) THEN '✅ PASS: accept_invitation_response exists'
        ELSE '❌ FAIL: accept_invitation_response missing'
    END as status;

SELECT 
    'Function Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'get_invitation_responses'
            AND routine_type = 'FUNCTION'
        ) THEN '✅ PASS: get_invitation_responses exists'
        ELSE '❌ FAIL: get_invitation_responses missing'
    END as status;

SELECT 'Invitation flow has been fixed to work without any invitation tables.' as note; 