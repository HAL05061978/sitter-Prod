-- Check the current schema of child_group_members table
-- This will help us understand what columns actually exist

-- Method 1: Check table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'child_group_members' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Method 2: Check if specific columns exist
SELECT 
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'child_group_members' 
        AND table_schema = 'public' 
        AND column_name = 'added_by'
    ) THEN 'added_by column EXISTS' ELSE 'added_by column DOES NOT EXIST' END as added_by_status;

SELECT 
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'child_group_members' 
        AND table_schema = 'public' 
        AND column_name = 'active'
    ) THEN 'active column EXISTS' ELSE 'active column DOES NOT EXIST' END as active_status;

-- Method 3: Show table definition
\d child_group_members; 