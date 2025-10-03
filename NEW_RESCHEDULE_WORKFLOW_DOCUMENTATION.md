# New Reschedule Workflow Documentation

## Overview

This document describes the new reschedule workflow implementation that addresses the requirements for proper time block rescheduling with multiple participating parents.

## Workflow Requirements

The new workflow follows these steps:

1. **Reschedule Request Initiation** (Parent A)
   - Create a new time block in Parent A's calendar at the new reschedule time
   - Move Parent A's child to the new time block
   - Remove Parent A's child from the original time block
   - Mark the original time block as "cancelled" (but keep it for tracking)
   - Send notifications to all participating parents

2. **Parent Response Handling**
   - When a parent accepts: Update their existing block to new time and add their child to Parent A's new providing block
   - When a parent declines: Remove their child from original block and handle their reciprocal block appropriately

3. **Reciprocal Block Management**
   - If declining parent's reciprocal block has other children: Only remove Parent A's child
   - If declining parent's reciprocal block has no other children: Cancel the entire block

4. **Completion Logic**
   - When all parents respond: Delete the original time block from Parent A's calendar
   - Mark the reschedule request as completed

## Database Functions

### 1. `initiate_reschedule_request()`

**Purpose**: Initiates a reschedule request from Parent A to all participating parents.

**Parameters**:
- `p_original_request_id` (uuid): ID of the original care request
- `p_new_date` (date): New date for the rescheduled time
- `p_new_start_time` (time): New start time
- `p_new_end_time` (time): New end time
- `p_reschedule_reason` (text): Optional reason for rescheduling

**Returns**: JSON object with success status and relevant IDs

**Key Actions**:
1. Creates a new care request for the rescheduled time
2. Creates a new providing care block for Parent A at the new time
3. Removes Parent A's child from the original block
4. Marks the original block as cancelled
5. Sends notifications to all participating parents

### 2. `handle_reschedule_response()`

**Purpose**: Handles individual parent responses (accept/decline) to reschedule requests.

**Parameters**:
- `p_reschedule_request_id` (uuid): ID of the reschedule request
- `p_responder_id` (uuid): ID of the parent responding
- `p_response_status` (text): 'accepted' or 'declined'
- `p_response_notes` (text): Optional response notes

**Returns**: JSON object with success status and remaining parent count

**Key Actions**:
1. Creates a care response record
2. If accepted: Updates responder's block to new time and adds child to Parent A's new block
3. If declined: Handles reciprocal block logic based on other children
4. Checks if all parents have responded
5. Completes the reschedule if all parents have responded

## Database Tables Affected

### Core Tables
- `care_requests`: Stores the original and new reschedule requests
- `care_reschedule_requests`: Tracks the reschedule workflow
- `care_responses`: Records individual parent responses
- `scheduled_care`: Manages time blocks for all parents
- `scheduled_care_children`: Tracks which children are in which blocks
- `notifications`: Sends reschedule requests to parents

### Key Fields
- `action_type`: Tracks the state of records ('new', 'rescheduled', 'cancelled')
- `status`: Tracks workflow status ('pending', 'completed')
- `response_type`: Records parent responses ('accept', 'decline')

## Workflow States

### 1. Initial State
- Original time block is active with all participating children
- All parents have their respective providing/needing care blocks

### 2. Reschedule Requested
- Parent A's new providing block is created at new time
- Parent A's child is moved to new block
- Original block is marked as cancelled but kept for tracking
- All other parents receive notifications

### 3. Parent Responses
- Each parent can accept or decline
- Accepted parents: Their blocks are updated to new time, children added to Parent A's new block
- Declined parents: Their children removed from original block, reciprocal blocks handled appropriately

### 4. Completion
- When all parents respond, original block is completely cancelled
- Reschedule request is marked as completed

## Testing

The workflow includes comprehensive testing scenarios:

1. **All Parents Accept**: Tests the happy path where everyone agrees to the new time
2. **Mixed Accept/Decline**: Tests partial acceptance with proper reciprocal block handling
3. **All Parents Decline**: Tests the case where no one can make the new time

## Key Improvements Over Previous Implementation

1. **Proper Block Management**: Original blocks are properly cancelled and new blocks created
2. **Sequential Response Handling**: Each parent's response is handled individually
3. **Reciprocal Block Logic**: Declining parents' reciprocal blocks are handled based on other children
4. **Complete Workflow**: The entire process from initiation to completion is properly managed
5. **Notification System**: All participating parents are properly notified

## Usage Examples

### Initiating a Reschedule Request
```sql
SELECT initiate_reschedule_request(
    'original-request-id',
    '2025-09-12',
    '08:30:00',
    '10:30:00',
    'Need to change time due to schedule conflict'
);
```

### Handling Parent Responses
```sql
-- Parent accepts
SELECT handle_reschedule_response(
    'reschedule-request-id',
    'parent-id',
    'accepted',
    'New time works for me'
);

-- Parent declines
SELECT handle_reschedule_response(
    'reschedule-request-id',
    'parent-id',
    'declined',
    'Cannot make the new time'
);
```

## Error Handling

The functions include comprehensive error handling:
- Input validation for all parameters
- Proper exception handling with meaningful error messages
- Transaction safety to prevent partial updates
- Detailed logging of all operations

## Future Enhancements

Potential improvements for future versions:
1. Email notifications in addition to in-app notifications
2. Time limits for responses with automatic handling
3. Partial reschedule options (only some children)
4. Recurring reschedule handling
5. Integration with calendar systems
