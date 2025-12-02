-- =====================================================
-- PHASE 1 STEP 1: Add reciprocal_end_date to pet_care_responses
-- =====================================================
-- This is a NON-BREAKING change that adds support for multi-day
-- reciprocal pet care offers without affecting existing functionality.
--
-- SAFETY: This is completely safe because:
-- - Adding a nullable column doesn't break existing queries
-- - Existing single-day responses continue to work (NULL = same day)
-- - No data migration needed
-- =====================================================

-- Add the reciprocal_end_date column
ALTER TABLE pet_care_responses
ADD COLUMN IF NOT EXISTS reciprocal_end_date DATE;

-- Add a comment to document the field
COMMENT ON COLUMN pet_care_responses.reciprocal_end_date IS
'End date for multi-day reciprocal pet care offers. If NULL, reciprocal care is single-day (same as reciprocal_date).';

-- Verify the column was added
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'pet_care_responses'
        AND column_name = 'reciprocal_end_date'
    ) THEN
        RAISE NOTICE '✅ Column reciprocal_end_date added successfully to pet_care_responses';
    ELSE
        RAISE EXCEPTION '❌ Failed to add reciprocal_end_date column';
    END IF;
END;
$$;
