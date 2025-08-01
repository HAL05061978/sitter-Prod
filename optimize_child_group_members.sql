-- ============================================================================
-- OPTIMIZE CHILD GROUP MEMBERS
-- ============================================================================
-- This script adds an active column to optimize activate/deactivate operations
-- instead of deleting and inserting records

-- ============================================================================
-- STEP 1: ADD ACTIVE COLUMN
-- ============================================================================

-- Add active column to child_group_members table
ALTER TABLE public.child_group_members 
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true NOT NULL;

-- ============================================================================
-- STEP 2: UPDATE EXISTING RECORDS
-- ============================================================================

-- Set all existing records to active
UPDATE public.child_group_members 
SET active = true 
WHERE active IS NULL;

-- ============================================================================
-- STEP 3: CREATE OPTIMIZED FUNCTIONS
-- ============================================================================

-- Function to activate a child in a group
CREATE OR REPLACE FUNCTION activate_child_in_group(
    p_child_id UUID,
    p_group_id UUID,
    p_added_by UUID
)
RETURNS UUID AS $$
DECLARE
    v_membership_id UUID;
BEGIN
    -- Check if membership already exists
    SELECT id INTO v_membership_id
    FROM public.child_group_members
    WHERE child_id = p_child_id AND group_id = p_group_id;
    
    IF v_membership_id IS NOT NULL THEN
        -- Update existing record to active
        UPDATE public.child_group_members
        SET active = true, added_by = p_added_by, added_at = NOW()
        WHERE id = v_membership_id;
        RETURN v_membership_id;
    ELSE
        -- Insert new record
        INSERT INTO public.child_group_members (child_id, group_id, added_by, active)
        VALUES (p_child_id, p_group_id, p_added_by, true)
        RETURNING id INTO v_membership_id;
        RETURN v_membership_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deactivate a child in a group
CREATE OR REPLACE FUNCTION deactivate_child_in_group(
    p_child_id UUID,
    p_group_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_membership_id UUID;
BEGIN
    -- Find the membership
    SELECT id INTO v_membership_id
    FROM public.child_group_members
    WHERE child_id = p_child_id AND group_id = p_group_id AND active = true;
    
    IF v_membership_id IS NOT NULL THEN
        -- Set to inactive instead of deleting
        UPDATE public.child_group_members
        SET active = false
        WHERE id = v_membership_id;
        RETURN true;
    ELSE
        RETURN false;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 4: CREATE VIEW FOR ACTIVE MEMBERSHIPS
-- ============================================================================

-- Create a view that only shows active memberships
CREATE OR REPLACE VIEW active_child_group_members AS
SELECT 
    id,
    child_id,
    group_id,
    added_by,
    added_at
FROM public.child_group_members
WHERE active = true;

-- ============================================================================
-- STEP 5: VERIFICATION
-- ============================================================================

-- Show the updated table structure
SELECT 'Updated child_group_members table structure:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'child_group_members' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Show current active memberships
SELECT 'Current active memberships:' as info;
SELECT 
    cgm.id,
    c.full_name as child_name,
    g.name as group_name,
    cgm.active,
    cgm.added_at
FROM public.child_group_members cgm
JOIN public.children c ON cgm.child_id = c.id
JOIN public.groups g ON cgm.group_id = g.id
ORDER BY cgm.added_at DESC;

-- ============================================================================
-- COMPLETION
-- ============================================================================

SELECT '✅ Child group members optimization complete!' as status;
SELECT 'Active column added and functions created' as note;
SELECT 'Use activate_child_in_group() and deactivate_child_in_group() functions' as note; 