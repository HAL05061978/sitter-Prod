# Date/Time Validation and Input Constraints

## Problems Fixed

1. **Past Date/Time Submission**: Users could submit care requests, hangouts, and open blocks with dates/times in the past
2. **Year Input Overflow**: Users could enter years with 5+ digits (e.g., 20,025) in date pickers
3. **No Min/Max Constraints**: Date inputs had no restrictions on selectable dates

## Solutions Implemented

### 1. JavaScript Validation in Submit Handlers

Added validation checks before submission to prevent scheduling in the past:

#### Scheduler Page (`app/scheduler/page.tsx`)
**Location:** `handleCreateRequest` function (lines ~2290-2310)

```typescript
// Validate date and time are not in the past
const inputDateTime = new Date(`${newRequest.care_date}T${newRequest.start_time}:00`);
const now = new Date();

if (inputDateTime <= now) {
  alert('Cannot schedule care in the past. Please select a future date and time.');
  return;
}

// Validate end date for sleepovers/multi-day care
if (newRequest.end_date) {
  const endDateTime = new Date(`${newRequest.end_date}T${newRequest.end_time}:00`);
  if (endDateTime <= now) {
    alert('End date and time cannot be in the past. Please select a future date and time.');
    return;
  }
  if (endDateTime <= inputDateTime) {
    alert('End date and time must be after start date and time.');
    return;
  }
}
```

#### Calendar Page (`app/calendar/page.tsx`)
**Location:** `handleCreateNewRequest` function (lines ~1431-1451)

Same validation added for care requests created from calendar view.

**Location:** `handleCreateOpenBlock` function (lines ~964-972)

```typescript
// Validate all reciprocal times are in the future
const now = new Date();
for (const timeBlock of openBlockData.reciprocal Times) {
  const inputDateTime = new Date(`${timeBlock.date}T${timeBlock.startTime}:00`);
  if (inputDateTime <= now) {
    alert('Cannot schedule reciprocal care in the past. Please select future dates and times for all reciprocal time blocks.');
    return;
  }
}
```

### 2. HTML5 Date Input Constraints

Added `min` and `max` attributes to all date inputs:

#### Constraints Applied:
- **min**: Today's date (prevents past date selection in the UI)
- **max**: 5 years from current year (e.g., 2025 → max 2030-12-31)

This prevents:
- Selecting past dates in the date picker
- Entering years beyond 2030 (or current year + 5)
- Year overflow (no more 20,025!)

#### Files Updated:

**Scheduler Page:**
- Care request start date (line ~3565)
- Care request end date for sleepovers (line ~3582)
- Reciprocal response date (line ~3850)

**Calendar Page:**
- New request date (line ~2520)
- Open block reciprocal dates (line ~2961)

### 3. Validation Utility Created

Created `app/lib/date-validation.ts` with reusable validation utilities:
- `getTodayDateString()`: Gets today in YYYY-MM-DD format
- `getCurrentTimeString()`: Gets current time in HH:MM format
- `isDateValid()`: Checks if date is not in past
- `isDateTimeValid()`: Checks if date-time is in future
- `validateFutureDateTime()`: Returns error message if invalid
- `getMinDate()`: Gets minimum allowed date (today)
- `getMaxDate()`: Gets maximum allowed date (5 years out)

## User Experience Changes

### Before:
- ❌ Could schedule care for yesterday
- ❌ Could enter year 20,025 in date picker
- ❌ No feedback until form submission
- ❌ Could create confusing/invalid schedules

### After:
- ✅ Date picker only shows today and future dates
- ✅ Year limited to 4 digits (current year to current year + 5)
- ✅ Clear alert messages explain validation errors
- ✅ Cannot submit requests for past dates/times
- ✅ End dates must be after start dates

## Validation Messages

Users will see these alerts when attempting to schedule in the past:

1. **Past start date/time**:
   - "Cannot schedule care in the past. Please select a future date and time."

2. **Past end date/time**:
   - "End date and time cannot be in the past. Please select a future date and time."

3. **End before start**:
   - "End date and time must be after start date and time."

4. **Past reciprocal times (open blocks)**:
   - "Cannot schedule reciprocal care in the past. Please select future dates and times for all reciprocal time blocks."

## Testing
- Build successful: ✓
- Date inputs restricted: ✓
- Submit validation working: ✓
- Error messages clear: ✓
- Multi-day care validated: ✓
- Open block reciprocal times validated: ✓

## Browser Support

HTML5 date input `min`/`max` attributes supported in:
- Chrome/Edge (all versions)
- Firefox 57+
- Safari 14.1+

For older browsers, JavaScript validation still prevents submission.
