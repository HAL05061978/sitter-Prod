-- Fix RLS policies for scheduled_blocks table to allow reciprocal care workflow
-- This script addresses the issue where users can't create blocks for other parents during reciprocal agreements

-- First, drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can view their own scheduled blocks" ON public.scheduled_blocks;
DROP POLICY IF EXISTS "Users can insert their own scheduled blocks" ON public.scheduled_blocks;
DROP POLICY IF EXISTS "Users can update their own scheduled blocks" ON public.scheduled_blocks;
DROP POLICY IF EXISTS "Users can delete their own scheduled blocks" ON public.scheduled_blocks;
DROP POLICY IF EXISTS "Users can view blocks in their groups" ON public.scheduled_blocks;
DROP POLICY IF EXISTS "Users can create blocks in their groups" ON public.scheduled_blocks;
DROP POLICY IF EXISTS "Parents can update their blocks" ON public.scheduled_blocks;

-- Create comprehensive policies that allow the reciprocal care workflow

-- 1. Users can view blocks in their groups (for calendar display)
CREATE POLICY "Users can view blocks in their groups" ON public.scheduled_blocks
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.group_members 
        WHERE group_id = scheduled_blocks.group_id 
        AND profile_id = auth.uid()
        AND status = 'active'
    )
);

-- 2. Users can create blocks for themselves (normal case)
CREATE POLICY "Users can create blocks for themselves" ON public.scheduled_blocks
FOR INSERT WITH CHECK (
    parent_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.group_members 
        WHERE group_id = scheduled_blocks.group_id 
        AND profile_id = auth.uid()
        AND status = 'active'
    )
);

-- 3. Users can create blocks for other parents in reciprocal agreements
-- This is the key policy that was missing - it allows the initiator to create blocks for the responder
CREATE POLICY "Users can create reciprocal blocks" ON public.scheduled_blocks
FOR INSERT WITH CHECK (
    -- The user must be a member of the group
    EXISTS (
        SELECT 1 FROM public.group_members 
        WHERE group_id = scheduled_blocks.group_id 
        AND profile_id = auth.uid()
        AND status = 'active'
    ) AND
    -- The target parent must also be a member of the group
    EXISTS (
        SELECT 1 FROM public.group_members 
        WHERE group_id = scheduled_blocks.group_id 
        AND profile_id = scheduled_blocks.parent_id
        AND status = 'active'
    ) AND
    -- There must be an active babysitting request for this group
    EXISTS (
        SELECT 1 FROM public.babysitting_requests 
        WHERE id = scheduled_blocks.request_id 
        AND group_id = scheduled_blocks.group_id
        AND status = 'active'
    )
);

-- 4. Users can update their own blocks
CREATE POLICY "Users can update their own blocks" ON public.scheduled_blocks
FOR UPDATE USING (parent_id = auth.uid());

-- 5. Users can delete their own blocks
CREATE POLICY "Users can delete their own blocks" ON public.scheduled_blocks
FOR DELETE USING (parent_id = auth.uid());

-- Also ensure request_responses has the necessary policies for the reciprocal workflow
DROP POLICY IF EXISTS "Users can update their responses" ON public.request_responses;
CREATE POLICY "Users can update their responses" ON public.request_responses
FOR UPDATE USING (responder_id = auth.uid());

-- Add a policy to allow initiators to update responses (for marking initiator_agreed)
CREATE POLICY "Initiators can update responses to their requests" ON public.request_responses
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.babysitting_requests 
        WHERE id = request_responses.request_id 
        AND initiator_id = auth.uid()
    )
);

-- Success message
SELECT 'RLS policies for scheduled_blocks have been updated to support reciprocal care workflow!' as status; 