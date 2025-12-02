# Reciprocal Care Notes Sharing Fix

## Issue
Provider could update notes for reciprocal care blocks, but the notes were not propagated to the receiver's block. The receiver could not see the updated notes.

## Root Cause
The calendar page used complex client-side logic with multiple fallback strategies to update the receiver's notes. This approach was unreliable and often failed silently.

## Solution
Created a proper database function `update_reciprocal_care_notes()` that:
1. Validates the user is the provider
2. Updates the provider's block
3. Finds and updates the receiver's block using two strategies:
   - Strategy 1: Match via `related_request_id` (most reliable)
   - Strategy 2: Match via care details (date, time, group) as fallback
4. Returns success message with count of updated blocks

## Files Changed

### 1. `migrations/20250122000017_add_reciprocal_update_notes.sql`
**New Function:** `update_reciprocal_care_notes(p_scheduled_care_id, p_parent_id, p_new_notes)`

**What it does:**
- Validates block is reciprocal care ('provided' or 'needed')
- Validates user is the provider
- Updates provider's block with new notes
- Updates receiver's block with "Reciprocal care for: [notes]"
- Uses two fallback strategies to find receiver's block
- Returns count of updated blocks

**Security:**
- Only provider can update notes
- Validates ownership before updates
- Uses `SECURITY DEFINER` for proper permissions

### 2. `app/calendar/page.tsx` (lines 1875-1920)
**Changes:**
- Replaced 150+ lines of complex client-side update logic
- Now calls `update_reciprocal_care_notes` RPC function
- Shows success message with participant count
- Button text changed to "Save Notes (Share with Receiver)"

## Before vs After

### Before:
```typescript
// Complex logic with 3 fallback methods
// - Try related_request_id
// - Try opposite care_type matching
// - Try all related records
// Often failed silently
// No feedback on success/failure
```

### After:
```typescript
const { data, error } = await supabase.rpc('update_reciprocal_care_notes', {
  p_scheduled_care_id: selectedCare.id,
  p_parent_id: user.id,
  p_new_notes: selectedCare.notes || ''
});
// Clean, reliable, with proper error handling
```

## User Experience

### Provider's View:
1. Opens their "Providing Care" block (green)
2. Edits notes field
3. Clicks "Save Notes (Share with Receiver)"
4. Success message: "Successfully updated notes for 2 participants (provider and receiver)"

### Receiver's View:
1. Opens their "Receiving Care" block (blue)
2. Sees read-only notes: "Reciprocal care for: [provider's notes]"
3. Notes update automatically when provider changes them (after refresh)

## Technical Details

### Database Function Logic:
```sql
-- Update provider's block
UPDATE scheduled_care
SET notes = p_new_notes, updated_at = NOW()
WHERE id = p_scheduled_care_id;

-- Strategy 1: Update via related_request_id
UPDATE scheduled_care
SET notes = 'Reciprocal care for: ' || p_new_notes
WHERE related_request_id = v_related_request_id
AND care_type = 'needed';

-- Strategy 2: Update by matching care details (fallback)
UPDATE scheduled_care
SET notes = 'Reciprocal care for: ' || p_new_notes
WHERE care_date = v_care_date
AND start_time = v_start_time
AND end_time = v_end_time
AND group_id = v_group_id
AND care_type = 'needed'
AND parent_id != p_parent_id;
```

### Note Format:
- **Provider sees:** "Pick up at 3pm, snacks provided"
- **Receiver sees:** "Reciprocal care for: Pick up at 3pm, snacks provided"

This prefix helps distinguish that these are care instructions from the provider.

## Benefits

1. **Reliable:** Database function ensures notes are always propagated
2. **Clean Code:** Removed 150+ lines of complex client logic
3. **Better UX:** Clear success messages with participant count
4. **Consistent:** Same pattern as hangout/sleepover notes
5. **Maintainable:** Single source of truth in database function

## Testing Checklist

- [ ] Provider can edit notes for 'provided' care block
- [ ] Notes propagate to receiver's 'needed' care block
- [ ] Receiver sees "Reciprocal care for: [notes]" prefix
- [ ] Success message shows correct participant count
- [ ] Non-provider cannot update notes (gets error)
- [ ] Works with related_request_id (Strategy 1)
- [ ] Works without related_request_id (Strategy 2 fallback)
- [ ] Calendar refresh shows updated notes for both parties

## Deployment

1. Run migration: `20250122000017_add_reciprocal_update_notes.sql`
2. Frontend changes are already in `app/calendar/page.tsx`
3. No additional configuration needed

## Related Functions

This fix completes the notes sharing system:
- **Reciprocal Care:** `update_reciprocal_care_notes()` (NEW)
- **Hangout/Sleepover:** `update_hangout_sleepover_notes()` (already implemented)
- **Events/Open Blocks:** Owner can always edit (no sharing needed)
