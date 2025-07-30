-- Check the structure of the profiles table
-- This will help us understand what columns are available

-- Check if profiles table exists
SELECT 'Profiles table exists:' as info, 
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') as exists;

-- Get all columns in the profiles table
SELECT 'Profiles table columns:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check for name-related columns
SELECT 'Name-related columns:' as info;
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND table_schema = 'public'
AND column_name ILIKE '%name%'
ORDER BY column_name;

-- Check for user-related columns
SELECT 'User-related columns:' as info;
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND table_schema = 'public'
AND (column_name ILIKE '%user%' OR column_name ILIKE '%email%' OR column_name ILIKE '%full%')
ORDER BY column_name;

-- Sample some actual data to see the structure
SELECT 'Sample profiles data:' as info;
SELECT * FROM public.profiles LIMIT 3; 