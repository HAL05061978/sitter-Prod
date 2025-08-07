-- Create Fresh Open Block Invitations
-- This script creates new open block invitations from scratch

-- 1. First, let's see what scheduled care blocks are available for opening
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

-- 2. Let's see what parents are available for invitations
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

-- 3. Create a new open block invitation
SELECT '=== CREATING NEW OPEN BLOCK INVITATION ===' as info;

-- First, let's get a scheduled care block to open
DO $$
DECLARE
    care_block_id UUID;
    inviting_parent_id UUID;
    invited_parent_id UUID;
    block_time_id UUID;
    reciprocal_date DATE;
    reciprocal_start_time TIME;
    reciprocal_end_time TIME;
BEGIN
    -- Get a scheduled care block to open (Parent B's care block)
    SELECT sc.id INTO care_block_id
    FROM scheduled_care sc
    WHERE sc.notes LIKE '%Reciprocal care provided%'
       OR sc.notes LIKE '%Reciprocal care%'
    ORDER BY sc.care_date DESC, sc.start_time ASC
    LIMIT 1;
    
    IF care_block_id IS NULL THEN
        RAISE NOTICE 'No suitable care blocks found for opening';
        RETURN;
    END IF;
    
    -- Get the parent who created this care block (Parent B)
    SELECT parent_id INTO inviting_parent_id
    FROM scheduled_care
    WHERE id = care_block_id;
    
    -- Get a parent to invite (Parent C)
    SELECT p.id INTO invited_parent_id
    FROM profiles p
    JOIN group_members gm ON p.id = gm.member_id
    WHERE gm.group_id = '243ea746-ce6b-42ec-95df-843a201f38fb'
      AND p.id != inviting_parent_id
    ORDER BY p.full_name
    LIMIT 1;
    
    IF invited_parent_id IS NULL THEN
        RAISE NOTICE 'No suitable parents found for invitation';
        RETURN;
    END IF;
    
    -- Generate a unique block time ID
    block_time_id := gen_random_uuid();
    
    -- Set reciprocal time (when Parent C will provide care for Parent B's child)
    reciprocal_date := CURRENT_DATE + INTERVAL '7 days';  -- Next week
    reciprocal_start_time := '14:00:00';  -- 2 PM
    reciprocal_end_time := '16:00:00';    -- 4 PM
    
    RAISE NOTICE 'Creating open block invitation...';
    RAISE NOTICE 'Care block ID: %', care_block_id;
    RAISE NOTICE 'Inviting parent ID: %', inviting_parent_id;
    RAISE NOTICE 'Invited parent ID: %', invited_parent_id;
    RAISE NOTICE 'Reciprocal date: %', reciprocal_date;
    RAISE NOTICE 'Reciprocal time: % to %', reciprocal_start_time, reciprocal_end_time;
    
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
    
    RAISE NOTICE 'Open block invitation created successfully';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating open block invitation: %', SQLERRM;
        RAISE NOTICE 'SQLSTATE: %', SQLSTATE;
END $$;

-- 4. Verify the new invitation was created
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
ORDER BY obi.created_at DESC
LIMIT 5;

-- 5. Show all current invitations
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

-- 6. Success message
SELECT '=== READY FOR TESTING ===' as info;
SELECT 'Fresh open block invitation has been created. You can now test the acceptance process.' as status;
