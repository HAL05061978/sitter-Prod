# Deploy Reciprocal Care Notes Fix - Step by Step

## Issue Fixed
Provider's notes were not propagating to receiver's care block.

## Files Changed
1. `migrations/20250122000017_add_reciprocal_update_notes.sql` - Database function
2. `app/calendar/page.tsx` - Frontend code with debugging

## Deployment Steps

### Step 1: Deploy Database Migration

**Option A: Via Supabase Dashboard**
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `migrations/20250122000017_add_reciprocal_update_notes.sql`
3. Paste into SQL Editor
4. Click "Run"
5. Verify you see "Success. No rows returned"

**Option B: Via Supabase CLI** (if installed)
```bash
supabase db push
```

### Step 2: Verify Function Exists

Run this in Supabase SQL Editor:
```sql
SELECT
    proname as function_name,
    pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname = 'update_reciprocal_care_notes';
```

**Expected Result:**
- Should return 1 row with function details

### Step 3: Deploy Frontend Code

**Your Vercel deployment should include:**
- Updated `app/calendar/page.tsx` with:
  - Console logging for debugging
  - Better error messages
  - Call to `update_reciprocal_care_notes` RPC function

**To verify deployment:**
1. Check Vercel deployment logs
2. Verify the deployment timestamp is recent
3. Hard refresh the browser (Ctrl+Shift+R or Cmd+Shift+R)

### Step 4: Test the Fix

1. **As Provider:**
   - Open a "Providing Care" block (green)
   - Edit the notes field
   - Click "Save Notes (Share with Receiver)"
   - Open browser console (F12)
   - Look for console logs starting with "=== Saving Reciprocal Care Notes ==="

2. **Check Console Output:**
   ```
   === Saving Reciprocal Care Notes ===
   Scheduled Care ID: [uuid]
   Parent ID: [uuid]
   New Notes: [your notes]
   Care Type: provided
   Related Request ID: [uuid or null]
   Function Response: { data: [...], error: null }
   Success: { success: true, message: "...", updated_count: 2 }
   ```

3. **As Receiver:**
   - Open the corresponding "Receiving Care" block (blue)
   - Verify notes show: "Reciprocal care for: [provider's notes]"
   - Refresh if needed

## Troubleshooting

### Error: "function update_reciprocal_care_notes does not exist"

**Solution:** Migration not deployed. Run Step 1 again.

### Error: "Only the provider can update notes for reciprocal care"

**Cause:** User opened a "Receiving Care" block instead of "Providing Care"

**Solution:** Only providers can edit notes. Receivers see read-only version.

### Error: "This function only works for reciprocal care blocks"

**Cause:** Trying to use function on hangout/sleepover block

**Solution:** Hangout/sleepover blocks use `update_hangout_sleepover_notes` instead.

### Success message shows "1 participant" instead of "2 participants"

**Possible Causes:**
1. Receiver's block doesn't have `related_request_id` set
2. Receiver's block has different time/date/group values
3. Care type is not 'needed' or 'received'

**Debug Steps:**
1. Check console logs for "Related Request ID"
2. If NULL, the function uses Strategy 2 (time/date matching)
3. Run this query in Supabase to find matching blocks:

```sql
-- Replace with your actual values from console
SELECT
    id,
    parent_id,
    care_type,
    care_date,
    start_time,
    end_time,
    notes,
    related_request_id
FROM scheduled_care
WHERE care_date = 'YYYY-MM-DD'
AND start_time = 'HH:MM:SS'
AND end_time = 'HH:MM:SS'
ORDER BY care_type;
```

### Notes don't update after saving

**Causes:**
1. Browser cache
2. Need to refresh calendar
3. Function succeeded but receiver block wasn't found

**Solutions:**
1. Hard refresh browser (Ctrl+Shift+R)
2. Check console for "Function Response"
3. Check `updated_count` in success message
4. If count is 1, only provider was updated (receiver not found)

### No console logs appear

**Cause:** Frontend not deployed or cached

**Solutions:**
1. Verify Vercel deployment completed
2. Hard refresh browser
3. Clear browser cache
4. Check Network tab for recent JS bundle

## Verification Checklist

After deployment, verify:

- [ ] Function exists in database (run Step 2 query)
- [ ] Vercel deployment shows recent timestamp
- [ ] Browser cache cleared (hard refresh)
- [ ] Console logs appear when clicking "Save Notes"
- [ ] Success message shows "2 participants"
- [ ] Provider's notes updated
- [ ] Receiver's notes updated with "Reciprocal care for: " prefix
- [ ] Both parties see the same notes (after refresh)

## Common Issues

### Issue: "care_type is 'received' but function looks for 'needed'"

**Fix:** Already fixed in updated migration. The function now accepts both:
```sql
AND care_type IN ('needed', 'received')
```

### Issue: Console shows error but no alert appears

**Fix:** Already fixed. Now shows alert with specific error message:
```javascript
alert(`Failed to save notes: ${error.message}`);
```

## Support

If issues persist:
1. Copy all console logs (F12 → Console tab)
2. Run the test queries from `test-reciprocal-notes-function.sql`
3. Check Supabase logs (Dashboard → Logs → Database)
4. Verify both provider and receiver blocks exist with matching time/date
