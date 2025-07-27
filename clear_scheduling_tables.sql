-- Clear scheduling-related tables only
-- This script clears the scheduling functionality while preserving core app data

-- Clear scheduling tables in the correct order (respecting foreign key constraints)
DELETE FROM public.block_connections;
DELETE FROM public.scheduled_blocks;
DELETE FROM public.request_responses;
DELETE FROM public.babysitting_requests;

-- Verify the tables are cleared
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

-- Success message
SELECT 'Scheduling tables cleared successfully! Core app data (profiles, children, groups) preserved.' as status; 