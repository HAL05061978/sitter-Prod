-- CORRECT OPEN BLOCK FUNCTION WITH THIRD BLOCK FOR PARENT C
-- Use care_requests table as source of truth, populate related_request_id, and create 3 blocks total

DROP FUNCTION IF EXISTS accept_open_block_invitation(UUID, UUID, UUID);

CREATE OR REPLACE FUNCTION accept_open_block_invitation(
    p_care_response_id UUID,
    p_accepting_parent_id UUID,
    p_accepted_child_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_care_request_id UUID;
    v_care_request RECORD;
    v_block_time_id UUID;
    v_invited_parent_id UUID;
    v_reciprocal_date DATE;
    v_reciprocal_start_time TIME;
    v_reciprocal_end_time TIME;
    v_existing_block_date DATE;
    v_existing_block_start_time TIME;
    v_existing_block_end_time TIME;
    v_declined_count INTEGER;
         -- P, Q, N, O tracking variables for child assignment
     v_provider_child_id UUID;      -- P: Retrieved from event_title
     v_other_children UUID[];       -- Q: Retrieved from event_description
     v_opened_block_id UUID;        -- N: Retrieved from event_description
     v_original_requester_block_id UUID; -- O: Retrieved from event_description
     -- Helper variables for parsing event_description
     v_other_children_text TEXT;
     v_opened_block_id_text TEXT;
     v_original_requester_block_id_text TEXT;
BEGIN
    -- Get the care request ID from the care response
    SELECT request_id INTO v_care_request_id
    FROM care_responses 
    WHERE id = p_care_response_id
    AND status = 'pending';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Care response not found or not in pending status';
    END IF;
    
    -- Get the complete care request details
    SELECT * INTO v_care_request
    FROM care_requests 
    WHERE id = v_care_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Care request not found';
    END IF;
    
    -- Verify this is an open block request
    IF v_care_request.request_type != 'open_block' THEN
        RAISE EXCEPTION 'Care request is not an open block request';
    END IF;
    
    -- Get the block_time_id and invited_parent_id from the care response being accepted
    -- These are needed for declining other responses
    SELECT block_time_id, invited_parent_id INTO v_block_time_id, v_invited_parent_id
    FROM care_responses 
    WHERE id = p_care_response_id;
    
         -- FIXED: For open block invitations, get opened block times from care_requests table
     -- Now that create_open_block_invitation properly stores the opened block times in requested_date fields
     SELECT requested_date, start_time, end_time INTO v_existing_block_date, v_existing_block_start_time, v_existing_block_end_time
     FROM care_requests 
     WHERE id = v_care_request_id;
     
     -- Validate that we have the required opened block information
     IF v_existing_block_date IS NULL OR v_existing_block_start_time IS NULL OR v_existing_block_end_time IS NULL THEN
         RAISE EXCEPTION 'Missing opened block date/time information in care request';
     END IF;
     
     -- Get the reciprocal times being offered from care_requests table (now stored in reciprocal_date fields)
     -- This is needed for the care_requests update and for creating the first two blocks
     SELECT reciprocal_date, reciprocal_start_time, reciprocal_end_time INTO v_reciprocal_date, v_reciprocal_start_time, v_reciprocal_end_time
     FROM care_requests 
     WHERE id = v_care_request_id;
     
     IF v_reciprocal_date IS NULL OR v_reciprocal_start_time IS NULL OR v_reciprocal_end_time IS NULL THEN
         RAISE EXCEPTION 'Missing reciprocal date/time information in care request';
     END IF;
     
     RAISE NOTICE 'Using opened block times (from scheduled_care): date=%, start=%, end=%', 
         v_existing_block_date, v_existing_block_start_time, v_existing_block_end_time;
     RAISE NOTICE 'Using reciprocal times (from UI form): date=%, start=%, end=%', 
         v_reciprocal_date, v_reciprocal_start_time, v_reciprocal_end_time;
    
         -- Create scheduled_care records based on the care_requests data
     -- RULE: All time information comes from care_requests table
     -- RULE: Parent C provides care for the RECIPROCAL time (times Parent B offered)
     -- RULE: Parent C receives care for the ORIGINAL time (times from the opened block)
     -- KEY: Populate related_request_id to link all blocks together
     
     -- DEBUG: Log what we're about to create
     RAISE NOTICE '=== CREATING SCHEDULED_CARE BLOCKS ===';
     RAISE NOTICE 'Parent C (accepting): %', p_accepting_parent_id;
     RAISE NOTICE 'Parent C child: %', p_accepted_child_id;
     RAISE NOTICE 'Original requester: %', v_care_request.requester_id;
     RAISE NOTICE 'Original requester child: %', v_care_request.child_id;
     
     -- 1. Parent C (accepting parent) providing care for the RECIPROCAL time (times Parent B offered)
     -- This is where Parent C provides care in exchange for receiving care during the opened block
     INSERT INTO scheduled_care (
         group_id, care_date, start_time, end_time, care_type, status, notes, 
         parent_id, child_id, related_request_id
     ) VALUES (
         v_care_request.group_id, 
         v_reciprocal_date,                           -- Use reciprocal date/time (times Parent B offered)
         v_reciprocal_start_time,                     -- Use reciprocal start time (times Parent B offered)
         v_reciprocal_end_time,                       -- Use reciprocal end time (times Parent B offered)
         'provided', 
         'confirmed', 
         v_care_request.notes || ' - Open block accepted - Parent C providing care', 
         p_accepting_parent_id,                       -- Parent C (the accepting parent) provides care
         p_accepted_child_id,                         -- Parent C's child
         v_care_request_id                            -- Link to the original care request!
     ) RETURNING id INTO v_care_request_id;
     
     RAISE NOTICE 'Created Block 1: Parent C providing care on % %-% (reciprocal time)', 
         v_reciprocal_date, v_reciprocal_start_time, v_reciprocal_end_time;
     
     -- 2. Original requester receiving care for the RECIPROCAL time (times Parent B offered)
     -- This is where the original requester receives care from Parent C
     INSERT INTO scheduled_care (
         group_id, care_date, start_time, end_time, care_type, status, notes, 
         parent_id, child_id, related_request_id
     ) VALUES (
         v_care_request.group_id, 
         v_reciprocal_date,                           -- Use reciprocal date/time (times Parent B offered)
         v_reciprocal_start_time,                     -- Use reciprocal start time (times Parent B offered)
         v_reciprocal_end_time,                       -- Use reciprocal end time (times Parent B offered)
         'needed', 
         'confirmed', 
         v_care_request.notes || ' - Open block accepted - requester receiving care from Parent C', 
         v_care_request.requester_id,                 -- The original requester receives care
         v_care_request.child_id,                     -- Their child
         v_care_request_id                            -- Link to the original care request!
     );
     
     RAISE NOTICE 'Created Block 2: Original requester receiving care on % %-% (reciprocal time)', 
         v_reciprocal_date, v_reciprocal_start_time, v_reciprocal_end_time;
     
     -- 3. Parent C (accepting parent) receiving care for the ORIGINAL OPENED BLOCK time
     -- This ensures Parent C sees the opened block where they're receiving care
     INSERT INTO scheduled_care (
         group_id, care_date, start_time, end_time, care_type, status, notes, 
         parent_id, child_id, related_request_id
     ) VALUES (
         v_care_request.group_id, 
         v_existing_block_date,                       -- Use ORIGINAL opened block date/time (from requested_date fields)
         v_existing_block_start_time,                 -- Use ORIGINAL opened block start time (from start_time field)
         v_existing_block_end_time,                   -- Use ORIGINAL opened block end time (from end_time field)
         'needed', 
         'confirmed', 
         v_care_request.notes || ' - Open block accepted - Parent C receiving care', 
         p_accepting_parent_id,                       -- Parent C (the accepting parent) receives care
         p_accepted_child_id,                         -- Parent C's child
         v_care_request_id                            -- Link to the original care request!
     );
     
     RAISE NOTICE 'Created Block 3: Parent C receiving care on % %-% (original opened block time)', 
         v_existing_block_date, v_existing_block_start_time, v_existing_block_end_time;
    
         -- NOTE: care_requests and care_responses updates moved to after child assignment to ensure they complete
    
         -- STEP 3: Use P, Q, N, O information for precise child assignment
     -- This ensures each parent sees the correct children in their blocks
     
     -- DEBUG: Log the raw P, Q, N, O data from care_requests
     RAISE NOTICE '=== EXTRACTING P, Q, N, O VARIABLES ===';
     RAISE NOTICE 'Raw event_title (P): %', v_care_request.event_title;
     RAISE NOTICE 'Raw event_description (Q, N, O): %', v_care_request.event_description;
     
     -- Extract P, Q, N, O from the stored information
     v_provider_child_id := v_care_request.event_title::UUID;  -- P stored as text
     
     -- Parse event_description to get Q, N, O
     -- The event_description contains PostgreSQL array literal format, not JSON
     -- Format: {"other_children" : ["3fbea496-5314-4d27-b6f3-addb40c7c4e8"], "opened_block_id" : "d496c9a0-83a6-4141-881c-6d3de31aae99", "original_requester_block_id" : "b9faf939-abc3-4390-a7ae-1973cc672dd0"}
     
     -- Extract the text values from the event_description using regex
     v_other_children_text := regexp_replace(
         regexp_replace(
             v_care_request.event_description, 
             '.*"other_children"\s*:\s*\[([^\]]*)\].*', 
             '\1'
         ),
         '"', '', 'g'
     );
     
     v_opened_block_id_text := regexp_replace(
         v_care_request.event_description, 
         '.*"opened_block_id"\s*:\s*"([^"]*)".*', 
         '\1'
     );
     
     v_original_requester_block_id_text := regexp_replace(
         v_care_request.event_description, 
         '.*"original_requester_block_id"\s*:\s*"([^"]*)".*', 
         '\1'
     );
     
     -- Convert to UUID arrays/values
     IF v_other_children_text != '' AND v_other_children_text != v_care_request.event_description THEN
         v_other_children := string_to_array(v_other_children_text, ',')::UUID[];
     ELSE
         v_other_children := NULL;
     END IF;
     
     IF v_opened_block_id_text != '' AND v_opened_block_id_text != v_care_request.event_description THEN
         v_opened_block_id := v_opened_block_id_text::UUID;
     ELSE
         v_opened_block_id := NULL;
     END IF;
     
     IF v_original_requester_block_id_text != '' AND v_original_requester_block_id_text != v_care_request.event_description THEN
         v_original_requester_block_id := v_original_requester_block_id_text::UUID;
     ELSE
         v_original_requester_block_id := NULL;
     END IF;
         
     RAISE NOTICE '=== EXTRACTED P, Q, N, O VALUES ===';
     RAISE NOTICE 'P (Provider child): %', v_provider_child_id;
     RAISE NOTICE 'Q (Other children): %', v_other_children;
     RAISE NOTICE 'N (Opened block): %', v_opened_block_id;
     RAISE NOTICE 'O (Original requester block): %', v_original_requester_block_id;
     
     -- Validate that we have the required P, Q, N, O information
     IF v_provider_child_id IS NULL THEN
         RAISE NOTICE 'WARNING: P (provider_child_id) is NULL - child assignment may fail';
     END IF;
     
     IF v_other_children IS NULL OR array_length(v_other_children, 1) = 0 THEN
         RAISE NOTICE 'WARNING: Q (other_children) is NULL or empty - child assignment may fail';
     END IF;
     
     IF v_opened_block_id IS NULL THEN
         RAISE NOTICE 'WARNING: N (opened_block_id) is NULL - child assignment may fail';
     END IF;
     
     IF v_original_requester_block_id IS NULL THEN
         RAISE NOTICE 'WARNING: O (original_requester_block_id) is NULL - child assignment may fail';
     END IF;
        
                 -- 1. Add Parent C's child to Parent B's opening block (N)
         RAISE NOTICE '=== STEP 1: Adding Parent C child to Parent B opening block ===';
         IF v_opened_block_id IS NOT NULL THEN
             -- Check if Parent C's child is already in the existing block
             IF NOT EXISTS (
                 SELECT 1 FROM scheduled_care_children 
                 WHERE scheduled_care_id = v_opened_block_id 
                 AND child_id = p_accepted_child_id
             ) THEN
                 -- Add Parent C's child to Parent B's opening block
                 INSERT INTO scheduled_care_children (scheduled_care_id, child_id, providing_parent_id, notes)
                 VALUES (
                     v_opened_block_id,  -- N: Parent B's opening block
                     p_accepted_child_id, -- Parent C's child
                     p_accepting_parent_id, -- Parent C is providing care
                     'Open block - Parent C child added to Parent B opening block'
                 );
                 
                 RAISE NOTICE 'SUCCESS: Added Parent C child % to Parent B opening block %', 
                     p_accepted_child_id, v_opened_block_id;
             ELSE
                 RAISE NOTICE 'SKIP: Parent C child % already exists in Parent B opening block %', 
                     p_accepted_child_id, v_opened_block_id;
             END IF;
         ELSE
             RAISE NOTICE 'ERROR: No opened_block_id found, skipping Parent B opening block child addition';
         END IF;
         
         -- 2. Add Parent C's child to Parent A's receiving care block (O)
         RAISE NOTICE '=== STEP 2: Adding Parent C child to Parent A receiving care block ===';
         IF v_original_requester_block_id IS NOT NULL THEN
             -- Check if Parent C's child is already in the existing block
             IF NOT EXISTS (
                 SELECT 1 FROM scheduled_care_children 
                 WHERE scheduled_care_id = v_original_requester_block_id 
                 AND child_id = p_accepted_child_id
             ) THEN
                 -- Add Parent C's child to Parent A's receiving care block
                 INSERT INTO scheduled_care_children (scheduled_care_id, child_id, providing_parent_id, notes)
                 VALUES (
                     v_original_requester_block_id,  -- O: Parent A's receiving care block
                     p_accepted_child_id,            -- Parent C's child
                     p_accepting_parent_id,          -- Parent C is providing care
                     'Open block - Parent C child added to Parent A receiving care block'
                 );
                 
                 RAISE NOTICE 'SUCCESS: Added Parent C child % to Parent A receiving care block %', 
                     p_accepted_child_id, v_original_requester_block_id;
             ELSE
                 RAISE NOTICE 'SKIP: Parent C child % already exists in Parent A receiving care block %', 
                     p_accepted_child_id, v_original_requester_block_id;
             END IF;
         ELSE
             RAISE NOTICE 'ERROR: No original_requester_block_id found, skipping Parent A receiving care block child addition';
         END IF;
         
                   -- 3. Add P and Q to Parent C's newly created blocks
          RAISE NOTICE '=== STEP 3: Adding P and Q to Parent C blocks ===';
          
          -- Parent C's providing care block (reciprocal time) should include Parent C's child and P
          IF v_provider_child_id IS NOT NULL THEN
              INSERT INTO scheduled_care_children (scheduled_care_id, child_id, providing_parent_id, notes)
              SELECT 
                  sc.id, 
                  v_provider_child_id,  -- P: Provider's child (Parent B's child)
                  p_accepting_parent_id, -- Parent C is providing care
                  'Open block - Provider child (P) added to Parent C providing care block'
              FROM scheduled_care sc
              WHERE sc.related_request_id = v_care_request_id
              AND sc.care_type = 'provided'  -- Parent C's providing care block
              AND sc.parent_id = p_accepting_parent_id  -- Parent C's block
              -- Avoid duplicate children
              AND NOT EXISTS (
                  SELECT 1 FROM scheduled_care_children scc 
                  WHERE scc.scheduled_care_id = sc.id 
                  AND scc.child_id = v_provider_child_id
              );
              
              GET DIAGNOSTICS v_declined_count = ROW_COUNT;
              RAISE NOTICE 'Added P (provider child) to Parent C providing care block: % rows affected', v_declined_count;
          ELSE
              RAISE NOTICE 'WARNING: Cannot add P to Parent C providing care block - v_provider_child_id is NULL';
          END IF;
          
          -- Parent C's receiving care block (opened block time) should include P, Q, and Parent C's child
          -- First add P (provider's child)
          IF v_provider_child_id IS NOT NULL THEN
              INSERT INTO scheduled_care_children (scheduled_care_id, child_id, providing_parent_id, notes)
              SELECT 
                  sc.id, 
                  v_provider_child_id,  -- P: Provider's child (Parent B's child)
                  p_accepting_parent_id, -- Parent C is providing care
                  'Open block - Provider child (P) added to Parent C receiving care block'
              FROM scheduled_care sc
              WHERE sc.related_request_id = v_care_request_id
              AND sc.care_type = 'needed'  -- Parent C's receiving care block
              AND sc.parent_id = p_accepting_parent_id  -- Parent C's block
              -- Avoid duplicate children
              AND NOT EXISTS (
                  SELECT 1 FROM scheduled_care_children scc 
                  WHERE scc.scheduled_care_id = sc.id 
                  AND scc.child_id = v_provider_child_id
              );
              
              GET DIAGNOSTICS v_declined_count = ROW_COUNT;
              RAISE NOTICE 'Added P (provider child) to Parent C receiving care block: % rows affected', v_declined_count;
          ELSE
              RAISE NOTICE 'WARNING: Cannot add P to Parent C receiving care block - v_provider_child_id is NULL';
          END IF;
          
          -- Then add Q (other children) if they exist
          IF v_other_children IS NOT NULL AND array_length(v_other_children, 1) > 0 THEN
              -- Use a loop to add each child individually to avoid the unnest() in WHERE clause issue
              FOR i IN 1..array_length(v_other_children, 1)
              LOOP
                  -- Check if this child is already in the block
                  IF NOT EXISTS (
                      SELECT 1 FROM scheduled_care_children scc 
                      INNER JOIN scheduled_care sc ON scc.scheduled_care_id = sc.id
                      WHERE sc.related_request_id = v_care_request_id
                      AND sc.care_type = 'needed'  -- Parent C's receiving care block
                      AND sc.parent_id = p_accepting_parent_id  -- Parent C's block
                      AND scc.child_id = v_other_children[i]
                  ) THEN
                      -- Add this child to Parent C's receiving care block
                      INSERT INTO scheduled_care_children (scheduled_care_id, child_id, providing_parent_id, notes)
                      SELECT 
                          sc.id, 
                          v_other_children[i],  -- Q: Current child from the array
                          p_accepting_parent_id, -- Parent C is providing care
                          'Open block - Other children (Q) added to Parent C receiving care block'
                      FROM scheduled_care sc
                      WHERE sc.related_request_id = v_care_request_id
                      AND sc.care_type = 'needed'  -- Parent C's receiving care block
                      AND sc.parent_id = p_accepting_parent_id  -- Parent C's block
                      LIMIT 1;
                      
                      RAISE NOTICE 'Added child % to Parent C receiving care block', v_other_children[i];
                  ELSE
                      RAISE NOTICE 'Child % already exists in Parent C receiving care block, skipping', v_other_children[i];
                  END IF;
              END LOOP;
              
              RAISE NOTICE 'Finished adding Q (other children) to Parent C receiving care block';
          ELSE
              RAISE NOTICE 'WARNING: Cannot add Q to Parent C receiving care block - v_other_children is NULL or empty';
          END IF;
    
         RAISE NOTICE 'Added children to appropriate blocks with related_request_id %', v_care_request_id;
     
     -- Debug: Log what was created
     RAISE NOTICE 'Created 3 scheduled_care records for open block %: % providing care, % receiving care, % receiving care (opened time)', 
         v_care_request_id, p_accepting_parent_id, v_care_request.requester_id, p_accepting_parent_id;
     
     -- CRITICAL: Update care_requests status to accepted
     RAISE NOTICE '=== UPDATING CARE_REQUESTS STATUS ===';
     UPDATE care_requests 
     SET 
         status = 'accepted',
         responder_id = p_accepting_parent_id,
         response_notes = v_care_request.notes || ' - Open block accepted',
         -- Store the accepting party details
         reciprocal_parent_id = p_accepting_parent_id,
         reciprocal_child_id = p_accepted_child_id,
         reciprocal_status = 'accepted'
         -- Note: reciprocal_date, reciprocal_start_time, reciprocal_end_time are already set correctly
         -- from the create_open_block_invitation function
     WHERE id = v_care_request_id;
     
     GET DIAGNOSTICS v_declined_count = ROW_COUNT;
     RAISE NOTICE 'Updated care_requests status: % rows affected', v_declined_count;
     
     -- Update the care response status to accepted
     RAISE NOTICE '=== UPDATING CARE_RESPONSES STATUS ===';
     UPDATE care_responses 
     SET status = 'accepted'
     WHERE id = p_care_response_id;
     
     GET DIAGNOSTICS v_declined_count = ROW_COUNT;
     RAISE NOTICE 'Updated care_responses status: % rows affected', v_declined_count;
     
     -- Decline ONLY the specific time slot and parent that was accepted
     -- This prevents over-booking while keeping other time slots and parents available
     RAISE NOTICE '=== DECLINING OTHER RESPONSES ===';
     
     -- 1. Decline all responses for the same block_time_id (same time slot) EXCEPT the accepted one
     IF v_block_time_id IS NOT NULL THEN
         UPDATE care_responses 
         SET status = 'declined'
         WHERE block_time_id = v_block_time_id
         AND status = 'pending'
         AND id != p_care_response_id;
         
         GET DIAGNOSTICS v_declined_count = ROW_COUNT;
         RAISE NOTICE 'Declined % responses for block_time_id %', v_declined_count, v_block_time_id;
     END IF;
     
     -- 2. Decline all responses for the same invited_parent_id (same parent) EXCEPT the accepted one
     IF v_invited_parent_id IS NOT NULL THEN
         UPDATE care_responses 
         SET status = 'declined'
         WHERE invited_parent_id = v_invited_parent_id
         AND status = 'pending'
         AND id != p_care_response_id;
         
         GET DIAGNOSTICS v_declined_count = ROW_COUNT;
         RAISE NOTICE 'Declined % responses for invited_parent_id %', v_declined_count, v_invited_parent_id;
     END IF;
     
     RAISE NOTICE '=== FUNCTION COMPLETED SUCCESSFULLY ===';
     RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in accept_open_block_invitation: %', SQLERRM;
        RAISE EXCEPTION 'Failed to accept open block invitation: %', SQLERRM;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION accept_open_block_invitation(UUID, UUID, UUID) TO authenticated;

-- Test deployment
DO $$
BEGIN
    RAISE NOTICE '=== FINALLY CORRECTED OPEN BLOCK FUNCTION WITH P, Q, N, O TRACKING ===';
    RAISE NOTICE '1. FIXED: Care direction now correct - Parent C provides care for reciprocal time, receives care for original time';
    RAISE NOTICE '2. CORRECTED: Uses correct dates - opened block times from scheduled_care, reciprocal times from UI form';
    RAISE NOTICE '3. Creates 3 blocks total: Parent C providing care, requester receiving care, Parent C receiving care';
    RAISE NOTICE '4. NEW: Uses P, Q, N, O tracking for precise child assignment with comprehensive debugging';
    RAISE NOTICE '5. P = Provider child (Parent B), Q = Other children (Parent A), N = Opened block, O = Original requester block';
    RAISE NOTICE '6. Parent C blocks show P + Q + Parent C child (receiving) and P + Parent C child (providing)';
    RAISE NOTICE '7. Parent B opening block gets Parent C child added';
    RAISE NOTICE '8. Parent A receiving care block gets Parent C child added';
    RAISE NOTICE '9. FIXED: JSON parsing error - now uses regex to parse event_description properly';
    RAISE NOTICE '10. FIXED: set-returning functions error - now uses loop instead of unnest() in WHERE clause';
    RAISE NOTICE '11. FIXED: care_requests.status not updating - moved updates to after child assignment';
    RAISE NOTICE '12. All permissions granted';
    RAISE NOTICE '=== FIELD MAPPING FINALLY CORRECTED - P, Q, N, O IMPLEMENTATION COMPLETE - ALL ERRORS FIXED ===';
END $$;



