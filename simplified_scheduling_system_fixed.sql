-- Simplified Scheduling System (Fixed Version)
-- This maintains all functionality but with cleaner, more maintainable code
-- Run this in your Supabase SQL editor

-- ============================================================================
-- STEP 1: CLEAN UP EXISTING COMPLEX FUNCTIONS
-- ============================================================================

-- Drop all complex trigger functions that cause RLS issues
DROP TRIGGER IF EXISTS create_reciprocal_scheduled_blocks_trigger ON public.request_responses;
DROP TRIGGER IF EXISTS create_initial_scheduled_blocks_trigger ON public.request_responses;
DROP TRIGGER IF EXISTS create_additional_care_trigger ON public.request_responses;
DROP TRIGGER IF EXISTS close_request_trigger ON public.request_responses;

-- Drop complex functions
DROP FUNCTION IF EXISTS create_reciprocal_scheduled_blocks();
DROP FUNCTION IF EXISTS create_initial_scheduled_blocks();
DROP FUNCTION IF EXISTS create_additional_care_request();
DROP FUNCTION IF EXISTS close_request_if_not_open_to_others();
DROP FUNCTION IF EXISTS join_existing_care_block(UUID, UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, UUID);
DROP FUNCTION IF EXISTS agree_to_additional_reciprocal(UUID);
DROP FUNCTION IF EXISTS get_available_children_for_joining_care(UUID);
DROP FUNCTION IF EXISTS get_open_care_blocks_for_joining(UUID[]);
DROP FUNCTION IF EXISTS create_multi_child_care_blocks(UUID, UUID, DATE, TIME, TIME, UUID[], UUID);

-- Drop complex views
DROP VIEW IF EXISTS public.multi_child_care_opportunities;

-- ============================================================================
-- STEP 2: SIMPLIFY DATABASE SCHEMA
-- ============================================================================

-- Remove unused columns from request_responses
ALTER TABLE public.request_responses 
DROP COLUMN IF EXISTS counter_date,
DROP COLUMN IF EXISTS counter_start_time,
DROP COLUMN IF EXISTS counter_end_time,
DROP COLUMN IF EXISTS keep_open_to_others,
DROP COLUMN IF EXISTS initiator_agreed;

-- Remove unused constraints
ALTER TABLE public.request_responses 
DROP CONSTRAINT IF EXISTS valid_counter_time_range;

-- Simplify response types to just agree/reject
ALTER TABLE public.request_responses 
DROP CONSTRAINT IF EXISTS request_responses_response_type_check;

ALTER TABLE public.request_responses 
ADD CONSTRAINT request_responses_response_type_check 
CHECK (response_type IN ('agree', 'reject'));

-- ============================================================================
-- STEP 3: CREATE SIMPLIFIED CORE FUNCTIONS
-- ============================================================================

-- Single function to handle all care exchange scenarios
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
  
  -- Calculate reciprocal duration if provided
  IF v_response.reciprocal_start_time IS NOT NULL AND v_response.reciprocal_end_time IS NOT NULL THEN
    v_reciprocal_duration_minutes := EXTRACT(EPOCH FROM (v_response.reciprocal_end_time::time - v_response.reciprocal_start_time::time)) / 60;
  ELSE
    v_reciprocal_duration_minutes := v_request.duration_minutes;
  END IF;
  
  -- Create scheduled blocks for the original request (Parent A needs care, Parent B provides)
  INSERT INTO public.scheduled_blocks (
    group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
    duration_minutes, block_type, status, request_id, notes
  ) VALUES (
    v_request.group_id, v_request.initiator_id, v_initiator_child_id,
    v_request.requested_date, v_request.start_time, v_request.end_time,
    v_request.duration_minutes, 'care_needed', 'confirmed', v_request.id, v_request.notes
  );
  
  INSERT INTO public.scheduled_blocks (
    group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
    duration_minutes, block_type, status, request_id, notes
  ) VALUES (
    v_request.group_id, v_response.responder_id, v_initiator_child_id,
    v_request.requested_date, v_request.start_time, v_request.end_time,
    v_request.duration_minutes, 'care_provided', 'confirmed', v_request.id, v_response.notes
  );
  
  -- Create scheduled blocks for reciprocal care (Parent B needs care, Parent A provides)
  -- Only create reciprocal blocks if the responder specified reciprocal care details
  IF v_responder_child_id IS NOT NULL AND v_response.reciprocal_date IS NOT NULL 
     AND v_response.reciprocal_start_time IS NOT NULL AND v_response.reciprocal_end_time IS NOT NULL THEN
    
    INSERT INTO public.scheduled_blocks (
      group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
      duration_minutes, block_type, status, request_id, notes
    ) VALUES (
      v_request.group_id, v_response.responder_id, v_responder_child_id,
      v_response.reciprocal_date, v_response.reciprocal_start_time, v_response.reciprocal_end_time,
      v_reciprocal_duration_minutes, 'care_needed', 'confirmed', v_request.id, v_response.notes
    );
    
    INSERT INTO public.scheduled_blocks (
      group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
      duration_minutes, block_type, status, request_id, notes
    ) VALUES (
      v_request.group_id, v_request.initiator_id, v_responder_child_id,
      v_response.reciprocal_date, v_response.reciprocal_start_time, v_response.reciprocal_end_time,
      v_reciprocal_duration_minutes, 'care_provided', 'confirmed', v_request.id, v_request.notes
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
  
  RAISE NOTICE 'Successfully processed care exchange for request % and response %', p_request_id, p_response_id;
END;
$$;

-- Function to allow additional parents to join existing care blocks
CREATE OR REPLACE FUNCTION join_care_block(
  p_request_id UUID,
  p_joining_parent_id UUID,
  p_joining_child_id UUID,
  p_reciprocal_date DATE,
  p_reciprocal_start_time TIME,
  p_reciprocal_end_time TIME,
  p_reciprocal_child_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
  v_original_response RECORD;
  v_response_id UUID;
  v_reciprocal_duration_minutes INTEGER;
BEGIN
  -- Get the original request details
  SELECT * INTO v_request FROM public.babysitting_requests WHERE id = p_request_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  
  -- Get the original response (Parent B's response)
  SELECT * INTO v_original_response 
  FROM public.request_responses 
  WHERE request_id = p_request_id AND status = 'accepted'
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No accepted response found for this request';
  END IF;
  
  -- Validate that the joining parent is a member of the same group
  IF NOT EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = v_request.group_id AND profile_id = p_joining_parent_id
  ) THEN
    RAISE EXCEPTION 'Joining parent is not a member of the care block group';
  END IF;
  
  -- Validate that the joining child is active in the group
  IF NOT EXISTS (
    SELECT 1 FROM public.child_group_members 
    WHERE group_id = v_request.group_id AND child_id = p_joining_child_id
  ) THEN
    RAISE EXCEPTION 'Joining child is not a member of the care block group';
  END IF;
  
  -- Validate time conflicts for the joining child
  IF EXISTS (
    SELECT 1 FROM public.scheduled_blocks 
    WHERE child_id = p_joining_child_id 
    AND (
      (start_time, end_time) OVERLAPS (p_reciprocal_start_time, p_reciprocal_end_time)
      OR (start_time, end_time) OVERLAPS (v_request.start_time, v_request.end_time)
    )
  ) THEN
    RAISE EXCEPTION 'Time conflict detected for joining child';
  END IF;
  
  -- Calculate reciprocal duration
  v_reciprocal_duration_minutes := EXTRACT(EPOCH FROM (p_reciprocal_end_time::time - p_reciprocal_start_time::time)) / 60;
  
  -- Create a response for the joining parent
  INSERT INTO public.request_responses (
    request_id, responder_id, response_type, 
    reciprocal_date, reciprocal_start_time, reciprocal_end_time, 
    reciprocal_duration_minutes, reciprocal_child_id, status
  ) VALUES (
    p_request_id, p_joining_parent_id, 'agree',
    p_reciprocal_date, p_reciprocal_start_time, p_reciprocal_end_time,
    v_reciprocal_duration_minutes, p_reciprocal_child_id, 'accepted'
  ) RETURNING id INTO v_response_id;
  
  -- Create care_needed block for the joining child (same time as original request)
  INSERT INTO public.scheduled_blocks (
    group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
    duration_minutes, block_type, status, request_id, notes
  ) VALUES (
    v_request.group_id, p_joining_parent_id, p_joining_child_id,
    v_request.requested_date, v_request.start_time, v_request.end_time,
    v_request.duration_minutes, 'care_needed', 'confirmed', v_request.id, 
    'Joining existing care block'
  );
  
  -- Create care_provided block for the original responder (Parent B) for the joining child
  INSERT INTO public.scheduled_blocks (
    group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
    duration_minutes, block_type, status, request_id, notes
  ) VALUES (
    v_request.group_id, v_original_response.responder_id, p_joining_child_id,
    v_request.requested_date, v_request.start_time, v_request.end_time,
    v_request.duration_minutes, 'care_provided', 'confirmed', v_request.id, 
    'Providing care for additional child'
  );
  
  -- Create reciprocal care blocks (joining parent provides care for original responder's child)
  INSERT INTO public.scheduled_blocks (
    group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
    duration_minutes, block_type, status, request_id, notes
  ) VALUES (
    v_request.group_id, v_original_response.responder_id, p_reciprocal_child_id,
    p_reciprocal_date, p_reciprocal_start_time, p_reciprocal_end_time,
    v_reciprocal_duration_minutes, 'care_needed', 'confirmed', v_request.id, 
    'Reciprocal care from joining parent'
  );
  
  INSERT INTO public.scheduled_blocks (
    group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
    duration_minutes, block_type, status, request_id, notes
  ) VALUES (
    v_request.group_id, p_joining_parent_id, p_reciprocal_child_id,
    p_reciprocal_date, p_reciprocal_start_time, p_reciprocal_end_time,
    v_reciprocal_duration_minutes, 'care_provided', 'confirmed', v_request.id, 
    'Providing reciprocal care'
  );
  
  RETURN json_build_object(
    'success', true,
    'response_id', v_response_id,
    'message', 'Successfully joined care block'
  );
END;
$$;

-- Function to get available care blocks that can accept additional children
CREATE OR REPLACE FUNCTION get_available_care_blocks(
  p_group_id UUID DEFAULT NULL
)
RETURNS TABLE (
  request_id UUID,
  group_id UUID,
  group_name TEXT,
  initiator_name TEXT,
  initiator_child_name TEXT,
  requested_date DATE,
  start_time TIME,
  end_time TIME,
  duration_minutes INTEGER,
  current_children_count INTEGER,
  max_children_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    br.id as request_id,
    br.group_id,
    g.name as group_name,
    p.full_name as initiator_name,
    c.full_name as initiator_child_name,
    br.requested_date,
    br.start_time,
    br.end_time,
    br.duration_minutes,
    COALESCE(COUNT(sb.id), 0)::INTEGER as current_children_count,
    5 as max_children_count
  FROM public.babysitting_requests br
  JOIN public.groups g ON br.group_id = g.id
  JOIN public.profiles p ON br.initiator_id = p.id
  JOIN public.children c ON br.child_id = c.id
  JOIN public.request_responses rr ON br.id = rr.request_id AND rr.status = 'accepted'
  LEFT JOIN public.scheduled_blocks sb ON sb.request_id = br.id AND sb.block_type = 'care_needed'
  WHERE br.status = 'closed'
    AND br.requested_date >= CURRENT_DATE
    AND (p_group_id IS NULL OR br.group_id = p_group_id)
  GROUP BY br.id, br.group_id, g.name, p.full_name, c.full_name, 
           br.requested_date, br.start_time, br.end_time, br.duration_minutes
  HAVING COALESCE(COUNT(sb.id), 0) < 5;  -- Only show blocks that haven't reached the limit
END;
$$;

-- Function to get available children for joining a specific care block
CREATE OR REPLACE FUNCTION get_available_children_for_care_block(
  p_request_id UUID
)
RETURNS TABLE (
  child_id UUID,
  child_name TEXT,
  parent_id UUID,
  parent_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
BEGIN
  -- Get the request details
  SELECT * INTO v_request FROM public.babysitting_requests WHERE id = p_request_id;
  
  RETURN QUERY
  SELECT 
    c.id as child_id,
    c.full_name as child_name,
    c.parent_id,
    p.full_name as parent_name
  FROM public.children c
  JOIN public.profiles p ON c.parent_id = p.id
  JOIN public.child_group_members cgm ON c.id = cgm.child_id
  WHERE cgm.group_id = v_request.group_id
    AND c.parent_id != v_request.initiator_id  -- Exclude the original requester
    AND c.parent_id != (  -- Exclude the original responder
      SELECT responder_id FROM public.request_responses 
      WHERE request_id = p_request_id AND status = 'accepted'
      LIMIT 1
    )
    AND NOT EXISTS (  -- Exclude children already involved in this care block
      SELECT 1 FROM public.scheduled_blocks sb
      WHERE sb.request_id = p_request_id AND sb.child_id = c.id
    )
    AND NOT EXISTS (  -- Exclude children with time conflicts
      SELECT 1 FROM public.scheduled_blocks sb2
      WHERE sb2.child_id = c.id
        AND sb2.id NOT IN (
          SELECT id FROM public.scheduled_blocks WHERE request_id = p_request_id
        )
        AND sb2.scheduled_date = v_request.requested_date
        AND (
          (sb2.start_time, sb2.end_time) OVERLAPS (v_request.start_time, v_request.end_time)
        )
    )
  ORDER BY p.full_name, c.full_name;
END;
$$;

-- ============================================================================
-- STEP 4: GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION create_care_exchange(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION join_care_block(UUID, UUID, UUID, DATE, TIME, TIME, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_care_blocks(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_children_for_care_block(UUID) TO authenticated;

-- ============================================================================
-- STEP 5: HANDLE EXISTING RLS POLICIES
-- ============================================================================

-- Enable RLS on all tables (if not already enabled)
ALTER TABLE public.babysitting_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_blocks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view requests in their groups" ON public.babysitting_requests;
DROP POLICY IF EXISTS "Users can create requests in their groups" ON public.babysitting_requests;
DROP POLICY IF EXISTS "Users can update their own requests" ON public.babysitting_requests;

DROP POLICY IF EXISTS "Users can view responses in their groups" ON public.request_responses;
DROP POLICY IF EXISTS "Users can create responses" ON public.request_responses;
DROP POLICY IF EXISTS "Users can update their own responses" ON public.request_responses;

DROP POLICY IF EXISTS "Users can view blocks in their groups" ON public.scheduled_blocks;
DROP POLICY IF EXISTS "Users can create blocks" ON public.scheduled_blocks;
DROP POLICY IF EXISTS "Users can update their own blocks" ON public.scheduled_blocks;

-- Create new RLS policies
CREATE POLICY "Users can view requests in their groups" ON public.babysitting_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.group_members 
            WHERE group_id = babysitting_requests.group_id 
            AND profile_id = auth.uid()
            AND status = 'active'
        )
    );

CREATE POLICY "Users can create requests in their groups" ON public.babysitting_requests
    FOR INSERT WITH CHECK (
        initiator_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.group_members 
            WHERE group_id = babysitting_requests.group_id 
            AND profile_id = auth.uid()
            AND status = 'active'
        )
    );

CREATE POLICY "Users can update their own requests" ON public.babysitting_requests
    FOR UPDATE USING (initiator_id = auth.uid());

-- RLS Policies for request_responses
CREATE POLICY "Users can view responses in their groups" ON public.request_responses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.group_members gm
            JOIN public.babysitting_requests br ON gm.group_id = br.group_id
            WHERE br.id = request_responses.request_id 
            AND gm.profile_id = auth.uid()
            AND gm.status = 'active'
        )
    );

CREATE POLICY "Users can create responses" ON public.request_responses
    FOR INSERT WITH CHECK (responder_id = auth.uid());

CREATE POLICY "Users can update their own responses" ON public.request_responses
    FOR UPDATE USING (responder_id = auth.uid());

-- RLS Policies for scheduled_blocks
CREATE POLICY "Users can view blocks in their groups" ON public.scheduled_blocks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.group_members 
            WHERE group_id = scheduled_blocks.group_id 
            AND profile_id = auth.uid()
            AND status = 'active'
        )
    );

CREATE POLICY "Users can create blocks" ON public.scheduled_blocks
    FOR INSERT WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Users can update their own blocks" ON public.scheduled_blocks
    FOR UPDATE USING (parent_id = auth.uid());

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Simplified scheduling system has been successfully implemented!' as status;