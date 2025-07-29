-- Check what columns actually exist in children table
-- Run this in Supabase SQL editor

-- Check all columns in children table
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'children'
ORDER BY ordinal_position;

-- Check sample data to see what's actually stored
SELECT * FROM children LIMIT 3;

-- Check if there's a name column or similar
SELECT 
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'children'
  AND (column_name LIKE '%name%' OR column_name LIKE '%title%' OR column_name LIKE '%label%')
ORDER BY column_name;