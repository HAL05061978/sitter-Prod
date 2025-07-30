-- Simplified Scheduling Schema with Reciprocal Support
-- This replaces the complex 6-table system with a clean 3-table system
-- Includes reciprocal functionality and opening time blocks to other group members

-- ============================================================================
-- STEP 1: CREATE SIMPLIFIED SCHEDULING TABLES
-- ============================================================================

-- Table 1: Care Requests (replaces babysitting_requests + request_responses + group_invitations)
CREATE TABLE IF NOT EXISTS public.care_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    requested_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (end_time - start_time)) / 60
    ) STORED,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'cancelled')),
    responder_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Who accepted the request
    response_notes TEXT, -- Notes from the responder
    
    -- RECIPROCAL SUPPORT
    is_reciprocal BOOLEAN DEFAULT false, -- Whether this is a reciprocal request
    reciprocal_care_id UUID REFERENCES public.scheduled_care(id) ON DELETE SET NULL, -- Links to reciprocal care block
    reciprocal_parent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Who will provide reciprocal care
    reciprocal_child_id UUID REFERENCES public.children(id) ON DELETE SET NULL, -- Child for reciprocal care
    reciprocal_date DATE, -- Date for reciprocal care
    reciprocal_start_time TIME, -- Start time for reciprocal care
    reciprocal_end_time TIME, -- End time for reciprocal care
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Ensure end_time is after start_time
    CONSTRAINT valid_request_time_range CHECK (end_time > start_time)
);

-- Table 2: Scheduled Care (replaces scheduled_blocks + block_connections)
CREATE TABLE IF NOT EXISTS public.scheduled_care (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    care_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (end_time - start_time)) / 60
    ) STORED,
    care_type TEXT NOT NULL CHECK (care_type IN ('needed', 'provided')),
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'completed', 'cancelled')),
    related_request_id UUID REFERENCES public.care_requests(id) ON DELETE SET NULL,
    notes TEXT,
    
    -- OPENING TO OTHERS SUPPORT
    is_open_to_others BOOLEAN DEFAULT false, -- Whether this block is open to other group members
    open_slots INTEGER DEFAULT 1, -- How many additional children can join
    current_slots_used INTEGER DEFAULT 0, -- How many additional children are currently scheduled
    
    -- EDITING SUPPORT FIELDS
    is_editable BOOLEAN DEFAULT true, -- Whether this block can be edited
    edit_deadline TIMESTAMP WITH TIME ZONE, -- Deadline for editing (e.g., 24 hours before)
    edit_reason TEXT, -- Reason for edit (optional)
    original_start_time TIME, -- Original start time (for audit trail)
    original_end_time TIME, -- Original end time (for audit trail)
    original_care_date DATE, -- Original care date (for audit trail)
    edited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Who made the edit
    edited_at TIMESTAMP WITH TIME ZONE, -- When the edit was made
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Ensure end_time is after start_time
    CONSTRAINT valid_care_time_range CHECK (end_time > start_time)
);

-- Table 3: Care Invitations (simplified version of group_invitations)
CREATE TABLE IF NOT EXISTS public.care_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    invitee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    care_block_id UUID NOT NULL REFERENCES public.scheduled_care(id) ON DELETE CASCADE,
    invitation_type TEXT NOT NULL CHECK (invitation_type IN ('reciprocal', 'join_open_block')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Ensure user can only be invited once per care block
    UNIQUE(care_block_id, invitee_id)
);

-- ============================================================================
-- STEP 2: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Indexes for care_requests
CREATE INDEX IF NOT EXISTS idx_care_requests_group_id ON public.care_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_care_requests_requester_id ON public.care_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_care_requests_responder_id ON public.care_requests(responder_id);
CREATE INDEX IF NOT EXISTS idx_care_requests_date ON public.care_requests(requested_date);
CREATE INDEX IF NOT EXISTS idx_care_requests_status ON public.care_requests(status);
CREATE INDEX IF NOT EXISTS idx_care_requests_reciprocal ON public.care_requests(is_reciprocal);

-- Indexes for scheduled_care
CREATE INDEX IF NOT EXISTS idx_scheduled_care_group_id ON public.scheduled_care(group_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_care_parent_id ON public.scheduled_care(parent_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_care_date ON public.scheduled_care(care_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_care_type ON public.scheduled_care(care_type);
CREATE INDEX IF NOT EXISTS idx_scheduled_care_status ON public.scheduled_care(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_care_parent_date ON public.scheduled_care(parent_id, care_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_care_editable ON public.scheduled_care(is_editable);
CREATE INDEX IF NOT EXISTS idx_scheduled_care_edit_deadline ON public.scheduled_care(edit_deadline);
CREATE INDEX IF NOT EXISTS idx_scheduled_care_open_to_others ON public.scheduled_care(is_open_to_others);

-- Indexes for care_invitations
CREATE INDEX IF NOT EXISTS idx_care_invitations_group_id ON public.care_invitations(group_id);
CREATE INDEX IF NOT EXISTS idx_care_invitations_inviter_id ON public.care_invitations(inviter_id);
CREATE INDEX IF NOT EXISTS idx_care_invitations_invitee_id ON public.care_invitations(invitee_id);
CREATE INDEX IF NOT EXISTS idx_care_invitations_care_block_id ON public.care_invitations(care_block_id);
CREATE INDEX IF NOT EXISTS idx_care_invitations_status ON public.care_invitations(status);

-- ============================================================================
-- STEP 3: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.care_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_care ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: CREATE RLS POLICIES
-- ============================================================================

-- RLS Policies for care_requests
CREATE POLICY "Users can view care requests in their groups" ON public.care_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = care_requests.group_id
            AND gm.profile_id = auth.uid()
        )
    );

CREATE POLICY "Users can create care requests in their groups" ON public.care_requests
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = care_requests.group_id
            AND gm.profile_id = auth.uid()
        )
        AND requester_id = auth.uid()
    );

CREATE POLICY "Users can update their own care requests" ON public.care_requests
    FOR UPDATE USING (requester_id = auth.uid())
    WITH CHECK (requester_id = auth.uid());

CREATE POLICY "Users can respond to care requests in their groups" ON public.care_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = care_requests.group_id
            AND gm.profile_id = auth.uid()
        )
        AND requester_id != auth.uid()
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = care_requests.group_id
            AND gm.profile_id = auth.uid()
        )
        AND requester_id != auth.uid()
    );

-- RLS Policies for scheduled_care
CREATE POLICY "Users can view scheduled care in their groups" ON public.scheduled_care
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = scheduled_care.group_id
            AND gm.profile_id = auth.uid()
        )
    );

CREATE POLICY "Users can create scheduled care in their groups" ON public.scheduled_care
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = scheduled_care.group_id
            AND gm.profile_id = auth.uid()
        )
        AND parent_id = auth.uid()
    );

CREATE POLICY "Users can update their own scheduled care" ON public.scheduled_care
    FOR UPDATE USING (parent_id = auth.uid())
    WITH CHECK (parent_id = auth.uid());

-- RLS Policies for care_invitations
CREATE POLICY "Users can view care invitations in their groups" ON public.care_invitations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = care_invitations.group_id
            AND gm.profile_id = auth.uid()
        )
    );

CREATE POLICY "Users can create care invitations in their groups" ON public.care_invitations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = care_invitations.group_id
            AND gm.profile_id = auth.uid()
        )
        AND inviter_id = auth.uid()
    );

CREATE POLICY "Users can respond to care invitations" ON public.care_invitations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = care_invitations.group_id
            AND gm.profile_id = auth.uid()
        )
        AND invitee_id = auth.uid()
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = care_invitations.group_id
            AND gm.profile_id = auth.uid()
        )
        AND invitee_id = auth.uid()
    );

-- ============================================================================
-- STEP 5: CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to check for time conflicts
CREATE OR REPLACE FUNCTION check_care_time_conflicts(
    p_parent_id UUID,
    p_care_date DATE,
    p_start_time TIME,
    p_end_time TIME,
    p_exclude_care_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    conflict_exists BOOLEAN := FALSE;
BEGIN
    -- Check for overlapping care blocks for the same parent on the same date
    SELECT EXISTS(
        SELECT 1 FROM public.scheduled_care
        WHERE parent_id = p_parent_id
        AND care_date = p_care_date
        AND status = 'confirmed'
        AND (
            (p_exclude_care_id IS NULL OR id != p_exclude_care_id) AND
            (
                (start_time < p_end_time AND end_time > p_start_time)
            )
        )
    ) INTO conflict_exists;
    
    RETURN conflict_exists;
END;
$$ LANGUAGE plpgsql;

-- Function to create scheduled care from a request
CREATE OR REPLACE FUNCTION accept_care_request(
    p_request_id UUID,
    p_responder_id UUID,
    p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_care_id UUID;
    v_request RECORD;
BEGIN
    -- Get the request details
    SELECT * INTO v_request FROM public.care_requests WHERE id = p_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Care request not found';
    END IF;
    
    IF v_request.status != 'pending' THEN
        RAISE EXCEPTION 'Care request is not pending';
    END IF;
    
    -- Check for time conflicts
    IF check_care_time_conflicts(p_responder_id, v_request.requested_date, v_request.start_time, v_request.end_time) THEN
        RAISE EXCEPTION 'Time conflict detected for the responder';
    END IF;
    
    -- Update the request
    UPDATE public.care_requests 
    SET status = 'accepted',
        responder_id = p_responder_id,
        response_notes = p_notes,
        updated_at = now()
    WHERE id = p_request_id;
    
    -- Create scheduled care block
    INSERT INTO public.scheduled_care (
        group_id,
        parent_id,
        child_id,
        care_date,
        start_time,
        end_time,
        care_type,
        related_request_id,
        notes,
        edit_deadline
    ) VALUES (
        v_request.group_id,
        p_responder_id,
        v_request.child_id,
        v_request.requested_date,
        v_request.start_time,
        v_request.end_time,
        'provided',
        p_request_id,
        p_notes,
        v_request.requested_date - INTERVAL '24 hours' -- 24 hour edit deadline
    ) RETURNING id INTO v_care_id;
    
    -- If this is a reciprocal request, create the reciprocal care block
    IF v_request.is_reciprocal AND v_request.reciprocal_parent_id IS NOT NULL THEN
        INSERT INTO public.scheduled_care (
            group_id,
            parent_id,
            child_id,
            care_date,
            start_time,
            end_time,
            care_type,
            related_request_id,
            notes,
            edit_deadline
        ) VALUES (
            v_request.group_id,
            v_request.reciprocal_parent_id,
            v_request.reciprocal_child_id,
            v_request.reciprocal_date,
            v_request.reciprocal_start_time,
            v_request.reciprocal_end_time,
            'provided',
            p_request_id,
            'Reciprocal care arrangement',
            v_request.reciprocal_date - INTERVAL '24 hours'
        );
    END IF;
    
    RETURN v_care_id;
END;
$$ LANGUAGE plpgsql;

-- Function to open a care block to other group members
CREATE OR REPLACE FUNCTION open_care_block_to_others(
    p_care_id UUID,
    p_open_slots INTEGER DEFAULT 1
) RETURNS BOOLEAN AS $$
DECLARE
    v_care RECORD;
BEGIN
    -- Get the care block details
    SELECT * INTO v_care FROM public.scheduled_care WHERE id = p_care_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Scheduled care not found';
    END IF;
    
    -- Update the care block to be open to others
    UPDATE public.scheduled_care 
    SET is_open_to_others = true,
        open_slots = p_open_slots,
        updated_at = now()
    WHERE id = p_care_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to join an open care block
CREATE OR REPLACE FUNCTION join_open_care_block(
    p_care_id UUID,
    p_joining_parent_id UUID,
    p_joining_child_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_care RECORD;
BEGIN
    -- Get the care block details
    SELECT * INTO v_care FROM public.scheduled_care WHERE id = p_care_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Scheduled care not found';
    END IF;
    
    IF NOT v_care.is_open_to_others THEN
        RAISE EXCEPTION 'This care block is not open to others';
    END IF;
    
    IF v_care.current_slots_used >= v_care.open_slots THEN
        RAISE EXCEPTION 'No available slots in this care block';
    END IF;
    
    -- Check for time conflicts for the joining parent
    IF check_care_time_conflicts(p_joining_parent_id, v_care.care_date, v_care.start_time, v_care.end_time) THEN
        RAISE EXCEPTION 'Time conflict detected for the joining parent';
    END IF;
    
    -- Create a new care block for the joining parent
    INSERT INTO public.scheduled_care (
        group_id,
        parent_id,
        child_id,
        care_date,
        start_time,
        end_time,
        care_type,
        notes
    ) VALUES (
        v_care.group_id,
        p_joining_parent_id,
        p_joining_child_id,
        v_care.care_date,
        v_care.start_time,
        v_care.end_time,
        'provided',
        'Joined open care block'
    );
    
    -- Update the slot count
    UPDATE public.scheduled_care 
    SET current_slots_used = current_slots_used + 1,
        updated_at = now()
    WHERE id = p_care_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to edit scheduled care
CREATE OR REPLACE FUNCTION edit_scheduled_care(
    p_care_id UUID,
    p_editor_id UUID,
    p_new_date DATE,
    p_new_start_time TIME,
    p_new_end_time TIME,
    p_edit_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_care RECORD;
BEGIN
    -- Get the care block details
    SELECT * INTO v_care FROM public.scheduled_care WHERE id = p_care_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Scheduled care not found';
    END IF;
    
    -- Check if the care block is editable
    IF NOT v_care.is_editable THEN
        RAISE EXCEPTION 'This care block is not editable';
    END IF;
    
    -- Check if we're past the edit deadline
    IF v_care.edit_deadline IS NOT NULL AND now() > v_care.edit_deadline THEN
        RAISE EXCEPTION 'Edit deadline has passed';
    END IF;
    
    -- Check for time conflicts with the new time
    IF check_care_time_conflicts(v_care.parent_id, p_new_date, p_new_start_time, p_new_end_time, p_care_id) THEN
        RAISE EXCEPTION 'Time conflict detected with the new schedule';
    END IF;
    
    -- Store original values if this is the first edit
    IF v_care.original_start_time IS NULL THEN
        UPDATE public.scheduled_care 
        SET original_start_time = v_care.start_time,
            original_end_time = v_care.end_time,
            original_care_date = v_care.care_date
        WHERE id = p_care_id;
    END IF;
    
    -- Update the care block
    UPDATE public.scheduled_care 
    SET care_date = p_new_date,
        start_time = p_new_start_time,
        end_time = p_new_end_time,
        edit_reason = p_edit_reason,
        edited_by = p_editor_id,
        edited_at = now(),
        updated_at = now()
    WHERE id = p_care_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 6: GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.care_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.scheduled_care TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.care_invitations TO authenticated;

-- ============================================================================
-- STEP 7: ENABLE REALTIME
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.care_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_care;
ALTER PUBLICATION supabase_realtime ADD TABLE public.care_invitations;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT '✅ Simplified scheduling schema with reciprocal support created successfully!' as status;
SELECT 'Tables created: care_requests, scheduled_care, care_invitations' as tables;
SELECT 'Features: Basic requests/responses, reciprocal care, open blocks, editing' as features; 