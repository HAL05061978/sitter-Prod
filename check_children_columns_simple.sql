-- Simple check of children table structure
-- Run this in Supabase SQL editor

-- Check all columns in children table
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'children' 
ORDER BY ordinal_position;

-- Check sample data
SELECT * FROM children LIMIT 2;