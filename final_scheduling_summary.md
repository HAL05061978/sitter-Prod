# Final Simplified Scheduling Schema - Summary

## Overview

This final schema supports **4 distinct workflow types** with a clean **3-table system** that replaces the complex 6-table system:

1. **Reciprocal Requests** (existing)
2. **Opening Time Blocks** (existing) 
3. **Simple Requests** (new)
4. **Event Requests** (new)

## Database Schema

### Table 1: `care_requests`
```sql
-- Handles all request types with request_type field
- request_type: 'simple', 'reciprocal', 'event', 'open_block'
- requester_id: Who needs care
- responder_id: Who accepted (NULL if pending/declined)
- status: pending → accepted/declined → completed/cancelled/expired
- expires_at: When request expires

-- RECIPROCAL SUPPORT
- is_reciprocal: Whether this is a reciprocal request
- reciprocal_parent_id: Who will provide reciprocal care
- reciprocal_child_id: Child for reciprocal care
- reciprocal_date/start_time/end_time: Reciprocal care details
- reciprocal_status: pending → accepted/declined

-- OPEN BLOCK SUPPORT
- open_block_parent_id: Who opened the block
- open_block_slots: How many slots available
- open_block_slots_used: How many slots used

-- EVENT SUPPORT
- event_title: For event requests
- event_description: For event requests
```

### Table 2: `scheduled_care`
```sql
-- Stores all confirmed care blocks
- care_type: 'needed', 'provided', 'event'
- related_request_id: Links to original request
- is_editable: Whether block can be modified
- edit_deadline: When editing closes
- original_*: Audit trail for edits

-- GROUP EVENT SUPPORT
- event_title: For group events
- event_description: For group events
- is_group_event: Whether this is a group event
```

### Table 3: `care_responses`
```sql
-- Handles responses to requests (multiple responses per request)
- request_id: Which request this responds to
- responder_id: Who is responding
- response_type: 'accept', 'decline', 'pending'
- status: pending → accepted/declined/expired
- UNIQUE(request_id, responder_id): One response per person per request
```

## Workflow Examples

### 1. **Reciprocal Request Flow** (existing)
1. **Parent A** creates reciprocal request: "Need care for Emma on Friday 2-4pm"
2. **Parent B** sees request in group feed
3. **Parent B** accepts → provides care for Emma but asks for their childcare on Saturday 3-5pm
4. **Parent A** gets notification and accepts or rejects. If does not respond to Parent B and accepts another parent's response then all non-accepted responses will expire. Only one accept can be done per request.

### 2. **Opening Time Blocks Flow** (existing)
1. **Parent B** has confirmed care block for Friday 2-4pm
2. **Parent B** opens block to others, excluding Parent A. They can choose which group members they can send provide requests to and depending on how many group members are being sent request, that's how many time slots requests Parent B can send out (ie: 2 invites would create 2 open slot requests). Remember the goal is to maximize their time. So if they take care of 3 children for 2 hours they can have their child taken care of for 6 hours total (2 hours by each of the 3 parents).
3. **Parent C** sees open blocks (2 in this case), chooses which time works for their child to be taken care of, and accepts/rejects/leaves alone. When accepted, then a time block in calendar is created and that time block is no longer available.
4. **Parent D** also joins the same block that Parent B sent invitation out for but only if he accepts the remaining providing care for request.
5. Block now has 3 children being cared for simultaneously and the 2 new parents that joined have signed up to take care of Parent B's child in exchange.

### 3. **Simple Request Flow** (new)
1. **Parent A** creates request: "Need care for Emma on Sunday 2-4pm"
2. **Parent B** sees request in their schedule page (as all other invitations) and agrees
3. **Calendar block is created for all parties** (Parent A needs care for {}; Parent B providing care for {}). Please note that this simplified version will be used more for when an edit to an already scheduled group event is made but not all parties can attend the new time.

### 4. **Event Request Flow** (new)
1. **Parent A** creates meet up request: "Basketball game on Thursday 2-4pm"
2. **Parents B, C, D, E, F, G, H** see request and all agree
3. **Calendar block is created for all parties as meet up**.

### 5. **Editing Flow** (new)
1. **Parent B** (care provider) needs to change time
2. **Parent B** edits block (if within deadline)
3. **All Parents involved** get notifications of change
4. **Parents** can agree or reject. If reject then it is up to Parent B to send simple request to make up for time. The rejecting parent can also reject the agreed upon time if they wish.

## Key Features

### **Request Types**
- **Simple**: Basic care request/response
- **Reciprocal**: "I'll watch your child if you watch mine"
- **Event**: Group meetups/activities
- **Open Block**: Opening confirmed blocks to others

### **Response Management**
- Multiple responses per request tracked in `care_responses`
- Only one acceptance per request
- Automatic expiration of other responses when one is accepted
- Response status tracking (pending → accepted/declined/expired)

### **Time Block Management**
- Automatic slot tracking for open blocks
- Time conflict checking for all operations
- Edit deadline enforcement
- Full audit trail for changes

### **Event Support**
- Group events with multiple participants
- Event titles and descriptions
- All participants get calendar blocks

## Benefits

### **Simplified Structure**
- **6 tables → 3 tables** (50% reduction)
- Clear separation of concerns
- Easier to understand and debug

### **Flexible Workflows**
- Supports all 4 workflow types
- Extensible for future requirements
- Consistent data model across all types

### **Better Performance**
- Fewer joins needed
- Optimized indexes
- Efficient queries

### **Maintainable Code**
- Clear business logic
- Reusable functions
- Consistent patterns

## Implementation Notes

### **Request Expiration**
- All requests have `expires_at` field
- Automatic cleanup of expired requests
- Configurable expiration times

### **Response Handling**
- One response per person per request
- Automatic status updates
- Clear audit trail

### **Time Conflict Checking**
- Built-in conflict detection
- Prevents double-booking
- Works across all request types

### **Editing Rules**
- 24-hour edit deadline (configurable)
- Full audit trail
- Notification to all participants

This schema provides a solid foundation that supports all your specific workflow requirements while being much simpler to work with than the original 6-table system. 