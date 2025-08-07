-- Clean and Create Fresh Open Block Invitations
-- This script first cleans up all existing open block data, then creates fresh invitations

-- 1. Clean up existing open block data
SELECT '=== CLEANING UP EXISTING OPEN BLOCK DATA ===' as info;

-- Remove all open block responses
DELETE FROM open_block_responses;

-- Remove all open block invitations
DELETE FROM open_block_invitations;

-- Clean up any care blocks created by open block acceptance
DELETE FROM scheduled_care_children 
WHERE notes LIKE '%Open block acceptance%';

DELETE FROM scheduled_care 
WHERE notes LIKE '%Open block acceptance%';

-- 2. Show what scheduled care blocks are available for opening
SELECT '=== AVAILABLE SCHEDULED CARE BLOCKS ===' as info;

SELECT 
    sc.id,
    sc.parent_id,
    sc.child_id,
    sc.care_date,
    sc.start_time,
    sc.end_time,
    sc.notes,
    p.full_name as parent_name,
    c.full_name as child_name
FROM scheduled_care sc
JOIN profiles p ON sc.parent_id = p.id
JOIN children c ON sc.child_id = c.id
WHERE sc.notes LIKE '%Reciprocal care provided%'
   OR sc.notes LIKE '%Reciprocal care%'
ORDER BY sc.care_date DESC, sc.start_time ASC;

-- 3. Show what parents are available for invitations
SELECT '=== AVAILABLE PARENTS FOR INVITATIONS ===' as info;

SELECT 
    p.id,
    p.full_name,
    p.email,
    COUNT(c.id) as children_count
FROM profiles p
JOIN children c ON p.id = c.parent_id
JOIN group_members gm ON p.id = gm.member_id
WHERE gm.group_id = '243ea746-ce6b-42ec-95df-843a201f38fb'  -- Your group ID
  AND p.id != '8c7b93f6-582d-4208-9cdd-65a940a1d18d'  -- Exclude the current user
GROUP BY p.id, p.full_name, p.email
ORDER BY p.full_name;

-- 4. Create fresh open block invitations
SELECT '=== CREATING FRESH OPEN BLOCK INVITATIONS ===' as info;

-- Create multiple invitations for different care blocks
DO $$
DECLARE
    care_block_id UUID;
    inviting_parent_id UUID;
    invited_parent_id UUID;
    block_time_id UUID;
    reciprocal_date DATE;
    reciprocal_start_time TIME;
    reciprocal_end_time TIME;
    invitation_count INTEGER := 0;
    max_invitations INTEGER := 3; -- Create up to 3 invitations
BEGIN
    -- Loop through available care blocks and create invitations
    FOR care_block_id IN 
        SELECT sc.id
        FROM scheduled_care sc
        WHERE sc.notes LIKE '%Reciprocal care provided%'
           OR sc.notes LIKE '%Reciprocal care%'
        ORDER BY sc.care_date DESC, sc.start_time ASC
        LIMIT 3
    LOOP
        -- Get the parent who created this care block
        SELECT parent_id INTO inviting_parent_id
        FROM scheduled_care
        WHERE id = care_block_id;
        
        -- Get a parent to invite (different from the inviting parent)
        SELECT p.id INTO invited_parent_id
        FROM profiles p
        JOIN group_members gm ON p.id = gm.member_id
        WHERE gm.group_id = '243ea746-ce6b-42ec-95df-843a201f38fb'
          AND p.id != inviting_parent_id
          AND p.id != '8c7b93f6-582d-4208-9cdd-65a940a1d18d'  -- Exclude current user
        ORDER BY p.full_name
        LIMIT 1;
        
        IF invited_parent_id IS NULL THEN
            RAISE NOTICE 'No suitable parents found for invitation for care block %', care_block_id;
            CONTINUE;
        END IF;
        
        -- Generate a unique block time ID
        block_time_id := gen_random_uuid();
        
        -- Set reciprocal time (when invited parent will provide care)
        reciprocal_date := CURRENT_DATE + INTERVAL '7 days';  -- Next week
        reciprocal_start_time := '14:00:00';  -- 2 PM
        reciprocal_end_time := '16:00:00';    -- 4 PM
        
        RAISE NOTICE 'Creating open block invitation %...', invitation_count + 1;
        RAISE NOTICE 'Care block ID: %', care_block_id;
        RAISE NOTICE 'Inviting parent ID: %', inviting_parent_id;
        RAISE NOTICE 'Invited parent ID: %', invited_parent_id;
        
        -- Create the open block invitation
        INSERT INTO open_block_invitations (
            open_block_id,
            block_time_id,
            invited_parent_id,
            reciprocal_date,
            reciprocal_start_time,
            reciprocal_end_time,
            status,
            notes
        ) VALUES (
            care_block_id,
            block_time_id,
            invited_parent_id,
            reciprocal_date,
            reciprocal_start_time,
            reciprocal_end_time,
            'active',
            'Fresh open block invitation for testing'
        );
        
        invitation_count := invitation_count + 1;
        RAISE NOTICE 'Open block invitation % created successfully', invitation_count;
        
        -- Stop if we've created enough invitations
        IF invitation_count >= max_invitations THEN
            EXIT;
        END IF;
        
    END LOOP;
    
    RAISE NOTICE 'Created % open block invitations', invitation_count;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating open block invitations: %', SQLERRM;
        RAISE NOTICE 'SQLSTATE: %', SQLSTATE;
END $$;

-- 5. Verify the new invitations were created
SELECT '=== VERIFICATION ===' as info;

SELECT 
    obi.id,
    obi.open_block_id,
    obi.block_time_id,
    obi.invited_parent_id,
    obi.status,
    obi.reciprocal_date,
    obi.reciprocal_start_time,
    obi.reciprocal_end_time,
    obi.created_at,
    p.full_name as invited_parent_name
FROM open_block_invitations obi
JOIN profiles p ON obi.invited_parent_id = p.id
WHERE obi.notes = 'Fresh open block invitation for testing'
ORDER BY obi.created_at DESC;

-- 6. Show all current invitations
SELECT '=== ALL CURRENT INVITATIONS ===' as info;

SELECT 
    obi.id,
    obi.status,
    obi.invited_parent_id,
    obi.reciprocal_date,
    obi.reciprocal_start_time,
    obi.reciprocal_end_time,
    obi.created_at,
    p.full_name as invited_parent_name
FROM open_block_invitations obi
JOIN profiles p ON obi.invited_parent_id = p.id
ORDER BY obi.created_at DESC;

-- 7. Success message
SELECT '=== READY FOR TESTING ===' as info;
SELECT 'All existing open block data has been cleaned up and fresh invitations have been created. You can now test the acceptance process.' as status;
