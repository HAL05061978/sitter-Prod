-- Debug children table structure and data
-- Run this in Supabase SQL editor

-- Check the actual columns in children table
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'children'
ORDER BY ordinal_position;

-- Check sample data from children table
SELECT * FROM children LIMIT 5;

-- Check if there are any name-related columns
SELECT 
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'children'
  AND (column_name LIKE '%name%' OR column_name LIKE '%first%' OR column_name LIKE '%last%' OR column_name LIKE '%display%')
ORDER BY column_name;

-- Test the get_child_display_name function with actual data
SELECT 
  c.id,
  c.first_name,
  c.last_name,
  get_child_display_name(c.*) as display_name
FROM children c
LIMIT 5;