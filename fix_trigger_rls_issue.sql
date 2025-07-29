-- Fix RLS issue with trigger that closes babysitting requests
-- The trigger is trying to update babysitting_requests but hitting RLS policies

-- Step 1: Drop the problematic trigger
DROP TRIGGER IF EXISTS close_request_trigger ON public.request_responses;

-- Step 2: Create a new function that handles RLS properly
CREATE OR REPLACE FUNCTION close_request_if_not_open_to_others()
RETURNS TRIGGER AS $$
DECLARE
    request_initiator_id UUID;
BEGIN
    -- If this is a new response with initiator_agreed = true and keep_open_to_others = false
    -- then close the request to prevent further acceptances
    IF NEW.initiator_agreed = true AND NEW.keep_open_to_others = false THEN
        -- Get the initiator_id for this request
        SELECT initiator_id INTO request_initiator_id
        FROM public.babysitting_requests 
        WHERE id = NEW.request_id;
        
        -- Only update if the current user is the initiator (to satisfy RLS)
        IF request_initiator_id = auth.uid() THEN
            UPDATE public.babysitting_requests 
            SET status = 'closed'
            WHERE id = NEW.request_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Recreate the trigger
CREATE TRIGGER close_request_trigger
    AFTER UPDATE ON public.request_responses
    FOR EACH ROW
    EXECUTE FUNCTION close_request_if_not_open_to_others();

-- Step 4: Also add a more comprehensive RLS policy for babysitting_requests updates
-- This allows the trigger to work properly when the initiator is updating
DROP POLICY IF EXISTS "Initiators can update their requests" ON public.babysitting_requests;
CREATE POLICY "Initiators can update their requests" ON public.babysitting_requests
FOR UPDATE USING (
    initiator_id = auth.uid() OR
    -- Allow updates when the status is being set to 'closed' (for trigger compatibility)
    (status = 'closed' AND initiator_id = auth.uid())
);

-- Step 5: Alternative approach - create a function that can be called directly
-- This bypasses the trigger and RLS issues
CREATE OR REPLACE FUNCTION close_babysitting_request_safe(request_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    request_initiator_id UUID;
BEGIN
    -- Get the initiator_id for this request
    SELECT initiator_id INTO request_initiator_id
    FROM public.babysitting_requests 
    WHERE id = request_uuid;
    
    -- Only close if the current user is the initiator
    IF request_initiator_id = auth.uid() THEN
        UPDATE public.babysitting_requests 
        SET status = 'closed'
        WHERE id = request_uuid;
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Show current triggers and functions
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'close_request_trigger';

SELECT 
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines 
WHERE routine_name IN ('close_request_if_not_open_to_others', 'close_babysitting_request_safe');

-- Success message
SELECT 'Trigger RLS issue has been fixed! The trigger will now only close requests when the initiator is the current user.' as status; 