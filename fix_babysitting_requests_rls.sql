-- Fix RLS policies for babysitting_requests table
-- This script addresses the issue where initiators can't update request_responses when agreeing to reciprocal care

-- First, let's check if the initiator update policy exists and add it if missing
DO $$
BEGIN
    -- Check if the policy exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'request_responses' 
        AND policyname = 'Initiators can update responses to their requests'
    ) THEN
        -- Add the missing policy
        CREATE POLICY "Initiators can update responses to their requests" ON public.request_responses
        FOR UPDATE USING (
            EXISTS (
                SELECT 1 FROM public.babysitting_requests
                WHERE id = request_responses.request_id
                AND initiator_id = auth.uid()
            )
        );
        
        RAISE NOTICE 'Added missing policy: Initiators can update responses to their requests';
    ELSE
        RAISE NOTICE 'Policy "Initiators can update responses to their requests" already exists';
    END IF;
END $$;

-- Also ensure we have the basic policies for babysitting_requests
DO $$
BEGIN
    -- Check if the basic policies exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'babysitting_requests' 
        AND policyname = 'Users can view requests in their groups'
    ) THEN
        CREATE POLICY "Users can view requests in their groups" ON public.babysitting_requests
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.group_members
                WHERE group_id = babysitting_requests.group_id
                AND profile_id = auth.uid()
                AND status = 'active'
            )
        );
        RAISE NOTICE 'Added missing policy: Users can view requests in their groups';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'babysitting_requests' 
        AND policyname = 'Users can create requests in their groups'
    ) THEN
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
        RAISE NOTICE 'Added missing policy: Users can create requests in their groups';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'babysitting_requests' 
        AND policyname = 'Initiators can update their requests'
    ) THEN
        CREATE POLICY "Initiators can update their requests" ON public.babysitting_requests
        FOR UPDATE USING (initiator_id = auth.uid());
        RAISE NOTICE 'Added missing policy: Initiators can update their requests';
    END IF;
END $$;

-- Show current policies for reference
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('babysitting_requests', 'request_responses')
ORDER BY tablename, policyname;

-- Success message
SELECT 'RLS policies for babysitting_requests and request_responses have been verified and fixed!' as status; 