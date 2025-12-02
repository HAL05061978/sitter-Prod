# Reschedule Message - Inline Buttons Update - Complete

## Changes Made

Removed the expand/collapse functionality from reschedule request messages and moved the Accept/Decline buttons to be displayed inline next to the badge, similar to group invitations.

### 1. Disabled Expand Functionality (lines 872, 875)

**Before:**
```typescript
className={`p-4 bg-gray-50 transition-colors ${message.type !== 'care_declined' ? 'hover:bg-gray-100 cursor-pointer' : ''}`}
onClick={() => {
  if (message.type === 'care_declined') return;
  toggleExpanded(message.id);
}}
```

**After:**
```typescript
className={`p-4 bg-gray-50 transition-colors ${message.type !== 'care_declined' && message.type !== 'reschedule_request' ? 'hover:bg-gray-100 cursor-pointer' : ''}`}
onClick={() => {
  if (message.type === 'care_declined' || message.type === 'reschedule_request') return;
  toggleExpanded(message.id);
}}
```

**Impact:** Reschedule messages no longer show hover effect or respond to clicks for expansion

### 2. Removed Expand Arrow (line 970)

**Before:**
```typescript
{message.type !== 'group_invitation' && message.type !== 'care_declined' && (
  <svg>...</svg>
)}
```

**After:**
```typescript
{message.type !== 'group_invitation' && message.type !== 'care_declined' && message.type !== 'reschedule_request' && (
  <svg>...</svg>
)}
```

**Impact:** No dropdown arrow shown for reschedule messages

### 3. Added Inline Accept/Decline Buttons (lines 962-967)

**New Code:**
```typescript
{/* Show Accept/Decline buttons to the right of reschedule badge */}
{message.type === 'reschedule_request' && message.actions && (
  <div className="ml-2" onClick={(e) => e.stopPropagation()}>
    {message.actions}
  </div>
)}
```

**Impact:** Accept and Decline buttons now display inline where the "Update" badge/arrow was

### 4. Removed Actions from Expanded Content (line 990)

**Before:**
```typescript
{message.actions && message.type !== 'group_invitation' && (
  <div className="mb-3">
    {message.actions}
  </div>
)}
```

**After:**
```typescript
{message.actions && message.type !== 'group_invitation' && message.type !== 'reschedule_request' && (
  <div className="mb-3">
    {message.actions}
  </div>
)}
```

**Impact:** Actions don't duplicate in expanded view (though reschedule messages can't expand anyway)

## Results

### Reschedule Message (Before):
```
Rosmary wants to reschedule Nov 3, 2025 care block
From Nov 3, 2025 16:00:00-17:00:00 to Nov 7, 2025 18:00:00-20:30:00
Nov 3, 2025                                    [Update ▼]

(Click to expand and show Accept/Decline buttons)
```

### Reschedule Message (After):
```
Rosmary wants to reschedule Nov 3, 2025 care block
From Nov 3, 2025 16:00:00-17:00:00 to Nov 7, 2025 18:00:00-20:30:00
Nov 3, 2025                    [Update] [Accept] [Decline]

(No expand, buttons immediately available)
```

## Consistency with Group Invitations

Reschedule messages now follow the same pattern as group invitations:

### Group Invitation:
```
Invitation to join Emma's Care Group
[Group Invite] [Accept] [Decline]
```

### Reschedule Request:
```
Rosmary wants to reschedule Nov 3, 2025 care block
From Nov 3, 2025 16:00:00-17:00:00 to Nov 7, 2025 18:00:00-20:30:00
[Update] [Accept] [Decline]
```

## Benefits

1. **Faster Action** - Users can Accept/Decline immediately without expanding
2. **Less Clutter** - No unnecessary expand/collapse mechanism
3. **Better UX** - Message is self-contained with all info visible
4. **Consistency** - Matches the pattern used for other action-required messages
5. **Cleaner Interface** - Subtitle already shows all the details (from/to times)
6. **Reduced Clicks** - One-click Accept/Decline instead of two (expand + action)

## Implementation Notes

- Used `onClick={(e) => e.stopPropagation()` on the buttons container to prevent the click from bubbling up to the message container
- This ensures button clicks don't trigger any unintended behavior
- The subtitle still shows the detailed "From...to..." information, so no context is lost

## Build Status
✓ Build successful
✓ Scheduler bundle: 16.1 kB (maintained)
✓ No TypeScript errors
✓ All routes compiled successfully
