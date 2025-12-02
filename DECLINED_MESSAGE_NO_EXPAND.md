# Declined Messages - Non-Expandable Update

## Change Made
Removed expand functionality from "Not Accepted" (care_declined) messages.

## Implementation (app/scheduler/page.tsx)

### 1. Disabled Click Handler (lines 868-878)
```typescript
<div
  className={`p-4 bg-gray-50 transition-colors ${message.type !== 'care_declined' ? 'hover:bg-gray-100 cursor-pointer' : ''}`}
  onClick={() => {
    // Don't allow expansion for care_declined messages
    if (message.type === 'care_declined') return;

    toggleExpanded(message.id);
    // Mark as read when expanded
    if (unreadMessages.has(message.id)) {
      markMessageAsRead(message.id);
    }
  }}
>
```

**Changes:**
- Added conditional class: Only show hover effect and cursor-pointer if NOT care_declined
- Added early return in onClick: Prevents expansion for care_declined messages

### 2. Removed Expand Arrow (lines 956-968)
```typescript
{/* Only show expand arrow for messages that have expandable content */}
{message.type !== 'group_invitation' && message.type !== 'care_declined' && (
  <svg className={...}>
    {/* Arrow icon */}
  </svg>
)}
```

**Changes:**
- Added `message.type !== 'care_declined'` condition
- Updated comment to reflect new logic

## Result

### Before:
```
Your reciprocal response for Nov 1, 2025 was not accepted
Nov 2, 2025                                    [Not Accepted ▼]
                                                            ↑ dropdown arrow

(Clickable, could expand but showed nothing)
```

### After:
```
Your reciprocal response for Nov 1, 2025 was not accepted
Nov 2, 2025                                    [Not Accepted]
                                                            ↑ no arrow

(Not clickable, no hover effect, message stands alone)
```

## Benefits
1. **Clearer UX** - No visual cue suggesting there's more content
2. **Better Design** - Message is self-contained and complete
3. **Reduced Confusion** - Users won't try to click/expand
4. **Consistent Pattern** - Similar to group invitations that have inline actions

## Build Status
✓ Build successful
✓ Scheduler bundle: 16.1 kB (maintained)

## No SQL Changes Required
Frontend-only change to UI behavior.
