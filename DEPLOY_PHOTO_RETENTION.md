# Deploy Photo Retention & Notifications - Quick Guide

## Prerequisites
- Supabase project set up
- Service role key available
- Access to Supabase Dashboard

## Deployment Steps

### 1. Run Database Migrations (in order)

Go to Supabase Dashboard → SQL Editor:

**First:** Run `migrations/add_care_photos_support.sql`
- Creates photo_urls column
- Creates storage bucket
- Sets up RLS policies

**Second:** Run `migrations/add_photo_urls_to_calendar_function.sql`
- Updates calendar functions
- Adds photo sharing logic

**Third:** Run `migrations/add_photo_notifications_and_cleanup.sql`
- Creates notifications table
- Creates notify_photo_upload function
- Creates cleanup_old_photos function

### 2. Deploy Edge Function

**Option A: Using Supabase CLI**
```bash
supabase functions deploy cleanup-old-photos
```

**Option B: Supabase Dashboard**
1. Go to Edge Functions → Create Function
2. Name: `cleanup-old-photos`
3. Upload: `supabase/functions/cleanup-old-photos/index.ts`
4. Deploy

### 3. Set Up Daily Cron Job

In Supabase Dashboard → Database → Extensions:
1. Enable `pg_cron` extension (if not already enabled)
2. Enable `pg_net` extension (for HTTP requests)

Then in SQL Editor:
```sql
SELECT cron.schedule(
    'cleanup-old-photos-daily',
    '0 2 * * *',  -- Every day at 2 AM UTC
    $$
    SELECT net.http_post(
        url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/cleanup-old-photos',
        headers := jsonb_build_object(
            'Authorization', 'Bearer YOUR-SERVICE-ROLE-KEY',
            'Content-Type', 'application/json'
        )
    );
    $$
);
```

**Replace:**
- `YOUR-PROJECT-REF` with your Supabase project reference
- `YOUR-SERVICE-ROLE-KEY` with your service role key

### 4. Deploy Frontend

Frontend is already updated - just deploy to production:
```bash
# Commit changes
git add app/calendar/page.tsx
git commit -m "Add photo notifications and 3-day retention"
git push

# Vercel will auto-deploy
```

## Verification

### Check Notifications Table
```sql
SELECT * FROM notifications LIMIT 5;
```
Should return table structure (may be empty).

### Check Cron Job
```sql
SELECT * FROM cron.job WHERE jobname = 'cleanup-old-photos-daily';
```
Should show scheduled job.

### Test Photo Upload
1. Upload a photo to a care block
2. Check notifications table:
```sql
SELECT * FROM notifications
WHERE type = 'photo_upload'
ORDER BY created_at DESC
LIMIT 1;
```

### Test Cleanup (Manual)
```bash
curl -X POST \
  https://YOUR-PROJECT-REF.supabase.co/functions/v1/cleanup-old-photos \
  -H "Authorization: Bearer YOUR-SERVICE-ROLE-KEY"
```

Should return:
```json
{
  "success": true,
  "deletedPhotos": 0,
  "deletedBlocks": 0,
  "message": "No old photos found"
}
```

## Configuration

### Retention Period (N=3 days currently)

To change retention period, update in **2 places**:

**1. Database Function:**
`migrations/add_photo_notifications_and_cleanup.sql`
- Line with `INTERVAL '3 days'` → Change to `INTERVAL 'N days'`

**2. Edge Function:**
`supabase/functions/cleanup-old-photos/index.ts`
- Line with `.setDate(cutoffDate.getDate() - 3)` → Change to `- N`

Then redeploy both.

## Monitoring

### View Cleanup History
Check Edge Function logs:
- Supabase Dashboard → Edge Functions → cleanup-old-photos → Logs

### Check Upcoming Deletions
```sql
SELECT
    COUNT(*) as blocks_to_clean,
    SUM(array_length(photo_urls, 1)) as photos_to_delete
FROM scheduled_care
WHERE care_date <= CURRENT_DATE - INTERVAL '3 days'
AND photo_urls IS NOT NULL;
```

### Check Recent Notifications
```sql
SELECT
    p.full_name,
    n.message,
    n.created_at,
    n.is_read
FROM notifications n
JOIN profiles p ON n.user_id = p.id
WHERE n.type = 'photo_upload'
ORDER BY n.created_at DESC
LIMIT 10;
```

## Troubleshooting

### Notifications not working?
- Check `notifications` table exists
- Check `notify_photo_upload` function exists
- Check RLS policies on notifications table
- Check browser console for errors

### Cleanup not running?
- Check cron job is scheduled: `SELECT * FROM cron.job;`
- Check edge function is deployed
- Check service role key is correct
- Manually trigger to test: curl command above
- Check Edge Function logs for errors

### Photos not being deleted?
- Check care_date is actually > 3 days old
- Manually run cleanup function
- Check Edge Function logs
- Verify storage bucket permissions

## Rollback

If needed to disable:

**Disable Cron Job:**
```sql
SELECT cron.unschedule('cleanup-old-photos-daily');
```

**Disable Notifications:**
```sql
-- Comment out notification call in frontend
-- Or delete notify_photo_upload function
DROP FUNCTION IF EXISTS notify_photo_upload;
```

## Summary

After deployment:
- ✅ Users notified when photos uploaded
- ✅ Notification includes 3-day warning
- ✅ Photos auto-deleted 3 days after care date
- ✅ Daily cleanup runs automatically
- ✅ Storage costs managed
- ✅ Users have time to download

See `PHOTO_RETENTION_AND_NOTIFICATIONS.md` for full documentation.
