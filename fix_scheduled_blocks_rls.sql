-- Fix RLS policies for scheduled_blocks table
-- This script adds proper RLS policies to allow users to create and manage their scheduled blocks

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own scheduled blocks" ON public.scheduled_blocks;
DROP POLICY IF EXISTS "Users can insert their own scheduled blocks" ON public.scheduled_blocks;
DROP POLICY IF EXISTS "Users can update their own scheduled blocks" ON public.scheduled_blocks;
DROP POLICY IF EXISTS "Users can delete their own scheduled blocks" ON public.scheduled_blocks;

-- Create new policies for scheduled_blocks
-- Users can view blocks where they are the parent_id (either providing or needing care)
CREATE POLICY "Users can view their own scheduled blocks" ON public.scheduled_blocks
FOR SELECT USING (auth.uid() = parent_id);

-- Users can insert blocks where they are the parent_id
CREATE POLICY "Users can insert their own scheduled blocks" ON public.scheduled_blocks
FOR INSERT WITH CHECK (auth.uid() = parent_id);

-- Users can update blocks where they are the parent_id
CREATE POLICY "Users can update their own scheduled blocks" ON public.scheduled_blocks
FOR UPDATE USING (auth.uid() = parent_id);

-- Users can delete blocks where they are the parent_id
CREATE POLICY "Users can delete their own scheduled blocks" ON public.scheduled_blocks
FOR DELETE USING (auth.uid() = parent_id);

-- Success message
SELECT 'RLS policies for scheduled_blocks table have been updated successfully!' as status; 