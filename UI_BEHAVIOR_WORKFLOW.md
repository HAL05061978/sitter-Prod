# UI Behavior Workflow for Reciprocal Care Requests

## Overview

This document details how the UI behaves for messages, alerts, and response handling in the reciprocal care request workflow, including the Messages button counter, response forms, and table behavior.

---

## 1. Messages Button & Alert Counter System

### Header Component (`app/components/Header.tsx`)

The header displays a counter badge on the Messages button that shows the total number of unread items requiring user action.

#### Counter Logic
```typescript
const [unreadSchedulerMessages, setUnreadSchedulerMessages] = useState<number>(0);
```

#### What Gets Counted
The `fetchUnreadSchedulerMessages()` function counts:

1. **Pending Open Block Invitations** (grouped by parent)
2. **Pending Care Requests** that need response
3. **Pending Care Responses** (for invited parents)
4. **Pending Group Invitations**
5. **Pending Event Invitations**
6. **Pending Reschedule Requests**

#### Counter Update Triggers
The counter updates when these events are dispatched:
- `invitationAccepted` - When user accepts an invitation
- `invitationDeclined` - When user declines an invitation
- `careRequestResponded` - When user responds to a care request
- `schedulerUpdated` - When scheduler data changes
- `newMessageSent` - When new messages are sent

#### Real-time Updates
```typescript
// Event listeners for real-time updates
window.addEventListener('invitationAccepted', handleInvitationAccepted);
window.addEventListener('careRequestResponded', handleCareRequestResponded);
window.addEventListener('schedulerUpdated', handleSchedulerUpdated);
```

---

## 2. Response to Request Workflow

### Scheduler Page (`app/scheduler/page.tsx`)

The scheduler page displays all care requests and responses in a unified inbox format.

#### Data Fetching
```typescript
const fetchData = async () => {
  // Fetch care requests that need response
  const { data: requests } = await supabase.rpc('get_reciprocal_care_requests', {
    parent_id: user.id
  });
  
  // Fetch care responses (responses to my requests)
  const { data: responses } = await supabase.rpc('get_reciprocal_care_responses', {
    parent_id: user.id
  });
  
  // Fetch responses to my requests (for accepting)
  const { data: responsesToMyRequests } = await supabase.rpc('get_responses_for_requester', {
    p_requester_id: user.id
  });
};
```

#### Response Form Display
When a user clicks "Respond" on a care request:

1. **Form Opens**: Modal/form appears with fields for:
   - Reciprocal date
   - Reciprocal start time
   - Reciprocal end time
   - Child selection
   - Notes

2. **Child Selection**: Fetches available children for the responding parent
```typescript
const fetchChildrenForGroup = async (groupId: string) => {
  const { data: childrenData } = await supabase
    .from('child_group_members')
    .select(`
      child_id,
      children!inner(id, full_name, parent_id)
    `)
    .eq('parent_id', user.id)
    .eq('active', true);
};
```

#### Response Submission
```typescript
const handleSubmitResponse = async (e: React.FormEvent) => {
  const { data, error } = await supabase.rpc('submit_reciprocal_care_response', {
    care_request_id: selectedRequest.care_request_id,
    responding_parent_id: user.id,
    reciprocal_date: reciprocalResponse.reciprocal_date,
    reciprocal_start_time: reciprocalResponse.reciprocal_start_time,
    reciprocal_end_time: reciprocalResponse.reciprocal_end_time,
    reciprocal_child_id: reciprocalResponse.reciprocal_child_id,
    notes: reciprocalResponse.notes || null
  });
  
  // Send notification to requester
  if (data) {
    await supabase.rpc('send_care_response_notifications', {
      p_care_response_id: data
    });
  }
  
  // Update UI and counter
  window.dispatchEvent(new CustomEvent('careRequestResponded'));
};
```

---

## 3. Table Behavior for Accept/Decline Actions

### Unified Messages Inbox Component

The scheduler displays all messages in a unified inbox format with different message types.

#### Message Types Displayed
1. **Care Requests** - Requests that need response
2. **Care Responses** - Responses to your requests
3. **Open Block Invitations** - Invitations to open blocks
4. **Reschedule Requests** - Requests to reschedule care
5. **Group Invitations** - Invitations to join groups

#### Table Structure
```typescript
interface CareRequest {
  care_request_id: string;
  group_id: string;
  group_name: string;
  requester_id: string;
  requester_name: string;
  requested_date: string;
  start_time: string;
  end_time: string;
  notes: string;
  status: string;
  created_at: string;
  accepted_response_count: number;
}

interface CareResponse {
  care_response_id: string;
  care_request_id: string;
  responder_id?: string;
  responder_name?: string;
  status: string;
  reciprocal_date: string;
  reciprocal_start_time: string;
  reciprocal_end_time: string;
  response_notes?: string;
}
```

#### Accept/Decline Button Behavior

##### For Care Requests (Responding)
- **"Respond" Button**: Opens response form
- **Form Fields**: Date, time, child selection, notes
- **Submit**: Calls `submit_reciprocal_care_response`

##### For Care Responses (Accepting)
- **"Accept Response" Button**: Accepts the response
- **"Accepted" Badge**: Shows when already accepted
- **Action**: Calls `accept_reciprocal_care_response`

```typescript
const handleAcceptResponse = async (responseId: string) => {
  const { error } = await supabase.rpc('accept_reciprocal_care_response', {
    p_care_response_id: responseId
  });
  
  if (!error) {
    // Send notifications
    await sendReciprocalAcceptanceNotifications(responseId);
    
    // Show success message
    showAlertOnce('Reciprocal care response accepted successfully! Calendar blocks have been created.');
    
    // Refresh data and update counter
    fetchData();
    window.dispatchEvent(new CustomEvent('invitationAccepted'));
  }
};
```

---

## 4. Status Management & UI Updates

### Status Flow
```
Care Request: pending → confirmed (when accepted)
Care Response: pending → submitted → accepted
```

### UI State Updates
1. **Form Reset**: After successful submission
2. **Data Refresh**: Calls `fetchData()` to update the table
3. **Counter Update**: Dispatches events to update header counter
4. **Success Messages**: Shows confirmation alerts

### Real-time Updates
The system uses custom events to trigger UI updates:
- `careRequestResponded` - When user responds to a request
- `invitationAccepted` - When user accepts an invitation
- `schedulerUpdated` - When scheduler data changes

---

## 5. Alert System & Notifications

### Alert Cooldown System
```typescript
let lastAlertTime = 0;
const ALERT_COOLDOWN = 2000; // 2 seconds

const showAlertOnce = (message: string) => {
  const now = Date.now();
  if (now - lastAlertTime > ALERT_COOLDOWN) {
    alert(message);
    lastAlertTime = now;
  }
};
```

### Notification Functions
1. **`send_care_request_notifications`** - Notifies group members of new requests
2. **`send_care_response_notifications`** - Notifies requester of responses
3. **`sendReciprocalAcceptanceNotifications`** - Notifies all parties when accepted

---

## 6. Table Display Logic

### Message Grouping
Messages are grouped by type and displayed in sections:

1. **Care Requests Section**
   - Shows requests that need response
   - "Respond" button for each request
   - Expandable details with notes

2. **Care Responses Section**
   - Shows responses to your requests
   - "Accept Response" button for pending responses
   - "Accepted" badge for accepted responses

3. **Open Block Invitations**
   - Shows invitations to open blocks
   - "Accept Invitation" / "Decline Invitation" buttons

4. **Reschedule Requests**
   - Shows requests to reschedule care
   - "Accept" / "Decline" buttons with reschedule details

### Expandable Content
Each message can be expanded to show:
- Full details (date, time, notes)
- Action buttons (Accept/Decline/Respond)
- Status information
- Response details

---

## 7. Error Handling & User Feedback

### Error States
- **Form Validation**: Required fields, time validation
- **Network Errors**: Retry mechanisms, error messages
- **Permission Errors**: User not in group, invalid access

### Success Feedback
- **Success Messages**: Confirmation alerts
- **Visual Updates**: Button state changes, status badges
- **Counter Updates**: Real-time counter updates

### Loading States
- **Form Submission**: Disabled buttons during submission
- **Data Fetching**: Loading spinners, skeleton states
- **Processing**: "Processing..." indicators

---

## 8. Mobile Responsiveness

### Responsive Design
- **Mobile Layout**: Stacked layout for small screens
- **Touch Targets**: Large buttons for touch interaction
- **Modal Behavior**: Full-screen modals on mobile
- **Table Scrolling**: Horizontal scroll for wide tables

### Performance Optimizations
- **Lazy Loading**: Load data as needed
- **Debounced Updates**: Prevent excessive API calls
- **Caching**: Cache frequently accessed data
- **Real-time Updates**: Efficient event system

---

## 9. Accessibility Features

### Keyboard Navigation
- **Tab Order**: Logical tab sequence
- **Enter Key**: Submit forms with Enter
- **Escape Key**: Close modals with Escape

### Screen Reader Support
- **ARIA Labels**: Descriptive labels for buttons
- **Status Announcements**: Screen reader notifications
- **Focus Management**: Proper focus handling

### Visual Indicators
- **Color Coding**: Status-based colors
- **Icons**: Clear action icons
- **Badges**: Status badges and counters

---

## 10. Testing & Debugging

### Debug Information
- **Console Logging**: Detailed logging for debugging
- **Error Tracking**: Comprehensive error handling
- **State Inspection**: React DevTools integration

### Manual Refresh
```typescript
const manualRefresh = async () => {
  if (user) {
    await Promise.all([
      fetchPendingInvitations(user.id),
      fetchUnreadChatMessages(user.id),
      fetchUnreadSchedulerMessages(user.id)
    ]);
  }
};
```

---

*This document provides a comprehensive guide to the UI behavior for reciprocal care requests, including message handling, response workflows, and table interactions.*
