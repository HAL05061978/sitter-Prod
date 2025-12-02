# Hangout/Sleepover UI Integration Guide

## Summary

The hangout creation function is working correctly and creating proper database records. However, the UI needs updates to display this data properly.

## Database Status ✅

All database functions and tables are working correctly:
- `care_requests` contains the hangout invitation
- `scheduled_care` has the host's block
- `scheduled_care_children` contains the hosting children
- `care_responses` has invitations for each invited parent

## Fixed Issues

### 1. Calendar Display (Fixed)

**Migration:** `migrations/20250122000009_fix_hangout_ui_display.sql`

Updated `get_scheduled_care_for_calendar` function to handle hangout/sleepover care types:
- Now shows the hosting parent as "Provider"
- Correctly displays children from `scheduled_care_children` table
- Works for hangout, sleepover, event, and open_block types

**Action Required:**
1. Run the migration in Supabase SQL Editor
2. Refresh the calendar page - blocks should now show correct provider and children

### 2. Invitations Display (Database Fixed, UI Needs Update)

**Migration:** `migrations/20250122000009_fix_hangout_ui_display.sql`

Created new function `get_hangout_sleepover_invitations` that returns:
- Host parent name
- Hosting children names
- Invited child details
- Date/time information
- Request type (hangout or sleepover)

**Action Required - UI Updates:**

The scheduler page (`app/scheduler/page.tsx`) currently only shows open block invitations. You need to add a section for hangout/sleepover invitations.

#### Option 1: Add to Existing Invitations Section

Add hangout/sleepover invitations to the existing `OpenBlockInvitationsSection`:

```typescript
// In app/scheduler/page.tsx, update the fetch function

const fetchInvitations = async () => {
  // ... existing code ...

  // Fetch hangout/sleepover invitations
  const { data: hangoutData, error: hangoutError } = await supabase.rpc(
    'get_hangout_sleepover_invitations',
    { p_parent_id: user.id }
  );

  if (!hangoutError && hangoutData) {
    // Merge with existing invitations or display separately
    setHangoutInvitations(hangoutData);
  }
};
```

Then display them with appropriate UI:

```typescript
{hangoutInvitations.map((invitation) => (
  <div key={invitation.care_response_id} className="border rounded p-4">
    <div className="font-semibold">
      {invitation.request_type === 'hangout' ? 'Hangout' : 'Sleepover'} Invitation
    </div>
    <div>Host: {invitation.host_parent_name}</div>
    <div>Hosting children: {invitation.hosting_children_names.join(', ')}</div>
    <div>Your child invited: {invitation.invited_child_name}</div>
    <div>
      {invitation.requested_date} from {invitation.start_time} to {invitation.end_time}
    </div>
    {invitation.end_date && (
      <div>Until: {invitation.end_date} at {invitation.end_time}</div>
    )}
    <div className="mt-2">
      <button onClick={() => handleAcceptHangout(invitation)}
              className="bg-green-500 text-white px-4 py-2 rounded mr-2">
        Accept
      </button>
      <button onClick={() => handleDeclineHangout(invitation)}
              className="bg-red-500 text-white px-4 py-2 rounded">
        Decline
      </button>
    </div>
  </div>
))}
```

#### Option 2: Create Separate Component

Create a new component similar to `OpenBlockInvitationsSection`:

```typescript
function HangoutSleepoverInvitationsSection() {
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHangoutInvitations();
  }, []);

  const fetchHangoutInvitations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.rpc('get_hangout_sleepover_invitations', {
      p_parent_id: user.id
    });

    if (!error) {
      setInvitations(data || []);
    }
    setLoading(false);
  };

  // ... rest of component with accept/decline handlers
}
```

### 3. Accept/Decline Handlers (TODO)

You'll need to create functions to handle accepting/declining hangout invitations. These should:

**Accept Handler:**
- Create a `scheduled_care` block for the accepting parent
- Add the invited child to `scheduled_care_children`
- Update the `care_response` status to 'accepted'
- Link the blocks via `related_request_id`

**Decline Handler:**
- Update the `care_response` status to 'declined'
- Optionally add decline reason/notes

## Testing Checklist

After applying the migration and UI updates:

- [ ] Calendar shows hosting parent's block with correct provider name
- [ ] Calendar shows hosting children names in the block
- [ ] Scheduler page shows pending hangout invitations
- [ ] Invited parents can see invitation details (host, date, time, children)
- [ ] Accept button creates appropriate blocks
- [ ] Decline button updates invitation status
- [ ] Real-time updates work when invitations are accepted/declined

## Next Steps

1. **Apply Database Migration** (Do this first)
   ```sql
   -- Run in Supabase SQL Editor
   -- File: migrations/20250122000009_fix_hangout_ui_display.sql
   ```

2. **Test Calendar Display**
   - Refresh calendar page
   - Verify hosting parent's block shows correct data

3. **Update Scheduler UI**
   - Choose Option 1 or 2 above
   - Implement invitation display
   - Add accept/decline handlers

4. **Create Accept/Decline Functions**
   - These can be similar to open block acceptance
   - Will need database functions for these operations

## Files to Update

1. `migrations/20250122000009_fix_hangout_ui_display.sql` - Apply this first ✅
2. `app/scheduler/page.tsx` - Add hangout invitation display
3. (Optional) Create new component for hangout invitations
4. (Future) Create accept/decline database functions

## Questions?

If you need help with:
- Accept/decline function implementation
- UI component structure
- Database queries for these operations

Just let me know!
