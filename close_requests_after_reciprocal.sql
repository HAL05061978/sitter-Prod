-- Add status field to babysitting_requests table to track when requests are closed
-- This allows us to prevent further acceptances when a reciprocal agreement is made without keeping it open to others

-- Step 1: Add status column to babysitting_requests table
ALTER TABLE public.babysitting_requests 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'completed'));

-- Step 2: Update existing requests to have 'active' status
UPDATE public.babysitting_requests 
SET status = 'active' 
WHERE status IS NULL;

-- Step 3: Create a function to close requests when reciprocal agreements are made
CREATE OR REPLACE FUNCTION close_request_if_not_open_to_others()
RETURNS TRIGGER AS $$
BEGIN
    -- If this is a new response with initiator_agreed = true and keep_open_to_others = false
    -- then close the request to prevent further acceptances
    IF NEW.initiator_agreed = true AND NEW.keep_open_to_others = false THEN
        UPDATE public.babysitting_requests 
        SET status = 'closed'
        WHERE id = NEW.request_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger to automatically close requests
DROP TRIGGER IF EXISTS close_request_trigger ON public.request_responses;
CREATE TRIGGER close_request_trigger
    AFTER UPDATE ON public.request_responses
    FOR EACH ROW
    EXECUTE FUNCTION close_request_if_not_open_to_others();

-- Step 5: Add RLS policy for the new status field
CREATE POLICY "Users can view request status" ON public.babysitting_requests
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = babysitting_requests.group_id
        AND profile_id = auth.uid()
        AND status = 'active'
    )
);

-- Success message
SELECT 'Request closing functionality has been added! Requests will now be closed when reciprocal agreements are made without keeping them open to others.' as status; 