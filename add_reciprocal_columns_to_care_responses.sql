-- Add missing reciprocal columns to care_responses table
-- These columns are needed for reciprocal care requests where the responder
-- provides details about when they need reciprocal care

ALTER TABLE public.care_responses 
ADD COLUMN IF NOT EXISTS reciprocal_date DATE,
ADD COLUMN IF NOT EXISTS reciprocal_start_time TIME,
ADD COLUMN IF NOT EXISTS reciprocal_end_time TIME,
ADD COLUMN IF NOT EXISTS reciprocal_child_id UUID REFERENCES public.children(id) ON DELETE SET NULL;

-- Add comments to document the purpose of these columns
COMMENT ON COLUMN public.care_responses.reciprocal_date IS 'Date when the responder needs reciprocal care';
COMMENT ON COLUMN public.care_responses.reciprocal_start_time IS 'Start time for reciprocal care';
COMMENT ON COLUMN public.care_responses.reciprocal_end_time IS 'End time for reciprocal care';
COMMENT ON COLUMN public.care_responses.reciprocal_child_id IS 'Child ID for whom reciprocal care is needed';

-- Verify the columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'care_responses' 
AND table_schema = 'public'
ORDER BY ordinal_position; 