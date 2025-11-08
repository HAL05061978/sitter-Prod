# Deploy Pet Care Fix - Quick Guide

## Issue
Getting 400 errors when fetching pet care requests:
```
POST .../rpc/get_reciprocal_pet_care_requests 400 (Bad Request)
Error: column reference "status" is ambiguous
```

## Fix
Run the corrected SQL in Supabase SQL Editor.

## Deployment Steps

1. **Open Supabase Dashboard**
   - Go to your Supabase project
   - Click "SQL Editor" in left sidebar

2. **Run the Fix**
   - Copy the entire contents of `DEPLOY_FIX_PET_CARE_VISIBILITY_AND_LOOP.sql`
   - Paste into SQL Editor
   - Click "Run"

3. **Verify Success**
   - You should see success messages in the output
   - No errors should appear

4. **Test in Production**
   - Refresh your Vercel app
   - Check browser console - 400 errors should be gone
   - Pet care requests should now appear in Messages

## What This Fixes

1. ✅ **400 Bad Request errors** - Fixes ambiguous status column
2. ✅ **Pet care requests missing** - Requests will now load correctly
3. ✅ **Infinite loop** - Requesters won't see their own requests
4. ✅ **Proper filtering** - Only pending requests shown to responders

## Expected Behavior After Fix

| Action | Result |
|--------|--------|
| Create pet care request | ✅ Request created, requester does NOT see it in Messages |
| Group member views Messages | ✅ Sees the pet care request with "Respond" button |
| Group member submits response | ✅ Request disappears from their view |
| Requester views Messages | ✅ Sees response with "Accept Response" button |
| Requester accepts response | ✅ 4 calendar blocks created, no loop |

## Troubleshooting

If you still see 400 errors after deployment:
1. Check Supabase SQL Editor for any error messages
2. Verify the function was created successfully
3. Try running: `SELECT * FROM get_reciprocal_pet_care_requests('your-user-id-here');`
4. Check that both `pet_care_requests` and `pet_care_responses` tables exist

## Files
- **SQL to deploy:** `DEPLOY_FIX_PET_CARE_VISIBILITY_AND_LOOP.sql`
- **Full analysis:** `PET_CARE_LOOP_FIX_SUMMARY.md`
