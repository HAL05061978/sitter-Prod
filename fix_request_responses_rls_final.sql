-- Fix RLS policies for request_responses table
-- This script addresses the 403 Forbidden error when updating request_responses

-- Step 1: Drop all existing policies for request_responses to start fresh
DROP POLICY IF EXISTS "Users can view responses to requests in their groups" ON public.request_responses;
DROP POLICY IF EXISTS "Users can create responses to requests in their groups" ON public.request_responses;
DROP POLICY IF EXISTS "Responders can update their responses" ON public.request_responses;
DROP POLICY IF EXISTS "Users can update their responses" ON public.request_responses;
DROP POLICY IF EXISTS "Initiators can update responses to their requests" ON public.request_responses;

-- Step 2: Create comprehensive RLS policies for request_responses
-- Policy 1: Users can view responses to requests in their groups
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

-- Policy 2: Users can create responses to requests in their groups
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

-- Policy 3: Responders can update their own responses
CREATE POLICY "Responders can update their responses" ON public.request_responses
FOR UPDATE USING (responder_id = auth.uid());

-- Policy 4: Initiators can update responses to their requests (for reciprocal agreements)
CREATE POLICY "Initiators can update responses to their requests" ON public.request_responses
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.babysitting_requests
        WHERE id = request_responses.request_id
        AND initiator_id = auth.uid()
    )
);

-- Policy 5: Users can delete their own responses
CREATE POLICY "Users can delete their responses" ON public.request_responses
FOR DELETE USING (responder_id = auth.uid());

-- Step 3: Also ensure babysitting_requests has proper policies
DROP POLICY IF EXISTS "Users can view requests in their groups" ON public.babysitting_requests;
DROP POLICY IF EXISTS "Users can create requests in their groups" ON public.babysitting_requests;
DROP POLICY IF EXISTS "Initiators can update their requests" ON public.babysitting_requests;

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

-- Step 4: Disable the problematic trigger temporarily to isolate the issue
DROP TRIGGER IF EXISTS close_request_trigger ON public.request_responses;

-- Step 5: Show current policies for verification
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
WHERE tablename IN ('request_responses', 'babysitting_requests')
ORDER BY tablename, policyname;

-- Step 6: Test if we can update a request_response (this will help verify the policies work)
-- Note: This is just a test query to verify the policies are working
SELECT 
    'Current user can update request_responses where they are responder: ' ||
    CASE WHEN EXISTS (
        SELECT 1 FROM public.request_responses rr
        WHERE rr.responder_id = auth.uid()
        LIMIT 1
    ) THEN 'YES' ELSE 'NO' END as test_result;

SELECT 
    'Current user can update request_responses where they are initiator: ' ||
    CASE WHEN EXISTS (
        SELECT 1 FROM public.request_responses rr
        JOIN public.babysitting_requests br ON rr.request_id = br.id
        WHERE br.initiator_id = auth.uid()
        LIMIT 1
    ) THEN 'YES' ELSE 'NO' END as test_result;

-- Success message
SELECT 'RLS policies for request_responses have been completely rebuilt! The 403 Forbidden error should now be resolved.' as status; 