-- Schedule Database Schema for Sitter Application
-- Run this script in your Supabase SQL Editor to create the scheduling tables

-- 1. Babysitting Requests Table
CREATE TABLE IF NOT EXISTS public.babysitting_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    initiator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    requested_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL, -- Calculated field for convenience
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Ensure end_time is after start_time
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- 2. Request Responses Table
CREATE TABLE IF NOT EXISTS public.request_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.babysitting_requests(id) ON DELETE CASCADE,
    responder_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    response_type TEXT NOT NULL CHECK (response_type IN ('agree', 'counter', 'reject')),
    counter_date DATE, -- Only used for counter responses
    counter_start_time TIME, -- Only used for counter responses
    counter_end_time TIME, -- Only used for counter responses
    counter_duration_minutes INTEGER, -- Only used for counter responses
    notes TEXT, -- For reject reasons or counter explanations
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Ensure counter times are valid if provided
    CONSTRAINT valid_counter_time_range CHECK (
        (response_type != 'counter') OR 
        (counter_date IS NOT NULL AND counter_start_time IS NOT NULL AND counter_end_time IS NOT NULL AND counter_end_time > counter_start_time)
    ),
    -- Ensure user can only respond once per request
    UNIQUE(request_id, responder_id)
);

-- 3. Scheduled Time Blocks Table
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
    is_open_to_others BOOLEAN DEFAULT false, -- Whether this block is open to other parents
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Ensure end_time is after start_time
    CONSTRAINT valid_block_time_range CHECK (end_time > start_time)
);

-- 4. Block Connections Table (for linking related blocks)
CREATE TABLE IF NOT EXISTS public.block_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_block_id UUID NOT NULL REFERENCES public.scheduled_blocks(id) ON DELETE CASCADE,
    connected_block_id UUID NOT NULL REFERENCES public.scheduled_blocks(id) ON DELETE CASCADE,
    connection_type TEXT NOT NULL CHECK (connection_type IN ('exchange', 'linked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(primary_block_id, connected_block_id)
);

-- Function to check for time conflicts
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
    -- Check for overlapping blocks for the same parent on the same date
    SELECT EXISTS(
        SELECT 1 FROM public.scheduled_blocks
        WHERE parent_id = p_parent_id
        AND scheduled_date = p_scheduled_date
        AND status = 'confirmed'
        AND (
            (p_exclude_block_id IS NULL OR id != p_exclude_block_id) AND
            (
                -- New block starts during existing block
                (p_start_time >= start_time AND p_start_time < end_time) OR
                -- New block ends during existing block
                (p_end_time > start_time AND p_end_time <= end_time) OR
                -- New block completely contains existing block
                (p_start_time <= start_time AND p_end_time >= end_time)
            )
        )
    ) INTO conflict_exists;
    
    RETURN conflict_exists;
END;
$$ LANGUAGE plpgsql;

-- Function to validate and insert a scheduled block
CREATE OR REPLACE FUNCTION insert_scheduled_block_with_validation(
    p_group_id UUID,
    p_request_id UUID,
    p_parent_id UUID,
    p_child_id UUID,
    p_scheduled_date DATE,
    p_start_time TIME,
    p_end_time TIME,
    p_duration_minutes INTEGER,
    p_block_type TEXT,
    p_is_open_to_others BOOLEAN DEFAULT false,
    p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    new_block_id UUID;
    has_conflicts BOOLEAN;
BEGIN
    -- Check for time conflicts
    SELECT check_time_conflicts(p_parent_id, p_scheduled_date, p_start_time, p_end_time) INTO has_conflicts;
    
    IF has_conflicts THEN
        RAISE EXCEPTION 'Time conflict detected: You already have a scheduled block during this time period';
    END IF;
    
    -- Insert the block if no conflicts
    INSERT INTO public.scheduled_blocks (
        group_id, request_id, parent_id, child_id, scheduled_date, 
        start_time, end_time, duration_minutes, block_type, 
        is_open_to_others, notes
    ) VALUES (
        p_group_id, p_request_id, p_parent_id, p_child_id, p_scheduled_date,
        p_start_time, p_end_time, p_duration_minutes, p_block_type,
        p_is_open_to_others, p_notes
    ) RETURNING id INTO new_block_id;
    
    RETURN new_block_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update a scheduled block with conflict checking
CREATE OR REPLACE FUNCTION update_scheduled_block_with_validation(
    p_block_id UUID,
    p_scheduled_date DATE,
    p_start_time TIME,
    p_end_time TIME,
    p_duration_minutes INTEGER,
    p_is_open_to_others BOOLEAN,
    p_notes TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    block_parent_id UUID;
    has_conflicts BOOLEAN;
BEGIN
    -- Get the parent_id for this block
    SELECT parent_id INTO block_parent_id FROM public.scheduled_blocks WHERE id = p_block_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Scheduled block not found';
    END IF;
    
    -- Check for time conflicts (excluding the current block)
    SELECT check_time_conflicts(block_parent_id, p_scheduled_date, p_start_time, p_end_time, p_block_id) INTO has_conflicts;
    
    IF has_conflicts THEN
        RAISE EXCEPTION 'Time conflict detected: You already have a scheduled block during this time period';
    END IF;
    
    -- Update the block if no conflicts
    UPDATE public.scheduled_blocks SET
        scheduled_date = p_scheduled_date,
        start_time = p_start_time,
        end_time = p_end_time,
        duration_minutes = p_duration_minutes,
        is_open_to_others = p_is_open_to_others,
        notes = p_notes,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_block_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE public.babysitting_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.block_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for babysitting_requests
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

-- RLS Policies for request_responses
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

-- RLS Policies for block_connections
CREATE POLICY "Users can view connections for blocks in their groups" ON public.block_connections
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.scheduled_blocks sb
            JOIN public.group_members gm ON sb.group_id = gm.group_id
            WHERE (sb.id = block_connections.primary_block_id OR sb.id = block_connections.connected_block_id)
            AND gm.profile_id = auth.uid()
            AND gm.status = 'active'
        )
    );

CREATE POLICY "Users can create connections for their blocks" ON public.block_connections
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.scheduled_blocks 
            WHERE id = block_connections.primary_block_id 
            AND parent_id = auth.uid()
        )
    );

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.babysitting_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.request_responses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.block_connections;

-- Create indexes for better performance
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
SELECT 'Schedule database schema created successfully with conflict validation!' as status; 