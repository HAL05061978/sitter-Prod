-- Fix RLS Policies for request_responses table
-- This script adds the missing RLS policies that were not included in simple_scheduler_fix.sql

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view responses to requests in their groups" ON public.request_responses;
DROP POLICY IF EXISTS "Users can create responses to requests in their groups" ON public.request_responses;
DROP POLICY IF EXISTS "Responders can update their responses" ON public.request_responses;

-- Create RLS Policies for request_responses
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

-- Also add missing policies for scheduled_blocks and block_connections
DROP POLICY IF EXISTS "Users can view blocks in their groups" ON public.scheduled_blocks;
DROP POLICY IF EXISTS "Users can create blocks in their groups" ON public.scheduled_blocks;
DROP POLICY IF EXISTS "Parents can update their blocks" ON public.scheduled_blocks;

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

-- Add policies for block_connections
DROP POLICY IF EXISTS "Users can view connections for blocks in their groups" ON public.block_connections;
DROP POLICY IF EXISTS "Users can create connections for their blocks" ON public.block_connections;

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

-- Success message
SELECT 'RLS policies for request_responses and other scheduling tables have been created successfully!' as status; 