# Deploy Hangout Accepted Notification with Date/Time

## Issue
The hangout_accepted notification message is showing "Hangout was accepted" but missing the date and time details.

## Solution
The `accept_hangout_sleepover_invitation` function already includes the date and time in the notification title, but needs to be deployed.

## Deployment Steps

### Step 1: Deploy the Updated Function

Run this SQL in your Supabase SQL Editor:

```sql
-- Copy the entire contents of:
-- /migrations/add_hangout_accept_notification.sql
```

Or run it directly:

1. Open Supabase Dashboard
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy the contents of `migrations/add_hangout_accept_notification.sql`
5. Paste and click **Run**

### Step 2: Verify the Format

The notification title will now show:
```
[Parent Name] has accepted your hangout invitation for Nov 15, 2025 from 02:00 PM to 04:00 PM
```

Instead of just:
```
Hangout was accepted
```

### Step 3: Test

1. Create a new hangout invitation
2. Have another parent accept it
3. Check the Messages/Scheduler tab
4. The notification should now show **bold title** with date and time

## Technical Details

The notification is created in the `accept_hangout_sleepover_invitation` function with this format:

```sql
title: format('%s has accepted your %s invitation for %s from %s to %s',
    p.full_name,                              -- Accepting parent name
    v_request_type,                           -- 'hangout' or 'sleepover'
    TO_CHAR(v_care_date, 'Mon DD, YYYY'),    -- Date
    TO_CHAR(v_start_time, 'HH12:MI AM'),     -- Start time
    TO_CHAR(v_end_time, 'HH12:MI AM')        -- End time
)
```

The message/subtitle is empty since all info is in the title.

## Note About Old Notifications

Notifications created **before** deploying this update will still show the old format. Only **new** hangout acceptances after deployment will show the date/time.

To clear old notifications and force a refresh, users can mark them as read.

## Files Modified
- `migrations/add_hangout_accept_notification.sql` (already updated)
