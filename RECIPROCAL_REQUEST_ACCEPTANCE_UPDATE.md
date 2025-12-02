# Reciprocal Request Acceptance Message Update - Complete

## Changes Made

Updated the reciprocal request acceptance message (requester's view when they accept someone's reciprocal offer) to match the open block acceptance pattern.

### 1. Updated Message Title Format (lines 746-751)

**Before:**
```typescript
title: `Reciprocal request for ${formatDateOnly(request.requested_date)} (${formatTime(request.start_time)} to ${formatTime(getActualEndTime(request.notes || '', request.end_time))}) accepted`
```

**After:**
```typescript
const responderName = acceptedResponse.responder_name || 'Someone';
const groupName = acceptedResponse.group_name || 'your group';
title: `You accepted ${responderName}'s ${groupName} reciprocal offer for ${formatDateOnly(request.requested_date)}`
```

**Impact:** Title now matches open block format: "You accepted {parent}'s {Group} reciprocal offer for {Date}"

### 2. Updated Badge to Show "Accepted" (lines 904, 918)

**Before:**
```typescript
message.type === 'care_request' ? 'bg-blue-100 text-blue-800'
message.type === 'care_request' ? 'Request'
```

**After:**
```typescript
message.type === 'care_request' && message.data.status === 'accepted' ? 'bg-green-100 text-green-800' :
message.type === 'care_request' ? 'bg-blue-100 text-blue-800'

message.type === 'care_request' && message.data.status === 'accepted' ? 'Accepted' :
message.type === 'care_request' ? 'Request'
```

**Impact:** Accepted reciprocal requests now show green "Accepted" badge instead of blue "Request" badge

### 3. Replaced Expanded View with Two Care Blocks (lines 1183-1231)

**Before:**
```typescript
<div className="space-y-3 mb-4">
  <h5 className="font-medium text-gray-900 text-sm">Accepted Care Details:</h5>
  <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
    <p className="font-medium text-gray-900 text-sm">
      Accepted from: {message.data.requester_name}
    </p>
    <p className="text-sm text-gray-600 mt-1">
      Reciprocal care: {formatDateOnly(message.data.reciprocal_date)} from...
    </p>
    {/* Child name and notes */}
  </div>
</div>
```

**After:**
```typescript
<div className="space-y-3 mb-4">
  {/* Block 1: You will receive care */}
  <div className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-500">
    <p className="font-medium text-gray-900 text-sm">
      You will receive care
    </p>
    <p className="text-sm text-gray-600 mt-1">
      {formatDateOnly(message.data.requested_date)} from {formatTime(message.data.start_time)} to {formatTime(...)}
    </p>
    <button onClick={() => navigateToCareBlock(message.data.requested_date, 'needed')}>
      View in Calendar
    </button>
  </div>

  {/* Block 2: You will provide care */}
  <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
    <p className="font-medium text-gray-900 text-sm">
      You will provide care
    </p>
    <p className="text-sm text-gray-600 mt-1">
      {formatDateOnly(message.data.reciprocal_date)} from {formatTime(message.data.reciprocal_start_time)} to {formatTime(...)}
    </p>
    <button onClick={() => navigateToCareBlock(message.data.reciprocal_date, 'provided')}>
      View in Calendar
    </button>
  </div>
</div>
```

**Impact:** Now shows both care blocks (receiving and providing) with proper colors and calendar navigation buttons, matching open block message pattern

## Results

### Reciprocal Request Acceptance Message:

**Collapsed:**
```
You accepted Hugo Lopez's Emma's Care Group reciprocal offer for Nov 1, 2025
Nov 2, 2025                                    [Accepted ▼]
```

**Expanded:**
```
You accepted Hugo Lopez's Emma's Care Group reciprocal offer for Nov 1, 2025
Nov 2, 2025                                    [Accepted ▼]

  You will receive care                    ← BLUE
  Nov 1, 2025 from 08:00 to 09:00
  [View in Calendar]

  You will provide care                    ← GREEN
  Nov 2, 2025 from 19:30 to 23:00
  [View in Calendar]
```

## Consistency Achieved

All three message types now follow the same pattern:

### Open Block Acceptance (Acceptor):
```
You accepted Bruce H's Emma's Care Group open block offer for Nov 1, 2025
[Accepted ▼]
  - You will receive care (blue)
  - You will provide care (green)
```

### Open Block Acceptance (Provider):
```
Bruce H accepted your Emma's Care Group open block offer for Nov 1, 2025
[Block Accepted ▼]
  - You will provide care (green)
  - You will receive care (blue)
```

### Reciprocal Request Acceptance (Requester):
```
You accepted Hugo Lopez's Emma's Care Group reciprocal offer for Nov 1, 2025
[Accepted ▼]
  - You will receive care (blue)
  - You will provide care (green)
```

### Reciprocal Response Acceptance (Responder):
```
Bruce H accepted your reciprocal response for Nov 1, 2025
[Accepted ▼]
  - You will provide care (green)
  - You will receive care (blue)
```

## Unified Message Design

### Title Pattern:
- **Acceptance:** "You accepted {Name}'s {Group} {type} offer for {Date}"
- **Being Accepted:** "{Name} accepted your {context}"

### Badge Pattern:
- **Accepted messages:** Green "Accepted" badge
- **Pending messages:** Blue/Yellow status badges

### Expanded View Pattern:
- **Two blocks:** One for receiving care (blue), one for providing care (green)
- **Clean titles:** "You will receive care" / "You will provide care"
- **Date/time only:** No redundant labels
- **Action button:** "View in Calendar" on all blocks

## Build Status
✓ Build successful
✓ Scheduler bundle: 16.1 kB (maintained)
✓ No TypeScript errors
✓ All routes compiled successfully

## Benefits
1. **Complete Consistency** - All acceptance messages follow identical pattern
2. **Clear Communication** - Users immediately understand what was accepted and what care was created
3. **Easy Navigation** - Calendar buttons on all blocks for quick access
4. **Professional UX** - Clean, organized, predictable interface
5. **Color Coding** - Consistent green=provide, blue=receive across all message types
