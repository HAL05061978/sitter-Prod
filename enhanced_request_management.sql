-- Enhanced Request Management for Multi-Child Care Efficiency
-- This script implements the logic where when keep_open_to_others is true,
-- a new request is created for additional children to be cared for by the responder

-- Step 1: Create a function to handle the "keep open to others" scenario
CREATE OR REPLACE FUNCTION create_additional_care_request()
RETURNS TRIGGER AS $$
DECLARE
    original_request RECORD;
    new_request_id UUID;
BEGIN
    -- If this is a new response with initiator_agreed = true and keep_open_to_others = true
    -- then create a new request for additional children to be cared for by the responder
    IF NEW.initiator_agreed = true AND NEW.keep_open_to_others = true THEN
        -- Get the original request details
        SELECT * INTO original_request 
        FROM public.babysitting_requests 
        WHERE id = NEW.request_id;
        
        -- Create a new request where the responder (Parent B) is now the initiator
        -- This request is for additional children to be cared for at the same time
        INSERT INTO public.babysitting_requests (
            group_id,
            initiator_id,
            child_id,
            requested_date,
            start_time,
            end_time,
            duration_minutes,
            notes,
            status
        ) VALUES (
            original_request.group_id,
            NEW.responder_id, -- Parent B becomes the initiator
            NEW.reciprocal_child_id, -- Parent B's child needs care
            NEW.reciprocal_date,
            NEW.reciprocal_start_time,
            NEW.reciprocal_end_time,
            original_request.duration_minutes, -- Same duration as original
            'Additional care request - Parent B can care for more children at this time',
            'active'
        ) RETURNING id INTO new_request_id;
        
        -- Update the original request to mark it as having spawned additional requests
        UPDATE public.babysitting_requests 
        SET notes = COALESCE(notes, '') || ' - Spawned additional care request for efficiency'
        WHERE id = NEW.request_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create trigger for the additional care request
DROP TRIGGER IF EXISTS create_additional_care_trigger ON public.request_responses;
CREATE TRIGGER create_additional_care_trigger
    AFTER UPDATE ON public.request_responses
    FOR EACH ROW
    EXECUTE FUNCTION create_additional_care_request();

-- Step 3: Enhance the existing close_request_if_not_open_to_others function
-- to also handle the case where keep_open_to_others is true but we want to close
-- the spawned request after the first additional agreement
CREATE OR REPLACE FUNCTION close_request_if_not_open_to_others()
RETURNS TRIGGER AS $$
BEGIN
    -- If this is a new response with initiator_agreed = true and keep_open_to_others = false
    -- then close the request to prevent further acceptances
    IF NEW.initiator_agreed = true AND NEW.keep_open_to_others = false THEN
        UPDATE public.babysitting_requests 
        SET status = 'closed'
        WHERE id = NEW.request_id;
    END IF;
    
    -- If this is a response to a spawned request (additional care request),
    -- always close it after the first agreement since it's for efficiency
    IF NEW.initiator_agreed = true AND EXISTS (
        SELECT 1 FROM public.babysitting_requests 
        WHERE id = NEW.request_id 
        AND notes LIKE '%Additional care request%'
    ) THEN
        UPDATE public.babysitting_requests 
        SET status = 'closed'
        WHERE id = NEW.request_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Add a function to get available children for additional care requests
-- This will help the frontend know which children can be included in additional requests
CREATE OR REPLACE FUNCTION get_available_children_for_additional_care(
    p_group_id UUID,
    p_exclude_parent_id UUID,
    p_care_date DATE,
    p_start_time TIME,
    p_end_time TIME
) RETURNS TABLE (
    child_id UUID,
    child_name TEXT,
    parent_id UUID,
    parent_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as child_id,
        c.full_name as child_name,
        c.parent_id,
        p.full_name as parent_name
    FROM public.children c
    JOIN public.profiles p ON c.parent_id = p.id
    JOIN public.child_group_members cgm ON c.id = cgm.child_id
    WHERE cgm.group_id = p_group_id
    AND c.parent_id != p_exclude_parent_id
    AND NOT EXISTS (
        -- Check if this child already has a scheduled block during this time
        SELECT 1 FROM public.scheduled_blocks sb
        WHERE sb.child_id = c.id
        AND sb.scheduled_date = p_care_date
        AND (
            (sb.start_time <= p_start_time AND sb.end_time > p_start_time) OR
            (sb.start_time < p_end_time AND sb.end_time >= p_end_time) OR
            (sb.start_time >= p_start_time AND sb.end_time <= p_end_time)
        )
        AND sb.status = 'confirmed'
    )
    ORDER BY p.full_name, c.full_name;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Add a function to create scheduled blocks for multiple children
-- This will be used when multiple children are cared for in one time slot
CREATE OR REPLACE FUNCTION create_multi_child_care_blocks(
    p_group_id UUID,
    p_care_provider_id UUID,
    p_care_date DATE,
    p_start_time TIME,
    p_end_time TIME,
    p_child_ids UUID[],
    p_request_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    child_id UUID;
    duration_minutes INTEGER;
BEGIN
    -- Calculate duration
    duration_minutes := EXTRACT(EPOCH FROM (p_end_time::time - p_start_time::time)) / 60;
    
    -- Create a care block for each child
    FOREACH child_id IN ARRAY p_child_ids
    LOOP
        INSERT INTO public.scheduled_blocks (
            group_id,
            request_id,
            parent_id,
            child_id,
            scheduled_date,
            start_time,
            end_time,
            duration_minutes,
            block_type,
            status,
            notes
        ) VALUES (
            p_group_id,
            p_request_id,
            child_id, -- The child's parent_id (who needs care)
            child_id, -- The child who needs care
            p_care_date,
            p_start_time,
            p_end_time,
            duration_minutes,
            'care_needed',
            'confirmed',
            'Multi-child care session'
        );
    END LOOP;
    
    -- Create one care_provided block for the provider
    INSERT INTO public.scheduled_blocks (
        group_id,
        request_id,
        parent_id,
        child_id,
        scheduled_date,
        start_time,
        end_time,
        duration_minutes,
        block_type,
        status,
        notes
    ) VALUES (
        p_group_id,
        p_request_id,
        p_care_provider_id,
        p_child_ids[1], -- Use first child as representative
        p_care_date,
        p_start_time,
        p_end_time,
        duration_minutes,
        'care_provided',
        'confirmed',
        'Providing care for multiple children'
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Success message
SELECT 'Enhanced request management has been added! The system now supports multi-child care efficiency where parents can care for multiple children in one time slot.' as status; 