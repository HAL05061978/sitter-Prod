/**
 * Date utility functions for formatting dates and times
 */

/**
 * Safely parse a date string, returning null if invalid
 * FIXED: Handle timezone issues that cause dates to appear one day early
 */
export function parseDateSafely(dateString: string | Date | null | undefined): Date | null {
  if (!dateString) return null;
  
  try {
    let date: Date;
    
    if (typeof dateString === 'string') {
      // Handle date strings like "2025-08-16" - parse as local date to avoid timezone issues
      if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Date-only string - create local date to avoid UTC conversion
        const [year, month, day] = dateString.split('-').map(Number);
        date = new Date(year, month - 1, day); // month is 0-indexed
      } else {
        // Full datetime string - use standard parsing
        date = new Date(dateString);
      }
    } else {
      date = dateString;
    }
    
    if (isNaN(date.getTime())) return null;
    
    return date;
  } catch (error) {
    console.warn('Failed to parse date:', dateString, error);
    return null;
  }
}

/**
 * Format a date string to show only the date (e.g., "Jan 15, 2025")
 * FIXED: Use parseDateSafely to prevent timezone issues
 * Now supports i18n - accepts optional language parameter or checks localStorage
 */
export function formatDateOnly(dateString: string | Date, lang?: string): string {
  if (!dateString) return '';

  const date = parseDateSafely(dateString);
  if (!date) return '';

  // Use provided lang, or get from localStorage
  const language = lang || (typeof window !== 'undefined' ? localStorage.getItem('i18nextLng') || 'en' : 'en');
  const locale = language === 'es' ? 'es-ES' : 'en-US';

  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Format a time string to show only the time (e.g., "2:30 PM")
 * Now supports i18n - checks localStorage for language preference
 */
export function formatTime(timeString: string): string {
  if (!timeString) return '';

  // Handle different time formats
  let time: Date;

  if (timeString.includes('T') || timeString.includes(' ')) {
    // Full datetime string
    time = new Date(timeString);
  } else {
    // Just time string (e.g., "14:30:00")
    const [hours, minutes] = timeString.split(':');
    time = new Date();
    time.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
  }

  if (isNaN(time.getTime())) return '';

  // Get language from localStorage (set by i18n)
  const lang = typeof window !== 'undefined' ? localStorage.getItem('i18nextLng') || 'en' : 'en';
  const locale = lang === 'es' ? 'es-ES' : 'en-US';

  return time.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format a timestamp to show the date and time (e.g., "Jan 15, 2025 at 2:30 PM")
 * FIXED: Use parseDateSafely to prevent timezone issues
 * Now supports i18n - checks localStorage for language preference
 */
export function formatTimestampDate(timestamp: string | Date): string {
  if (!timestamp) return '';

  const date = parseDateSafely(timestamp);
  if (!date) return '';

  // Get language from localStorage (set by i18n)
  const lang = typeof window !== 'undefined' ? localStorage.getItem('i18nextLng') || 'en' : 'en';
  const locale = lang === 'es' ? 'es-ES' : 'en-US';

  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format a date for input fields (YYYY-MM-DD format)
 */
export function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayString(): string {
  return formatDateForInput(new Date());
}

/**
 * Normalize a date string to ensure consistent display in calendar
 * FIXED: Prevents timezone-related off-by-one errors
 */
export function normalizeDateForCalendar(dateString: string): string {
  if (!dateString) return '';
  
  // If it's already a date-only string, return as-is
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateString;
  }
  
  // Parse and format as date-only to avoid timezone issues
  const date = parseDateSafely(dateString);
  if (!date) return dateString;
  
  return formatDateForInput(date);
}

/**
 * Check if a date is today
 */
export function isToday(dateString: string | Date): boolean {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const today = new Date();
  
  return date.toDateString() === today.toDateString();
}

/**
 * Check if a date is in the past
 */
export function isPastDate(dateString: string | Date): boolean {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return date < today;
}

/**
 * Check if a date is in the future
 */
export function isFutureDate(dateString: string | Date): boolean {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return date > today;
}
