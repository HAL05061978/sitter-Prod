-- Check the structure of children table
-- Run this in Supabase SQL editor

-- Check the columns in children table
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'children'
ORDER BY ordinal_position;

-- Sample data from children table
SELECT * FROM children LIMIT 5;

-- Check if there are any name-related columns
SELECT 
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'children'
  AND (column_name LIKE '%name%' OR column_name LIKE '%first%' OR column_name LIKE '%last%')
ORDER BY column_name;