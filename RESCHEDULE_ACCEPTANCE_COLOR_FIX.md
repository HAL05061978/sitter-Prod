# Reschedule Acceptance Block Color Fix

## Issue
When a parent accepts a reschedule, the new care block was displaying in **green** (providing care), but it should be **blue** (receiving care).

## Why This Matters

In the reschedule workflow:
1. **Requester** initiates reschedule (wants to move THEIR providing block to a new time)
2. **Responder** accepts (agrees to receive care at the new time)

When the responder accepts:
- They are **receiving care** at the new time
- Their calendar should show a **blue "needed" block** at the new time
- NOT a green "provided" block

## Color Coding Convention

Throughout the app:
- 🟢 **Green** = Providing care (parent is caring for other children)
- 🔵 **Blue** = Receiving care (parent's child is being cared for)
- 🟡 **Yellow** = Rescheduled/pending status
- 🔴 **Red** = Declined/cancelled

## The Fix

### Before:
```tsx
<div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
  <p className="font-medium text-gray-900 text-sm">
    New care block
  </p>
  ...
  <button
    onClick={() => navigateToCareBlock(message.data.new_date, 'provided')}
    className="... bg-green-600 ... hover:bg-green-700"
  >
    View in Calendar
  </button>
</div>
```

### After:
```tsx
<div className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-500">
  <p className="font-medium text-gray-900 text-sm">
    New care block (receiving care)
  </p>
  ...
  <button
    onClick={() => navigateToCareBlock(message.data.new_date, 'needed')}
    className="... bg-blue-600 ... hover:bg-blue-700"
  >
    View in Calendar
  </button>
</div>
```

## Changes Made

1. **Background color:** `bg-green-50` → `bg-blue-50`
2. **Border color:** `border-green-500` → `border-blue-500`
3. **Label:** "New care block" → "New care block (receiving care)"
4. **Button color:** `bg-green-600 hover:bg-green-700` → `bg-blue-600 hover:bg-blue-700`
5. **Navigation:** `navigateToCareBlock(date, 'provided')` → `navigateToCareBlock(date, 'needed')`

## User Experience

When a parent accepts a reschedule, they will now see:

┌────────────────────────────────────┐
│ 🔵 New care block (receiving care) │  ← Blue color, clear label
│ Nov 10, 2025 from 3:00 PM to      │
│ 7:00 PM                            │
│                                    │
│ [View in Calendar] (blue button)  │  ← Navigates to "needed" view
└────────────────────────────────────┘

## Consistency

This fix ensures consistency with other "receiving care" displays throughout the app:
- Reciprocal care blocks (receiving side) = Blue
- Open block acceptances (receiving side) = Blue
- Care request blocks (receiving side) = Blue
- **Reschedule acceptances (receiving side) = Blue** ✓

## Testing

- [x] Build successful
- [ ] Test acceptance notification display
- [ ] Verify blue color shows correctly
- [ ] Verify "View in Calendar" navigates to needed/receiving view
- [ ] Verify label shows "(receiving care)"

## File Changed

- `app/scheduler/page.tsx` (lines 1309-1330)

## Build Status
✅ Compiled successfully
