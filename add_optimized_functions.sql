-- ============================================================================
-- ADD OPTIMIZED FUNCTIONS
-- ============================================================================
-- This script adds optimized functions for child group membership management
-- Since the active column already exists, we only need to create the functions

-- ============================================================================
-- STEP 1: CREATE OPTIMIZED FUNCTIONS
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
-- STEP 2: CREATE VIEW FOR ACTIVE MEMBERSHIPS
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
-- STEP 3: VERIFICATION
-- ============================================================================

-- Show the functions were created
SELECT 'Functions created successfully:' as info;
SELECT 
    routine_name,
    routine_type,
    'CREATED' as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('activate_child_in_group', 'deactivate_child_in_group');

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
WHERE cgm.active = true
ORDER BY cgm.added_at DESC;

-- ============================================================================
-- COMPLETION
-- ============================================================================

SELECT '✅ Optimized functions added!' as status;
SELECT 'Your dashboard code will now use the optimized approach' as note;
SELECT 'No more deleting/inserting records - just updating active status' as note; 