# Open Block Functionality - Rebuild Summary

## Overview
I've rebuilt the open block functionality from scratch, focusing on the three main functions that needed to be restarted:

1. `get_open_block_invitations`
2. `accept_open_block_invitation` 
3. `decline_open_block_invitation`

## Database Schema Understanding
Based on the CSV constraints file, the open block functionality uses these tables:

### care_requests table
- `request_type` can be 'open_block'
- `requester_id` = inviting parent (who creates the open block)
- `responder_id` = invited parent (who receives the invitation)
- `open_block_parent_id` = the parent who owns the original care block
- `open_block_slots` = number of available slots (default 1)
- `open_block_slots_used` = number of slots already taken (default 0)
- `existing_block_id` = links to the original scheduled_care block
- `reciprocal_date`, `reciprocal_start_time`, `reciprocal_end_time` = details for reciprocal care

### scheduled_care table
- `care_type` can be 'needed', 'provided', or 'event'
- `related_request_id` = links back to care_requests

### scheduled_care_children table
- Links scheduled care to children and providing parents

## Rebuilt Functions

### 1. get_open_block_invitations(p_parent_id UUID)
**Purpose**: Get all pending open block invitations for a parent

**Logic**:
- Finds care requests where `responder_id = p_parent_id` (the invited parent)
- `request_type = 'open_block'` and `status = 'pending'`
- Joins with scheduled_care, groups, and profiles to get full details
- Returns invitation details including reciprocal care information

### 2. accept_open_block_invitation(p_care_response_id, p_accepting_parent_id, p_accepted_child_id)
**Purpose**: Accept an open block invitation and set up reciprocal care

**Logic**:
1. Validates the care request exists and is pending
2. Checks if there are available slots
3. Updates the care request status to 'accepted'
4. Adds the child to the existing scheduled care block via scheduled_care_children
5. Increments the open_block_slots_used counter
6. Creates a new care request for the reciprocal care
7. Creates scheduled care for the reciprocal care
8. Links the providing parent to the reciprocal care

### 3. decline_open_block_invitation(p_care_response_id, p_declining_parent_id)
**Purpose**: Decline an open block invitation

**Logic**:
- Updates the care request status to 'declined'
- Validates the user is the correct responder

## Frontend Updates

### useOpenBlock Hook
- Fixed parameter names to match database functions
- Updated return value handling for decline function

### Scheduler Page
- Fixed parameter names in accept_open_block_invitation call
- Updated decline function to use database function instead of direct table update

## Testing Instructions

To test the rebuilt functionality:

1. **Apply the migration**:
   ```bash
   supabase db push
   ```

2. **Create test data**:
   - Create a scheduled care block (existing_block)
   - Create an open block invitation in care_requests with:
     - `request_type = 'open_block'`
     - `requester_id` = inviting parent
     - `responder_id` = invited parent
     - `status = 'pending'`
     - `existing_block_id` = the scheduled care block ID
     - `reciprocal_date`, `reciprocal_start_time`, `reciprocal_end_time` = reciprocal care details

3. **Test the functions**:
   - Call `get_open_block_invitations` with the invited parent's ID
   - Call `accept_open_block_invitation` with the care request ID, accepting parent ID, and child ID
   - Call `decline_open_block_invitation` with the care request ID and declining parent ID

4. **Verify the results**:
   - Check that scheduled_care_children entries are created
   - Verify that reciprocal care requests and scheduled care are created
   - Confirm that open_block_slots_used is incremented

## Key Changes from Previous Version

1. **Removed dependency on care_responses table** - now uses care_requests directly
2. **Fixed parameter naming** - all functions now use consistent parameter names
3. **Improved error handling** - better validation and error messages
4. **Simplified data flow** - clearer relationship between tables

## Notes for Manual Testing

When you manually populate the care_requests and care_responses tables, make sure to:

1. Set `request_type = 'open_block'` for open block invitations
2. Use `requester_id` for the inviting parent and `responder_id` for the invited parent
3. Set `existing_block_id` to link to the original scheduled care block
4. Include reciprocal care details (`reciprocal_date`, `reciprocal_start_time`, `reciprocal_end_time`)
5. Set `open_block_slots` and `open_block_slots_used` appropriately

The functions should now work correctly with the existing frontend code once the migration is applied.
