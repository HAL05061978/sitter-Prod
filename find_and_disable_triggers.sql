-- Find and disable all triggers that might be auto-accepting invitations
-- This script will identify all triggers and disable the problematic ones

-- First, let's see what triggers exist in the database
SELECT 
    'All Triggers' as info,
    trigger_name,
    event_object_table,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
ORDER BY trigger_name;

-- Check for triggers on care_responses table specifically
SELECT 
    'Care Responses Triggers' as info,
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'care_responses';

-- Check for triggers on any table with 'response' in the name
SELECT 
    'Response Table Triggers' as info,
    trigger_name,
    event_object_table,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table LIKE '%response%';

-- Check for triggers with 'accept' or 'care' in the name
SELECT 
    'Accept/Care Triggers' as info,
    trigger_name,
    event_object_table,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name LIKE '%accept%' 
   OR trigger_name LIKE '%care%'
   OR trigger_name LIKE '%response%'
   OR trigger_name LIKE '%invitation%';

-- Now let's disable any triggers that might be auto-accepting
-- We'll disable triggers that create scheduled blocks automatically

-- Disable trigger on care_responses if it exists
DROP TRIGGER IF EXISTS create_initial_scheduled_blocks_trigger ON public.care_responses;

-- Disable any other potential auto-accept triggers
DROP TRIGGER IF EXISTS create_scheduled_blocks_trigger ON public.care_responses;
DROP TRIGGER IF EXISTS auto_accept_response_trigger ON public.care_responses;
DROP TRIGGER IF EXISTS create_care_exchange_trigger ON public.care_responses;

-- Check what tables exist in the database
SELECT 
    'Available Tables' as info,
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%response%' 
   OR table_name LIKE '%care%'
   OR table_name LIKE '%invitation%'
ORDER BY table_name;

SELECT 'Triggers have been checked and potentially problematic ones disabled.' as note; 