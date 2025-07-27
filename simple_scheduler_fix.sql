-- Simple Scheduler Fix
-- This script will drop and recreate the scheduling tables to fix the initiator_id error

-- Step 1: Drop existing tables if they exist (in correct order due to foreign keys)
DROP TABLE IF EXISTS public.block_connections CASCADE;
DROP TABLE IF EXISTS public.scheduled_blocks CASCADE;
DROP TABLE IF EXISTS public.request_responses CASCADE;
DROP TABLE IF EXISTS public.babysitting_requests CASCADE;

-- Step 2: Create Babysitting Requests Table (this is the one causing the error)
CREATE TABLE public.babysitting_requests (
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

-- Step 3: Create Request Responses Table
CREATE TABLE public.request_responses (
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

-- Step 4: Create Scheduled Time Blocks Table
CREATE TABLE public.scheduled_blocks (
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

-- Step 5: Create Block Connections Table
CREATE TABLE public.block_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_block_id UUID NOT NULL REFERENCES public.scheduled_blocks(id) ON DELETE CASCADE,
    connected_block_id UUID NOT NULL REFERENCES public.scheduled_blocks(id) ON DELETE CASCADE,
    connection_type TEXT NOT NULL CHECK (connection_type IN ('exchange', 'linked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(primary_block_id, connected_block_id)
);

-- Step 6: Enable RLS
ALTER TABLE public.babysitting_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.block_connections ENABLE ROW LEVEL SECURITY;

-- Step 7: Create basic RLS policies
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

-- Step 8: Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.babysitting_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.request_responses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.block_connections;

-- Step 9: Verify the table was created correctly
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'babysitting_requests'
ORDER BY ordinal_position;

-- Success message
SELECT 'Scheduling tables created successfully! initiator_id column should now exist.' as status; 