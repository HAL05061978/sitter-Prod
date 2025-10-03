# UI Integration Plan - Reschedule into Unified System

## Current Problem
- Reschedule requests use separate `RescheduleRequestsSection` component
- `NotificationsPanel.tsx` is redundant 
- Multiple different function calls causing 404 errors
- Not integrated with existing unified messaging system

## Solution
Integrate reschedule requests into the existing `UnifiedMessagesInbox` component alongside reciprocal and open block requests.

## UI Changes Needed

### 1. Remove Separate Components
- ❌ Remove `RescheduleRequestsSection` from `app/scheduler/page.tsx`
- ❌ Remove `NotificationsPanel.tsx` calls for reschedule requests
- ❌ Remove separate reschedule state management

### 2. Update UnifiedMessagesInbox
Add reschedule requests to the existing `getAllMessages()` function in `app/scheduler/page.tsx`:

```typescript
// Add to getAllMessages() function around line 686
const getAllMessages = () => {
  const messages: Array<{
    id: string;
    type: 'open_block_invitation' | 'care_request' | 'care_response' | 'care_accepted' | 'care_declined' | 'open_block_accepted' | 'group_invitation' | 'event_invitation' | 'reschedule_request'; // ADD THIS
    title: string;
    subtitle: string;
    timestamp: string;
    data: any;
    actions?: React.ReactNode;
  }> = [];

  // ... existing code for open block invitations ...

  // ADD: Reschedule requests
  rescheduleRequests.forEach((request) => {
    messages.push({
      id: `reschedule-${request.id}`,
      type: 'reschedule_request',
      title: `${request.requester_name} wants to reschedule a care block`,
      subtitle: `From ${formatDateOnly(request.original_date)} ${request.original_start_time}-${request.original_end_time} to ${formatDateOnly(request.new_date)} ${request.new_start_time}-${request.new_end_time}`,
      timestamp: request.created_at,
      data: request,
      actions: (
        <div className="flex space-x-2">
          <button
            onClick={() => handleRescheduleResponse(request.care_response_id, 'accepted')}
            disabled={processingReschedule}
            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
          >
            Accept
          </button>
          <button
            onClick={() => handleRescheduleResponse(request.care_response_id, 'declined')}
            disabled={processingReschedule}
            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      )
    });
  });

  // ... rest of existing code ...
};
```

### 3. Update handleRescheduleResponse Function
Replace the existing `handleRescheduleResponse` in `app/scheduler/page.tsx` with:

```typescript
const handleRescheduleResponse = async (careResponseId: string, response: 'accepted' | 'declined', notes?: string) => {
  try {
    setProcessingReschedule(true);
    
    const { data, error } = await supabase.rpc('handle_reschedule_response', {
      p_care_response_id: careResponseId,
      p_response_status: response,
      p_response_notes: notes || null
    });

    if (error) {
      console.error('Error handling reschedule response:', error);
      alert('Failed to process response. Please try again.');
      return;
    }

    if (data.success) {
      alert(`Successfully ${response} the reschedule request.`);
      // Refresh all data
      await fetchData();
    } else {
      alert('Failed to process response: ' + data.error);
    }
  } catch (error) {
    console.error('Error handling reschedule response:', error);
    alert('An error occurred. Please try again.');
  } finally {
    setProcessingReschedule(false);
  }
};
```

### 4. Update fetchData Function
Add reschedule requests to the existing `fetchData()` function:

```typescript
const fetchData = async () => {
  try {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch all data including reschedule requests
    const [
      careRequestsResult, 
      careResponsesResult, 
      invitationsResult,
      rescheduleRequestsResult  // ADD THIS
    ] = await Promise.all([
      supabase.rpc('get_care_requests', { p_parent_id: user.id }),
      supabase.rpc('get_reciprocal_care_requests', { parent_id: user.id }),
      supabase.rpc('get_open_block_invitations', { p_parent_id: user.id }),
      supabase.rpc('get_reschedule_requests', { p_parent_id: user.id })  // ADD THIS
    ]);

    // ... existing error handling ...

    setCareRequests(careRequestsResult.data || []);
    setCareResponses(careResponsesResult.data || []);
    setInvitations(invitationsResult.data || []);
    setRescheduleRequests(rescheduleRequestsResult.data || []);  // ADD THIS

    // ... rest of existing code ...
  } catch (error) {
    console.error('Error fetching data:', error);
    setError('Failed to load data');
  } finally {
    setLoading(false);
  }
};
```

### 5. Remove Redundant Components
- Remove the entire `RescheduleRequestsSection` component
- Remove reschedule-specific state management
- Remove separate reschedule processing logic

## Benefits
1. ✅ **Unified Experience** - All requests in one inbox
2. ✅ **Consistent UI** - Same styling and behavior
3. ✅ **Simplified Code** - One function, one component
4. ✅ **No More 404 Errors** - Single function signature
5. ✅ **Better UX** - Users see all requests together

## Next Steps
1. Run `INTEGRATE_RESCHEDULE_INTO_UNIFIED_SYSTEM.sql`
2. Update `app/scheduler/page.tsx` with the changes above
3. Test the unified messaging system
4. Remove redundant components and functions
