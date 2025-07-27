-- SQL Script to Clear All Sitter Application Records
-- Run this script in your Supabase SQL Editor to start fresh

-- Clear all records from Sitter application tables
-- Note: This will delete ALL data but keep the table structure intact

-- Clear messages first (due to potential foreign key constraints)
DELETE FROM public.messages;

-- Clear group invites
DELETE FROM public.group_invites;

-- Clear child group members first (due to foreign key constraint)
DELETE FROM public.child_group_members;

-- Clear group members
DELETE FROM public.group_members;

-- Clear groups
DELETE FROM public.groups;

-- Clear children records
DELETE FROM public.children;

-- Clear profiles (but keep auth.users intact)
DELETE FROM public.profiles;

-- Reset any auto-incrementing sequences if they exist
-- (PostgreSQL will handle this automatically, but you can manually reset if needed)
-- ALTER SEQUENCE IF EXISTS public.children_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS public.groups_id_seq RESTART WITH 1;

-- Verify tables are empty
SELECT 'profiles' as table_name, COUNT(*) as record_count FROM public.profiles
UNION ALL
SELECT 'children', COUNT(*) FROM public.children
UNION ALL
SELECT 'groups', COUNT(*) FROM public.groups
UNION ALL
SELECT 'group_members', COUNT(*) FROM public.group_members
UNION ALL
SELECT 'child_group_members', COUNT(*) FROM public.child_group_members
UNION ALL
SELECT 'group_invites', COUNT(*) FROM public.group_invites
UNION ALL
SELECT 'messages', COUNT(*) FROM public.messages
ORDER BY table_name;

-- Success message
SELECT 'All Sitter application records have been cleared successfully!' as status; 