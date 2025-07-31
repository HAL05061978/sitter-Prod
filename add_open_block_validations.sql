-- Open Block Validation System
-- This adds comprehensive validation to prevent abuse and ensure proper limits

-- ============================================================================
-- STEP 1: ADD VALIDATION FUNCTIONS
-- ============================================================================

-- Function to get active children count for a group
CREATE OR REPLACE FUNCTION get_active_children_count(p_group_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    child_count INTEGER;
BEGIN
    SELECT COUNT(DISTINCT c.id) INTO child_count
    FROM public.children c
    JOIN public.group_members gm ON c.parent_id = gm.profile_id
    WHERE gm.group_id = p_group_id
    AND c.is_active = true; -- Assuming children have an is_active field
    
    RETURN COALESCE(child_count, 0);
END;
$$;

-- Function to check if a parent has already opened a block for a specific time
CREATE OR REPLACE FUNCTION check_existing_open_block(
    p_group_id UUID,
    p_parent_id UUID,
    p_date DATE,
    p_start_time TIME,
    p_end_time TIME
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    existing_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO existing_count
    FROM public.care_requests
    WHERE group_id = p_group_id
    AND open_block_parent_id = p_parent_id
    AND requested_date = p_date
    AND start_time = p_start_time
    AND end_time = p_end_time
    AND request_type = 'open_block'
    AND status IN ('pending', 'accepted');
    
    RETURN existing_count > 0;
END;
$$;

-- Function to get current open block usage for a specific time slot
CREATE OR REPLACE FUNCTION get_open_block_usage(
    p_group_id UUID,
    p_date DATE,
    p_start_time TIME,
    p_end_time TIME
)
RETURNS TABLE(
    total_slots INTEGER,
    used_slots INTEGER,
    available_slots INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(open_block_slots), 0) as total_slots,
        COALESCE(SUM(open_block_slots_used), 0) as used_slots,
        COALESCE(SUM(open_block_slots - open_block_slots_used), 0) as available_slots
    FROM public.care_requests
    WHERE group_id = p_group_id
    AND requested_date = p_date
    AND start_time = p_start_time
    AND end_time = p_end_time
    AND request_type = 'open_block'
    AND status IN ('pending', 'accepted');
END;
$$;

-- Function to validate open block creation
CREATE OR REPLACE FUNCTION validate_open_block_creation(
    p_group_id UUID,
    p_parent_id UUID,
    p_date DATE,
    p_start_time TIME,
    p_end_time TIME,
    p_slots INTEGER
)
RETURNS TABLE(
    is_valid BOOLEAN,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    active_children_count INTEGER;
    existing_open BOOLEAN;
    current_usage RECORD;
BEGIN
    -- Check if parent has already opened a block for this time
    SELECT check_existing_open_block(p_group_id, p_parent_id, p_date, p_start_time, p_end_time) INTO existing_open;
    
    IF existing_open THEN
        RETURN QUERY SELECT false, 'You have already opened a block for this time slot';
        RETURN;
    END IF;
    
    -- Get active children count for the group
    SELECT get_active_children_count(p_group_id) INTO active_children_count;
    
    -- Get current usage for this time slot
    SELECT * FROM get_open_block_usage(p_group_id, p_date, p_start_time, p_end_time) INTO current_usage;
    
    -- Validate slot count
    IF p_slots > active_children_count THEN
        RETURN QUERY SELECT false, format('Cannot open more slots (%s) than active children in group (%s)', p_slots, active_children_count);
        RETURN;
    END IF;
    
    -- Check if adding these slots would exceed the limit
    IF (current_usage.total_slots + p_slots) > active_children_count THEN
        RETURN QUERY SELECT false, format('Opening %s more slots would exceed the group limit of %s active children', p_slots, active_children_count);
        RETURN;
    END IF;
    
    -- All validations passed
    RETURN QUERY SELECT true, 'Valid open block request';
END;
$$;

-- ============================================================================
-- STEP 2: ADD TRIGGERS FOR AUTOMATIC VALIDATION
-- ============================================================================

-- Trigger function to validate open block creation
CREATE OR REPLACE FUNCTION validate_open_block_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    validation_result RECORD;
BEGIN
    -- Only validate open_block requests
    IF NEW.request_type = 'open_block' THEN
        SELECT * FROM validate_open_block_creation(
            NEW.group_id,
            NEW.open_block_parent_id,
            NEW.requested_date,
            NEW.start_time,
            NEW.end_time,
            NEW.open_block_slots
        ) INTO validation_result;
        
        IF NOT validation_result.is_valid THEN
            RAISE EXCEPTION 'Open block validation failed: %', validation_result.error_message;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger on care_requests table
DROP TRIGGER IF EXISTS validate_open_block_trigger ON public.care_requests;
CREATE TRIGGER validate_open_block_trigger
    BEFORE INSERT OR UPDATE ON public.care_requests
    FOR EACH ROW
    EXECUTE FUNCTION validate_open_block_trigger();

-- ============================================================================
-- STEP 3: ADD FUNCTIONS TO TRACK CHILD PARTICIPATION
-- ============================================================================

-- Function to check if a child is already participating in a time slot
CREATE OR REPLACE FUNCTION check_child_participation(
    p_child_id UUID,
    p_date DATE,
    p_start_time TIME,
    p_end_time TIME
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    participation_count INTEGER;
BEGIN
    -- Check scheduled care blocks
    SELECT COUNT(*) INTO participation_count
    FROM public.scheduled_care
    WHERE child_id = p_child_id
    AND care_date = p_date
    AND (
        (start_time <= p_start_time AND end_time > p_start_time) OR
        (start_time < p_end_time AND end_time >= p_end_time) OR
        (start_time >= p_start_time AND end_time <= p_end_time)
    )
    AND status = 'confirmed';
    
    -- Check pending care requests
    SELECT participation_count + COUNT(*) INTO participation_count
    FROM public.care_requests
    WHERE child_id = p_child_id
    AND requested_date = p_date
    AND (
        (start_time <= p_start_time AND end_time > p_start_time) OR
        (start_time < p_end_time AND end_time >= p_end_time) OR
        (start_time >= p_start_time AND end_time <= p_end_time)
    )
    AND status IN ('pending', 'accepted');
    
    RETURN participation_count > 0;
END;
$$;

-- Function to get available children for a specific open block
CREATE OR REPLACE FUNCTION get_available_children_for_open_block(
    p_group_id UUID,
    p_date DATE,
    p_start_time TIME,
    p_end_time TIME
)
RETURNS TABLE(
    child_id UUID,
    child_name TEXT,
    parent_id UUID,
    parent_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as child_id,
        c.full_name as child_name,
        p.id as parent_id,
        p.full_name as parent_name
    FROM public.children c
    JOIN public.profiles p ON c.parent_id = p.id
    JOIN public.group_members gm ON p.id = gm.profile_id
    WHERE gm.group_id = p_group_id
    AND c.is_active = true
    AND NOT check_child_participation(c.id, p_date, p_start_time, p_end_time)
    ORDER BY p.full_name, c.full_name;
END;
$$;

-- ============================================================================
-- STEP 4: ADD FUNCTION TO UPDATE SLOT USAGE
-- ============================================================================

-- Function to update open block slot usage when a response is accepted
CREATE OR REPLACE FUNCTION update_open_block_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- When a response is accepted, update the slot usage
    IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
        UPDATE public.care_requests
        SET open_block_slots_used = open_block_slots_used + 1
        WHERE id = NEW.request_id
        AND request_type = 'open_block';
    END IF;
    
    -- When a response is declined or cancelled, decrease slot usage
    IF (NEW.status = 'declined' OR NEW.status = 'cancelled') AND OLD.status = 'accepted' THEN
        UPDATE public.care_requests
        SET open_block_slots_used = GREATEST(open_block_slots_used - 1, 0)
        WHERE id = NEW.request_id
        AND request_type = 'open_block';
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger on care_responses table
DROP TRIGGER IF EXISTS update_open_block_usage_trigger ON public.care_responses;
CREATE TRIGGER update_open_block_usage_trigger
    AFTER UPDATE ON public.care_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_open_block_usage();

-- ============================================================================
-- STEP 5: ADD CONSTRAINTS TO ENFORCE LIMITS
-- ============================================================================

-- Add constraint to ensure slots_used never exceeds slots
ALTER TABLE public.care_requests 
ADD CONSTRAINT check_open_block_slots 
CHECK (open_block_slots_used <= open_block_slots);

-- Add constraint to ensure slots_used is never negative
ALTER TABLE public.care_requests 
ADD CONSTRAINT check_open_block_slots_used_positive 
CHECK (open_block_slots_used >= 0);

-- ============================================================================
-- STEP 6: ADD INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for checking existing open blocks
CREATE INDEX IF NOT EXISTS idx_care_requests_open_block_check 
ON public.care_requests(group_id, open_block_parent_id, requested_date, start_time, end_time, request_type, status);

-- Index for tracking slot usage
CREATE INDEX IF NOT EXISTS idx_care_requests_slot_usage 
ON public.care_requests(group_id, requested_date, start_time, end_time, request_type, status, open_block_slots, open_block_slots_used);

-- Index for child participation checks
CREATE INDEX IF NOT EXISTS idx_scheduled_care_child_time 
ON public.scheduled_care(child_id, care_date, start_time, end_time, status);

CREATE INDEX IF NOT EXISTS idx_care_requests_child_time 
ON public.care_requests(child_id, requested_date, start_time, end_time, status);

-- ============================================================================
-- STEP 7: ADD HELPER FUNCTIONS FOR FRONTEND
-- ============================================================================

-- Function to get open block statistics for a group
CREATE OR REPLACE FUNCTION get_open_block_stats(p_group_id UUID)
RETURNS TABLE(
    total_open_blocks INTEGER,
    total_slots_available INTEGER,
    total_slots_used INTEGER,
    active_children_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_open_blocks,
        COALESCE(SUM(open_block_slots), 0) as total_slots_available,
        COALESCE(SUM(open_block_slots_used), 0) as total_slots_used,
        get_active_children_count(p_group_id) as active_children_count
    FROM public.care_requests
    WHERE group_id = p_group_id
    AND request_type = 'open_block'
    AND status IN ('pending', 'accepted');
END;
$$;

-- Function to check if a user can open a block (for frontend validation)
CREATE OR REPLACE FUNCTION can_user_open_block(
    p_user_id UUID,
    p_group_id UUID,
    p_date DATE,
    p_start_time TIME,
    p_end_time TIME
)
RETURNS TABLE(
    can_open BOOLEAN,
    reason TEXT,
    active_children_count INTEGER,
    current_usage INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    active_children INTEGER;
    usage RECORD;
    existing_open BOOLEAN;
BEGIN
    -- Get active children count
    SELECT get_active_children_count(p_group_id) INTO active_children;
    
    -- Get current usage
    SELECT * FROM get_open_block_usage(p_group_id, p_date, p_start_time, p_end_time) INTO usage;
    
    -- Check if user already opened a block
    SELECT check_existing_open_block(p_group_id, p_user_id, p_date, p_start_time, p_end_time) INTO existing_open;
    
    IF existing_open THEN
        RETURN QUERY SELECT false, 'You have already opened a block for this time', active_children, usage.total_slots;
        RETURN;
    END IF;
    
    IF (usage.total_slots + 1) > active_children THEN
        RETURN QUERY SELECT false, format('Cannot open more slots. Group has %s active children, %s slots already open', active_children, usage.total_slots), active_children, usage.total_slots;
        RETURN;
    END IF;
    
    RETURN QUERY SELECT true, 'Can open block', active_children, usage.total_slots;
END;
$$; 