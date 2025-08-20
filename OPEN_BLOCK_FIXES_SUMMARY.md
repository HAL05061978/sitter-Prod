# Open Block Invitation Fixes Summary

## Issues Identified and Fixed

### Issue 1: block_time_id Logic for First-Come-First-Serve

**Problem:** Multiple care responses for the same time block had different `block_time_id` values, preventing proper first-come-first-serve logic.

**Solution:** 
- Modified `create_open_block_invitation` to generate a single `block_time_id` for each time block
- Updated `accept_open_block_invitation` to implement proper first-come-first-serve logic:
  - Accepts the first invitation that comes in
  - Rejects all other pending invitations for the same `block_time_id`
  - Rejects all other pending invitations for the same `invited_parent_id`

**Logic Flow:**
1. When a parent accepts an invitation, their `care_response.status` becomes 'accepted'
2. All other `care_responses` with the same `block_time_id` and status 'pending' become 'rejected'
3. All other `care_responses` for the same `invited_parent_id` and status 'pending' become 'rejected'

### Issue 2: Reciprocal Data in Pending Requests

**Problem:** Reciprocal data (columns O-S in Requests.csv) was being populated even when status was 'pending', but should only be filled when accepted.

**Solution:**
- Modified `create_open_block_invitation` to NOT populate reciprocal data when creating pending requests
- Updated `accept_open_block_invitation` to populate reciprocal data only when the invitation is accepted

**Data Flow:**
1. **Pending State:** `care_requests` created with `status = 'pending'` and NO reciprocal data
2. **Accepted State:** When invitation is accepted, reciprocal data is populated:
   - `reciprocal_parent_id` = accepting parent
   - `reciprocal_child_id` = accepted child
   - `reciprocal_date`, `reciprocal_start_time`, `reciprocal_end_time` = reciprocal care details
   - `reciprocal_status` = 'accepted'

## Database Functions Updated

### 1. `create_open_block_invitation` (NEW)
- Creates open block invitations without reciprocal data
- Generates single `block_time_id` per time block
- Creates care responses for all invited parents

### 2. `accept_open_block_invitation` (UPDATED)
- Implements first-come-first-serve logic
- Updates original care request with reciprocal data when accepted
- Creates reciprocal care request with `request_type = 'reciprocal'`
- Rejects competing invitations

### 3. `get_open_block_invitations` (UNCHANGED)
- Retrieves pending open block invitations for a parent

### 4. `decline_open_block_invitation` (UNCHANGED)
- Declines an open block invitation

## Key Changes Made

### Migration Files:
1. `20250115000000_open_block_functions.sql` - Updated accept function
2. `20250115000001_create_open_block_invitation.sql` - New create function

### Logic Improvements:
- ✅ Single `block_time_id` per time block
- ✅ First-come-first-serve functionality
- ✅ Reciprocal data only populated when accepted
- ✅ Proper rejection of competing invitations
- ✅ Correct request types ('open_block' vs 'reciprocal')

## Testing Recommendations

1. **Test First-Come-First-Serve:**
   - Create open block invitation for multiple parents
   - Verify all responses have same `block_time_id`
   - Accept invitation from one parent
   - Verify other invitations are automatically rejected

2. **Test Reciprocal Data:**
   - Verify pending requests have no reciprocal data
   - Accept invitation and verify reciprocal data is populated
   - Check that reciprocal care request is created with correct type

3. **Test Data Integrity:**
   - Verify `block_time_id` consistency across responses
   - Check that only one invitation can be accepted per time block
   - Ensure proper cleanup of rejected invitations
