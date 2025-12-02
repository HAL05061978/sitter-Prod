# Complete Reschedule & Counter-Proposal Workflow Fix

## Issues Fixed

### 1. **Yellow Blocks Disappearing When Counter-Proposal Sent**
**Problem:** When a parent declined a reschedule with a counter-proposal, the yellow (rescheduled) blocks were immediately deleted.

**Root Cause:** The cleanup logic at the end of `handle_improved_reschedule_response()` had a backwards check:
```sql
-- WRONG: Looking for requests where counter_proposal_to = v_care_request.id
WHERE counter_proposal_to = v_care_request.id
```

But counter-proposals are linked the OTHER way:
```sql
UPDATE care_requests SET counter_proposal_to = v_counter_proposal_id
WHERE id = v_care_request.id;
```

**Fix:** Check if a counter-proposal was just created OR if an existing one is pending:
```sql
IF v_remaining_responses = 0 AND v_counter_proposal_id IS NULL THEN
    -- Check the correct direction
    SELECT status INTO v_linked_counter_status
    FROM care_requests
    WHERE id = (SELECT counter_proposal_to FROM care_requests WHERE id = v_care_request.id);

    -- Only cleanup if no pending counter-proposal
    IF v_linked_counter_status IS NULL OR v_linked_counter_status NOT IN ('pending', 'awaiting_response') THEN
        -- Safe to delete yellow blocks
    END IF;
END IF;
```

### 2. **No Blocks Created When Counter-Proposal Accepted**
**Problem:** When accepting a counter-proposal, no blocks were created/updated.

**Root Cause:** The UPDATE query was looking for the wrong parent's block:
```sql
WHERE parent_id = v_care_request.requester_id  -- Wrong for counter-proposals!
```

For normal reschedules: `requester_id` = the providing parent (correct)
For counter-proposals: `requester_id` = the counter-proposer (wrong - they're receiving, not providing!)

**Fix:** Find the yellow block by group/date/time only, regardless of parent:
```sql
UPDATE scheduled_care
SET care_date = v_care_request.requested_date, ...
WHERE group_id = v_care_request.group_id
AND care_type = 'provided'
AND status = 'rescheduled'
AND care_date = v_care_request.reciprocal_date
-- Don't filter by parent_id - there's only ONE yellow providing block
```

### 3. **Duplicate Providing Blocks**
**Problem:** System created multiple providing blocks for the same parent.

**Root Cause:** `initiate_improved_reschedule()` created a NEW block immediately when reschedule was sent (lines 108-125).

**Fix:** Remove new block creation entirely. Only mark existing block as yellow:
```sql
-- OLD (WRONG):
INSERT INTO scheduled_care (...) VALUES (...);  -- Created new block

-- NEW (CORRECT):
UPDATE scheduled_care SET status = 'rescheduled' ...  -- Just mark yellow
```

### 4. **Missing Children in Blocks**
**Problem:** Blocks only contained the requester's child, missing other children.

**Root Cause:** New blocks were created with only one child, and acceptances didn't add all children properly.

**Fix:** When acceptance updates the yellow block, all accepting parents' children are added:
```sql
INSERT INTO scheduled_care_children (...)
SELECT sc.id, v_responder_child_id, sc.parent_id, 'Added from reschedule acceptance'
FROM scheduled_care sc
WHERE sc.care_date = v_care_request.requested_date  -- The updated block
ON CONFLICT DO NOTHING;
```

## The Correct Workflow

### Scenario 1: Counter-Proposal Accepted

**Setup:** Rosmary reschedules to Oct 23, Hugo counter-proposes Oct 22, Rosmary accepts

1. **Initial State**
   - Rosmary provides care Oct 20 20:00-21:00
   - Hugo needs care Oct 21 07:30-11:30

2. **Rosmary Sends Reschedule to Oct 23**
   - ✅ Rosmary's providing block (Oct 20) → Yellow (status = 'rescheduled')
   - ✅ Hugo's needed block (Oct 20) → Yellow
   - ✅ NO new blocks created
   - ✅ care_request created with requested_date = Oct 23, reciprocal_date = Oct 20

3. **Hugo Declines and Counter-Proposes Oct 22**
   - ✅ Counter-proposal care_request created (requested_date = Oct 22)
   - ✅ Yellow blocks STAY at Oct 20 (NOT deleted)
   - ✅ Hugo's yellow needed block remains
   - ✅ Rosmary's yellow providing block remains

4. **Rosmary Accepts Counter-Proposal (Oct 22)**
   - ✅ New providing block created at Oct 22 with Rosmary's child + Hugo's child
   - ✅ Hugo's needed block created at Oct 22
   - ✅ All yellow blocks deleted
   - ✅ Result: ONE providing block at Oct 22 with both children

### Scenario 2: Counter-Proposal Declined - Multi-Parent

**Setup:** Rosmary reschedules to Oct 30 with Bruce, Hugo, Karen. Bruce counters Oct 29, Rosmary declines.

1. **Rosmary Sends Reschedule to Oct 30**
   - ✅ Yellow providing block at Oct 23 (Rosmary + Bruce + Hugo + Karen children)
   - ✅ Yellow needed blocks at Oct 23 for Bruce, Hugo, Karen

2. **Bruce Declines and Counter-Proposes Oct 29**
   - ✅ Counter-proposal care_request created
   - ✅ ALL yellow blocks STAY at Oct 23

3. **Rosmary Declines Bruce's Counter-Proposal**
   - ✅ Bruce's child removed from yellow providing block at Oct 23
   - ✅ Bruce's yellow needed block deleted
   - ✅ Bruce's selected arrangement canceled
   - ✅ Hugo and Karen's yellow blocks STAY (they can still accept Oct 30)

4. **Hugo Accepts Oct 30**
   - ✅ New providing block created at Oct 30 with Rosmary's child + Hugo's child
   - ✅ Hugo's needed block created at Oct 30

5. **Karen Accepts Oct 30**
   - ✅ Karen's child ADDED to existing Oct 30 providing block
   - ✅ Karen's needed block created at Oct 30

**Final Result:**
- Bruce: Selected arrangement canceled, OUT of reschedule
- Oct 30 block: Rosmary + Hugo + Karen (3 children)

## Deployment

```bash
# Run in Supabase SQL Editor
\i COMPLETE_FIX_reschedule_workflow.sql
```

## Key Changes Summary

| Function | Line | Change |
|----------|------|--------|
| `initiate_improved_reschedule` | 96-106 | Only marks existing block as yellow (removed new block creation) |
| `handle_improved_reschedule_response` | 259-391 | **NEW LOGIC:** Check if block exists at new time, create if not, add child to it |
| `handle_improved_reschedule_response` | 290-322 | Create NEW providing block if none exists at accepted time |
| `handle_improved_reschedule_response` | 324-332 | Add accepting child to providing block (new or existing) |
| `handle_improved_reschedule_response` | 346-379 | Create/update accepting parent's needed block at new time |
| `handle_improved_reschedule_response` | 496-522 | Fixed cleanup to preserve yellow block when counter-proposal pending |

## Multi-Child Scenario Handling - SPLIT BLOCK LOGIC

The system supports **split blocks** where different children can be rescheduled to different times based on parent responses. **CRITICAL:** Each new providing block MUST include the provider's child to maintain balanced care logic.

**Example:** Rosmary provides care for Hugo, Karen, and Bruce on Oct 23, wants to reschedule to Oct 30:

1. **Reschedule Sent:** Yellow block at Oct 23 with all 4 children (Rosmary + Hugo + Karen + Bruce)
2. **Bruce counters Oct 29, Rosmary accepts:** NEW block created at Oct 29 with **Rosmary's child + Bruce's child**
3. **Hugo accepts Oct 30:** NEW block created at Oct 30 with **Rosmary's child + Hugo's child**
4. **Karen accepts Oct 30:** Karen's child ADDED to existing Oct 30 block (Rosmary + Hugo + Karen)

**Final Result:**
- **Block 1** Oct 29: Rosmary's child + Bruce's child (2 children)
- **Block 2** Oct 30: Rosmary's child + Hugo's child + Karen's child (3 children)
- **Original yellow block deleted** after all responses complete

**Key Business Rules:**
- **EVERY providing block MUST include the provider's child (Rosmary's child)** to maintain balanced care
- Each acceptance creates a NEW block at that time (or adds to existing block at that time)
- Children split into different blocks based on accepted times
- Yellow block persists until ALL parents respond
- Provider can have MULTIPLE blocks at different times for different children

### 5. **Provider's Child Missing from Split Blocks**
**Problem:** When split blocks were created, only the accepting parent's child was added, missing the provider's own child.

**Root Cause:** Code used `v_requester_child_id` which for counter-proposals was the counter-proposer's child, not the provider's child.

**Fix:** Get and use the PROVIDER'S child for every new block (lines 283-287).

### 6. **Counter-Proposal Acceptance Creating Wrong Blocks**
**Problem:** When open block invitee (Bruce) counters and provider (Rosmary) accepts:
- Rosmary gets BOTH providing AND needed blocks ❌
- Bruce doesn't get needed block ❌
- Only one child appears in blocks instead of both ❌

**Root Cause:** Code didn't distinguish between normal reschedule acceptance and counter-proposal acceptance:
```sql
-- WRONG: Always used responder as the receiving parent
v_receiving_parent_id := p_responder_id;  -- Rosmary for counter-proposals!
v_receiving_child_id := v_responder_child_id;

-- Created needed block for responder (Rosmary) instead of requester (Bruce)
INSERT INTO scheduled_care (parent_id, ...) VALUES (p_responder_id, ...)
```

**Fix:** Detect counter-proposals and use correct parent/child (lines 289-304):
```sql
-- Check if counter-proposal (requester != provider)
v_is_counter_proposal := (v_care_request.requester_id != v_providing_parent_id);

IF v_is_counter_proposal THEN
    -- Counter: requester (Bruce) is receiving
    v_receiving_parent_id := v_care_request.requester_id;
    v_receiving_child_id := v_requester_child_id;
ELSE
    -- Normal: responder is receiving
    v_receiving_parent_id := p_responder_id;
    v_receiving_child_id := v_responder_child_id;
END IF;

-- Use v_receiving_parent_id and v_receiving_child_id throughout (lines 365, 399, 400, 419)
```

**Result:**
- Providing block: Rosmary's child + Bruce's child ✓
- Needed block created for Bruce (not Rosmary) ✓
- Rosmary only has providing block ✓
- Bruce only has needed block ✓

### 7. **Inactive Children Being Added to New Blocks**
**Problem:** When creating new blocks, system was using `LIMIT 1` to grab any child, sometimes selecting inactive children instead of the child from the original block.

**Root Cause:**
```sql
-- WRONG: Grabs any child, could be inactive
SELECT c.id INTO v_responder_child_id
FROM children c
WHERE c.parent_id = p_responder_id
LIMIT 1;
```

**Fix:** Get child from yellow rescheduled block (lines 238-279):
```sql
-- Get from yellow needed block first
SELECT sc.child_id INTO v_responder_child_id
FROM scheduled_care sc
WHERE sc.parent_id = p_responder_id
AND sc.care_type = 'needed'
AND sc.status = 'rescheduled'
AND sc.care_date = v_care_request.reciprocal_date ...
LIMIT 1;

-- Fallback to active children only if not found
IF v_responder_child_id IS NULL THEN
    SELECT c.id INTO v_responder_child_id
    FROM children c
    WHERE c.parent_id = p_responder_id
    AND c.is_active = true
    LIMIT 1;
END IF;
```

**Result:** Only children from the original rescheduled block are used in new blocks ✓

### 8. **Counter-Proposal Detection Using Wrong Field**
**Problem:**
- When Bruce sent a counter-proposal, the system deleted his blocks instead of creating the counter
- When Rosmary declined Bruce's counter, it didn't remove Bruce's blocks

**Root Cause:** Code checked `v_care_request.original_request_id IS NOT NULL` to detect counter-proposals, but BOTH the original reschedule AND counter-proposals have this field set:
- Original reschedule: `original_request_id` = original reciprocal arrangement ID
- Counter-proposal: `original_request_id` = original reschedule ID

So the code couldn't distinguish between them!

**Fix:** Properly detect counter-proposals by checking if another request points to this one (lines 239-246, 477):
```sql
-- Detect if responding to a counter-proposal
SELECT EXISTS (
    SELECT 1 FROM care_requests
    WHERE counter_proposal_to = v_care_request.id  -- Another request countered THIS one
) INTO v_is_responding_to_counter;

ELSIF p_response_status = 'declined' THEN
    -- Check using the correct detection method
    IF v_is_responding_to_counter THEN
        -- ✅ This IS a counter-proposal being declined
        -- Remove counter-proposer's yellow blocks and cancel their selected arrangement
        DELETE FROM scheduled_care_children WHERE child_id = v_requester_child_id ...
        DELETE FROM scheduled_care WHERE parent_id = v_care_request.requester_id ...
        DELETE FROM scheduled_care WHERE related_request_id = p_selected_cancellation_request_id ...

    -- If not counter-proposal, check if user wants to counter-propose
    ELSIF p_decline_action = 'counter_propose' AND p_counter_proposal_date IS NOT NULL THEN
        -- ✅ Original reschedule decline WITH counter-proposal
        INSERT INTO care_requests ... (create counter-proposal)

    ELSE
        -- ✅ Original reschedule decline WITHOUT counter-proposal
        DELETE FROM scheduled_care_children ... (remove yellow blocks)
    END IF;
END IF;
```

**Result:**
- ✓ Bruce can send counter-proposal (creates new care_request, keeps yellow blocks)
- ✓ Rosmary sees simple Accept/Decline UI (no option to counter back)
- ✓ Rosmary can decline Bruce's counter (removes Bruce's blocks, cancels his selected arrangement)
- ✓ Counter-proposals CANNOT be countered back (prevents infinite loops)
- ✓ Declining counter-proposal:
  - Bruce's yellow needed block removed (he's OUT)
  - Bruce's child removed from yellow providing block
  - Bruce's selected arrangement canceled (the one he selected when sending counter)
  - Hugo and Karen's yellow blocks stay (can still accept Oct 30)
  - Function returns early, skipping cleanup logic (line 514-523)
- ✓ Original reschedule can be declined with or without counter-proposal

### 9. **Frontend Shows Full Decline Workflow for Counter-Proposals**
**Problem:** When responding to a counter-proposal, UI showed full decline workflow (select arrangement, send counter back) instead of simple Accept/Decline.

**Fix:**
- Backend: Added `is_counter_proposal` flag to `get_reschedule_request_details` (line 689)
- Frontend: Detect counter-proposals and use simple decline (lines 158-227 in RescheduleResponseModal.tsx)

**Result:**
- ✓ Counter-proposals show simple Accept/Decline UI only
- ✓ No option to send counter back (prevents infinite loops)
- ✓ One-click decline with confirmation dialog

### 10. **Counter-Proposer's Selected Arrangement Not Being Canceled**
**Problem:** When Rosmary declined Bruce's counter, Bruce's selected arrangement (the one he chose when sending the counter) wasn't being deleted from calendars.

**Root Cause:** Code used `p_selected_cancellation_request_id` (Rosmary's selection, which is NULL) instead of looking up Bruce's original selection.

**Fix:** Get Bruce's selection from his original care_response (lines 520-537):
```sql
-- Get the arrangement Bruce selected when he sent the counter
SELECT selected_cancellation_request_id INTO v_counter_proposer_selected_arrangement
FROM care_responses
WHERE request_id = v_care_request.original_request_id  -- Original reschedule
AND responder_id = v_care_request.requester_id  -- Bruce
AND decline_action = 'counter_propose'
LIMIT 1;

-- Cancel that arrangement
IF v_counter_proposer_selected_arrangement IS NOT NULL THEN
    DELETE FROM scheduled_care WHERE related_request_id = v_counter_proposer_selected_arrangement;
    UPDATE care_requests SET status = 'canceled' WHERE id = v_counter_proposer_selected_arrangement;
END IF;
```

**Additional Issue:** Counter-proposal's `original_request_id` was set to the original reciprocal arrangement ID instead of the reschedule request ID:
```sql
-- WRONG (line 574 - old):
original_request_id = v_care_request.original_request_id  -- Points to original arrangement

-- CORRECT (line 574 - new):
original_request_id = v_care_request.id  -- Points to reschedule request
```

This broke the lookup because it was searching in the wrong care_responses records.

**Result:** ✓ Bruce's selected arrangement is properly canceled when his counter is declined

### 11. **Accepting Counter-Proposal Deletes All Yellow Blocks**
**Problem:** When Rosmary accepted Bruce's counter, ALL yellow blocks were deleted, preventing other parents (Karen) from accepting the original reschedule. Error: `null value in column "parent_id"`.

**Root Cause:** Cleanup logic counted responses to the counter-proposal request (Bruce's counter, which is now complete) instead of the original reschedule request (which still has pending responses from Karen).

**Fix:** Skip cleanup entirely when accepting/declining counter-proposals (lines 474-485, 539-548):
```sql
-- After accepting counter-proposal
IF v_is_responding_to_counter THEN
    RAISE NOTICE 'Counter-proposal accepted - skipping cleanup';
    UPDATE care_requests SET status = 'completed' WHERE id = v_care_request.id;
    RETURN json_build_object('success', true, 'message', 'Counter-proposal accepted');
END IF;

-- After declining counter-proposal
IF v_is_responding_to_counter THEN
    RAISE NOTICE 'Counter-proposal declined - skipping cleanup';
    UPDATE care_requests SET status = 'declined' WHERE id = v_care_request.id;
    RETURN json_build_object('success', true, 'message', 'Counter-proposal declined');
END IF;
```

**Result:**
- ✓ Counter-proposal acceptance: Yellow blocks stay for other parents
- ✓ Counter-proposal decline: Yellow blocks stay for other parents
- ✓ Other parents can still accept/decline the original reschedule
- ✓ No more "null value in parent_id" error

### 12. **Yellow Block Persists After All Parents Respond**
**Problem:** After all parents respond (accept/decline), Rosmary still has a yellow rescheduling block that never gets cleaned up. `care_requests.status` never becomes 'completed'.

**Root Cause:** The yellow providing block contains:
- Provider's child (Rosmary) - never removed
- Receiving children (Bruce, Karen) - removed when they accept/decline

When cleanup checks `v_remaining_children`, it counts ALL children including Rosmary's, so it always finds 1 child and skips cleanup.

**Fix:** Only count receiving children, exclude provider's child (lines 664-678):
```sql
-- Count only RECEIVING children (not provider's child)
SELECT COUNT(DISTINCT scc.child_id) INTO v_remaining_children
FROM scheduled_care sc
JOIN scheduled_care_children scc ON sc.id = scc.scheduled_care_id
WHERE sc.care_type = 'provided'
AND sc.status = 'rescheduled'
AND scc.child_id != (
    -- Exclude provider's child from count
    SELECT c.id FROM children c WHERE c.parent_id = sc.parent_id LIMIT 1
);
```

**Result:**
- ✓ When all receiving children removed: `v_remaining_children = 0`
- ✓ Cleanup runs: deletes yellow blocks, sets `status = 'completed'`
- ✓ No orphaned yellow blocks

### 13. **Yellow Block Deleted When Parent Declines Before Last Parent Responds**
**Problem:** When a parent (Hugo) declines the original reschedule and selects an arrangement to cancel, the yellow providing block is deleted. This causes "Yellow providing block not found!" error when remaining parents (Karen) try to accept.

**Root Cause:** When Hugo selected arrangement `be2ba91c` to cancel, the code deleted ALL blocks with that `related_request_id`:
```sql
-- WRONG: Deletes ALL blocks including yellow ones
DELETE FROM scheduled_care
WHERE related_request_id = p_selected_cancellation_request_id;
```

The yellow providing block has the same `related_request_id` (pointing to original arrangement), so it gets deleted even though Karen hasn't responded yet.

**Fix:** Only delete NON-YELLOW blocks when canceling selected arrangement (line 639-641):
```sql
-- CORRECT: Skip yellow blocks
DELETE FROM scheduled_care
WHERE related_request_id = p_selected_cancellation_request_id
AND status != 'rescheduled';  -- Don't delete yellow blocks!
```

**Result:**
- ✓ Hugo declines with cancel: Selected arrangement deleted, yellow block preserved
- ✓ Karen can still accept: Yellow block exists for her to respond
- ✓ When Karen accepts: Cleanup runs and removes yellow block
- ✓ No "Yellow providing block not found!" errors

### 14. **Multiple Counter-Proposals Not Working (Second Counter Gets Wrong Behavior)**
**Problem:** When Bruce sends a counter-proposal and then Hugo tries to send a counter-proposal, Hugo gets treated as if he's responding to a counter (simple decline UI, blocks removed immediately) instead of being able to enter counter date/time.

**Root Cause:** The `counter_proposal_to` field was set ON THE ORIGINAL reschedule request:
```sql
-- WRONG: Set on original, can only store ONE counter
UPDATE care_requests
SET counter_proposal_to = v_counter_proposal_id
WHERE id = v_care_request.id;  -- Original request
```

When multiple counters exist:
- Bruce counters: Original.counter_proposal_to = Bruce's counter ID
- Hugo counters: Original.counter_proposal_to = Hugo's counter ID (OVERWRITES Bruce!)
- Hugo sees counter_proposal_to is set on original → Treated as if responding to a counter

**Fix:** Set `counter_proposal_to` ON THE COUNTER itself to mark it as a counter (lines 617, 635):
```sql
-- CORRECT: Set on counter, multiple counters can all point back to original
INSERT INTO care_requests (
    ...,
    counter_proposal_to
) VALUES (
    ...,
    v_care_request.id  -- Counter points back to original
);
```

Detection logic updated (line 243):
```sql
-- Check if THIS request has counter_proposal_to set
v_is_responding_to_counter := (v_care_request.counter_proposal_to IS NOT NULL);
```

Cleanup logic updated (lines 699-703):
```sql
-- Check if any counters point to this original and are still pending
SELECT EXISTS (
    SELECT 1 FROM care_requests
    WHERE counter_proposal_to = v_care_request.id
    AND status IN ('pending', 'awaiting_response')
) INTO v_has_pending_counter;
```

**Result:**
- ✓ Bruce counters: Bruce.counter_proposal_to = Original ID
- ✓ Hugo counters: Hugo.counter_proposal_to = Original ID (doesn't overwrite Bruce)
- ✓ Hugo gets full decline workflow (can enter counter date/time)
- ✓ Rosmary responding to Bruce's counter: Bruce.counter_proposal_to IS NOT NULL → Simple decline
- ✓ Multiple counters work independently

### 15. **Provider's Child Causing Orphaned Yellow Blocks**
**Problem:** After all parents respond (counters accepted/declined), a yellow block persists on the rescheduling parent's calendar. This happens because the provider's child is in the yellow block and never gets removed, making cleanup logic complex and error-prone.

**Root Cause:** When reschedule is sent, the yellow providing block contains:
- Provider's child (Rosmary) - stays forever
- Receiving children (Bruce, Hugo, Karen) - removed when they respond

Cleanup had to exclude provider's child from count, leading to complex logic and edge cases.

**Fix:** Remove provider's child from yellow block when reschedule is sent (lines 123-130):
```sql
-- Remove provider's child from yellow providing block
-- Provider's child doesn't need to be in the yellow block since they're providing, not receiving
DELETE FROM scheduled_care_children
WHERE scheduled_care_id = p_scheduled_care_id
AND child_id IN (
    SELECT id FROM children WHERE parent_id = v_original_block.parent_id
);
```

Simplified cleanup logic (lines 716-726):
```sql
-- Count ALL children in yellow block (no need to exclude provider's child)
SELECT COUNT(DISTINCT scc.child_id) INTO v_remaining_children
FROM scheduled_care sc
JOIN scheduled_care_children scc ON sc.id = scc.scheduled_care_id
WHERE sc.group_id = v_care_request.group_id
AND sc.care_type = 'provided'
AND sc.status = 'rescheduled' ...;
```

**Result:**
- ✓ Yellow block only contains receiving children
- ✓ When last child removed: `v_remaining_children = 0`, cleanup runs
- ✓ Simpler, more reliable cleanup logic
- ✓ No orphaned yellow blocks regardless of workflow
- ✓ Provider's child not visible in yellow block (cleaner UI)

### 16. **Yellow Block Remains When Last Parent Declines Counter**
**Problem:** When 2 counter offers are declined and the last parent to reply was one of the counter offers, the original rescheduler's yellow block remains with no children.

**Root Cause:** Counter-proposal decline logic (lines 595-599) returned early with:
```sql
-- SKIP cleanup - other parents still need to respond to ORIGINAL reschedule
RETURN json_build_object('success', true, 'message', 'Counter-proposal declined');
```

But when the LAST counter is declined, no other parents are pending, so cleanup SHOULD run.

**Fix:** Add cleanup check to counter decline logic (lines 595-641):
```sql
-- After declining counter, check if cleanup should run
UPDATE care_requests SET status = 'declined' WHERE id = v_care_request.id;

-- Get original reschedule request
SELECT * INTO v_care_request FROM care_requests WHERE id = v_care_request.counter_proposal_to;

-- Check if any other counters pending
SELECT EXISTS (...) INTO v_has_pending_counter;

-- Count remaining children
SELECT COUNT(...) INTO v_remaining_children ...;

IF NOT v_has_pending_counter AND v_remaining_children = 0 THEN
    -- All parents responded - cleanup yellow blocks
    DELETE FROM scheduled_care WHERE ... status = 'rescheduled' ...;
END IF;
```

**Result:**
- ✓ Bruce sends counter, Rosmary declines: Bruce's child removed, cleanup skips (Hugo pending)
- ✓ Hugo sends counter, Rosmary declines: Hugo's child removed, 0 children remain, cleanup runs
- ✓ Yellow blocks deleted when last counter declined
- ✓ No empty yellow blocks remaining

### 17. **Yellow Block Not Cleaned Up When Counter Accepted Last**
**Problem:** When all parents respond and the original rescheduler accepts a counter-proposal at the very end, the yellow block remains in the calendar.

**Root Cause:** When Rosmary accepted Bruce's counter, it returned early without checking if the original yellow blocks could be cleaned up. Bruce's child remained in the yellow block even after all parents responded.

**Fix:** When accepting a counter-proposal, remove counter-proposer's child and check cleanup (lines 489-532):
```sql
IF v_is_responding_to_counter THEN
    -- Remove counter-proposer's child from original yellow providing block
    DELETE FROM scheduled_care_children
    WHERE child_id = v_receiving_child_id
    AND scheduled_care_id IN (
        SELECT id FROM scheduled_care
        WHERE ... AND status = 'rescheduled'
    );

    -- Check if original reschedule can be cleaned up (simplified with fix #15)
    SELECT COUNT(DISTINCT scc.child_id) INTO v_remaining_children
    FROM scheduled_care sc
    JOIN scheduled_care_children scc ON sc.id = scc.scheduled_care_id
    WHERE ... AND status = 'rescheduled' ...;

    IF v_remaining_children = 0 THEN
        -- All parents responded - cleanup yellow blocks
        DELETE FROM scheduled_care WHERE ... status = 'rescheduled' ...;
    END IF;
END IF;
```

**Result:**
- ✓ Bruce sends counter: His child in yellow block
- ✓ Karen accepts: Her child removed, cleanup skips (Bruce's child still there)
- ✓ Rosmary accepts counter: Bruce's child removed, cleanup runs, yellow blocks deleted
- ✓ Works correctly with fix #15 (provider's child already removed from yellow block)

## Testing Checklist

- [ ] Reschedule sent:
  - [ ] Yellow blocks appear at original date
  - [ ] Provider's child NOT in yellow providing block (only receiving children)
  - [ ] All receiving children in yellow blocks
- [ ] Counter-proposal sent: Yellow blocks stay (don't disappear)
- [ ] Counter-proposal accepted by original provider:
  - [ ] Provider only gets providing block (NOT needed block)
  - [ ] Counter-proposer only gets needed block (NOT providing block)
  - [ ] Providing block contains provider's child + counter-proposer's child
- [ ] Normal reschedule accepted by receiving parent:
  - [ ] Provider only gets providing block
  - [ ] Responder only gets needed block
  - [ ] Providing block contains provider's child + responder's child
- [ ] Multiple acceptances at same time: Children added to existing block (no duplicates)
- [ ] Multiple acceptances at different times: Separate blocks created, each with provider's child
- [ ] Provider's child included in EVERY new providing block (split blocks)
- [ ] Only children from original rescheduled block used (no inactive children)
- [ ] Counter-proposal declined by original rescheduler:
  - [ ] Counter-proposer's yellow blocks removed (needed block + child from providing block)
  - [ ] Counter-proposer's selected arrangement canceled (the one THEY selected when sending counter)
  - [ ] Other parents' yellow blocks stay (can still accept original reschedule)
  - [ ] Other parents can successfully accept original reschedule after counter declined
- [ ] Counter-proposal accepted by original rescheduler:
  - [ ] New block created with provider + counter-proposer children
  - [ ] Counter-proposer's yellow blocks removed
  - [ ] Other parents' yellow blocks stay (can still accept original reschedule)
  - [ ] Other parents can successfully accept original reschedule after counter accepted
- [ ] Original reschedule declined: Yellow blocks removed correctly for declining parent
- [ ] Parent declines with selected arrangement cancel before last parent responds:
  - [ ] Selected arrangement blocks deleted (non-yellow only)
  - [ ] Yellow blocks preserved for remaining parents
  - [ ] Remaining parents can successfully accept/decline
  - [ ] Yellow blocks cleaned up when last parent responds
- [ ] Parent sends counter-proposal:
  - [ ] Counter-proposer's child stays in yellow block (counter still pending)
  - [ ] When original rescheduler accepts counter: Counter-proposer's child removed
  - [ ] When last parent responds to original: Yellow blocks cleaned up correctly
  - [ ] When original rescheduler accepts counter last: Yellow blocks cleaned up, no orphans
- [ ] No duplicate blocks created
- [ ] Open block invitees can decline and select arrangement to cancel (same as reciprocal parents)
