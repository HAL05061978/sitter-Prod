-- =====================================================
-- REPLACE EVENT GROUPS WITH PET GROUPS
-- =====================================================
-- This migration replaces 'event' group type with 'pet' group type
-- Event functionality is being removed in favor of pet care
-- =====================================================

-- Step 1: Update any existing 'event' groups to 'pet'
UPDATE groups
SET group_type = 'pet'
WHERE group_type = 'event';

-- Step 2: Update any other invalid group types to 'care' (safety measure)
UPDATE groups
SET group_type = 'care'
WHERE group_type NOT IN ('care', 'pet');

-- Step 3: Drop the existing CHECK constraint and recreate it with new values
ALTER TABLE groups
DROP CONSTRAINT IF EXISTS groups_group_type_check;

-- Step 4: Add the CHECK constraint with only 'care' and 'pet'
ALTER TABLE groups
ADD CONSTRAINT groups_group_type_check
CHECK (group_type IN ('care', 'pet'));

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Group types updated successfully!';
    RAISE NOTICE '✅ Valid types are now: care, pet';
    RAISE NOTICE '✅ Event groups have been converted to pet groups';
END;
$$;
