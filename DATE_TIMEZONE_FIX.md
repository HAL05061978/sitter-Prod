# Date Timezone Fix for Scheduler Page

## Problem Description

The Scheduler page was displaying dates that were off by one day from what was recorded in the database. This was caused by a timezone conversion issue when using `new Date()` with date strings.

### Root Cause

When a date string like "2025-08-17" is passed to `new Date()`, JavaScript interprets it as midnight UTC. However, when this date is displayed in the user's local timezone, it can shift by one day depending on the user's location relative to UTC.

For example:
- Database stores: `2025-08-17` (DATE type)
- JavaScript: `new Date('2025-08-17')` creates `2025-08-17T00:00:00.000Z` (UTC)
- User in US Eastern Time (UTC-5): Date displays as `2025-08-16` (previous day)

### Affected Areas

The issue was present in multiple locations throughout the Scheduler page:
- Care request displays
- Care response displays  
- Open block invitation displays
- Reciprocal care date displays
- Created date displays

## Solution Implemented

### 1. Created Date Utility Functions (`app/lib/date-utils.ts`)

```typescript
/**
 * Formats a date string (YYYY-MM-DD) to a readable format without timezone conversion
 * This prevents the issue where dates appear off by one day due to UTC conversion
 */
export function formatDateOnly(dateString: string, format: string = 'MMM d, yyyy'): string {
  if (!dateString) return '';
  
  // Parse the date string directly without creating a Date object
  // This prevents timezone conversion issues
  const [year, month, day] = dateString.split('-').map(Number);
  
  if (!year || !month || !day) return dateString;
  
  // Create a date object in the user's local timezone
  const localDate = new Date(year, month - 1, day);
  
  // Use Intl.DateTimeFormat for consistent formatting
  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  
  return formatter.format(localDate);
}
```

### 2. Updated All Date Formatting Calls

Replaced all instances of:
```typescript
// OLD - Problematic
{format(new Date(request.requested_date), 'MMM d, yyyy')}

// NEW - Fixed
{formatDateOnly(request.requested_date)}
```

### 3. Files Updated

- `app/scheduler/page.tsx` - Main scheduler page
- `app/calendar/page.tsx` - Calendar page (similar date formatting)
- `app/lib/date-utils.ts` - New utility functions

## Benefits

1. **Accurate Date Display**: Dates now show exactly what's stored in the database
2. **No Timezone Issues**: Eliminates the one-day-off problem for users in different timezones
3. **Consistent Behavior**: All date displays use the same formatting logic
4. **Maintainable Code**: Centralized date formatting logic in utility functions

## Testing

A test file (`app/lib/date-utils.test.ts`) was created to verify the fix works correctly:

```typescript
// Test case: A date that was showing as off by one day
const testDate1 = '2025-08-17';
console.log(`Input: ${testDate1}`);
console.log(`Output: ${formatDateOnly(testDate1)}`);
console.log(`Expected: Aug 17, 2025`);
```

## Database Schema Note

The `requested_date` field in the `care_requests` table is stored as a `DATE` type (not `TIMESTAMP`), which means it stores only the date portion without time or timezone information. This makes our approach of parsing the date string directly the correct solution.

## Future Considerations

1. **Consistent Date Handling**: All new date displays should use these utility functions
2. **Time Display**: The `formatTime` function handles time formatting consistently
3. **Localization**: The utility functions can be extended to support different locales
4. **Date Input**: Consider using the same approach for date input fields to ensure consistency

## Migration Notes

This fix is backward compatible and doesn't require any database changes. It only affects how dates are displayed in the UI, ensuring they match what's actually stored in the database.
