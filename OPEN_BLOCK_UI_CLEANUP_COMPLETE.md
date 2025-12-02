# Open Block Messages UI Cleanup - Complete

## Changes Made

### 1. Removed Duplicate Invitation Messages (line 480)
**Before:** Accepted open blocks showed BOTH:
- "Rosmary is opening Nov 1, 2025 from 08:00 to 09:00 block to Emma's Care Group" (invitation)
- "You accepted Rosmary's open block..." (acceptance message)

**After:** Only shows the acceptance message. Removed accepted invitations from the invitation filter.

```typescript
// Changed from:
return invitation.status === 'pending' || invitation.is_acceptor_view;

// To:
return invitation.status === 'pending';
```

### 2. Updated Message Title to Show Group (lines 621-626)
**Before:** "You accepted Rosmary's open block for Nov 1, 2025 (08:00 to 09:00)"

**After:** "You accepted Rosmary's open block for Emma's Care Group"

```typescript
const groupName = invitation.group_name;
title: `You accepted ${providerName}'s open block for ${groupName}`
```

### 3. Simplified Expanded Block Display (lines 1032-1132)
Removed redundant information from both blocks:

**Acceptor View - Block 1 (Receive care):**
- ❌ Removed: "From: Rosmary"
- ❌ Removed: "Group: Emma's Care Group"
- ✅ Kept: Date and time
- ✅ Kept: "View in Calendar" button

**Acceptor View - Block 2 (Provide care):**
- ❌ Removed: "For: Rosmary"
- ❌ Removed: "Group: Emma's Care Group"
- ✅ Kept: Date and time
- ✅ Kept: "View in Calendar" button

**Provider View - Both blocks:**
- ❌ Removed: "For:" and "From:" labels
- ❌ Removed: "Group:" label
- ✅ Kept: Date and time
- ✅ Kept: "View in Calendar" buttons

## Result

### Clean Message Display:
```
You accepted Rosmary's open block for Emma's Care Group
Nov 2, 2025                                           [Accepted ▼]

  You will receive care
  Nov 1, 2025 from 08:00 to 09:00
  [View in Calendar]

  You will provide care (Reciprocal)
  Nov 4, 2025 from 13:00 to 17:00
  [View in Calendar]
```

## Benefits
1. **No duplication** - Invitation messages no longer show for accepted blocks
2. **Clearer context** - Group name in title provides better context than time
3. **Less clutter** - Removed redundant "From/For/Group" labels since:
   - The provider/acceptor name is already in the message title
   - The group is in the title
   - Users mainly care about the date/time for each block

## Build Status
✓ Build successful
✓ Scheduler bundle: 16.2 kB
