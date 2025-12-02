# Enhanced Decline Workflow Deployment Guide

## Overview
This deployment adds the enhanced decline workflow that allows parents to:
1. Select which arrangement to cancel when declining a reschedule
2. Optionally propose a counter-proposal (replacement time)
3. Automatic fallback cancellation if counter-proposal is declined

## Deployment Steps

### Step 1: Deploy SQL to Supabase

1. **Open Supabase Dashboard**
   - Go to your Supabase project dashboard
   - Navigate to **SQL Editor**

2. **Run the deployment SQL**
   - Open the file: `deploy_enhanced_decline_workflow.sql`
   - Copy the entire contents
   - Paste into Supabase SQL Editor
   - Click **Run** to execute

3. **Verify deployment**
   - You should see a success message: "ENHANCED DECLINE WORKFLOW DEPLOYED!"
   - Check that all functions were created without errors

### Step 2: Deploy Frontend to Vercel

After the SQL is successfully deployed to Supabase, deploy the frontend changes:

1. **Commit the changes** (if not already committed):
   ```bash
   git add components/care/RescheduleResponseModal.tsx
   git commit -m "Add enhanced decline workflow with arrangement selection and counter-proposals"
   ```

2. **Push to repository**:
   ```bash
   git push origin main
   ```

3. **Vercel will auto-deploy** (if auto-deploy is enabled)
   - Or manually deploy from Vercel dashboard

## What Was Changed

### Database Changes (deploy_enhanced_decline_workflow.sql)

1. **care_responses table** - Added columns:
   - `decline_action` - 'cancel' or 'counter_propose'
   - `counter_proposal_date` - Alternative date
   - `counter_proposal_start_time` - Alternative start time
   - `counter_proposal_end_time` - Alternative end time
   - `selected_cancellation_request_id` - Which arrangement to cancel
   - `counter_proposal_notes` - Notes for counter-proposal

2. **New function**: `get_arrangements_between_parents(parent1_id, parent2_id)`
   - Returns all scheduled care arrangements between two parents
   - Used to populate the dropdown for cancellation selection

3. **Updated function**: `handle_improved_reschedule_response`
   - Now accepts 5 new optional parameters for decline workflow
   - Creates counter-proposal reschedule requests when offered
   - Links counter-proposals to original reschedule

4. **New function**: `respond_to_counter_proposal(proposal_id, responder_id, response)`
   - Handles original requester's response to counter-proposal
   - Three options: 'accept', 'keep_original', 'decline_and_cancel'
   - Automatically cancels selected arrangement if declined

### Frontend Changes (RescheduleResponseModal.tsx)

1. **Two-stage modal flow**:
   - Initial view: Simple Accept/Decline buttons
   - Decline view: Enhanced options for arrangement selection and counter-proposal

2. **New state management**:
   - Fetches all arrangements between parents
   - Manages counter-proposal date/time inputs
   - Validates required fields before submission

3. **Enhanced UX**:
   - Clear informational messages
   - Radio button selection for arrangements
   - Optional checkbox for counter-proposal
   - Warning about automatic cancellation

## Testing Checklist

After deployment, test the following scenarios:

- [ ] Accept reschedule request (should work as before)
- [ ] Decline reschedule with simple cancellation (no counter-proposal)
- [ ] Decline reschedule with counter-proposal
- [ ] Original requester accepts counter-proposal
- [ ] Original requester declines counter-proposal (check that selected arrangement gets canceled)
- [ ] Verify that arrangements list populates correctly
- [ ] Check that all calendar updates happen correctly

## Rollback Plan

If issues occur, you can rollback by:

1. **Database**: Run this SQL to remove the new columns:
   ```sql
   ALTER TABLE care_responses
   DROP COLUMN IF EXISTS decline_action,
   DROP COLUMN IF EXISTS counter_proposal_date,
   DROP COLUMN IF EXISTS counter_proposal_start_time,
   DROP COLUMN IF EXISTS counter_proposal_end_time,
   DROP COLUMN IF EXISTS selected_cancellation_request_id,
   DROP COLUMN IF EXISTS counter_proposal_notes;

   DROP FUNCTION IF EXISTS get_arrangements_between_parents(UUID, UUID);
   DROP FUNCTION IF EXISTS respond_to_counter_proposal(UUID, UUID, TEXT);
   ```

2. **Frontend**: Revert to previous version of RescheduleResponseModal.tsx

## Support

If you encounter any issues during deployment, check:
- Supabase SQL Editor logs for error messages
- Browser console for frontend errors
- Network tab for failed RPC calls
