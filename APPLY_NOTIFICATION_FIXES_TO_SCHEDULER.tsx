// APPLY NOTIFICATION FIXES TO SCHEDULER PAGE
// This script applies the notification fixes to your current app/scheduler/page.tsx

// =====================================================
// Step 1: Add alert cooldown functionality at the top of your component
// =====================================================

// Add these variables at the top of your SchedulerPage component, after the state declarations:
let lastAlertTime = 0;
const ALERT_COOLDOWN = 2000; // 2 seconds

// Add this helper function after your other helper functions:
const showAlertOnce = (message: string) => {
  const now = Date.now();
  if (now - lastAlertTime > ALERT_COOLDOWN) {
    alert(message);
    lastAlertTime = now;
  }
};

// =====================================================
// Step 2: Replace the sendReciprocalAcceptanceNotifications function
// =====================================================

// REPLACE the entire sendReciprocalAcceptanceNotifications function (lines 1309-1389)
// with this improved version:

const sendReciprocalAcceptanceNotifications = async (responseId: string) => {
  try {
    // Get the care response details to find the care request
    const { data: careResponse, error: responseError } = await supabase
      .from('care_responses')
      .select(`
        *,
        care_requests!inner(
          id,
          group_id,
          requester_id,
          requested_date,
          start_time,
          end_time,
          notes,
          groups(name)
        )
      `)
      .eq('id', responseId)
      .single();

    if (responseError) {
      console.error('Error fetching care response:', responseError);
      return;
    }

    const careRequest = careResponse.care_requests;
    
    // FIXED: Use the new safe notification function instead of sending to all group members
    // This prevents duplicate notifications
    const { data: notificationResult, error: notificationError } = await supabase.rpc(
      'send_reciprocal_acceptance_notifications_safe',
      {
        p_care_request_id: careRequest.id,
        p_accepting_parent_id: careResponse.responder_id,
        p_group_id: careRequest.group_id
      }
    );

    if (notificationError) {
      console.error('Error sending notification:', notificationError);
      return;
    }

    console.log('Notification sent successfully:', notificationResult);

  } catch (error) {
    console.error('Error sending reciprocal acceptance notifications:', error);
  }
};

// =====================================================
// Step 3: Update the handleAcceptResponse function
// =====================================================

// REPLACE the handleAcceptResponse function (lines 1281-1306) with this version:

const handleAcceptResponse = async (responseId: string) => {
  try {
    const { error } = await supabase.rpc('accept_reciprocal_care_response', {
      p_care_response_id: responseId
    });

     if (error) {
      setError('Failed to accept response');
       return;
     }

    // Send notifications to all parents with children in the care blocks
    await sendReciprocalAcceptanceNotifications(responseId);

    // FIXED: Use showAlertOnce to prevent duplicate alerts
    showAlertOnce('Reciprocal care response accepted successfully! Calendar blocks have been created.');
    
    fetchData();
    
    // Dispatch event to update header counter
    window.dispatchEvent(new CustomEvent('invitationAccepted'));
    
  } catch (err) {
    setError('An unexpected error occurred');
  }
};

// =====================================================
// Step 4: Update other alert calls to use showAlertOnce
// =====================================================

// REPLACE these specific alert calls in your file:

// Line 1157: Replace
// alert('Failed to process response. Please try again.');
// with:
showAlertOnce('Failed to process response. Please try again.');

// Line 1162: Replace
// alert(`Successfully ${response} the reschedule request.`);
// with:
showAlertOnce(`Successfully ${response} the reschedule request.`);

// Line 1166: Replace
// alert('Failed to process response: ' + data.error);
// with:
showAlertOnce('Failed to process response: ' + data.error);

// Line 1170: Replace
// alert('An error occurred. Please try again.');
// with:
showAlertOnce('An error occurred. Please try again.');

// Line 1511: Replace
// alert('Invitation accepted successfully! Your child has been added to the care block.');
// with:
showAlertOnce('Invitation accepted successfully! Your child has been added to the care block.');

// Line 1513: Replace
// alert('Error accepting invitation. Please try again.');
// with:
showAlertOnce('Error accepting invitation. Please try again.');

// Line 1541: Replace
// alert('Invitation declined successfully.');
// with:
showAlertOnce('Invitation declined successfully.');

// Line 1543: Replace
// alert('Error declining invitation. Please try again.');
// with:
showAlertOnce('Error declining invitation. Please try again.');

// Line 1729: Replace
// alert('Group invitation accepted successfully!');
// with:
showAlertOnce('Group invitation accepted successfully!');

// Line 1825: Replace
// alert(`RSVP submitted: ${responseType}`);
// with:
showAlertOnce(`RSVP submitted: ${responseType}`);

// =====================================================
// Step 5: Summary of changes needed
// =====================================================

/*
CHANGES TO MAKE IN YOUR app/scheduler/page.tsx:

1. Add these variables at the top of your component (after state declarations):
   let lastAlertTime = 0;
   const ALERT_COOLDOWN = 2000;

2. Add the showAlertOnce helper function after your other helper functions

3. Replace the entire sendReciprocalAcceptanceNotifications function (lines 1309-1389)

4. Replace the handleAcceptResponse function (lines 1281-1306)

5. Replace all alert() calls with showAlertOnce() calls as shown above

6. Make sure to run the database fixes first:
   - FIX_CHILD_COUNT_AND_DUPLICATE_ISSUES.sql
   - FIX_UI_DUPLICATE_NOTIFICATIONS.sql

This will fix:
✅ Duplicate popup notifications
✅ Random child count changes  
✅ Child count adding 8 in detail modal
✅ Multiple alert popups
*/
