# Simplified Scheduling Approach - Summary (Revised)

## Overview

This simplified approach reduces the complex 6-table system to a clean **3-table system** while preserving all the important functionality: **reciprocal care requests**, **opening time blocks to other group members**, and **editing capabilities**.

## Key Features

### 1. **Simple Request/Response Flow**
- Parent A creates a care request (with optional reciprocal arrangement)
- Parent B accepts/declines the request
- If accepted, scheduled care blocks are automatically created
- Supports both simple and reciprocal arrangements

### 2. **Reciprocal Care Support**
- Parents can propose reciprocal care arrangements
- "I'll watch your child on Friday if you watch mine on Saturday"
- Both care blocks are created when the request is accepted
- All reciprocal details stored in the request

### 3. **Opening Time Blocks to Others**
- Care providers can open their confirmed blocks to other group members
- Other parents can join open blocks (up to specified slot limits)
- Automatic slot tracking and conflict checking
- Perfect for group care scenarios

### 4. **Editing Support**
- Approved blocks can be edited up to a deadline (e.g., 24 hours before)
- Full audit trail of changes
- Time conflict checking for edits
- Optional edit reasons

## Database Schema

### Table 1: `care_requests`
```sql
-- Handles the entire request/response lifecycle
- requester_id: Who needs care
- responder_id: Who accepted (NULL if pending/declined)
- status: pending → accepted/declined → completed/cancelled
- response_notes: Optional notes from responder

-- RECIPROCAL SUPPORT
- is_reciprocal: Whether this is a reciprocal request
- reciprocal_parent_id: Who will provide reciprocal care
- reciprocal_child_id: Child for reciprocal care
- reciprocal_date/start_time/end_time: Reciprocal care details
```

### Table 2: `scheduled_care`
```sql
-- Stores confirmed care blocks
- care_type: 'needed' or 'provided'
- related_request_id: Links to original request
- is_editable: Whether block can be modified
- edit_deadline: When editing closes
- original_*: Audit trail for edits

-- OPENING TO OTHERS SUPPORT
- is_open_to_others: Whether block is open to other group members
- open_slots: How many additional children can join
- current_slots_used: How many additional children are currently scheduled
```

### Table 3: `care_invitations`
```sql
-- Handles invitations for reciprocal care and joining open blocks
- inviter_id: Who is sending the invitation
- invitee_id: Who is being invited
- care_block_id: Which care block the invitation is for
- invitation_type: 'reciprocal' or 'join_open_block'
- status: pending → accepted/declined
```

## Workflow Examples

### Basic Reciprocal Request Flow
1. **Parent A** creates reciprocal request: "Need care for Emma on Friday 2-4pm, can provide care for your child on Saturday 3-5pm"
2. **Parent B** sees request in group feed
3. **Parent B** accepts → two scheduled care blocks created (Friday and Saturday)
4. **Parent A** gets notification of acceptance

### Opening Time Blocks Flow
1. **Parent B** has confirmed care block for Friday 2-4pm
2. **Parent B** opens block to others (sets open_slots = 2)
3. **Parent C** sees open block and joins with their child
4. **Parent D** also joins the same block
5. Block now has 3 children being cared for simultaneously

### Editing Flow
1. **Parent B** (care provider) needs to change time
2. **Parent B** edits block (if within deadline)
3. **Parent A** gets notification of change
4. **Parent A** can discuss via chat if needed

## Benefits of This Approach

### 1. **Simplified but Complete**
- 3 tables instead of 6 (50% reduction)
- Preserves all important functionality
- Clear, predictable workflows
- Easy to understand and debug

### 2. **Flexibility**
- Supports both simple and reciprocal arrangements
- Allows opening blocks to multiple children
- Editing allows for schedule changes
- Parents can discuss details via chat

### 3. **User Experience**
- Straightforward request/accept flow
- Clear status tracking
- Simple notifications
- Intuitive invitation system

### 4. **Maintenance**
- Fewer moving parts than 6-table system
- Easier to test and debug
- Simpler codebase
- Better performance

## Implementation Notes

### Reciprocal Rules
- Reciprocal details stored in the request
- Both care blocks created when request is accepted
- Time conflict checking for both blocks
- Clear audit trail

### Opening Blocks Rules
- Care provider controls who can join
- Slot limits prevent overcrowding
- Time conflict checking for joining parents
- Automatic slot tracking

### Editing Rules
- Default 24-hour edit deadline
- Only care provider can edit
- Time conflict checking
- Full audit trail

### Communication
- All coordination happens via chat
- Simple notifications for changes
- Clear invitation system

## Migration Strategy

1. **Run cleanup script** to clear old data
2. **Create new simplified tables** (3 tables instead of 6)
3. **Update application code** to use new schema
4. **Test basic workflows** (requests, reciprocal, opening blocks)
5. **Add editing functionality** once basic flow works

## Questions for Discussion

1. **Edit Deadline**: Should it be 24 hours, 12 hours, or configurable?
2. **Edit Permissions**: Should requester also be able to edit?
3. **Slot Limits**: Should there be default limits for opening blocks?
4. **Notifications**: What notifications should be sent for edits and joins?

This approach gives you a solid foundation that preserves all the important functionality while being much easier to work with than the complex 6-table system. 