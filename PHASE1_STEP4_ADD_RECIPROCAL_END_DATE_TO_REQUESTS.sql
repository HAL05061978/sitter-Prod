-- =====================================================
-- PHASE 1 STEP 4: Add reciprocal_end_date to pet_care_requests
-- =====================================================
-- The pet_care_requests table stores the AGREED reciprocal care
-- after a response is accepted. It needs reciprocal_end_date to
-- support multi-day reciprocal offers.
--
-- This mirrors how child care works:
-- - Requester creates request with requested_date/end_date
-- - Responder offers reciprocal_date/reciprocal_end_date
-- - When accepted, reciprocal details are stored in request table
-- =====================================================

-- Add the reciprocal_end_date column to pet_care_requests
ALTER TABLE pet_care_requests
ADD COLUMN IF NOT EXISTS reciprocal_end_date DATE;

-- Add a comment to document the field
COMMENT ON COLUMN pet_care_requests.reciprocal_end_date IS
'End date for the agreed reciprocal pet care. Populated when a response is accepted. If NULL, reciprocal care is single-day (same as reciprocal_date).';

-- Verify the column was added
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'pet_care_requests'
        AND column_name = 'reciprocal_end_date'
    ) THEN
        RAISE NOTICE '✅ Column reciprocal_end_date added successfully to pet_care_requests';
        RAISE NOTICE '';
        RAISE NOTICE 'SUMMARY: reciprocal_end_date now exists in:';
        RAISE NOTICE '  - pet_care_responses (for offers)';
        RAISE NOTICE '  - pet_care_requests (for agreed reciprocal after acceptance)';
    ELSE
        RAISE EXCEPTION '❌ Failed to add reciprocal_end_date column';
    END IF;
END;
$$;
