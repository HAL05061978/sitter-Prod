# Deployment Checklist - Counter-Decline Complete Fix

## Pre-Deployment

- [ ] Read `FINAL_DEPLOYMENT_SUMMARY.md` for overview
- [ ] Read `MEANINGLESS_BLOCKS_COMPLETE_FIX.md` for technical details
- [ ] Read `BLOCK_VALIDITY_RULES.md` for visual guide
- [ ] Have access to Supabase SQL Editor
- [ ] Have access to test accounts for Hugo, Rosmary, Bruce, Karen

## Deployment Steps

### 1. Backup Current Function ✅
```sql
-- In Supabase SQL Editor, run:
CREATE OR REPLACE FUNCTION handle_improved_reschedule_response_backup_20251026 AS
SELECT pg_get_functiondef('handle_improved_reschedule_response'::regproc);
```

### 2. Deploy New Function ✅
- [ ] Open `DEPLOY_FIXED_handle_improved_reschedule_response_v2.sql`
- [ ] Copy entire file contents (828 lines)
- [ ] Open Supabase SQL Editor
- [ ] Paste into editor
- [ ] Click "Run"
- [ ] Verify: "Success. No rows returned"

### 3. Verify Deployment ✅
```sql
-- Check function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'handle_improved_reschedule_response';
-- Should return 1 row

-- Check function line count (approximate)
SELECT length(pg_get_functiondef('handle_improved_reschedule_response'::regproc));
-- Should return ~50000+ characters
```

## Testing Scenarios

### Test 1: Hugo counters, Rosmary declines ✅

**Setup:**
- [ ] Create Hugo ↔ Rosmary reciprocal agreement (Oct 27 07:30-11:30)
- [ ] Hugo opens his providing block to Bruce and Karen
- [ ] Bruce and Karen accept
- [ ] Verify Hugo's providing block has 4 children: Hugo, Rosmary, Bruce, Karen

**Test Actions:**
- [ ] Rosmary requests reschedule to Nov 1
- [ ] Hugo, Bruce, Karen all decline
- [ ] Hugo declines with counter-proposal (Nov 2)
- [ ] Hugo selects original reciprocal to cancel (Oct 27)
- [ ] Rosmary declines Hugo's counter

**Expected Results:**
- [ ] Hugo's providing block (Oct 27) has 3 children: Hugo, Bruce, Karen ✅
- [ ] Rosmary's needed block (Oct 27) is DELETED ✅
- [ ] Bruce's needed block (Oct 27) has 3 children: Hugo, Bruce, Karen ✅
- [ ] Karen's needed block (Oct 27) has 3 children: Hugo, Bruce, Karen ✅
- [ ] Rosmary has NO blocks on calendar ✅

**Export and verify:**
```sql
-- Export to CSV
COPY (SELECT * FROM scheduled_care WHERE care_date = '2025-10-27' ORDER BY parent_id, care_type) TO STDOUT WITH CSV HEADER;
COPY (SELECT * FROM scheduled_care_children WHERE scheduled_care_id IN (SELECT id FROM scheduled_care WHERE care_date = '2025-10-27')) TO STDOUT WITH CSV HEADER;
```

### Test 2: Karen counters, Rosmary declines ✅

**Setup:**
- [ ] Create Karen ↔ Rosmary reciprocal agreement (Oct 28)
- [ ] Verify Karen's providing block has 2 children: Karen, Rosmary

**Test Actions:**
- [ ] Rosmary requests reschedule
- [ ] Karen declines with counter-proposal
- [ ] Karen selects original reciprocal to cancel
- [ ] Rosmary declines Karen's counter

**Expected Results:**
- [ ] Karen's providing block (Oct 28) is DELETED ✅ (only had Karen's child left)
- [ ] Rosmary's needed block (Oct 28) is DELETED ✅ (missing Rosmary's child)
- [ ] Both calendars show NO blocks for Oct 28 ✅

### Test 3: Regular reschedule decline ✅

**Setup:**
- [ ] Create Hugo providing block with Hugo, Rosmary children
- [ ] Create Bruce needed block with Hugo, Bruce, Rosmary children

**Test Actions:**
- [ ] Rosmary requests reschedule
- [ ] Hugo declines (simple decline, no counter)

**Expected Results:**
- [ ] Hugo's providing block deleted if only Hugo's child remains ✅
- [ ] Bruce's needed block deleted if missing Bruce's child ✅

### Test 4: Multiple open block participants ✅

**Setup:**
- [ ] Hugo opens block to Bruce, Karen, and Rosmary
- [ ] All accept
- [ ] Hugo's block has: Hugo, Bruce, Karen, Rosmary (4 children)

**Test Actions:**
- [ ] Rosmary requests reschedule
- [ ] Everyone declines
- [ ] Bruce declines with counter
- [ ] Rosmary declines Bruce's counter

**Expected Results:**
- [ ] Hugo's providing block has: Hugo, Bruce, Karen (3 children) ✅
- [ ] Bruce's needed block has: Hugo, Bruce, Karen (3 children) ✅
- [ ] Karen's needed block has: Hugo, Bruce, Karen (3 children) ✅
- [ ] Rosmary's needed block is DELETED ✅

## Validation Queries

### Check for meaningless providing blocks
```sql
SELECT sc.id, sc.parent_id, p.first_name || ' ' || p.last_name as parent_name,
       sc.care_date, sc.start_time, sc.end_time,
       COUNT(scc.child_id) as child_count,
       STRING_AGG(DISTINCT c.parent_id::text, ', ') as unique_parent_ids
FROM scheduled_care sc
LEFT JOIN profiles p ON sc.parent_id = p.id
LEFT JOIN scheduled_care_children scc ON sc.id = scc.scheduled_care_id
LEFT JOIN children c ON scc.child_id = c.id
WHERE sc.care_type = 'provided'
AND sc.status IN ('confirmed', 'rescheduled')
GROUP BY sc.id, sc.parent_id, p.first_name, p.last_name, sc.care_date, sc.start_time, sc.end_time
HAVING COUNT(scc.child_id) = 0
   OR (COUNT(scc.child_id) = 1 AND MIN(c.parent_id) = sc.parent_id);
```
**Expected result:** 0 rows ✅

### Check for meaningless needed blocks
```sql
SELECT sc.id, sc.parent_id, p.first_name || ' ' || p.last_name as parent_name,
       sc.care_date, sc.start_time, sc.end_time,
       COUNT(scc.child_id) as child_count,
       BOOL_OR(c.parent_id = sc.parent_id) as has_own_child
FROM scheduled_care sc
LEFT JOIN profiles p ON sc.parent_id = p.id
LEFT JOIN scheduled_care_children scc ON sc.id = scc.scheduled_care_id
LEFT JOIN children c ON scc.child_id = c.id
WHERE sc.care_type = 'needed'
AND sc.status IN ('confirmed', 'rescheduled')
GROUP BY sc.id, sc.parent_id, p.first_name, p.last_name, sc.care_date, sc.start_time, sc.end_time
HAVING COUNT(scc.child_id) = 0
   OR NOT BOOL_OR(c.parent_id = sc.parent_id);
```
**Expected result:** 0 rows ✅

## Post-Deployment Monitoring

### Day 1-3: Monitor for errors
- [ ] Check Supabase logs for function errors
- [ ] Watch for user reports of missing/extra blocks
- [ ] Run validation queries daily

### Day 4-7: Verify with real users
- [ ] Ask test users to report any calendar discrepancies
- [ ] Check for blocks showing when they shouldn't
- [ ] Check for blocks missing when they should show

## Rollback Procedure

If critical issues found:

### Immediate Rollback
```sql
-- Restore backup function
SELECT handle_improved_reschedule_response_backup_20251026();
```

### Report Issues
Create issue report with:
- [ ] Description of the problem
- [ ] Which test scenario failed
- [ ] Expected vs actual results
- [ ] CSV exports of affected records
- [ ] Screenshots if applicable

## Success Criteria

✅ All 4 test scenarios pass
✅ Validation queries return 0 rows
✅ No errors in Supabase logs
✅ User calendars show correct blocks
✅ No meaningless blocks visible

## Sign-Off

- [ ] All tests passed
- [ ] Validation queries confirmed
- [ ] Documentation complete
- [ ] Deployment successful

**Deployed by:** _________________
**Date:** _________________
**Time:** _________________

## Notes

_Use this space for any deployment notes or observations_

---

---

---
