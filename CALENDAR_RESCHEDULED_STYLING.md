# Calendar Rescheduled Block Styling

## Frontend Update Needed

The calendar component needs to be updated to display blocks with `action_type = 'rescheduled'` and `status = 'rescheduled'` in orange color.

### Current Status Values:
- `'confirmed'` - Green (normal providing care)
- `'cancelled'` - Gray/Red (cancelled blocks)
- `'rescheduled'` - **Orange** (new - pending reschedule responses)

### Implementation:

In your calendar component, update the block styling logic:

```typescript
// Example styling logic
const getBlockColor = (block: ScheduledCare) => {
  if (block.action_type === 'rescheduled' && block.status === 'rescheduled') {
    return 'bg-orange-500'; // Orange for rescheduled blocks
  }
  if (block.status === 'confirmed') {
    return 'bg-green-500'; // Green for confirmed blocks
  }
  if (block.status === 'cancelled') {
    return 'bg-red-500'; // Red for cancelled blocks
  }
  return 'bg-blue-500'; // Default blue
};
```

### Visual Distinction:
- **Orange blocks**: Indicate a reschedule request is pending
- **Shows all children** except the requester's child
- **Remains visible** until all parents respond to the reschedule request

### Database Changes Applied:
1. Added `'rescheduled'` to `scheduled_care_status_check` constraint
2. Updated reschedule functions to use `status = 'rescheduled'`
3. Original blocks now show as orange when reschedule is requested
