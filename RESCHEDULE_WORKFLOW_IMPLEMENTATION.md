# Reschedule Workflow Implementation

## Overview
This document outlines the complete implementation of the rescheduling workflow for time blocks in the care management system. The new system addresses the issue where only parents with reciprocal care agreements were being notified of reschedule requests, excluding parents who had accepted open block invitations.

## Problem Statement
The original system only notified parents who had `care_type = 'needed'` blocks, but it should notify ALL parents who have children participating in the time block, including those who accepted open block invitations.

## Solution Architecture

### 1. Database Changes

#### New Migration: `20250115000017_fix_reschedule_notifications.sql`

**Key Functions Added:**

1. **Updated `create_reschedule_notifications` function:**
   - Now finds ALL parents with children participating in the time block
   - Includes parents with both 'needed' and 'provided' care blocks
   - Includes parents whose children were added via open block invitations
   - Excludes cancelled blocks and the requester

2. **New `handle_reschedule_response_complete` function:**
   - Handles the complete workflow for parent responses
   - Creates new care blocks for accepted reschedules
   - Removes children from original blocks for declined reschedules
   - Tracks remaining parents and completes the process when all respond
   - Returns detailed status information

3. **New `get_reschedule_request_details` function:**
   - Provides comprehensive details for the UI
   - Shows all participating parents and their children
   - Shows current response status
   - Returns structured JSON data for easy frontend consumption

### 2. Frontend Changes

#### Updated Components:

1. **RescheduleModal.tsx:**
   - Updated comment to clarify that ALL participating parents are notified
   - No functional changes needed as the database function handles the logic

2. **New RescheduleResponseModal.tsx:**
   - Complete UI for parents to respond to reschedule requests
   - Shows current vs proposed schedule
   - Lists all participating parents and their response status
   - Handles accept/decline responses with notes
   - Provides real-time feedback on the process

## Workflow Implementation

### Step 1: Reschedule Request Creation
1. Parent A initiates reschedule request through RescheduleModal
2. System creates new care request with proposed time
3. System creates reschedule request record
4. **NEW:** System notifies ALL parents with children in the time block (not just reciprocal care parents)

### Step 2: Parent Response Handling
1. Each parent receives notification and can view RescheduleResponseModal
2. Parent can accept or decline with optional notes
3. **If Accepted:**
   - **Only the block being rescheduled** is modified to the new time (keeps same block ID)
   - **Reciprocal blocks remain untouched** - they stay at the original time
   - New providing care block created for the rescheduling parent to track responses
   - Much simpler - no new blocks created for responding parents
4. **If Declined:**
   - Parent's children removed from original time block
   - Parent's care blocks marked as cancelled
   - **ONLY** the specific reciprocal care block between the declining parent and requester is cancelled
   - Other care agreements remain intact to maintain scheduling balance

### Step 3: Progressive Calendar Updates
1. As parents accept, their calendars are immediately updated
2. Original time block remains in Parent A's calendar with remaining children
3. Accepting parents see new time block in their calendars
4. Declining parents have their blocks removed

### Step 4: Final Cleanup
1. When all parents respond, original time block is removed from Parent A's calendar
2. Reschedule request marked as completed
3. All related records properly cleaned up

## Key Features

### Comprehensive Parent Notification
- **Before:** Only parents with `care_type = 'needed'` blocks notified
- **After:** ALL parents with children in the time block notified, including:
  - Reciprocal care participants
  - Open block invitation acceptors
  - Parents providing care
  - Parents receiving care

### Progressive Calendar Updates
- Parents see changes immediately upon responding
- Original requester sees remaining participants until all respond
- No confusion about who has responded and who hasn't

### Simplified Block Management
- **Only the block being rescheduled is modified** to new time (keeps same block ID)
- **Reciprocal blocks remain untouched** until parent declines
- **Only new providing care block** created for rescheduling parent to track responses
- Much simpler database structure - no duplicate blocks for responding parents
- Reciprocal care blocks handled correctly based on remaining participants

### Audit Trail
- Complete tracking of all responses
- Detailed notes and timestamps
- Proper action_type tracking for all records

## Implementation Steps

### 1. Apply Database Migration
```bash
cd supabase
npx supabase db reset
# or apply the specific migration
npx supabase migration up
```

### 2. Update Frontend Components
- The RescheduleModal.tsx is already updated
- Add RescheduleResponseModal.tsx to your components
- Update any notification handling to use the new modal

### 3. Integration Points
- Update notification click handlers to open RescheduleResponseModal
- Ensure proper data flow between components
- Test with multiple parent scenarios

## Testing Scenarios

### Scenario 1: Basic Reciprocal Care Reschedule
1. Parent A has reciprocal care with Parent B
2. Parent A requests reschedule
3. Parent B should be notified and can accept/decline
4. Calendar updates accordingly

### Scenario 2: Open Block with Multiple Parents
1. Parent A opens block, Parent B and Parent C accept
2. Parent A requests reschedule
3. Both Parent B and Parent C should be notified
4. Each can independently accept/decline
5. Calendar updates progressively

### Scenario 3: Mixed Participation
1. Parent A has reciprocal care with Parent B
2. Parent A opens block, Parent C accepts
3. Parent A requests reschedule
4. Both Parent B and Parent C should be notified
5. Different response combinations should work correctly

## Database Schema Impact

### New Tables/Columns
- `care_reschedule_requests.rescheduled_care_block_id` - tracks specific block being rescheduled
- Enhanced notification system with better data structure

### Function Signatures
```sql
-- Updated function
create_reschedule_notifications(p_reschedule_request_id UUID, p_requester_id UUID, p_original_request_id UUID)

-- New functions
handle_reschedule_response_complete(p_reschedule_request_id UUID, p_responder_id UUID, p_response_status TEXT, p_response_notes TEXT DEFAULT NULL)
get_reschedule_request_details(p_reschedule_request_id UUID)
```

## Benefits

1. **Complete Parent Coverage:** All participating parents are notified
2. **Progressive Updates:** Calendars update as parents respond
3. **Clear Status Tracking:** Easy to see who has responded
4. **Proper Cleanup:** No orphaned records or blocks
5. **Audit Trail:** Complete history of all actions
6. **User Experience:** Clear, intuitive interface for responses

## Future Enhancements

1. **Email Notifications:** Send email alerts for reschedule requests
2. **Push Notifications:** Mobile app notifications
3. **Auto-Response:** Allow parents to set default responses
4. **Bulk Operations:** Handle multiple reschedule requests
5. **Analytics:** Track reschedule patterns and success rates

This implementation provides a robust, user-friendly rescheduling system that properly handles all the complex scenarios in your care management workflow.
