# Reschedule Notification Implementation - Analysis & Recommendations

## Function Review: `handle_improved_reschedule_response`

After carefully reviewing the 815-line function, here's my analysis:

## Current Flow & Notification Points

### 1. **ACCEPTED Path** (Lines 107-375)
   - **Simple Reschedule Acceptance** (Lines 107-323)
     - Creates confirmed blocks at new time
     - Removes yellow blocks
     - ✅ **SAFE INSERTION POINT: After line 323**

   - **Counter-Proposal Acceptance** (Lines 325-374)
     - Removes counter-proposer from yellow blocks
     - Cleans up if all parents responded
     - ✅ **SAFE INSERTION POINT: Before line 369 (before the RETURN)**

### 2. **DECLINED Path** (Lines 376-748)
   - **Counter-Proposal Declined** (Lines 379-570)
     - Removes counter-proposer's child
     - Cancels selected arrangement
     - Cleans up yellow blocks
     - ✅ **SAFE INSERTION POINT: Before line 566 (before the RETURN)**

   - **Counter-Proposal Created** (Lines 572-621)
     - Creates new counter request
     - Creates response for original requester
     - ⚠️ **NOTIFICATION NEEDED: Counter sent**
     - ✅ **SAFE INSERTION POINT: After line 617, before line 620**

   - **Original Reschedule Declined** (Lines 621-747)
     - Removes child from blocks
     - Cancels blocks if needed
     - ✅ **SAFE INSERTION POINT: After line 747 (before final cleanup)**

## Recommended Safe Implementation

### Key Principles:
1. **Add notifications AFTER all block operations complete successfully**
2. **Add BEFORE any RETURN statements**
3. **Use variables already available in context**
4. **Don't modify existing logic flow**

### Variables Available in Each Path:

**For Acceptance Messages:**
- `v_care_request.requester_id` - Original reschedule requester
- `p_responder_id` - Person who accepted
- `v_care_request.requested_date` - New date
- `v_care_request.start_time` / `end_time` - New time
- `v_care_request.reciprocal_date` - Original date (yellow block time)

**For Counter Messages:**
- `v_counter_proposal_id` - New counter request ID
- `p_responder_id` - Counter proposer
- `v_care_request.requester_id` - Original requester (now receiving counter)
- `p_counter_proposal_date` / `start_time` / `end_time` - Counter proposal time

## Safe Insertion Points with Code

### 1. Simple Reschedule Accepted
**Location: After line 323**

```sql
        RAISE NOTICE 'Child added to block at new time, yellow blocks updated';

        -- ✅ ADD NOTIFICATIONS HERE (Simple reschedule accepted)
        -- Get participant names
        DECLARE
            v_requester_name TEXT;
            v_responder_name TEXT;
        BEGIN
            SELECT full_name INTO v_requester_name
            FROM profiles WHERE id = v_care_request.requester_id;

            SELECT full_name INTO v_responder_name
            FROM profiles WHERE id = p_responder_id;

            -- Notification for requester (person who initiated reschedule)
            INSERT INTO notifications (user_id, type, title, message, data)
            VALUES (
                v_care_request.requester_id,
                'reschedule_accepted',
                v_responder_name || ' accepted your reschedule request for ' ||
                    TO_CHAR(v_care_request.reciprocal_date, 'Mon DD, YYYY'),
                '',
                jsonb_build_object(
                    'requester_id', v_care_request.requester_id,
                    'responder_id', p_responder_id,
                    'responder_name', v_responder_name,
                    'original_date', v_care_request.reciprocal_date,
                    'original_start_time', v_care_request.reciprocal_start_time,
                    'original_end_time', v_care_request.reciprocal_end_time,
                    'new_date', v_care_request.requested_date,
                    'new_start_time', v_care_request.start_time,
                    'new_end_time', v_care_request.end_time,
                    'care_response_id', p_care_response_id
                )
            );

            -- Notification for responder (person who accepted)
            INSERT INTO notifications (user_id, type, title, message, data)
            VALUES (
                p_responder_id,
                'reschedule_accepted',
                'You accepted ' || v_requester_name || '''s reschedule request for ' ||
                    TO_CHAR(v_care_request.reciprocal_date, 'Mon DD, YYYY'),
                '',
                jsonb_build_object(
                    'requester_id', v_care_request.requester_id,
                    'requester_name', v_requester_name,
                    'responder_id', p_responder_id,
                    'original_date', v_care_request.reciprocal_date,
                    'original_start_time', v_care_request.reciprocal_start_time,
                    'original_end_time', v_care_request.reciprocal_end_time,
                    'new_date', v_care_request.requested_date,
                    'new_start_time', v_care_request.start_time,
                    'new_end_time', v_care_request.end_time,
                    'care_response_id', p_care_response_id
                )
            );

            RAISE NOTICE 'Created reschedule acceptance notifications';
        END;
        -- END NOTIFICATIONS

        -- ✅ CRITICAL FIX: If this is a counter-proposal acceptance
```

### 2. Counter-Proposal Accepted
**Location: Before line 369 (before RETURN)**

```sql
            END IF;

            -- ✅ ADD NOTIFICATIONS HERE (Counter-proposal accepted)
            DECLARE
                v_requester_name TEXT;
                v_responder_name TEXT;
            BEGIN
                SELECT full_name INTO v_requester_name
                FROM profiles WHERE id = v_care_request.requester_id;

                SELECT full_name INTO v_responder_name
                FROM profiles WHERE id = p_responder_id;

                -- Note: For counter-proposal, requester is the counter-proposer, responder accepted it
                INSERT INTO notifications (user_id, type, title, message, data)
                VALUES (
                    v_care_request.requester_id,
                    'reschedule_accepted',
                    v_responder_name || ' accepted your counter-proposal for ' ||
                        TO_CHAR(v_care_request.reciprocal_date, 'Mon DD, YYYY'),
                    '',
                    jsonb_build_object(
                        'requester_id', v_care_request.requester_id,
                        'responder_id', p_responder_id,
                        'responder_name', v_responder_name,
                        'original_date', v_care_request.reciprocal_date,
                        'new_date', v_care_request.requested_date,
                        'new_start_time', v_care_request.start_time,
                        'new_end_time', v_care_request.end_time,
                        'care_response_id', p_care_response_id
                    )
                );

                INSERT INTO notifications (user_id, type, title, message, data)
                VALUES (
                    p_responder_id,
                    'reschedule_accepted',
                    'You accepted ' || v_requester_name || '''s counter-proposal for ' ||
                        TO_CHAR(v_care_request.reciprocal_date, 'Mon DD, YYYY'),
                    '',
                    jsonb_build_object(
                        'requester_id', v_care_request.requester_id,
                        'requester_name', v_requester_name,
                        'responder_id', p_responder_id,
                        'original_date', v_care_request.reciprocal_date,
                        'new_date', v_care_request.requested_date,
                        'new_start_time', v_care_request.start_time,
                        'new_end_time', v_care_request.end_time,
                        'care_response_id', p_care_response_id
                    )
                );

                RAISE NOTICE 'Created counter-proposal acceptance notifications';
            END;
            -- END NOTIFICATIONS

            UPDATE care_requests SET status = 'completed' WHERE id = v_care_request.id;
```

### 3. Counter-Proposal Sent
**Location: After line 617**

```sql
            -- Create response for original requester
            INSERT INTO care_responses (
                request_id, responder_id, response_type, status, action_type
            ) VALUES (
                v_counter_proposal_id,
                v_care_request.requester_id,
                'pending',
                'pending',
                'counter_proposal_response'
            );

            -- ✅ ADD NOTIFICATIONS HERE (Counter-proposal sent)
            DECLARE
                v_requester_name TEXT;
                v_responder_name TEXT;
            BEGIN
                SELECT full_name INTO v_requester_name
                FROM profiles WHERE id = v_care_request.requester_id;

                SELECT full_name INTO v_responder_name
                FROM profiles WHERE id = p_responder_id;

                -- Notification for original requester (now receiving counter)
                INSERT INTO notifications (user_id, type, title, message, data)
                VALUES (
                    v_care_request.requester_id,
                    'reschedule_counter_sent',
                    v_responder_name || ' sent a counter-proposal for ' ||
                        TO_CHAR(v_care_request.reciprocal_date, 'Mon DD, YYYY'),
                    '',
                    jsonb_build_object(
                        'requester_id', v_care_request.requester_id,
                        'counter_proposer_id', p_responder_id,
                        'counter_proposer_name', v_responder_name,
                        'original_date', v_care_request.reciprocal_date,
                        'counter_date', p_counter_proposal_date,
                        'counter_start_time', p_counter_proposal_start_time,
                        'counter_end_time', p_counter_proposal_end_time,
                        'counter_request_id', v_counter_proposal_id,
                        'care_response_id', p_care_response_id
                    )
                );

                -- Notification for counter-proposer (confirming they sent it)
                INSERT INTO notifications (user_id, type, title, message, data)
                VALUES (
                    p_responder_id,
                    'reschedule_counter_sent',
                    'You sent a counter-proposal to ' || v_requester_name || ' for ' ||
                        TO_CHAR(v_care_request.reciprocal_date, 'Mon DD, YYYY'),
                    '',
                    jsonb_build_object(
                        'requester_id', v_care_request.requester_id,
                        'requester_name', v_requester_name,
                        'counter_proposer_id', p_responder_id,
                        'original_date', v_care_request.reciprocal_date,
                        'counter_date', p_counter_proposal_date,
                        'counter_start_time', p_counter_proposal_start_time,
                        'counter_end_time', p_counter_proposal_end_time,
                        'counter_request_id', v_counter_proposal_id,
                        'care_response_id', p_care_response_id
                    )
                );

                RAISE NOTICE 'Created counter-proposal sent notifications';
            END;
            -- END NOTIFICATIONS

            -- Keep yellow blocks until counter-proposal is resolved
```

### 4. Counter-Proposal Declined & Original Reschedule Declined
**Location: These need separate handling - see next section**

## Concerns & Questions

### 1. **Variable Scope Issue**
The function uses nested BEGIN/END blocks for the DECLARE statements. We need to add new DECLARE blocks for the notification variables.

**Recommendation:** Use inline subqueries instead of DECLARE blocks to avoid scope issues:

```sql
-- Instead of DECLARE v_requester_name TEXT
-- Use inline:
INSERT INTO notifications (user_id, type, title, message, data)
VALUES (
    v_care_request.requester_id,
    'reschedule_accepted',
    (SELECT full_name FROM profiles WHERE id = p_responder_id) ||
        ' accepted your reschedule request for ' ||
        TO_CHAR(v_care_request.reciprocal_date, 'Mon DD, YYYY'),
    ...
);
```

### 2. **Decline Notifications**
Declined messages are trickier because:
- Counter-decline returns early (line 566)
- Original decline doesn't have a clear end point
- Need to ensure we don't send duplicate notifications

**Recommendation:** Add decline notifications right before the RETURN statements.

### 3. **Notification Table Types**
Need to add new types to notifications table:
- `reschedule_accepted`
- `reschedule_declined`
- `reschedule_counter_sent`

## Next Steps

**I recommend a phased approach:**

### Phase 1: Simple Acceptance Only (Safest)
Add notifications ONLY for simple reschedule acceptance (after line 323). This is the simplest path with least risk.

### Phase 2: Counter-Proposal Messages
Add counter-proposal sent and accepted notifications.

### Phase 3: Decline Messages
Add decline notifications with careful testing.

**Would you like me to:**
1. Create a clean SQL migration file with ONLY Phase 1 (simple acceptance)?
2. Create all phases at once but in a way that's easy to rollback?
3. Review specific sections with you before generating code?

## Safety Recommendations

1. **Test in staging first** - This function is critical
2. **Add comprehensive logging** - RAISE NOTICE statements help debugging
3. **Use transactions** - Ensure notifications don't prevent block updates
4. **Consider failure handling** - What if notification INSERT fails?

My recommendation: Start with Phase 1 only, test thoroughly, then add others.
