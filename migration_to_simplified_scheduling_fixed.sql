-- Migration to Simplified Scheduling System (FIXED)
-- This script safely transitions from the old 6-table system to the new 3-table system

-- ============================================================================
-- STEP 1: BACKUP EXISTING DATA (SAFETY FIRST)
-- ============================================================================

-- Create backup tables for existing data
CREATE TABLE IF NOT EXISTS backup_babysitting_requests AS 
SELECT * FROM public.babysitting_requests;

CREATE TABLE IF NOT EXISTS backup_request_responses AS 
SELECT * FROM public.request_responses;

CREATE TABLE IF NOT EXISTS backup_scheduled_blocks AS 
SELECT * FROM public.scheduled_blocks;

CREATE TABLE IF NOT EXISTS backup_block_connections AS 
SELECT * FROM public.block_connections;

CREATE TABLE IF NOT EXISTS backup_group_invitations AS 
SELECT * FROM public.group_invitations;

-- Check if invitation_time_blocks exists and backup if it does
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invitation_time_blocks') THEN
        EXECUTE 'CREATE TABLE IF NOT EXISTS backup_invitation_time_blocks AS SELECT * FROM public.invitation_time_blocks';
        RAISE NOTICE 'Backed up invitation_time_blocks table';
    ELSE
        RAISE NOTICE 'invitation_time_blocks table does not exist, skipping backup';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: CREATE NEW SIMPLIFIED TABLES
-- ============================================================================

-- Table 1: Care Requests (handles all request types)
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
    request_type TEXT NOT NULL CHECK (request_type IN ('simple', 'reciprocal', 'event', 'open_block')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'cancelled', 'expired')),
    responder_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Who accepted the request
    response_notes TEXT, -- Notes from the responder
    
    -- RECIPROCAL SUPPORT
    is_reciprocal BOOLEAN DEFAULT false, -- Whether this is a reciprocal request
    reciprocal_parent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Who will provide reciprocal care
    reciprocal_child_id UUID REFERENCES public.children(id) ON DELETE SET NULL, -- Child for reciprocal care
    reciprocal_date DATE, -- Date for reciprocal care
    reciprocal_start_time TIME, -- Start time for reciprocal care
    reciprocal_end_time TIME, -- End time for reciprocal care
    reciprocal_status TEXT DEFAULT 'pending' CHECK (reciprocal_status IN ('pending', 'accepted', 'declined')),
    
    -- OPEN BLOCK SUPPORT
    open_block_parent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Who opened the block
    open_block_slots INTEGER DEFAULT 1, -- How many slots available
    open_block_slots_used INTEGER DEFAULT 0, -- How many slots used
    
    -- EVENT SUPPORT
    event_title TEXT, -- For event requests
    event_description TEXT, -- For event requests
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE, -- When request expires
    -- Ensure end_time is after start_time
    CONSTRAINT valid_request_time_range CHECK (end_time > start_time)
);

-- Table 2: Scheduled Care (stores all confirmed care blocks)
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
    care_type TEXT NOT NULL CHECK (care_type IN ('needed', 'provided', 'event')),
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'completed', 'cancelled')),
    related_request_id UUID REFERENCES public.care_requests(id) ON DELETE SET NULL,
    notes TEXT,
    
    -- EDITING SUPPORT FIELDS
    is_editable BOOLEAN DEFAULT true, -- Whether this block can be edited
    edit_deadline TIMESTAMP WITH TIME ZONE, -- Deadline for editing (e.g., 24 hours before)
    edit_reason TEXT, -- Reason for edit (optional)
    original_start_time TIME, -- Original start time (for audit trail)
    original_end_time TIME, -- Original end time (for audit trail)
    original_care_date DATE, -- Original care date (for audit trail)
    edited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Who made the edit
    edited_at TIMESTAMP WITH TIME ZONE, -- When the edit was made
    
    -- GROUP EVENT SUPPORT
    event_title TEXT, -- For group events
    event_description TEXT, -- For group events
    is_group_event BOOLEAN DEFAULT false, -- Whether this is a group event
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Ensure end_time is after start_time
    CONSTRAINT valid_care_time_range CHECK (end_time > start_time)
);

-- Table 3: Care Responses (handles responses to requests)
CREATE TABLE IF NOT EXISTS public.care_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.care_requests(id) ON DELETE CASCADE,
    responder_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    response_type TEXT NOT NULL CHECK (response_type IN ('accept', 'decline', 'pending')),
    response_notes TEXT, -- Notes from the responder
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Ensure user can only respond once per request
    UNIQUE(request_id, responder_id)
);

-- ============================================================================
-- STEP 3: ADD MISSING FOREIGN KEY (AFTER BOTH TABLES EXIST)
-- ============================================================================

-- Add the reciprocal_care_id foreign key after both tables exist
ALTER TABLE public.care_requests 
ADD COLUMN IF NOT EXISTS reciprocal_care_id UUID REFERENCES public.scheduled_care(id) ON DELETE SET NULL;

-- ============================================================================
-- STEP 4: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Indexes for care_requests
CREATE INDEX IF NOT EXISTS idx_care_requests_group_id ON public.care_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_care_requests_requester_id ON public.care_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_care_requests_responder_id ON public.care_requests(responder_id);
CREATE INDEX IF NOT EXISTS idx_care_requests_date ON public.care_requests(requested_date);
CREATE INDEX IF NOT EXISTS idx_care_requests_status ON public.care_requests(status);
CREATE INDEX IF NOT EXISTS idx_care_requests_type ON public.care_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_care_requests_reciprocal ON public.care_requests(is_reciprocal);
CREATE INDEX IF NOT EXISTS idx_care_requests_expires_at ON public.care_requests(expires_at);

-- Indexes for scheduled_care
CREATE INDEX IF NOT EXISTS idx_scheduled_care_group_id ON public.scheduled_care(group_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_care_parent_id ON public.scheduled_care(parent_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_care_date ON public.scheduled_care(care_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_care_type ON public.scheduled_care(care_type);
CREATE INDEX IF NOT EXISTS idx_scheduled_care_status ON public.scheduled_care(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_care_parent_date ON public.scheduled_care(parent_id, care_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_care_editable ON public.scheduled_care(is_editable);
CREATE INDEX IF NOT EXISTS idx_scheduled_care_edit_deadline ON public.scheduled_care(edit_deadline);
CREATE INDEX IF NOT EXISTS idx_scheduled_care_group_event ON public.scheduled_care(is_group_event);

-- Indexes for care_responses
CREATE INDEX IF NOT EXISTS idx_care_responses_request_id ON public.care_responses(request_id);
CREATE INDEX IF NOT EXISTS idx_care_responses_responder_id ON public.care_responses(responder_id);
CREATE INDEX IF NOT EXISTS idx_care_responses_status ON public.care_responses(status);

-- ============================================================================
-- STEP 5: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.care_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_care ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_responses ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 6: CREATE RLS POLICIES
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

-- RLS Policies for care_responses
CREATE POLICY "Users can view care responses in their groups" ON public.care_responses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.care_requests cr
            JOIN public.group_members gm ON gm.group_id = cr.group_id
            WHERE cr.id = care_responses.request_id
            AND gm.profile_id = auth.uid()
        )
    );

CREATE POLICY "Users can create care responses" ON public.care_responses
    FOR INSERT WITH CHECK (
        responder_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.care_requests cr
            JOIN public.group_members gm ON gm.group_id = cr.group_id
            WHERE cr.id = care_responses.request_id
            AND gm.profile_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own care responses" ON public.care_responses
    FOR UPDATE USING (responder_id = auth.uid())
    WITH CHECK (responder_id = auth.uid());

-- ============================================================================
-- STEP 7: CREATE HELPER FUNCTIONS
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

-- Function to accept a care request
CREATE OR REPLACE FUNCTION accept_care_request(
    p_request_id UUID,
    p_responder_id UUID,
    p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_care_id UUID;
    v_request RECORD;
    v_response RECORD;
BEGIN
    -- Get the request details
    SELECT * INTO v_request FROM public.care_requests WHERE id = p_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Care request not found';
    END IF;
    
    IF v_request.status != 'pending' THEN
        RAISE EXCEPTION 'Care request is not pending';
    END IF;
    
    -- Check if responder has already responded
    SELECT * INTO v_response FROM public.care_responses 
    WHERE request_id = p_request_id AND responder_id = p_responder_id;
    
    IF FOUND AND v_response.status != 'pending' THEN
        RAISE EXCEPTION 'You have already responded to this request';
    END IF;
    
    -- Check for time conflicts
    IF check_care_time_conflicts(p_responder_id, v_request.requested_date, v_request.start_time, v_request.end_time) THEN
        RAISE EXCEPTION 'Time conflict detected for the responder';
    END IF;
    
    -- Update or create response
    IF FOUND THEN
        UPDATE public.care_responses 
        SET response_type = 'accept',
            response_notes = p_notes,
            status = 'accepted'
        WHERE request_id = p_request_id AND responder_id = p_responder_id;
    ELSE
        INSERT INTO public.care_responses (
            request_id,
            responder_id,
            response_type,
            response_notes,
            status
        ) VALUES (
            p_request_id,
            p_responder_id,
            'accept',
            p_notes,
            'accepted'
        );
    END IF;
    
    -- Update the request status
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
    
    -- Expire other responses
    UPDATE public.care_responses 
    SET status = 'expired'
    WHERE request_id = p_request_id 
    AND responder_id != p_responder_id
    AND status = 'pending';
    
    RETURN v_care_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create open block requests
CREATE OR REPLACE FUNCTION create_open_block_requests(
    p_care_id UUID,
    p_invited_parent_ids UUID[],
    p_slots_per_invite INTEGER DEFAULT 1
) RETURNS INTEGER AS $$
DECLARE
    v_care RECORD;
    v_invited_parent UUID;
    v_request_id UUID;
    v_slots_created INTEGER := 0;
BEGIN
    -- Get the care block details
    SELECT * INTO v_care FROM public.scheduled_care WHERE id = p_care_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Scheduled care not found';
    END IF;
    
    -- Create open block requests for each invited parent
    FOREACH v_invited_parent IN ARRAY p_invited_parent_ids
    LOOP
        -- Create a request for each slot
        FOR i IN 1..p_slots_per_invite LOOP
            INSERT INTO public.care_requests (
                group_id,
                requester_id,
                child_id,
                requested_date,
                start_time,
                end_time,
                notes,
                request_type,
                open_block_parent_id,
                open_block_slots,
                expires_at
            ) VALUES (
                v_care.group_id,
                v_invited_parent,
                v_care.child_id,
                v_care.care_date,
                v_care.start_time,
                v_care.end_time,
                'Open block invitation',
                'open_block',
                v_care.parent_id,
                1,
                now() + INTERVAL '24 hours'
            );
            
            v_slots_created := v_slots_created + 1;
        END LOOP;
    END LOOP;
    
    RETURN v_slots_created;
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
-- STEP 8: GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.care_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.scheduled_care TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.care_responses TO authenticated;

-- ============================================================================
-- STEP 9: ENABLE REALTIME
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.care_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_care;
ALTER PUBLICATION supabase_realtime ADD TABLE public.care_responses;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT '✅ Migration to simplified scheduling system completed successfully!' as status;
SELECT 'New tables: care_requests, scheduled_care, care_responses' as new_tables;
SELECT 'Backup tables created for safety' as backup_info;
SELECT 'All functions, indexes, and policies created' as setup_complete; 