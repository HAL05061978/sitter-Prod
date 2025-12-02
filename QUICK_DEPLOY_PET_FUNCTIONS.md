# Quick Deploy: Just the Pet Care Functions

Since you already have some pet care tables, let's just deploy the functions you need.

## Step 1: Deploy the Functions (Migration 2)

**File:** `migrations/20250123000002_add_pet_care_functions.sql`

1. Open `migrations/20250123000002_add_pet_care_functions.sql` in your IDE
2. Copy the **entire file contents**
3. Go to Supabase SQL Editor
4. Paste and click "Run"
5. You should see: ✅ Success messages for all 6 functions

---

## Step 2: Deploy the Calendar Function (Migration 3)

**File:** `migrations/20250123000003_add_pet_care_calendar_function.sql`

1. Open `migrations/20250123000003_add_pet_care_calendar_function.sql`
2. Copy the entire contents
3. Paste into Supabase SQL Editor
4. Click "Run"
5. You should see: ✅ Function created

---

## Step 3: Update Groups Constraint (Migration 4)

**File:** `migrations/20250123000004_replace_event_with_pet_groups.sql`

1. Open `migrations/20250123000004_replace_event_with_pet_groups.sql`
2. Copy the entire contents
3. Paste into Supabase SQL Editor
4. Click "Run"
5. You should see: ✅ Constraint updated

---

## Step 4: Verify Everything Works

Run this verification query:

```sql
-- Check if the critical function exists
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'send_pet_care_request';
```

Should return: `send_pet_care_request`

---

## Step 5: Test Your Pet Care Request

1. Refresh your app
2. Go to Calendar → Toggle to "Pet Care"
3. Click a date → "New Request"
4. Fill out the form
5. Submit

You should now see: **"Pet care request created successfully!"**

---

## If You Still Get Errors

If migration 2 fails because functions already exist, run this cleanup first:

```sql
-- Drop existing pet care functions
DROP FUNCTION IF EXISTS send_pet_care_request;
DROP FUNCTION IF EXISTS submit_pet_care_response;
DROP FUNCTION IF EXISTS accept_pet_care_response;
DROP FUNCTION IF EXISTS decline_pet_care_request;
DROP FUNCTION IF EXISTS cancel_pet_care_block;
DROP FUNCTION IF EXISTS update_pet_care_notes;
DROP FUNCTION IF EXISTS get_scheduled_pet_care_for_calendar;
```

Then run migration 2 again.
