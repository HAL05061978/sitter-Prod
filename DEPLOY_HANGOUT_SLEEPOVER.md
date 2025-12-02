# Deploy Hangout and Sleepover Features

## ✅ Fixed Issues

The original migration scripts had errors because they assumed your database used ENUM types. I've corrected them to work with your actual schema which uses:
- Text columns for `request_type` and `action_type`
- Standard table structure matching your existing `care_requests.csv`

## 📁 New Migration Files Created

These files are in the `migrations/` folder:

1. **`20250122000001_add_hangout_sleepover_schema.sql`**
   - Adds `end_date` column to `care_requests` and `scheduled_care`
   - Adds `invited_child_id` column to `care_responses`
   - Creates `create_hangout_invitation()` function
   - Creates `create_sleepover_invitation()` function

2. **`20250122000002_add_hangout_sleepover_accept_functions.sql`**
   - Creates `accept_hangout_sleepover_invitation()` function
   - Creates `decline_hangout_sleepover_invitation()` function

3. **`20250122000003_add_hangout_sleepover_reschedule_functions.sql`**
   - Creates `reschedule_hangout_sleepover()` function
   - Creates `cancel_hangout_sleepover()` function

## 🚀 Deployment Steps

### Option 1: Using Supabase CLI (Recommended)

```bash
# Make sure you're in the project directory
cd C:\Users\admin\SitterAp\sitter-Prod

# Run migrations in order
supabase db push

# Or run them individually:
psql -h your-db-host -U your-user -d your-db -f migrations/20250122000001_add_hangout_sleepover_schema.sql
psql -h your-db-host -U your-user -d your-db -f migrations/20250122000002_add_hangout_sleepover_accept_functions.sql
psql -h your-db-host -U your-user -d your-db -f migrations/20250122000003_add_hangout_sleepover_reschedule_functions.sql
```

### Option 2: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of each file in order:
   - First: `20250122000001_add_hangout_sleepover_schema.sql`
   - Second: `20250122000002_add_hangout_sleepover_accept_functions.sql`
   - Third: `20250122000003_add_hangout_sleepover_reschedule_functions.sql`
4. Click **Run** for each one

## ✅ Verification

After running the migrations, verify they worked:

```sql
-- Check that end_date columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'care_requests' AND column_name = 'end_date';

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'scheduled_care' AND column_name = 'end_date';

-- Check that functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_name LIKE '%hangout%' OR routine_name LIKE '%sleepover%';
```

Expected output:
```
end_date | date
end_date | date

create_hangout_invitation
create_sleepover_invitation
accept_hangout_sleepover_invitation
decline_hangout_sleepover_invitation
reschedule_hangout_sleepover
cancel_hangout_sleepover
```

## 🎯 Next Steps

After deploying the database changes:

1. **Update Frontend** - Apply the code changes from `HANGOUT_SLEEPOVER_IMPLEMENTATION_GUIDE.md` to:
   - `app/scheduler/page.tsx`
   - `app/calendar/page.tsx` (optional but recommended)

2. **Test the Workflow**:
   - Create a hangout invitation
   - Create a sleepover invitation
   - Accept/decline invitations
   - Host reschedules event
   - Host cancels event

3. **Deploy to Production** - Once tested, deploy both database and frontend changes

## 🐛 Troubleshooting

If you get errors about missing columns, check that:
- Your `care_requests` table has columns: `requester_id`, `requested_date`, `request_type`, `action_type`
- Your `care_responses` table has columns: `care_request_id`, `responding_parent_id`, `response_status`, `responded_at`
- Your `scheduled_care` table has columns: `original_request_id`, `care_type`, `providing_care`

Run this to check your schema:
```sql
\d care_requests
\d care_responses
\d scheduled_care
```
