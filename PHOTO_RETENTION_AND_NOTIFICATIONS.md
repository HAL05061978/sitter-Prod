# Photo Retention & Notifications

## Overview

Photos are automatically deleted **3 days after the care date** to manage storage costs. Users receive notifications when photos are uploaded, with a warning about the 3-day retention policy.

## Features

### 1. Photo Upload Notifications

When a provider/host uploads photos:
- **Receiving parents** are notified (for providing/receiving care)
- **Attendees** are notified (for hangouts/sleepovers)
- **Uploader** is NOT notified (they know they uploaded)

**Notification Message:**
```
[Provider Name] uploaded 2 photos. Photos will be automatically deleted 3 days after the care date (Jan 15, 2025).
```

### 2. Automatic Cleanup (3-Day Retention)

Photos are deleted automatically:
- **When**: 3 days after the care date (not upload date)
- **What**: Photos deleted from Supabase Storage
- **Database**: `photo_urls` field set to `null`
- **How**: Daily cron job via Edge Function

**Example Timeline:**
```
Jan 10: Care happens, photos uploaded
Jan 11: Photos still available
Jan 12: Photos still available
Jan 13: Photos still available (last day!)
Jan 14: Photos automatically deleted
```

## Database Schema

### notifications Table

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES profiles(id),
    message TEXT,
    type TEXT,  -- 'photo_upload'
    related_care_id UUID REFERENCES scheduled_care(id),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ
);
```

### Functions

#### notify_photo_upload
```sql
SELECT notify_photo_upload(
    p_scheduled_care_id UUID,  -- Care block ID
    p_uploader_id UUID,        -- Who uploaded
    p_photo_count INTEGER      -- Number of photos
);
```

Automatically determines who to notify based on care type:
- **Providing care**: Notifies receiving parent
- **Hangout/Sleepover**: Notifies all attendees except host

#### cleanup_old_photos
```sql
SELECT cleanup_old_photos();
-- Returns: deleted_count, storage_freed_mb
```

Deletes photos from care blocks where `care_date <= CURRENT_DATE - 3`.

## Deployment

### Step 1: Run Database Migration

```bash
# In Supabase Dashboard → SQL Editor
# Run: migrations/add_photo_notifications_and_cleanup.sql
```

This creates:
- `notifications` table
- `notify_photo_upload()` function
- `cleanup_old_photos()` function
- RLS policies for notifications

### Step 2: Deploy Edge Function

```bash
# Deploy the cleanup function
supabase functions deploy cleanup-old-photos

# Or manually in Supabase Dashboard:
# Edge Functions → Create → Upload supabase/functions/cleanup-old-photos/index.ts
```

### Step 3: Set Up Daily Cron Job

**Option A: Supabase Cron (Recommended)**

In Supabase Dashboard → Database → Cron Jobs:

```sql
-- Create daily cleanup job (runs at 2 AM UTC)
SELECT cron.schedule(
    'cleanup-old-photos-daily',
    '0 2 * * *',  -- Every day at 2 AM UTC
    $$
    SELECT net.http_post(
        url := 'https://[your-project].supabase.co/functions/v1/cleanup-old-photos',
        headers := jsonb_build_object(
            'Authorization', 'Bearer [your-service-role-key]',
            'Content-Type', 'application/json'
        )
    );
    $$
);
```

**Option B: External Cron Service**

Use services like:
- Vercel Cron
- GitHub Actions
- Render Cron Jobs
- cron-job.org

Configure to call:
```
POST https://[your-project].supabase.co/functions/v1/cleanup-old-photos
Authorization: Bearer [service-role-key]
```

### Step 4: Deploy Frontend

Frontend already updated in `app/calendar/page.tsx`:
- Calls `notify_photo_upload()` after successful upload
- Includes proper error handling

## Configuration

### Change Retention Period

To change from 3 days to N days:

1. **Update SQL function** (`migrations/add_photo_notifications_and_cleanup.sql`):
```sql
-- Change this line in notify_photo_upload:
to_char(v_care_date + INTERVAL '3 days', 'Mon DD, YYYY')
-- To:
to_char(v_care_date + INTERVAL 'N days', 'Mon DD, YYYY')

-- And in cleanup_old_photos:
v_cutoff_date := CURRENT_DATE - INTERVAL '3 days';
-- To:
v_cutoff_date := CURRENT_DATE - INTERVAL 'N days';
```

2. **Update Edge Function** (`supabase/functions/cleanup-old-photos/index.ts`):
```typescript
// Change this line:
cutoffDate.setDate(cutoffDate.getDate() - 3)
// To:
cutoffDate.setDate(cutoffDate.getDate() - N)
```

3. **Redeploy** both migrations and edge function

## Testing

### Test Notifications

```sql
-- Upload a photo and check notifications table
SELECT * FROM notifications
WHERE type = 'photo_upload'
ORDER BY created_at DESC
LIMIT 5;
```

### Test Cleanup (Manual Trigger)

```bash
# Call edge function manually
curl -X POST \
  https://[your-project].supabase.co/functions/v1/cleanup-old-photos \
  -H "Authorization: Bearer [service-role-key]" \
  -H "Content-Type: application/json"
```

### Test with Old Date

```sql
-- Temporarily set a care block to old date
UPDATE scheduled_care
SET care_date = CURRENT_DATE - INTERVAL '4 days'
WHERE id = 'some-test-block-id';

-- Run cleanup
SELECT * FROM cleanup_old_photos();

-- Check photos were deleted
SELECT id, care_date, photo_urls
FROM scheduled_care
WHERE id = 'some-test-block-id';
```

## Monitoring

### Check Cleanup Stats

```sql
-- Count photos that will be deleted next cleanup
SELECT
    COUNT(*) as blocks_with_photos,
    SUM(array_length(photo_urls, 1)) as total_photos
FROM scheduled_care
WHERE care_date <= CURRENT_DATE - INTERVAL '3 days'
AND photo_urls IS NOT NULL;
```

### View Recent Notifications

```sql
SELECT
    n.message,
    n.created_at,
    p.full_name as recipient,
    n.is_read
FROM notifications n
JOIN profiles p ON n.user_id = p.id
WHERE n.type = 'photo_upload'
ORDER BY n.created_at DESC
LIMIT 20;
```

### Check Edge Function Logs

In Supabase Dashboard:
- Edge Functions → cleanup-old-photos → Logs
- See execution history and any errors

## Storage Estimates

### With 3-Day Retention:

**Assumptions:**
- Average: 2 photos per care block
- Average: 300 KB per photo
- Average: 10 care blocks per day with photos

**Storage calculation:**
```
Max photos stored = 10 blocks/day × 2 photos × 3 days = 60 photos
Max storage = 60 photos × 300 KB = 18 MB
```

With thousands of users:
```
1000 users × 18 MB = 18 GB (well under free tier for active photos)
```

## User Experience

### What Users See:

1. **Provider uploads photo**:
   - ✅ Photo uploaded successfully!
   - Photo appears immediately in their view

2. **Receiver gets notification**:
   - 📸 New notification badge
   - "Jane uploaded 2 photos. Photos will be automatically deleted 3 days after the care date (Jan 15)."

3. **3 days later**:
   - Photos automatically removed
   - No notification sent (silent cleanup)
   - Users should have downloaded by now

### Best Practices for Users:

- **Download important photos** within 3 days
- Use phone's native "Save Image" when viewing
- Photos are for immediate sharing, not long-term storage

## Future Enhancements

Potential improvements:

1. **Download reminder**: Notify 1 day before deletion
2. **Bulk download**: "Download All Photos" button
3. **Variable retention**: Premium users get 30 days
4. **Photo archives**: Optional paid long-term storage
5. **Download confirmation**: Track if users downloaded before deletion

## Troubleshooting

### Notifications not appearing?

```sql
-- Check if notification was created
SELECT * FROM notifications
WHERE related_care_id = 'your-care-block-id';

-- Check RLS policies
SELECT * FROM notifications
WHERE user_id = auth.uid();
```

### Photos not being deleted?

```sql
-- Check cron job status
SELECT * FROM cron.job WHERE jobname = 'cleanup-old-photos-daily';

-- Manually trigger cleanup
SELECT * FROM cleanup_old_photos();
```

### Edge function not running?

- Check Supabase logs
- Verify service role key is set
- Test function manually via curl
- Check cron job configuration

## Support

For issues:
- See `PHOTO_FEATURE_COMPLETE.md` for photo feature overview
- See `CAMERA_TROUBLESHOOTING.md` for upload issues
- Check Supabase Dashboard → Database → Cron Jobs for cleanup status
- Check Edge Functions logs for execution history
