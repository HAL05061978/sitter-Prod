# Deploy Pet Care Migrations to Supabase

You need to run these 4 migration files in **this exact order** in your Supabase SQL Editor:

## Step-by-Step Instructions

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new
   - Or: Dashboard → SQL Editor → New Query

2. **Run Each Migration in Order**

### Migration 1: Pet Care Schema
**File:** `migrations/20250123000001_add_pet_care_schema.sql`

This creates:
- `pets` table
- `pet_group_members` table
- `pet_care_requests` table
- `pet_care_responses` table
- `scheduled_pet_care` table
- `scheduled_pet_care_pets` table
- All RLS policies and indexes

**How to run:**
1. Open the file in your IDE
2. Copy the **entire contents**
3. Paste into Supabase SQL Editor
4. Click "Run"
5. Wait for success message

---

### Migration 2: Pet Care Functions
**File:** `migrations/20250123000002_add_pet_care_functions.sql`

This creates 6 workflow functions:
- `send_pet_care_request()` ← This is the one you need!
- `submit_pet_care_response()`
- `accept_pet_care_response()`
- `decline_pet_care_request()`
- `cancel_pet_care_block()`
- `update_pet_care_notes()`

**How to run:**
1. Open the file in your IDE
2. Copy the **entire contents**
3. Paste into Supabase SQL Editor
4. Click "Run"
5. Wait for success message

---

### Migration 3: Pet Care Calendar Function
**File:** `migrations/20250123000003_add_pet_care_calendar_function.sql`

This creates:
- `get_scheduled_pet_care_for_calendar()` - Returns pet care blocks for calendar display

**How to run:**
1. Open the file
2. Copy the **entire contents**
3. Paste into Supabase SQL Editor
4. Click "Run"
5. Wait for success message

---

### Migration 4: Replace Event with Pet Groups
**File:** `migrations/20250123000004_replace_event_with_pet_groups.sql`

This:
- Updates `groups` table constraint
- Changes 'event' group type to 'pet'
- Valid types: 'care' and 'pet'

**How to run:**
1. Open the file
2. Copy the **entire contents**
3. Paste into Supabase SQL Editor
4. Click "Run"
5. Wait for success message

---

## Quick Verification

After running all 4 migrations, verify with this query:

```sql
-- Check if tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE '%pet%';

-- Should return: pets, pet_group_members, pet_care_requests,
-- pet_care_responses, scheduled_pet_care, scheduled_pet_care_pets

-- Check if functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%pet%';

-- Should return: send_pet_care_request, submit_pet_care_response,
-- accept_pet_care_response, decline_pet_care_request,
-- cancel_pet_care_block, update_pet_care_notes,
-- get_scheduled_pet_care_for_calendar
```

---

## Troubleshooting

**If you get an error about existing constraints:**
- This is okay, it means part of the migration already ran
- Continue with the next migration

**If a function fails to create:**
- Check for syntax errors in the SQL
- Make sure you copied the entire file

**After all migrations run successfully:**
- Your pet care request should work!
- Try creating a pet care request again in the calendar

---

## After Deployment

Once all migrations are deployed:
1. Refresh your app
2. Go to Calendar → Toggle to "Pet Care"
3. Create a new pet care request
4. You should see: "Pet care request created successfully!"
