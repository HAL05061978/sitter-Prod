# Open Block Acceptance Debug Workflow

## Problem Summary
The open block invitation acceptance process is not working correctly. When a parent accepts an open block invitation:
1. The status field in `open_block_invitations` table is not being updated
2. The block is not being created in the scheduled care system

## Root Cause Analysis

Based on the console error (406 Not Acceptable) and code analysis, the issue appears to be:

1. **Database Trigger Issue**: The `handle_open_block_acceptance` trigger function may not be properly configured or may have errors
2. **RLS Policy Issue**: Row Level Security policies might be preventing the trigger from updating the invitation status
3. **Schema Mismatch**: The database schema might not match what the trigger function expects

## Debugging Workflow

### Step 1: Check Current Database State

Run the `debug_open_block_workflow.sql` script to check:
- If the trigger function exists and is properly configured
- Current state of invitations and responses
- Any recent responses that should have triggered updates

### Step 2: Apply Fixed Trigger Function

Run the `fix_open_block_trigger_debug.sql` script to:
- Drop and recreate the trigger function with comprehensive debugging
- Add proper error handling and logging
- Ensure all necessary database operations are performed

### Step 3: Test the Process

#### Option A: Use the Frontend Debugger
1. Navigate to the Schedule page
2. Click the "Debug Open Block" button (red button in calendar header)
3. Click "Test Open Block Acceptance" in the debugger modal
4. Review the debug log to see what's happening

#### Option B: Use Database Test Script
1. Run the `test_open_block_acceptance.sql` script
2. Follow the instructions to replace placeholder IDs with actual values
3. Check the results after the test

### Step 4: Verify the Fix

After applying the fixed trigger, verify that:

1. **Invitation Status Updates**: The `open_block_invitations.status` should change from 'active' to 'accepted'
2. **Accepted Parent ID**: The `accepted_parent_id` should be set to the accepting parent
3. **Scheduled Care Children**: A new entry should be created in `scheduled_care_children`
4. **Reciprocal Care Block**: A new care block should be created in `scheduled_care`

## Expected Workflow

### When Parent C accepts Parent B's open block invitation:

1. **Response Created**: A record is inserted into `open_block_responses`
2. **Trigger Fires**: The `handle_open_block_acceptance` trigger is activated
3. **Invitation Updated**: The invitation status changes to 'accepted'
4. **Other Invitations Expired**: Other invitations for the same time slot are marked as 'expired'
5. **Child Added to Care**: The accepting child is added to the original care block
6. **Reciprocal Block Created**: A new care block is created for Parent C to care for Parent B's child

## Debugging Tools Created

### 1. Database Scripts
- `debug_open_block_workflow.sql`: Check current database state
- `fix_open_block_trigger_debug.sql`: Apply fixed trigger with debugging
- `test_open_block_acceptance.sql`: Manual testing script

### 2. Frontend Debugger
- `app/components/OpenBlockDebugger.tsx`: UI component for testing
- Added debug button to Schedule page
- Real-time logging of the acceptance process

## Common Issues and Solutions

### Issue 1: Trigger Not Firing
**Symptoms**: No database updates when response is created
**Solution**: Check if trigger exists and is properly configured

### Issue 2: RLS Policy Blocking Updates
**Symptoms**: 406 Not Acceptable error
**Solution**: Ensure RLS policies allow the trigger to update invitations

### Issue 3: Schema Mismatch
**Symptoms**: Trigger errors about missing columns
**Solution**: Update trigger function to match actual database schema

### Issue 4: Missing Reciprocal Child
**Symptoms**: Reciprocal care block not created
**Solution**: Ensure reciprocal_child_id is properly determined

## Testing Checklist

- [ ] Run debug workflow script
- [ ] Apply fixed trigger function
- [ ] Test with frontend debugger
- [ ] Verify invitation status updates
- [ ] Verify scheduled_care_children creation
- [ ] Verify reciprocal care block creation
- [ ] Test with multiple invitations (first-come-first-serve)
- [ ] Test with different parents and children

## Next Steps

1. **Apply the fixed trigger function** using the provided SQL script
2. **Test the process** using either the frontend debugger or database test script
3. **Monitor the logs** to identify any remaining issues
4. **Verify the complete workflow** works as expected
5. **Remove debug components** once the issue is resolved

## Files to Execute

1. `fix_open_block_trigger_debug.sql` - Apply the fixed trigger
2. `debug_open_block_workflow.sql` - Check current state
3. Use the frontend debugger or `test_open_block_acceptance.sql` for testing

This workflow should resolve the open block acceptance issue and ensure the system works as expected.
