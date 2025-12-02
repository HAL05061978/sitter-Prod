# Pet Care Complete Deployment Guide

## ⚠️ IMPORTANT: Deploy in Order!

There are TWO SQL files that MUST be deployed in the correct order to avoid constraint errors.

---

## Step 1: Deploy Notifications Constraint (FIRST!)

**File:** `DEPLOY_FINAL_NOTIFICATIONS_CONSTRAINT.sql`

**What it does:**
- Updates notifications table constraint to include ALL notification types
- Includes: Reschedule (10 types) + Child Care (4 types) + Pet Care (4 types) + Other (2 types)
- **Total: 20 notification types**

**How to deploy:**
1. Open Supabase Dashboard → SQL Editor
2. Copy entire contents of `DEPLOY_FINAL_NOTIFICATIONS_CONSTRAINT.sql`
3. Paste and click "Run"
4. ✅ Verify you see: "FINAL NOTIFICATIONS CONSTRAINT DEPLOYED"

**Why this is first:**
The `create_pet_care_request` function creates notifications. If the constraint doesn't allow the notification types, the function will fail!

---

## Step 2: Deploy Pet Care Request Function (SECOND!)

**File:** `DEPLOY_CREATE_PET_CARE_REQUEST.sql`

**What it does:**
- Creates `create_pet_care_request` function that mirrors child care workflow
- Creates pending responses for all group members
- Creates notifications for all group members

**How to deploy:**
1. Open Supabase Dashboard → SQL Editor
2. Copy entire contents of `DEPLOY_CREATE_PET_CARE_REQUEST.sql`
3. Paste and click "Run"
4. ✅ Verify you see: "PET CARE REQUEST CREATION COMPLETE"

**Why this is second:**
This function depends on the notification constraint being updated first.

---

## Step 3: Test Pet Care Workflow

### Test 1: Create Pet Care Request
1. Login as Pet Owner A
2. Go to Calendar
3. Click on a date/time
4. Select "Care Request"
5. Select pet care group
6. Select your pet
7. Set date and time
8. Click "Create Request"
9. ✅ Should see: "Pet care request created successfully! Group members have been notified."

### Test 2: See Request in Messages
1. Login as Pet Owner B (different user, same group)
2. Go to Scheduler → Messages
3. ✅ Should see new pet care request
4. ✅ Message counter should show 1

### Test 3: Respond to Request
1. As Pet Owner B, click on the pet care request
2. Fill in reciprocal details:
   - Select your pet
   - Select reciprocal date/time
   - Add notes (optional)
3. Click "Submit Response"
4. ✅ Request should disappear from your Messages

### Test 4: Accept Response
1. Login as Pet Owner A (original requester)
2. Go to Scheduler → Messages
3. ✅ Should see Pet Owner B's response
4. Click "Accept"
5. ✅ Should see success message
6. Go to Calendar
7. ✅ Should see 4 blocks created

---

## Verification Checklist

After deployment, verify these work:

- [ ] Pet care request creation from Calendar (no constraint errors)
- [ ] Notifications created for all group members
- [ ] Pet care requests appear in Messages
- [ ] Responses can be submitted
- [ ] Responses appear for requester
- [ ] Responses can be accepted
- [ ] Calendar blocks created after acceptance
- [ ] Child care workflow still works (not broken)
- [ ] Reschedule workflow still works (not broken)

---

## What NOT to Do

❌ **DO NOT** deploy partial notification constraint updates
❌ **DO NOT** run `DEPLOY_COMPLETE_notification_fix.sql` (old version, missing pet care types)
❌ **DO NOT** run `DEPLOY_PET_CARE_FINAL_FIX_v2.sql` (old version, incomplete constraint)
❌ **DO NOT** run `DEPLOY_FIX_NOTIFICATIONS_CONSTRAINT.sql` (old version, incomplete)

✅ **ONLY USE:** `DEPLOY_FINAL_NOTIFICATIONS_CONSTRAINT.sql` (has ALL 20 types)

---

## Files Summary

### Deploy These (In Order):
1. ✅ `DEPLOY_FINAL_NOTIFICATIONS_CONSTRAINT.sql` - Notifications constraint
2. ✅ `DEPLOY_CREATE_PET_CARE_REQUEST.sql` - Pet care function

### Frontend (Already Deployed):
- ✅ `app/calendar/page.tsx` - Already pushed to GitHub

### Documentation:
- 📄 This file: `DEPLOY_PET_CARE_COMPLETE_GUIDE.md`
- 📄 `PET_CARE_CALENDAR_CLONE_COMPLETE.md` - Overview

### Old Files (IGNORE):
- ❌ `DEPLOY_COMPLETE_notification_fix.sql` - Incomplete
- ❌ `DEPLOY_PET_CARE_FINAL_FIX_v2.sql` - Old version
- ❌ `DEPLOY_FIX_NOTIFICATIONS_CONSTRAINT.sql` - Incomplete
- ❌ `DEPLOY_COMPLETE_NOTIFICATIONS_FIX.sql` - Different syntax
- ❌ `DEPLOY_PET_CARE_NOTIFICATIONS_*.sql` - Old versions

---

## Notification Types Reference

For future reference, here are ALL 20 notification types currently supported:

### Reschedule (10 types):
- `reschedule_request`
- `reschedule_response`
- `reschedule_accepted`
- `reschedule_declined`
- `reschedule_counter_sent`
- `reschedule_counter_accepted`
- `reschedule_counter_declined`
- `rescheduled`
- `counter_proposal_response`
- `counter_propose`

### Child Care (4 types):
- `care_request`
- `care_response`
- `care_accepted`
- `care_declined`

### Pet Care (4 types):
- `pet_care_request_received`
- `pet_care_response_submitted`
- `pet_care_response_accepted`
- `pet_care_response_declined`

### Other (2 types):
- `group_invitation`
- `system`

---

## Troubleshooting

### Error: "violates check constraint notifications_type_check"

**Cause:** Notifications constraint missing a notification type

**Solution:** Re-run `DEPLOY_FINAL_NOTIFICATIONS_CONSTRAINT.sql`

### Error: "function create_pet_care_request does not exist"

**Cause:** Pet care function not deployed

**Solution:** Run `DEPLOY_CREATE_PET_CARE_REQUEST.sql`

### Pet care requests don't appear in Messages

**Cause:** Either notifications not created or function not deployed

**Solution:**
1. Check Supabase logs for errors
2. Verify `create_pet_care_request` exists
3. Verify notification constraint includes `pet_care_request_received`

---

## Success Criteria

✅ Pet care works EXACTLY like child care:
- Create from Calendar ✅
- All group members notified ✅
- Appears in Messages ✅
- Can respond with reciprocal details ✅
- Requester can accept/decline ✅
- Calendar blocks created ✅

✅ Child care still works (not broken)
✅ Reschedule still works (not broken)

---

**Status:** Ready to deploy!
**Estimated Time:** 5 minutes
**Risk Level:** Low (only adds new functionality, doesn't modify existing)
