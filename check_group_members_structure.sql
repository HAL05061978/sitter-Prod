-- Check the structure of group_members table
-- Run this in Supabase SQL editor

-- Check the columns in group_members table
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'group_members'
ORDER BY ordinal_position;

-- Check if there's a separate child_group_members table
SELECT 
  table_name
FROM information_schema.tables 
WHERE table_name LIKE '%child%' OR table_name LIKE '%member%'
ORDER BY table_name;

-- Check the structure of child_group_members if it exists
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'child_group_members'
ORDER BY ordinal_position;

-- Sample data from group_members
SELECT * FROM group_members LIMIT 5;

-- Sample data from child_group_members (if it exists)
SELECT * FROM child_group_members LIMIT 5;