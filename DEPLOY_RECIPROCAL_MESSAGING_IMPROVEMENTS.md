# Deploy Reciprocal Care Messaging Improvements

## Summary
This deployment updates the reciprocal care messaging experience based on user feedback:

### Changes Made:

1. **Removed baby icon from reciprocal care request messages**
   - Changed from: `👶 child care request`
   - Changed to: `child care request`
   - File: `app/scheduler/page.tsx` line 604

2. **Simplified accepted response message (requester view)**
   - Changed from: `You accepted [Name]'s reciprocal request for your Oct 28, 2025 from 14:00 to 15:00 request`
   - Changed to: `Reciprocal request for Oct 28, 2025 (14:00 to 15:00) accepted`
   - File: `app/scheduler/page.tsx` line 643-644
   - Note: Full details are still available when expanding the message

3. **Added distinct message for accepted response (responder view)**
   - Message: `Your reciprocal response for Oct 28, 2025 (14:00 to 15:00) has been accepted. Care blocks have been added to your calendar`
   - File: `app/scheduler/page.tsx` lines 709-710
   - When expanded, shows both care blocks that were created:
     - Blue block: "You will provide care" with requester details
     - Green block: "You will receive care" with reciprocal care details
   - File: `app/scheduler/page.tsx` lines 1022-1063

4. **Added message for declined response (responder view)**
   - Message: `Your reciprocal response for Oct 28, 2025 was not accepted`
   - File: `app/scheduler/page.tsx` line 711
   - Badge: Red "Not Accepted" badge
   - When expanded, shows explanation and details of both original and proposed reciprocal care
   - File: `app/scheduler/page.tsx` lines 1066-1086

5. **Added care_declined badge styling**
   - Red badge with "Not Accepted" label
   - File: `app/scheduler/page.tsx` lines 833, 844

6. **Added backend notifications when reciprocal response is accepted/declined**
   - Responder receives notification when accepted: "Your reciprocal care response has been accepted and the calendar has been updated."
   - Other responders receive notification when not accepted: "Your reciprocal care response was not accepted. The requester may have accepted a different response."
   - File: `migrations/20250128_add_reciprocal_response_notifications.sql`

## Deployment Steps

### Step 1: Deploy Frontend Changes

The frontend changes in `app/scheduler/page.tsx` will be automatically deployed when you push to production.

```bash
git add app/scheduler/page.tsx
git commit -m "Improve reciprocal care messaging UI"
git push
```

### Step 2: Deploy Database Function Updates

Deploy the updated database functions to production (in order):

**Migration 1: Fix get_my_submitted_responses function**
```bash
# Using Supabase CLI
supabase db push

# OR manually via Supabase Dashboard:
# 1. Go to Supabase Dashboard > SQL Editor
# 2. Copy and paste the contents of migrations/20250128_fix_get_my_submitted_responses.sql
# 3. Click "Run"
```

**Migration 2: Add notifications to accept_reciprocal_care_response function**
```bash
# Using Supabase CLI
supabase db push

# OR manually via Supabase Dashboard:
# 1. Go to Supabase Dashboard > SQL Editor
# 2. Copy and paste the contents of migrations/20250128_add_reciprocal_response_notifications.sql
# 3. Click "Run"
```

### Step 3: Verify Deployment

1. **Test reciprocal care request display:**
   - Create a new reciprocal care request
   - Verify the message does NOT show a baby icon for child care
   - Verify pet care still shows 🐾 icon

2. **Test accepted response message (requester view):**
   - Accept a reciprocal care response
   - Verify the message shows simplified format: "Reciprocal request for [date] ([time]) accepted"
   - Expand the message to verify full details are still available

3. **Test accepted response message (responder view):**
   - Have User A create a reciprocal care request
   - Have User B respond with reciprocal care offer
   - Have User A accept User B's response
   - Verify User B sees message: "Your reciprocal response for [date] ([time]) has been accepted. Care blocks have been added to your calendar"
   - Expand the message and verify two blocks are shown:
     - Blue block: "You will provide care" with User A's details
     - Green block: "You will receive care" with reciprocal care details
   - Verify green "Accepted" badge is displayed

4. **Test declined response message (responder view):**
   - Have User A create a reciprocal care request
   - Have User B and User C respond with reciprocal care offers
   - Have User A accept User B's response
   - Verify User C sees message: "Your reciprocal response for [date] was not accepted"
   - Expand the message and verify explanation and details are shown
   - Verify red "Not Accepted" badge is displayed

5. **Test backend notifications:**
   - Follow scenario from test #4
   - Verify User B receives notification in NotificationsPanel
   - Verify User C receives notification in NotificationsPanel

## Files Modified

### Frontend:
- `app/scheduler/page.tsx`
  - Line 604: Removed baby icon from reciprocal care request messages
  - Lines 643-644: Simplified accepted response message text (requester view)
  - Lines 709-711: Updated message text for accepted/declined responses (responder view)
  - Lines 1022-1063: Added expanded view for accepted response showing care blocks created
  - Lines 1066-1086: Added expanded view for declined response with explanation
  - Lines 833, 844: Added care_declined badge styling (red "Not Accepted")

### Backend:
- `supabase/supabase/migrations/20250115000018_fix_reciprocal_response_function.sql`
  - Lines 287-352: Added notification creation for accepted and declined responses

### New Migrations:
- `migrations/20250128_fix_get_my_submitted_responses.sql`
  - Fixes the get_my_submitted_responses function to return accepted/declined responses
  - Previously only returned 'submitted' status, so accepted/declined messages never appeared
- `migrations/20250128_add_reciprocal_response_notifications.sql`
  - Complete updated function with notifications

## Rollback Plan

If issues arise, you can rollback the database changes by running:

```sql
-- Rollback to previous version without notifications
DROP FUNCTION IF EXISTS accept_reciprocal_care_response(UUID);

CREATE OR REPLACE FUNCTION accept_reciprocal_care_response(
    p_care_response_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
-- [Previous version of function without notification code]
$$;
```

The frontend changes can be reverted via git:

```bash
git revert [commit-hash]
git push
```

## Notes

- The notification feature requires the `notifications` table to exist (created in migration `20250115000020_create_notifications_system.sql`)
- Notifications are displayed in the `NotificationsPanel` component
- Pet care requests still show the 🐾 icon as before
- The simplified message only affects the collapsed view; expanded view still shows all details
