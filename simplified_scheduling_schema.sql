-- Simplified Scheduling Schema
-- This replaces the complex 6-table system with a clean 2-table system

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
    related_care_id UUID REFERENCES public.scheduled_care(id) ON DELETE SET NULL, -- For linked care (exchanges)
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Ensure end_time is after start_time
    CONSTRAINT valid_care_time_range CHECK (end_time > start_time)
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

-- Indexes for scheduled_care
CREATE INDEX IF NOT EXISTS idx_scheduled_care_group_id ON public.scheduled_care(group_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_care_parent_id ON public.scheduled_care(parent_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_care_date ON public.scheduled_care(care_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_care_type ON public.scheduled_care(care_type);
CREATE INDEX IF NOT EXISTS idx_scheduled_care_status ON public.scheduled_care(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_care_parent_date ON public.scheduled_care(parent_id, care_date);

-- ============================================================================
-- STEP 3: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.care_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_care ENABLE ROW LEVEL SECURITY;

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
        notes
    ) VALUES (
        v_request.group_id,
        p_responder_id,
        v_request.child_id,
        v_request.requested_date,
        v_request.start_time,
        v_request.end_time,
        'provided',
        p_request_id,
        p_notes
    ) RETURNING id INTO v_care_id;
    
    RETURN v_care_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 6: GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.care_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.scheduled_care TO authenticated;

-- ============================================================================
-- STEP 7: ENABLE REALTIME
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.care_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_care;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT '✅ Simplified scheduling schema created successfully!' as status;
SELECT 'Tables created: care_requests, scheduled_care' as tables;
SELECT 'This replaces the complex 6-table system with a clean 2-table system.' as note; 