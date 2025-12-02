import { TFunction } from 'i18next';

interface NotificationData {
  requester_name?: string;
  responder_name?: string;
  requested_date?: string;
  reciprocal_date?: string;
  start_time?: string;
  end_time?: string;
  reciprocal_start_time?: string;
  reciprocal_end_time?: string;
  care_type?: string;
  new_date?: string;
  [key: string]: unknown;
}

interface Notification {
  type: string;
  title?: string;
  message?: string;
  data?: NotificationData;
}

// Format date for display (e.g., "Nov 26, 2025")
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

// Format time for display (e.g., "9:00 AM")
function formatTime(timeStr: string | undefined): string {
  if (!timeStr) return '';
  try {
    // Handle HH:mm:ss or HH:mm format
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  } catch {
    return timeStr;
  }
}

// Get translated notification title
export function getNotificationTitle(notification: Notification, t: TFunction): string {
  const typeToTitleKey: Record<string, string> = {
    'care_request': 'notifications.careRequestTitle',
    'care_response': 'notifications.careResponseTitle',
    'care_accepted': 'notifications.careAcceptedTitle',
    'care_declined': 'notifications.careDeclinedTitle',
    'open_block_invitation': 'notifications.openBlockInvitationTitle',
    'open_block_accepted': 'notifications.openBlockAcceptedTitle',
    'hangout_accepted': 'notifications.hangoutAcceptedTitle',
    'reschedule_request': 'notifications.rescheduleRequestTitle',
    'reschedule_accepted': 'notifications.rescheduleAcceptedTitle',
    'reschedule_declined': 'notifications.rescheduleDeclinedTitle',
    'reschedule_counter_sent': 'notifications.rescheduleCounterSentTitle',
    'reschedule_counter_accepted': 'notifications.rescheduleCounterAcceptedTitle',
    'reschedule_counter_declined': 'notifications.rescheduleCounterDeclinedTitle',
  };

  const titleKey = typeToTitleKey[notification.type];
  if (titleKey) {
    return t(titleKey);
  }

  // Fallback to original title
  return notification.title || notification.type;
}

// Get translated notification message
export function getNotificationMessage(notification: Notification, t: TFunction): string {
  const data = notification.data || {};

  // Extract common parameters
  const name = data.requester_name || data.responder_name || '';
  const date = formatDate(data.requested_date || data.reciprocal_date);
  const startTime = formatTime(data.start_time || data.reciprocal_start_time);
  const endTime = formatTime(data.end_time || data.reciprocal_end_time);
  const newDate = formatDate(data.new_date || data.reciprocal_date);
  const careType = data.care_type || 'care';

  const typeToMessageKey: Record<string, string> = {
    'care_request': data.care_type === 'pet' ? 'notifications.petCareRequest' : 'notifications.careRequest',
    'care_response': data.care_type === 'pet' ? 'notifications.petCareResponse' : 'notifications.careResponse',
    'care_accepted': data.care_type === 'pet' ? 'notifications.petCareAccepted' : 'notifications.careAccepted',
    'care_declined': 'notifications.careDeclined',
    'open_block_invitation': 'notifications.openBlockInvitation',
    'open_block_accepted': 'notifications.openBlockAccepted',
    'hangout_accepted': 'notifications.hangoutAccepted',
    'reschedule_request': 'notifications.rescheduleRequest',
    'reschedule_accepted': 'notifications.rescheduleAccepted',
    'reschedule_declined': 'notifications.rescheduleDeclined',
    'reschedule_counter_sent': 'notifications.rescheduleCounterSent',
    'reschedule_counter_accepted': 'notifications.rescheduleCounterAccepted',
    'reschedule_counter_declined': 'notifications.rescheduleCounterDeclined',
  };

  const messageKey = typeToMessageKey[notification.type];

  if (messageKey) {
    const translatedMessage = t(messageKey, {
      name,
      date,
      startTime,
      endTime,
      newDate,
      careType,
    });

    // If translation returns the key (not found), fall back to original message
    if (translatedMessage === messageKey) {
      return notification.message || '';
    }

    return translatedMessage;
  }

  // Fallback to original message
  return notification.message || '';
}

// Combined function to get both title and message
export function translateNotification(notification: Notification, t: TFunction): { title: string; message: string } {
  return {
    title: getNotificationTitle(notification, t),
    message: getNotificationMessage(notification, t),
  };
}
