# Hangout/Sleepover Shared Notes Feature

## Overview
The host of a hangout/sleepover can now update the notes field, and all participants (both host and attending parents) will see the updated notes in their calendar blocks.

## How It Works

### For Hosts (Organizers):
1. Open the hangout/sleepover block from the calendar
2. Edit the notes field
3. Click "Save Notes (Share with All)" button
4. Notes are instantly propagated to all attending parents' blocks
5. Success message shows how many participants received the update

### For Attending Parents:
1. Open the hangout/sleepover block from their calendar
2. Can **view** the notes that the host has set
3. **Cannot edit** the notes (no Save button visible)
4. Will automatically see updates when the host changes the notes (after refreshing)

## Technical Implementation

### 1. Database Function
**File:** `migrations/20250122000016_add_hangout_update_notes.sql`

**Function:** `update_hangout_sleepover_notes(p_scheduled_care_id, p_parent_id, p_new_notes)`

**What it does:**
- Validates the block is a hangout/sleepover
- Validates the parent is the host (original requester)
- Updates the host's block notes
- Finds all attending parents' blocks via `related_request_id`
- Updates all attending blocks with the same notes
- Returns count of updated blocks

**Security:**
- `SECURITY DEFINER` for proper permissions
- Validates host identity before allowing updates
- Only the original requester can update notes

### 2. Frontend Implementation
**File:** `app/calendar/page.tsx` (lines 1815-1860)

**Added:**
- "Save Notes (Share with All)" button for hangout/sleepover hosts
- Button only shows if `care_type` is 'hangout' or 'sleepover' AND `is_host` is true
- Calls `update_hangout_sleepover_notes` RPC function
- Shows success message with participant count
- Refreshes calendar to display updated notes

**UI Behavior:**
- Button is green when notes are modified
- Button is gray/disabled when no changes
- Button text: "Save Notes (Share with All)" or "No Changes"

## User Experience

### Example Scenario:
1. **Alice** creates a hangout for Saturday 3-5 PM with her child **Emma**
2. Alice invites **Bob's** child **Max**
3. Bob accepts the invitation
4. Both Alice and Bob now have calendar blocks for this hangout

**Alice's View (Host):**
- Green calendar block (hosting)
- Can edit notes field
- Has "Save Notes (Share with All)" button
- Updates notes: "Bring snacks and games!"

**Bob's View (Attending):**
- Blue calendar block (attending)
- Can see notes: "Bring snacks and games!"
- No "Save Notes" button visible
- Notes are read-only

## Benefits

1. **Centralized Communication:** Host can share important information about the event
2. **No Confusion:** Only host can edit, preventing conflicting messages
3. **Instant Sync:** All participants see the same notes
4. **Practical Use Cases:**
   - "Bring swim suits for the pool!"
   - "We're having pizza for dinner"
   - "Please drop off at the back door"
   - "Pickup is at 8 AM"

## Technical Details

### Database Schema:
- Uses existing `notes` field in `scheduled_care` table
- Uses `related_request_id` to link all blocks for the same event
- Uses `is_host` boolean to determine who can edit

### Permission Logic:
```sql
-- Only the requester (host) can update notes
IF v_requester_id IS NULL OR v_requester_id != p_parent_id THEN
    RETURN QUERY SELECT FALSE, 'Only the host can update notes for this event'::TEXT, 0;
    RETURN;
END IF;
```

### Propagation Logic:
```sql
-- Update all attending parents' blocks with the same notes
UPDATE scheduled_care
SET
    notes = p_new_notes,
    updated_at = NOW()
WHERE related_request_id = v_related_request_id
AND care_type = v_care_type
AND id != p_scheduled_care_id;  -- Don't update the host's block again
```

## Deployment

1. Run migration: `20250122000016_add_hangout_update_notes.sql`
2. Frontend changes are already in `app/calendar/page.tsx`
3. No additional configuration needed

## Testing Checklist

- [ ] Host can edit notes and save
- [ ] Attending parent can view notes
- [ ] Attending parent cannot see "Save Notes" button
- [ ] Notes propagate to all attending parents
- [ ] Success message shows correct participant count
- [ ] Non-host attempting to save gets error message
- [ ] Works for both hangout and sleepover types
- [ ] Calendar refresh shows updated notes for all participants

## Future Enhancements

Possible improvements:
- Real-time sync (via WebSocket/Supabase Realtime)
- Notes history/changelog
- Email notification when host updates notes
- Character limit or formatting options
