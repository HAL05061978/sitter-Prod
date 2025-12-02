-- =====================================================
-- ADD hangout_accepted TO NOTIFICATION TYPES
-- =====================================================
-- This adds the new notification type to the allowed values

-- Drop the existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add the new constraint with hangout_accepted included
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
CHECK (type IN (
    'care_request',
    'care_response',
    'care_accepted',
    'care_declined',
    'group_invitation',
    'event_invitation',
    'open_block_invitation',
    'open_block_accepted',
    'reschedule_request',
    'reschedule_accepted',
    'reschedule_declined',
    'reschedule_counter_sent',
    'reschedule_counter_accepted',
    'reschedule_counter_declined',
    'hangout_accepted'  -- NEW: notification when someone accepts your hangout/sleepover
));

COMMENT ON CONSTRAINT notifications_type_check ON notifications IS 'Valid notification types including hangout_accepted for when someone accepts a hangout/sleepover invitation';
