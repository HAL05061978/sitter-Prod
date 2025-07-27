-- Step-by-Step Scheduler Setup
-- Run this script to add only the new scheduling functionality
-- This avoids conflicts with existing tables

-- Step 1: Create Babysitting Requests Table
CREATE TABLE IF NOT EXISTS public.babysitting_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    initiator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    requested_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Step 2: Create Request Responses Table
CREATE TABLE IF NOT EXISTS public.request_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.babysitting_requests(id) ON DELETE CASCADE,
    responder_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    response_type TEXT NOT NULL CHECK (response_type IN ('agree', 'counter', 'reject')),
    counter_date DATE,
    counter_start_time TIME,
    counter_end_time TIME,
    counter_duration_minutes INTEGER,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT valid_counter_time_range CHECK (
        (response_type != 'counter') OR
        (counter_date IS NOT NULL AND counter_start_time IS NOT NULL AND counter_end_time IS NOT NULL AND counter_end_time > counter_start_time)
    ),
    UNIQUE(request_id, responder_id)
);

-- Step 3: Create Scheduled Time Blocks Table
CREATE TABLE IF NOT EXISTS public.scheduled_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    request_id UUID REFERENCES public.babysitting_requests(id) ON DELETE SET NULL,
    parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL,
    block_type TEXT NOT NULL CHECK (block_type IN ('care_needed', 'care_provided')),
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'completed', 'cancelled')),
    is_open_to_others BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT valid_block_time_range CHECK (end_time > start_time)
);

-- Step 4: Create Block Connections Table
CREATE TABLE IF NOT EXISTS public.block_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_block_id UUID NOT NULL REFERENCES public.scheduled_blocks(id) ON DELETE CASCADE,
    connected_block_id UUID NOT NULL REFERENCES public.scheduled_blocks(id) ON DELETE CASCADE,
    connection_type TEXT NOT NULL CHECK (connection_type IN ('exchange', 'linked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(primary_block_id, connected_block_id)
);

-- Step 5: Create Validation Functions
CREATE OR REPLACE FUNCTION check_time_conflicts(
    p_parent_id UUID,
    p_scheduled_date DATE,
    p_start_time TIME,
    p_end_time TIME,
    p_exclude_block_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    conflict_exists BOOLEAN := FALSE;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM public.scheduled_blocks
        WHERE parent_id = p_parent_id
        AND scheduled_date = p_scheduled_date
        AND status = 'confirmed'
        AND (
            (p_exclude_block_id IS NULL OR id != p_exclude_block_id) AND
            (
                (p_start_time >= start_time AND p_start_time < end_time) OR
                (p_end_time > start_time AND p_end_time <= end_time) OR
                (p_start_time <= start_time AND p_end_time >= end_time)
            )
        )
    ) INTO conflict_exists;

    RETURN conflict_exists;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Enable RLS on new tables
ALTER TABLE public.babysitting_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.block_connections ENABLE ROW LEVEL SECURITY;

-- Step 7: Create RLS Policies for new tables
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

CREATE POLICY "Initiators can update their requests" ON public.babysitting_requests
    FOR UPDATE USING (initiator_id = auth.uid());

CREATE POLICY "Users can view responses to requests in their groups" ON public.request_responses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.babysitting_requests br
            JOIN public.group_members gm ON br.group_id = gm.group_id
            WHERE br.id = request_responses.request_id
            AND gm.profile_id = auth.uid()
            AND gm.status = 'active'
        )
    );

CREATE POLICY "Users can create responses to requests in their groups" ON public.request_responses
    FOR INSERT WITH CHECK (
        responder_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.babysitting_requests br
            JOIN public.group_members gm ON br.group_id = gm.group_id
            WHERE br.id = request_responses.request_id
            AND gm.profile_id = auth.uid()
            AND gm.status = 'active'
        )
    );

CREATE POLICY "Responders can update their responses" ON public.request_responses
    FOR UPDATE USING (responder_id = auth.uid());

CREATE POLICY "Users can view blocks in their groups" ON public.scheduled_blocks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_id = scheduled_blocks.group_id
            AND profile_id = auth.uid()
            AND status = 'active'
        )
    );

CREATE POLICY "Users can create blocks in their groups" ON public.scheduled_blocks
    FOR INSERT WITH CHECK (
        parent_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_id = scheduled_blocks.group_id
            AND profile_id = auth.uid()
            AND status = 'active'
        )
    );

CREATE POLICY "Parents can update their blocks" ON public.scheduled_blocks
    FOR UPDATE USING (parent_id = auth.uid());

-- Step 8: Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.babysitting_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.request_responses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.block_connections;

-- Step 9: Create indexes
CREATE INDEX IF NOT EXISTS idx_babysitting_requests_group_id ON public.babysitting_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_babysitting_requests_initiator_id ON public.babysitting_requests(initiator_id);
CREATE INDEX IF NOT EXISTS idx_babysitting_requests_date ON public.babysitting_requests(requested_date);
CREATE INDEX IF NOT EXISTS idx_request_responses_request_id ON public.request_responses(request_id);
CREATE INDEX IF NOT EXISTS idx_request_responses_responder_id ON public.request_responses(responder_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_blocks_group_id ON public.scheduled_blocks(group_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_blocks_parent_id ON public.scheduled_blocks(parent_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_blocks_date ON public.scheduled_blocks(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_blocks_parent_date ON public.scheduled_blocks(parent_id, scheduled_date);

-- Success message
SELECT 'Scheduling tables and functions created successfully!' as status; 