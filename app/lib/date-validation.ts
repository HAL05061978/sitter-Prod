/**
 * Date and Time Validation Utilities
 * Prevents scheduling in the past and validates date/time inputs
 */

/**
 * Gets the current date in YYYY-MM-DD format (local timezone)
 */
export function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets the current time in HH:MM format (local timezone)
 */
export function getCurrentTimeString(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Validates that a date is not in the past
 * @param dateString Date in YYYY-MM-DD format
 * @returns true if valid (today or future), false if in the past
 */
export function isDateValid(dateString: string): boolean {
  if (!dateString) return false;

  const inputDate = new Date(dateString + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return inputDate >= today;
}

/**
 * Validates that a date-time combination is not in the past
 * @param dateString Date in YYYY-MM-DD format
 * @param timeString Time in HH:MM format
 * @returns true if valid (future), false if in the past
 */
export function isDateTimeValid(dateString: string, timeString: string): boolean {
  if (!dateString || !timeString) return false;

  const inputDateTime = new Date(`${dateString}T${timeString}:00`);
  const now = new Date();

  return inputDateTime > now;
}

/**
 * Validates that a date-time is in the future with a friendly error message
 * @param dateString Date in YYYY-MM-DD format
 * @param timeString Time in HH:MM format
 * @param fieldName Name of the field for error message (e.g., "Start time")
 * @returns Error message if invalid, null if valid
 */
export function validateFutureDateTime(
  dateString: string,
  timeString: string,
  fieldName: string = 'Date and time'
): string | null {
  if (!dateString || !timeString) {
    return `${fieldName} is required`;
  }

  if (!isDateValid(dateString)) {
    return `${fieldName} cannot be in the past. Please select today or a future date.`;
  }

  if (!isDateTimeValid(dateString, timeString)) {
    return `${fieldName} must be in the future. Please select a later time.`;
  }

  return null;
}

/**
 * Gets the minimum allowed date (today) for date inputs
 */
export function getMinDate(): string {
  return getTodayDateString();
}

/**
 * Gets the maximum allowed year (current year + 5)
 */
export function getMaxYear(): number {
  return new Date().getFullYear() + 5;
}

/**
 * Gets the maximum allowed date string (5 years from now)
 */
export function getMaxDate(): string {
  const maxYear = getMaxYear();
  return `${maxYear}-12-31`;
}
