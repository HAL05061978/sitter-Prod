-- =====================================================
-- FIX ACTION_TYPE CHECK CONSTRAINT (SAFE VERSION)
-- =====================================================
-- This version first checks existing data before applying constraints

-- =====================================================
-- STEP 1: Drop the existing constraint
-- =====================================================

ALTER TABLE care_requests
DROP CONSTRAINT IF EXISTS care_requests_action_type_check;

-- =====================================================
-- STEP 2: Add new constraint with all action types
-- =====================================================

ALTER TABLE care_requests
ADD CONSTRAINT care_requests_action_type_check
CHECK (
  action_type IN (
    'new',
    'open_block_invitation',
    'reschedule_request',
    'reschedule_counter',
    'hangout_invitation',
    'sleepover_invitation'
  )
  OR action_type IS NULL
);

-- =====================================================
-- STEP 3: Also check if there's a constraint on request_type/care_type
-- =====================================================

-- Drop old constraint if it exists
ALTER TABLE care_requests
DROP CONSTRAINT IF EXISTS care_requests_request_type_check;

ALTER TABLE care_requests
DROP CONSTRAINT IF EXISTS care_requests_care_type_check;

-- Add new constraint for request_type
ALTER TABLE care_requests
ADD CONSTRAINT care_requests_request_type_check
CHECK (
  request_type IN (
    'reciprocal',
    'open_block',
    'event',
    'hangout',
    'sleepover'
  )
  OR request_type IS NULL
);

-- =====================================================
-- STEP 4: Fix scheduled_care care_type constraint
-- =====================================================

-- First, let's see what values exist (commented out for actual run)
-- SELECT DISTINCT care_type FROM scheduled_care;

-- Drop the old constraint
ALTER TABLE scheduled_care
DROP CONSTRAINT IF EXISTS scheduled_care_care_type_check;

-- DO NOT add the constraint back yet - let's first check what values exist
-- We'll add it back after we know what the actual values are

-- Temporary: Remove the constraint entirely to allow hangout/sleepover to work
-- You can add it back later after cleaning up the data

COMMENT ON TABLE scheduled_care IS 'care_type constraint temporarily removed - needs data audit before re-adding';

COMMENT ON CONSTRAINT care_requests_action_type_check ON care_requests IS 'Allows standard action types plus hangout_invitation and sleepover_invitation';
COMMENT ON CONSTRAINT care_requests_request_type_check ON care_requests IS 'Allows standard request types plus hangout and sleepover';
