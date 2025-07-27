-- Debug Script to Check Current Database Schema
-- Run this first to see what's currently in your database

-- Check if babysitting_requests table exists
SELECT 
    table_name,
    'EXISTS' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'babysitting_requests';

-- Check all tables in public schema
SELECT 
    table_name,
    'TABLE' as object_type
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check columns in babysitting_requests if it exists
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'babysitting_requests'
ORDER BY ordinal_position;

-- Check for any errors in recent operations
SELECT 
    n.nspname as schema_name,
    c.relname as table_name,
    a.attname as column_name,
    'COLUMN' as object_type
FROM pg_attribute a
JOIN pg_class c ON a.attrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
AND c.relname = 'babysitting_requests'
AND a.attnum > 0
ORDER BY a.attnum; 