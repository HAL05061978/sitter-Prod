-- Add reciprocal care fields to request_responses table
-- These fields are needed for the two-step agreement process

-- Add new columns for reciprocal care
ALTER TABLE public.request_responses 
ADD COLUMN IF NOT EXISTS reciprocal_date DATE,
ADD COLUMN IF NOT EXISTS reciprocal_start_time TIME,
ADD COLUMN IF NOT EXISTS reciprocal_end_time TIME,
ADD COLUMN IF NOT EXISTS reciprocal_duration_minutes INTEGER,
ADD COLUMN IF NOT EXISTS reciprocal_child_id UUID REFERENCES public.children(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS keep_open_to_others BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS initiator_agreed BOOLEAN DEFAULT false;

-- Drop constraint if it exists, then add it
DO $$ 
BEGIN
    -- Drop the constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'valid_reciprocal_time_range' 
        AND table_name = 'request_responses'
    ) THEN
        ALTER TABLE public.request_responses DROP CONSTRAINT valid_reciprocal_time_range;
    END IF;
    
    -- Add the constraint
    ALTER TABLE public.request_responses 
    ADD CONSTRAINT valid_reciprocal_time_range CHECK (
        (response_type != 'agree') OR
        (reciprocal_date IS NOT NULL AND reciprocal_start_time IS NOT NULL AND reciprocal_end_time IS NOT NULL AND reciprocal_end_time > reciprocal_start_time)
    );
END $$;

-- Success message
SELECT 'Reciprocal care fields added to request_responses table successfully!' as status; 