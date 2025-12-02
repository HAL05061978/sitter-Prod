-- =====================================================
-- FIX ACTION_TYPE CHECK CONSTRAINT
-- =====================================================
-- The care_requests table has a CHECK constraint that doesn't include
-- the new hangout_invitation and sleepover_invitation values

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
-- STEP 4: Fix scheduled_care care_type constraint if needed
-- =====================================================

ALTER TABLE scheduled_care
DROP CONSTRAINT IF EXISTS scheduled_care_care_type_check;

ALTER TABLE scheduled_care
ADD CONSTRAINT scheduled_care_care_type_check
CHECK (
  care_type IN (
    'provided',
    'received',
    'open_block',
    'event',
    'hangout',
    'sleepover'
  )
  OR care_type IS NULL
);

COMMENT ON CONSTRAINT care_requests_action_type_check ON care_requests IS 'Allows standard action types plus hangout_invitation and sleepover_invitation';
COMMENT ON CONSTRAINT care_requests_request_type_check ON care_requests IS 'Allows standard request types plus hangout and sleepover';
COMMENT ON CONSTRAINT scheduled_care_care_type_check ON scheduled_care IS 'Allows standard care types plus hangout and sleepover';
