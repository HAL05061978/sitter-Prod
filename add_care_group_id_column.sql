-- Add care_group_id column to scheduled_blocks table
-- This column is needed for linking related care blocks and showing all children in a care arrangement
-- Run this in your Supabase SQL editor

-- ============================================================================
-- STEP 1: Add care_group_id column to scheduled_blocks table
-- ============================================================================

-- Add care_group_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'scheduled_blocks' 
        AND column_name = 'care_group_id'
    ) THEN
        ALTER TABLE public.scheduled_blocks ADD COLUMN care_group_id UUID;
        RAISE NOTICE 'Added care_group_id column to scheduled_blocks table';
    ELSE
        RAISE NOTICE 'care_group_id column already exists in scheduled_blocks table';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Verify the column was added
-- ============================================================================

-- Check that the column exists
SELECT 
    'Column Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'scheduled_blocks' 
            AND column_name = 'care_group_id'
        ) THEN '✅ PASS: care_group_id column exists'
        ELSE '❌ FAIL: care_group_id column missing'
    END as status;

-- ============================================================================
-- STEP 3: Grant permissions (if needed)
-- ============================================================================

-- Make sure the column is accessible to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.scheduled_blocks TO authenticated;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'care_group_id column added successfully! The create_care_exchange function should now work properly.' as status; 