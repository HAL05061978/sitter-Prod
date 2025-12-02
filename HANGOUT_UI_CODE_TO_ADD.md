# Hangout/Sleepover UI Code to Add

## Summary of Changes Made

### ✅ COMPLETED:
1. **Calendar UI Fixed** - `app/calendar/page.tsx` now shows "Hosting Hangout/Sleepover" instead of "Receiving Care"
2. **Database Functions Created**:
   - `get_hangout_sleepover_invitations` - Fetches pending invitations
   - `accept_hangout_sleepover_invitation` - Accepts invitation and creates receiving block
   - `decline_hangout_sleepover_invitation` - Declines invitation

### ⚠️ PENDING:
- Update `app/scheduler/page.tsx` to display hangout invitations

## Files to Apply (in order)

### 1. Migration (Apply this in Supabase SQL Editor)
```sql
-- File: migrations/20250122000010_add_hangout_accept_decline_functions.sql
```

This creates the accept/decline functions.

### 2. Scheduler UI Updates

Add the following code to `app/scheduler/page.tsx`:

#### Step 1: Add state variable (around line 331, with other state variables)

```typescript
const [hangoutInvitations, setHangoutInvitations] = useState<any[]>([]);
```

#### Step 2: Add fetch function (around line 1906, after `fetchOpenBlockInvitations`)

```typescript
const fetchHangoutInvitations = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.rpc('get_hangout_sleepover_invitations', {
      p_parent_id: user.id
    });

    if (error) {
      console.error('Error fetching hangout/sleepover invitations:', error);
      return;
    }

    console.log('✅ Hangout/sleepover invitations fetched:', data);
    setHangoutInvitations(data || []);
  } catch (error) {
    console.error('Error fetching hangout/sleepover invitations:', error);
  }
};
```

#### Step 3: Call fetch function in useEffect (around line 1046)

Find where `fetchOpenBlockInvitations()` is called and add `fetchHangoutInvitations()`:

```typescript
fetchOpenBlockInvitations();
fetchGroupInvitations();
fetchEventInvitations();
fetchHangoutInvitations(); // ADD THIS LINE
```

#### Step 4: Add accept handler (around line 1770, after handleAcceptOpenBlockInvitation)

```typescript
const handleAcceptHangoutInvitation = async (invitation: any, childId: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.rpc('accept_hangout_sleepover_invitation', {
      p_care_response_id: invitation.care_response_id,
      p_accepting_parent_id: user.id,
      p_invited_child_id: childId
    });

    if (error) {
      console.error('Error accepting invitation:', error);
      showAlertOnce('Failed to accept invitation: ' + error.message);
      return;
    }

    console.log('✅ Hangout/sleepover invitation accepted:', data);
    showAlertOnce(`${invitation.request_type === 'hangout' ? 'Hangout' : 'Sleepover'} invitation accepted successfully!`);

    // Refresh invitations
    await fetchHangoutInvitations();

    // Update the Header counter immediately
    window.dispatchEvent(new Event('schedulerUpdated'));

  } catch (error) {
    console.error('Error accepting invitation:', error);
    showAlertOnce('Failed to accept invitation');
  }
};

const handleDeclineHangoutInvitation = async (invitation: any, reason?: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.rpc('decline_hangout_sleepover_invitation', {
      p_care_response_id: invitation.care_response_id,
      p_declining_parent_id: user.id,
      p_decline_reason: reason || null
    });

    if (error) {
      console.error('Error declining invitation:', error);
      showAlertOnce('Failed to decline invitation: ' + error.message);
      return;
    }

    console.log('✅ Hangout/sleepover invitation declined:', data);
    showAlertOnce('Invitation declined');

    // Refresh invitations
    await fetchHangoutInvitations();

    // Update the Header counter immediately
    window.dispatchEvent(new Event('schedulerUpdated'));

  } catch (error) {
    console.error('Error declining invitation:', error);
    showAlertOnce('Failed to decline invitation');
  }
};
```

#### Step 5: Add invitations to inboxItems array (around line 690)

Find where `groupInvitations.forEach` and `eventInvitations.forEach` are located, and add:

```typescript
// Add hangout/sleepover invitations
hangoutInvitations.forEach((invitation, index) => {
  inboxItems.push({
    id: `hangout-${invitation.care_response_id}`,
    type: invitation.request_type, // 'hangout' or 'sleepover'
    priority: 2,
    date: invitation.created_at,
    data: invitation
  });
});
```

#### Step 6: Add rendering case in the inbox switch statement

Find the switch statement that renders different invitation types (around where groupInvitation and eventInvitation cases are), and add:

```typescript
case 'hangout':
case 'sleepover':
  return (
    <div key={item.id} className="bg-white border border-purple-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-2xl">
              {item.type === 'hangout' ? '🎉' : '🌙'}
            </span>
            <h3 className="font-semibold text-gray-900">
              {item.type === 'hangout' ? 'Hangout' : 'Sleepover'} Invitation
            </h3>
            <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">
              Invitation
            </span>
          </div>

          <div className="ml-9 space-y-1 text-sm text-gray-600">
            <p>
              <span className="font-medium">Host:</span> {item.data.host_parent_name}
            </p>
            <p>
              <span className="font-medium">Your child:</span> {item.data.invited_child_name}
            </p>
            {item.data.hosting_children_names && item.data.hosting_children_names.length > 0 && (
              <p>
                <span className="font-medium">Hosting children:</span> {item.data.hosting_children_names.join(', ')}
              </p>
            )}
            <p>
              <span className="font-medium">When:</span> {formatDateOnly(item.data.requested_date)} from {item.data.start_time} to {item.data.end_time}
            </p>
            {item.data.end_date && (
              <p>
                <span className="font-medium">Until:</span> {formatDateOnly(item.data.end_date)} at {item.data.end_time}
              </p>
            )}
            <p>
              <span className="font-medium">Group:</span> {item.data.group_name}
            </p>
            {item.data.notes && (
              <p className="mt-2">
                <span className="font-medium">Notes:</span> {item.data.notes}
              </p>
            )}
          </div>

          <div className="ml-9 mt-3 flex gap-2">
            <button
              onClick={() => handleAcceptHangoutInvitation(item.data, item.data.invited_child_id)}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
            >
              Accept
            </button>
            <button
              onClick={() => handleDeclineHangoutInvitation(item.data)}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
            >
              Decline
            </button>
          </div>
        </div>

        <div className="text-xs text-gray-500">
          {formatDateOnly(item.data.created_at)}
        </div>
      </div>
    </div>
  );
```

## Testing Checklist

After making these changes:

- [ ] Apply migration `migrations/20250122000010_add_hangout_accept_decline_functions.sql`
- [ ] Restart your Next.js dev server
- [ ] Check that invited parents see hangout invitations in their scheduler/messages
- [ ] Test accepting an invitation:
  - [ ] Creates a "Receiving Care" block for the invited parent
  - [ ] Shows the invited child in the block
  - [ ] Calendar refreshes automatically
- [ ] Test declining an invitation:
  - [ ] Removes invitation from inbox
  - [ ] Updates invitation count in header
- [ ] Verify hosting parent's calendar block shows:
  - [ ] "Hosting Hangout" label
  - [ ] Provider name (hosting parent)
  - [ ] Hosting children names

## Quick Implementation

If you want me to directly add this code to your scheduler page, just say "add hangout UI to scheduler" and I'll make all the edits for you!

## Notes

- The invitations will appear in the unified inbox alongside group invitations, event invitations, and care requests
- The priority is set to 2 (between care requests at 1 and group invitations at 3)
- Real-time updates are handled via the existing `schedulerUpdated` event
- The code follows the same pattern as existing invitation types for consistency
