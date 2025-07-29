-- Enhanced Multi-Child Care Management
-- This script implements the ability for additional parents to join existing care blocks
-- and offer reciprocal care times when Parent B keeps their care open to others

-- Drop existing view to prevent column type conflicts
DROP VIEW IF EXISTS public.multi_child_care_opportunities;

-- Drop existing functions to prevent parameter name conflicts
DROP FUNCTION IF EXISTS public.join_existing_care_block(UUID, UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, UUID);
DROP FUNCTION IF EXISTS public.agree_to_additional_reciprocal(UUID);
DROP FUNCTION IF EXISTS public.get_available_children_for_joining_care(UUID);
DROP FUNCTION IF EXISTS public.get_open_care_blocks_for_joining(UUID[]);

-- Function to get care blocks that are open to accepting additional children
CREATE OR REPLACE FUNCTION public.get_open_care_blocks_for_joining(
    user_group_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
    care_block_id UUID,
    group_id UUID,
    group_name TEXT,
    original_child_name TEXT,
    original_parent_name TEXT,
    care_start_time TIMESTAMP WITH TIME ZONE,
    care_end_time TIMESTAMP WITH TIME ZONE,
    current_children_count INTEGER,
    max_children_count INTEGER,
    available_children_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sb.id as care_block_id,
        sb.group_id,
        g.name as group_name,
        c.full_name as original_child_name,
        p.full_name as original_parent_name,
        sb.start_time as care_start_time,
        sb.end_time as care_end_time,
        COALESCE(COUNT(sb2.id), 0)::INTEGER as current_children_count,
        5 as max_children_count,
        (5 - COALESCE(COUNT(sb2.id), 0))::INTEGER as available_children_count
    FROM public.scheduled_blocks sb
    JOIN public.groups g ON sb.group_id = g.id
    JOIN public.children c ON sb.child_id = c.id
    JOIN public.profiles p ON c.parent_id = p.id
    LEFT JOIN public.scheduled_blocks sb2 ON sb2.request_id = sb.request_id AND sb2.block_type = 'care_needed'
    JOIN public.request_responses rr ON sb.response_id = rr.id
    WHERE sb.block_type = 'care_providing'
    AND rr.keep_open_to_others = true
    AND rr.initiator_agreed = true
    AND sb.start_time > NOW()
    AND (
        user_group_ids IS NULL 
        OR sb.group_id = ANY(user_group_ids)
    )
    GROUP BY sb.id, sb.group_id, g.name, c.full_name, p.full_name, sb.start_time, sb.end_time
    HAVING COALESCE(COUNT(sb2.id), 0) < 5;  -- Only show blocks that haven't reached the limit
END;
$$;

-- Function to get children available to join a specific care block
CREATE OR REPLACE FUNCTION public.get_available_children_for_joining_care(
    care_block_id UUID
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
    care_block RECORD;
BEGIN
    -- Get the care block details
    SELECT * INTO care_block FROM public.scheduled_blocks WHERE id = care_block_id;
    
    RETURN QUERY
    SELECT 
        c.id as child_id,
        c.full_name as child_name,
        c.parent_id,
        p.full_name as parent_name
    FROM public.children c
    JOIN public.profiles p ON c.parent_id = p.id
    JOIN public.child_group_members cgm ON c.id = cgm.child_id
    WHERE cgm.group_id = care_block.group_id
    AND c.parent_id != care_block.parent_id  -- Exclude the original care provider
    AND c.parent_id != (SELECT parent_id FROM public.children WHERE id = care_block.child_id)  -- Exclude the original care requester
    AND NOT EXISTS (  -- Exclude children already involved in this care block
        SELECT 1 FROM public.scheduled_blocks sb2
        WHERE sb2.request_id = care_block.request_id
        AND sb2.child_id = c.id
    )
    AND NOT EXISTS (  -- Exclude children with time conflicts
        SELECT 1 FROM public.scheduled_blocks sb3
        WHERE sb3.child_id = c.id
        AND sb3.id != care_block_id
        AND (sb3.start_time, sb3.end_time) OVERLAPS (care_block.start_time, care_block.end_time)
    );
END;
$$;

-- Function to allow a joining parent to create a response and a care_needed scheduled block for their child
CREATE OR REPLACE FUNCTION public.join_existing_care_block(
    care_block_id UUID,
    joining_child_id UUID,
    reciprocal_start_time TIMESTAMP WITH TIME ZONE,
    reciprocal_end_time TIMESTAMP WITH TIME ZONE,
    reciprocal_child_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    care_block RECORD;
    joining_parent_id UUID;
    response_id UUID;
    care_needed_block_id UUID;
BEGIN
    -- Get the care block details
    SELECT * INTO care_block FROM public.scheduled_blocks WHERE id = care_block_id;
    
    -- Get the joining parent's ID
    SELECT parent_id INTO joining_parent_id FROM public.children WHERE id = joining_child_id;
    
    -- Validate that the joining parent is a member of the same group
    IF NOT EXISTS (
        SELECT 1 FROM public.group_members 
        WHERE group_id = care_block.group_id AND user_id = joining_parent_id
    ) THEN
        RAISE EXCEPTION 'Joining parent is not a member of the care block group';
    END IF;
    
    -- Validate that the joining child is active in the group
    IF NOT EXISTS (
        SELECT 1 FROM public.child_group_members 
        WHERE group_id = care_block.group_id AND child_id = joining_child_id
    ) THEN
        RAISE EXCEPTION 'Joining child is not a member of the care block group';
    END IF;
    
    -- Validate time conflicts for the joining child
    IF EXISTS (
        SELECT 1 FROM public.scheduled_blocks 
        WHERE child_id = joining_child_id 
        AND (
            (start_time, end_time) OVERLAPS (reciprocal_start_time, reciprocal_end_time)
            OR (start_time, end_time) OVERLAPS (care_block.start_time, care_block.end_time)
        )
    ) THEN
        RAISE EXCEPTION 'Time conflict detected for joining child';
    END IF;
    
    -- Create a response to the original request
    INSERT INTO public.request_responses (
        request_id,
        responder_id,
        response_type,
        reciprocal_start_time,
        reciprocal_end_time,
        reciprocal_child_id,
        keep_open_to_others
    ) VALUES (
        care_block.request_id,
        joining_parent_id,
        'agree',
        reciprocal_start_time,
        reciprocal_end_time,
        reciprocal_child_id,
        false  -- Additional joiners don't keep open to others
    ) RETURNING id INTO response_id;
    
    -- Create a care_needed block for the joining child
    INSERT INTO public.scheduled_blocks (
        child_id,
        parent_id,
        group_id,
        request_id,
        response_id,
        block_type,
        start_time,
        end_time,
        description
    ) VALUES (
        joining_child_id,
        joining_parent_id,
        care_block.group_id,
        care_block.request_id,
        response_id,
        'care_needed',
        care_block.start_time,
        care_block.end_time,
        'Joining existing care block'
    ) RETURNING id INTO care_needed_block_id;
    
    RETURN json_build_object(
        'success', true,
        'response_id', response_id,
        'care_needed_block_id', care_needed_block_id,
        'message', 'Successfully joined care block'
    );
END;
$$;

-- Function for Parent B (the original responder who kept care open) to agree to reciprocal offers from additional joining parents
CREATE OR REPLACE FUNCTION public.agree_to_additional_reciprocal(
    response_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    response RECORD;
    care_providing_block_id UUID;
BEGIN
    -- Get the response details
    SELECT * INTO response FROM public.request_responses WHERE id = response_id;
    
    -- Validate that the current user is the original responder (Parent B)
    IF response.responder_id != auth.uid() THEN
        RAISE EXCEPTION 'Only the original responder can agree to additional reciprocal offers';
    END IF;
    
    -- Update the response to mark it as agreed
    UPDATE public.request_responses 
    SET initiator_agreed = true 
    WHERE id = response_id;
    
    -- Create a care_needed block for Parent B's child (the original responder)
    INSERT INTO public.scheduled_blocks (
        child_id,
        parent_id,
        group_id,
        request_id,
        response_id,
        block_type,
        start_time,
        end_time,
        description
    ) VALUES (
        response.reciprocal_child_id,
        response.responder_id,
        (SELECT group_id FROM public.babysitting_requests WHERE id = response.request_id),
        response.request_id,
        response_id,
        'care_needed',
        response.reciprocal_start_time,
        response.reciprocal_end_time,
        'Reciprocal care from additional joiner'
    ) RETURNING id INTO care_providing_block_id;
    
    RETURN json_build_object(
        'success', true,
        'care_providing_block_id', care_providing_block_id,
        'message', 'Successfully agreed to additional reciprocal care'
    );
END;
$$;

-- View to summarize multi-child care opportunities
CREATE VIEW public.multi_child_care_opportunities AS
SELECT 
    ocb.care_block_id,
    ocb.group_id,
    ocb.group_name,
    ocb.original_child_name,
    ocb.original_parent_name,
    ocb.care_start_time,
    ocb.care_end_time,
    ocb.current_children_count,
    ocb.max_children_count,
    ocb.available_children_count,
    COUNT(ac.child_id)::INTEGER as available_children_for_joining
FROM public.get_open_care_blocks_for_joining() ocb
LEFT JOIN public.get_available_children_for_joining_care(ocb.care_block_id) ac ON true
GROUP BY 
    ocb.care_block_id,
    ocb.group_id,
    ocb.group_name,
    ocb.original_child_name,
    ocb.original_parent_name,
    ocb.care_start_time,
    ocb.care_end_time,
    ocb.current_children_count,
    ocb.max_children_count,
    ocb.available_children_count;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.join_existing_care_block(UUID, UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agree_to_additional_reciprocal(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_children_for_joining_care(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_open_care_blocks_for_joining(UUID[]) TO authenticated;
GRANT SELECT ON public.multi_child_care_opportunities TO authenticated; 