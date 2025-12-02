# Reschedule Modal Simplification

## Problem
When a user clicked on a reschedule request, there were 2 modals:
1. **First Modal**: "Reschedule Request" - Info screen showing current vs new schedule with Accept/Decline buttons
2. **Second Modal**: "Decline Reschedule Request" - Options to select arrangement and offer counter

This was redundant - the first modal served no real purpose except showing information before requiring another click to actually decline.

## Solution
Skip the first modal entirely and go directly to the decline/response screen.

## Changes Made

### 1. Default to Decline Options View
**File**: `components/care/RescheduleResponseModal.tsx`
**Line 77**:
```typescript
// Before:
const [showDeclineOptions, setShowDeclineOptions] = useState(false);

// After:
const [showDeclineOptions, setShowDeclineOptions] = useState(true); // Start with decline options visible
```

### 2. Fetch Arrangements Immediately
**Lines 86-91**:
```typescript
useEffect(() => {
  if (isOpen && rescheduleRequestId) {
    fetchRescheduleDetails();
    fetchArrangements(); // Fetch arrangements immediately when modal opens
  }
}, [isOpen, rescheduleRequestId]);
```

### 3. Updated Modal Header
**Line 418**:
```typescript
// Before:
<h2>Decline Reschedule Request</h2>

// After:
<h2>Respond to Reschedule Request</h2>
```

### 4. Added Schedule Summary
**Lines 429-441**:
Added a two-column grid showing:
- **Left**: Current Schedule (red box)
- **Right**: Proposed New Schedule (green box)

This gives users context right at the top without needing a separate modal.

### 5. Updated Instructions
**Lines 443-448**:
Clear instructions:
- "To Accept: Click 'Accept Instead' below"
- "To Decline: Select which arrangement to cancel..."

### 6. Added Accept Button
**Lines 556-564**:
Added a green "Accept Instead" button on the left side of the action buttons, so users can still accept without leaving this modal.

**Layout**:
```
[Accept Instead]              [Cancel] [Submit Decline]
```

## New User Flow

### Before (2 clicks to decline):
1. User clicks reschedule notification
2. **Modal 1**: See schedule comparison, click "Decline"
3. **Modal 2**: Select arrangement, click "Submit Decline"

### After (1 click to decline):
1. User clicks reschedule notification
2. **Single Modal**: See schedule comparison at top, select arrangement, click "Submit Decline"
   - OR click "Accept Instead" to accept

## Features Preserved

✅ Schedule comparison (current vs new)
✅ Arrangement selection for cancellation
✅ Counter-proposal option
✅ Response notes
✅ Accept functionality (now via "Accept Instead" button)
✅ Counter-proposal detection (simple decline for counters)

## User Experience Improvements

1. **Fewer clicks**: One modal instead of two
2. **Better context**: Schedule comparison visible while making decision
3. **Clear options**: Both Accept and Decline available in same screen
4. **Less confusion**: No intermediate "information only" modal

## Testing

Test these scenarios:
1. ✅ Open reschedule request from calendar
2. ✅ See current vs new schedule at top
3. ✅ Click "Accept Instead" → should accept
4. ✅ Select arrangement, click "Submit Decline" → should decline
5. ✅ Check "Offer alternative time", fill in counter → should send counter
6. ✅ Test with counter-proposals (should still work with simple decline)

## Files Modified

- ✅ `components/care/RescheduleResponseModal.tsx`
