# Hangout & Sleepover Photo Support

## Overview
Extended photo upload functionality to support Hangouts and Sleepovers. The host can upload photos that all attendees can view.

## How It Works

### For Hosts:
1. Host views their Hangout/Sleepover block in calendar
2. Sees camera button next to "Photos" label
3. Can upload photos via camera or gallery
4. Photos are stored in the host's block
5. Can delete photos they uploaded

### For Attendees:
1. Attendee views their Hangout/Sleepover block in calendar
2. Sees "Photos from Host" section (read-only)
3. Can view all photos uploaded by the host
4. Can click photos to view full size
5. Cannot delete host's photos

## Photo Sharing Logic

Similar to Providing/Receiving care blocks:

```
Host uploads photo → Stored in host's block (where is_host = TRUE)
                          ↓
Attendee views block → Function finds host's block via related_request_id
                          ↓
                   Returns photos from host's block
                          ↓
                   Attendee sees the same photos!
```

### Database Function Logic:
```sql
WHEN sc.care_type IN ('hangout', 'sleepover') THEN
    COALESCE(
        -- Find the host's block and get their photos
        (SELECT host_care.photo_urls
         FROM scheduled_care host_care
         JOIN care_requests cr ON host_care.related_request_id = cr.id
         WHERE host_care.parent_id = cr.requester_id  -- Host is the requester
         AND [matching date/time/group]
         LIMIT 1),
        sc.photo_urls  -- Fallback if you ARE the host
    )
```

## Frontend Changes

### Upload Section:
```typescript
// Shows for: Provided care OR Hangout/Sleepover hosts
{(selectedCare.care_type === 'provided' ||
  ((selectedCare.care_type === 'hangout' || selectedCare.care_type === 'sleepover') &&
   selectedCare.is_host)) && (
  // Camera button with upload menu
)}
```

### Display Section:
```typescript
// Shows for: Receiving care OR Hangout/Sleepover attendees
{((selectedCare.care_type === 'needed') ||
  ((selectedCare.care_type === 'hangout' || selectedCare.care_type === 'sleepover') &&
   !selectedCare.is_host)) && (
  // Read-only photo grid
  // Label: "Photos from Host" or "Photos from Care Provider"
)}
```

## Deployment

The changes are included in the updated migration:
- **File**: `migrations/add_photo_urls_to_calendar_function.sql`
- **What it does**:
  1. Updates `get_scheduled_care_for_calendar` to share photos from host to attendees
  2. Uses `is_host` field to determine who is the host
  3. Matches blocks via `related_request_id` and `requester_id`

## Testing

### As Host:
- [ ] Create a Hangout or Sleepover
- [ ] View the block in calendar - should see camera button
- [ ] Upload photo - should appear immediately
- [ ] Refresh - photo should persist
- [ ] Delete photo - should work

### As Attendee:
- [ ] View your Hangout/Sleepover block (where you're not the host)
- [ ] Should see "Photos from Host" section
- [ ] Should see all photos uploaded by host
- [ ] Click photo - should open full size
- [ ] Should NOT see delete button (read-only)

## Benefits

✅ Single source of truth (host's photos)
✅ No duplicate storage
✅ All participants see the same photos
✅ Host controls photo uploads/deletions
✅ Attendees can view but not modify
✅ Consistent with Providing/Receiving care pattern
