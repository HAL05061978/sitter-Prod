-- Test script to check calendar display issues
-- This will help us understand why blocks are appearing gray and both reading 'Provide:'

-- ============================================================================
-- STEP 1: CHECK CURRENT SCHEDULED_CARE DATA
-- ============================================================================

SELECT 
    'Current scheduled_care records:' as info,
    COUNT(*) as total_records
FROM public.scheduled_care;

-- Check the care_type values in the database
SELECT 
    'Care type distribution:' as info,
    care_type,
    COUNT(*) as count
FROM public.scheduled_care 
GROUP BY care_type
ORDER BY care_type;

-- Check a few sample records with full details
SELECT 
    'Sample scheduled_care records:' as info,
    id,
    parent_id,
    child_id,
    care_date,
    start_time,
    end_time,
    care_type,
    status,
    notes
FROM public.scheduled_care 
ORDER BY care_date DESC, start_time DESC
LIMIT 10;

-- ============================================================================
-- STEP 2: CHECK CHILDREN DATA
-- ============================================================================

-- Check if children data is properly linked
SELECT 
    'Children in scheduled_care:' as info,
    sc.id as care_id,
    sc.child_id,
    c.full_name as child_name,
    sc.care_type,
    sc.parent_id
FROM public.scheduled_care sc
LEFT JOIN public.children c ON sc.child_id = c.id
ORDER BY sc.care_date DESC, sc.start_time DESC
LIMIT 10;

-- ============================================================================
-- STEP 3: CHECK PROFILES DATA
-- ============================================================================

-- Check if parent data is available
SELECT 
    'Parents in scheduled_care:' as info,
    sc.id as care_id,
    sc.parent_id,
    p.full_name as parent_name,
    sc.care_type,
    sc.child_id
FROM public.scheduled_care sc
LEFT JOIN public.profiles p ON sc.parent_id = p.id
ORDER BY sc.care_date DESC, sc.start_time DESC
LIMIT 10;

-- ============================================================================
-- STEP 4: VERIFY DATABASE SCHEMA
-- ============================================================================

-- Check the care_type constraint
SELECT 
    'Care type constraint:' as info,
    constraint_name,
    check_clause
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%care_type%';

-- Check the scheduled_care table structure
SELECT 
    'Scheduled_care table structure:' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'scheduled_care' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================================================
-- STEP 5: SUMMARY
-- ============================================================================

SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.scheduled_care 
            WHERE care_type IN ('needed', 'provided', 'event')
        ) THEN '✅ PASS: Database has correct care_type values'
        ELSE '❌ FAIL: Database has incorrect care_type values'
    END as database_check;

SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.scheduled_care 
            WHERE care_type IS NOT NULL
        ) THEN '✅ PASS: Database has scheduled_care records'
        ELSE '❌ FAIL: No scheduled_care records found'
    END as data_check;

SELECT 'Calendar display test completed. Check the results above.' as status; 