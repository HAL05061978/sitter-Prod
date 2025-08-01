-- Test Supabase access to group_invites table
SELECT '=== CHECKING TABLE ACCESS ===' as section;

-- Check if we can see the table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'group_invites' 
AND table_schema = 'public';

-- Check if we can see any data at all
SELECT '=== ALL GROUP_INVITES ===' as section;
SELECT COUNT(*) as total_invites FROM public.group_invites;

-- Check RLS policies
SELECT '=== RLS POLICIES ===' as section;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'group_invites';

-- Test direct query
SELECT '=== DIRECT QUERY TEST ===' as section;
SELECT id, email, status 
FROM public.group_invites 
WHERE status = 'pending' 
LIMIT 5; 