-- Check Current Database Schema
-- Run this first to see what you already have

-- Check existing tables
SELECT 
    schemaname,
    tablename,
    'TABLE' as object_type
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'profiles', 'children', 'groups', 'group_members', 'child_group_members',
    'group_invites', 'messages', 'babysitting_requests', 'request_responses',
    'scheduled_blocks', 'block_connections'
)
ORDER BY tablename;

-- Check existing functions
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    'FUNCTION' as object_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname IN (
    'check_time_conflicts', 'insert_scheduled_block_with_validation', 
    'update_scheduled_block_with_validation'
)
ORDER BY p.proname;

-- Check RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    'POLICY' as object_type
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN (
    'profiles', 'children', 'groups', 'group_members', 'child_group_members',
    'group_invites', 'messages', 'babysitting_requests', 'request_responses',
    'scheduled_blocks', 'block_connections'
)
ORDER BY tablename, policyname;

-- Summary
SELECT 'Run the complete script - it will only add what you need!' as recommendation; 