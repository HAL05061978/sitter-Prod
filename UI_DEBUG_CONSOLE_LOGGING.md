# UI Debug Console Logging

## Problem
We have 3 different UI components calling `handle_reschedule_response` with different parameter sets, causing 404 errors.

## Solution
Add console logging to each UI component to see exactly what's being called.

## UI Components to Update

### 1. app/scheduler/page.tsx (Line 484)
**Current call:**
```typescript
const { data, error } = await supabase.rpc('handle_reschedule_response', {
  p_care_response_id: careResponseId,
  p_response_status: response,
  p_response_notes: notes || null
});
```

**Add debug logging:**
```typescript
const { data, error } = await supabase.rpc('handle_reschedule_response', {
  p_care_response_id: careResponseId,
  p_response_status: response,
  p_response_notes: notes || null
});

// DEBUG: Log the call details
console.log('🔍 SCHEDULER PAGE DEBUG:', {
  function: 'handle_reschedule_response',
  parameters: {
    p_care_response_id: careResponseId,
    p_response_status: response,
    p_response_notes: notes || null
  },
  data,
  error
});
```

### 2. components/care/RescheduleResponseModal.tsx (Line 97)
**Current call:**
```typescript
const { data, error } = await supabase.rpc('handle_reschedule_response', {
  p_reschedule_request_id: rescheduleRequestId,
  p_responder_id: user.id,
  p_response_action: responseStatus,
  p_response_notes: responseNotes || null
});
```

**Add debug logging:**
```typescript
const { data, error } = await supabase.rpc('handle_reschedule_response', {
  p_reschedule_request_id: rescheduleRequestId,
  p_responder_id: user.id,
  p_response_action: responseStatus,
  p_response_notes: responseNotes || null
});

// DEBUG: Log the call details
console.log('🔍 RESCHEDULE RESPONSE MODAL DEBUG:', {
  function: 'handle_reschedule_response',
  parameters: {
    p_reschedule_request_id: rescheduleRequestId,
    p_responder_id: user.id,
    p_response_action: responseStatus,
    p_response_notes: responseNotes || null
  },
  data,
  error
});
```

### 3. components/notifications/NotificationsPanel.tsx (Line 59)
**Current call:**
```typescript
const { error: responseError } = await supabase.rpc('handle_reschedule_response', {
  reschedule_request_id: notification.data.reschedule_request_id,
  response_status: response,
  response_notes: null
});
```

**Add debug logging:**
```typescript
const { error: responseError } = await supabase.rpc('handle_reschedule_response', {
  reschedule_request_id: notification.data.reschedule_request_id,
  response_status: response,
  response_notes: null
});

// DEBUG: Log the call details
console.log('🔍 NOTIFICATIONS PANEL DEBUG:', {
  function: 'handle_reschedule_response',
  parameters: {
    reschedule_request_id: notification.data.reschedule_request_id,
    response_status: response,
    response_notes: null
  },
  error: responseError
});
```

## Next Steps

1. **Run the debug SQL script** to create placeholder functions
2. **Add console logging** to each UI component
3. **Test the accept button** in each UI location
4. **Check browser console** to see which function gets called
5. **Create the correct function** based on the actual calls

## Expected Results

After adding console logging, we should see:
- Which UI component is making the call
- What parameters are being passed
- Whether the function exists or returns 404
- The exact function signature needed

This will help us create the correct function that matches the actual UI calls.
