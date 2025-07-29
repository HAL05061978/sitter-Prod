-- Clear only scheduling-related data for testing
-- This preserves fundamental data like profiles, children, groups, etc.

-- Step 1: Clear scheduling-related tables in the correct order (respecting foreign keys)
-- Start with the most dependent tables first

-- Clear block_connections (depends on scheduled_blocks)
DELETE FROM public.block_connections;

-- Clear scheduled_blocks (depends on babysitting_requests, profiles, children, groups)
DELETE FROM public.scheduled_blocks;

-- Clear request_responses (depends on babysitting_requests, profiles)
DELETE FROM public.request_responses;

-- Clear babysitting_requests (depends on groups, profiles, children)
DELETE FROM public.babysitting_requests;

-- Step 2: Reset any sequences if they exist (optional, but good practice)
-- Note: Most tables use UUIDs, so sequences might not be needed

-- Step 3: Verify the clearing worked
SELECT 
    'babysitting_requests' as table_name,
    COUNT(*) as record_count
FROM public.babysitting_requests
UNION ALL
SELECT 
    'request_responses' as table_name,
    COUNT(*) as record_count
FROM public.request_responses
UNION ALL
SELECT 
    'scheduled_blocks' as table_name,
    COUNT(*) as record_count
FROM public.scheduled_blocks
UNION ALL
SELECT 
    'block_connections' as table_name,
    COUNT(*) as record_count
FROM public.block_connections;

-- Step 4: Verify fundamental data is still intact
SELECT 
    'profiles' as table_name,
    COUNT(*) as record_count
FROM public.profiles
UNION ALL
SELECT 
    'children' as table_name,
    COUNT(*) as record_count
FROM public.children
UNION ALL
SELECT 
    'groups' as table_name,
    COUNT(*) as record_count
FROM public.groups
UNION ALL
SELECT 
    'group_members' as table_name,
    COUNT(*) as record_count
FROM public.group_members
UNION ALL
SELECT 
    'child_group_members' as table_name,
    COUNT(*) as record_count
FROM public.child_group_members;

-- Success message
SELECT 'Scheduling data has been cleared! All scheduling-related tables are now empty, but fundamental data (profiles, children, groups) has been preserved.' as status; 