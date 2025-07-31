-- Debug script to check profiles and responder relationships
-- This will help us understand if the responder_id exists in profiles table

-- Check all profiles
SELECT 
    id,
    full_name,
    email,
    created_at
FROM public.profiles
ORDER BY created_at DESC;

-- Check if all responder_ids in care_responses have corresponding profiles
SELECT 
    cresp.responder_id,
    p.full_name,
    p.id as profile_id,
    CASE 
        WHEN p.id IS NULL THEN 'MISSING PROFILE'
        ELSE 'PROFILE FOUND'
    END as profile_status
FROM public.care_responses cresp
LEFT JOIN public.profiles p ON cresp.responder_id = p.id
ORDER BY cresp.created_at DESC;

-- Count how many responder_ids don't have corresponding profiles
SELECT 
    COUNT(*) as missing_profiles_count
FROM public.care_responses cresp
LEFT JOIN public.profiles p ON cresp.responder_id = p.id
WHERE p.id IS NULL;

-- Check the most recent care_responses with their responder profiles
SELECT 
    cresp.id as response_id,
    cresp.responder_id,
    cresp.status as response_status,
    p.full_name as responder_name,
    p.id as profile_id
FROM public.care_responses cresp
LEFT JOIN public.profiles p ON cresp.responder_id = p.id
ORDER BY cresp.created_at DESC
LIMIT 10; 