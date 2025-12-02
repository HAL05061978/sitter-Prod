# Hangout & Sleepover Final Fixes

## Summary
Fixed three critical issues with hangout/sleepover functionality:
1. **Messages counter not showing** - Hangout/sleepover invitations weren't counted
2. **Sleepover not working** - Same as hangout but with overnight support
3. **Time constraint error** - `valid_care_time_range` prevented overnight events

## Files Changed

### 1. `app/components/Header.tsx`
**Issue:** Messages button counter wasn't including hangout/sleepover invitations

**Fix:**
- Added fetch for `get_hangout_sleepover_invitations` RPC function
- Added counter for pending hangout/sleepover invitations
- Lines 169-176: Fetch hangout invitations
- Lines 249-253: Count pending invitations

### 2. `migrations/20250122000013_add_is_host_to_calendar.sql`
**Issue:** Calendar colors relied on notes field to distinguish hosting vs attending

**Fix:**
- Updated `get_scheduled_care_for_calendar` function to return `is_host` boolean
- For hangout/sleepover: `is_host = true` if `parent_id = requester_id`, else `false`
- This allows proper color coding without polluting the notes field

### 3. `migrations/20250122000014_clean_hangout_notes.sql`
**Issue:** Accept function added "Attending..." prefix to notes field

**Fix:**
- Updated `accept_hangout_sleepover_invitation` to remove programmatic text from notes
- Notes field now uses original request notes without modification
- Parents can freely use notes field for their own purposes

### 4. `migrations/20250122000015_fix_sleepover_and_time_constraint.sql`
**Issue:**
- `valid_care_time_range` constraint blocked overnight events
- Hangout function didn't support overnight times
- Sleepover function needed updating

**Fix:**
- **Part 1:** Dropped `valid_care_time_range` constraint from `scheduled_care` table
- **Part 2:** Updated `create_hangout_invitation` function:
  - Added optional `p_end_date` parameter
  - Automatically detects overnight (when `end_time < start_time`)
  - Sets `end_date` to next day for overnight hangouts
- **Part 3:** Updated `create_sleepover_invitation` function to match hangout pattern

### 5. `app/calendar/page.tsx`
**Issue:** Color logic used notes field to determine hosting vs attending

**Fix:**
- Added `is_host?: boolean` to `ScheduledCare` interface
- Updated `getCareTypeColor()` to use `isHost` parameter instead of `notes`
- Updated `getCareTypeBgColor()` to use `isHost` parameter instead of `notes`
- Updated all 4 call sites to pass `care.is_host` instead of `care.notes`

## Color Scheme
- **Hosting** (creating hangout/sleepover) → **Green block** 🟩
- **Attending** (accepted invitation) → **Blue block** 🟦

This matches the reciprocal care color scheme:
- Providing care = Green
- Receiving care = Blue

## How Overnight Events Work

### Hangouts
- If `end_time < start_time` (e.g., 8:00 PM to 1:00 AM), function automatically sets `end_date` to next day
- Calendar can also pass explicit `p_end_date` if needed

### Sleepovers
- Always require explicit `end_date` (must be > `care_date`)
- Function validates that `end_date > care_date`

## Deployment Order
Run migrations in this order:
1. `20250122000013_add_is_host_to_calendar.sql` - Adds is_host field
2. `20250122000014_clean_hangout_notes.sql` - Cleans up notes usage
3. `20250122000015_fix_sleepover_and_time_constraint.sql` - Fixes constraints and functions

Then deploy frontend changes:
- `app/components/Header.tsx` - Counter fix
- `app/calendar/page.tsx` - Color logic fix

## Testing Checklist
- [ ] Create a hangout invitation (same day)
- [ ] Create a hangout invitation (overnight, e.g., 8 PM to 1 AM)
- [ ] Create a sleepover invitation (multi-day)
- [ ] Accept a hangout invitation
- [ ] Accept a sleepover invitation
- [ ] Verify Messages button counter shows pending invitations
- [ ] Verify hosting parent sees green block
- [ ] Verify attending parent sees blue block
- [ ] Verify all children appear in both blocks after acceptance
- [ ] Verify notes field is editable without affecting colors
