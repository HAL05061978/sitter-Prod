# Request Types Documentation

## Overview

The care management system supports four distinct request types, each serving a specific purpose in the care coordination workflow:

## 1. **`care`** - Basic Care Requests
- **Purpose**: Standard care requests between parents
- **Usage**: Initial care requests that don't involve reciprocal agreements or open blocks
- **Workflow**: Direct parent-to-parent care arrangements
- **Status**: Basic functionality

## 2. **`reciprocal`** - Reciprocal Care Agreements
- **Purpose**: 1-to-1 care agreements where parents exchange care services
- **Usage**: When Parent A provides care for Parent B's child, and Parent B provides care for Parent A's child
- **Workflow**: 
  - Parent A creates a reciprocal request
  - Parent B accepts, creating a reciprocal agreement
  - Both parents get care blocks for their respective children
- **Status**: ✅ **Working perfectly**

## 3. **`open_block`** - Open Block Invitations
- **Purpose**: Allows parents to open their providing care blocks to group members who weren't chosen for reciprocal agreements
- **Usage**: When a parent has a providing care block and wants to invite other group members to participate
- **Workflow**:
  - Parent A creates an open block invitation
  - Other group members can accept the invitation
  - Children are added to the providing care block
- **Status**: ✅ **Working perfectly**

## 4. **`reschedule`** - Reschedule Requests (NEW)
- **Purpose**: Allows parents to reschedule existing care blocks that they are providing
- **Usage**: When a parent needs to change the time/date of a care block they're providing
- **Workflow**:
  - Parent A initiates a reschedule request for their providing care block
  - All participating parents (reciprocal + open block participants) are notified
  - Each parent can accept or decline the new time
  - Parent A's child is moved to the new time block immediately
  - Original block is marked as cancelled but kept for tracking
  - As parents respond, their children are added/removed from the new block
  - When all parents respond, the original block is completely removed
- **Status**: 🚧 **Newly implemented**

## Database Schema

### Request Type Constraint
```sql
ALTER TABLE care_requests ADD CONSTRAINT care_requests_request_type_check 
CHECK (request_type IN ('care', 'reciprocal', 'open_block', 'reschedule'));
```

### Action Type Constraints
```sql
-- care_requests action_type
CHECK (action_type IN ('new', 'reschedule', 'cancellation'))

-- care_responses action_type  
CHECK (action_type IN ('new', 'reschedule_response', 'cancellation'))

-- scheduled_care action_type
CHECK (action_type IN ('new', 'rescheduled', 'cancelled'))

-- scheduled_care_children action_type
CHECK (action_type IN ('new', 'rescheduled', 'cancelled'))
```

## Workflow Relationships

```
Basic Care (care)
    ↓
Reciprocal Agreements (reciprocal) ← Working perfectly
    ↓
Open Block Invitations (open_block) ← Working perfectly
    ↓
Reschedule Requests (reschedule) ← New implementation
```

## Key Differences

| Request Type | Purpose | Participants | Block Management | Status |
|--------------|---------|--------------|------------------|---------|
| `care` | Basic care requests | 2 parents | Simple | Basic |
| `reciprocal` | 1-to-1 care exchange | 2 parents | Reciprocal blocks | ✅ Working |
| `open_block` | Invite group members | Multiple parents | Add children to existing block | ✅ Working |
| `reschedule` | Change existing block time | All participants | Create new block, cancel old | 🚧 New |

## Implementation Notes

### Reschedule Workflow Specifics
1. **Immediate Action**: Parent A's child is moved to new time block immediately
2. **Tracking**: Original block is marked as cancelled but kept for tracking responses
3. **Notifications**: All participating parents (both reciprocal and open block) are notified
4. **Response Handling**: Each parent's response is handled individually
5. **Reciprocal Block Logic**: When parents decline, their reciprocal blocks are handled based on other children
6. **Completion**: Original block is only deleted when all parents have responded

### Database Functions
- `initiate_reschedule_request()` - Creates reschedule request and new time block
- `handle_reschedule_response()` - Processes individual parent responses
- `create_reschedule_notifications()` - Sends notifications to all participants

## Testing

The complete reschedule workflow is tested in `COMPLETE_RESCHEDULE_TEST.sql` which:
1. Adds the new request type constraint
2. Tests the complete reschedule workflow
3. Verifies all database operations
4. Tests parent responses (accept/decline)
5. Validates final state

## Future Considerations

1. **Email Notifications**: Could be added for reschedule requests
2. **Time Limits**: Could add response deadlines
3. **Partial Reschedules**: Could allow rescheduling only some children
4. **Recurring Reschedules**: Could handle recurring care blocks
5. **Calendar Integration**: Could sync with external calendar systems
