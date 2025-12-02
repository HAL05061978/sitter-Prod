# Reschedule Workflow Analysis

## Current Database State

### Key Players
- **Parent A (Hugo Lopez)**: `750d426c-1556-4efc-aeb6-c694311f0b50` - Child: Sarah Grace (`3fbea496-5314-4d27-b6f3-addb40c7c4e8`)
- **Parent B (H Admin)**: `9911b41f-bac0-4c4a-a7fb-72ea408e74f1` - Child: Saralicious (`321a2c8b-a723-4631-9c16-d7a55c869cf8`)
- **Parent C (R Admin)**: `8c7b93f6-582d-4208-9cdd-65a940a1d18d` - Child: Santiago (`7d88bd93-2ad1-4560-ad06-47ae9e769fa7`)
- **Parent D (Rosmary)**: `ec313283-8696-4676-bc26-530606d01798` - Child: Gaston (`1022587f-565e-4ffa-87f5-049588086c3d`)

### Current Care Blocks
1. **Reciprocal Agreement** (Parent A ↔ Parent B):
   - Parent A needs care: `2025-09-09 19:00-23:00` (Sarah Grace)
   - Parent B needs care: `2025-09-10 07:30-11:30` (Saralicious)
   - Parent A provides care: `2025-09-10 07:30-11:30` (for Saralicious)
   - Parent B provides care: `2025-09-09 19:00-23:00` (for Sarah Grace)

2. **Open Block Invitations** (Parent A opened to Parent C & D):
   - Parent A's block: `2025-09-10 07:30-11:30` (Sarah Grace providing)
   - Parent C accepted: `2025-09-11 13:00-17:00` (Santiago providing)
   - Parent D accepted: `2025-09-12 13:05-17:05` (Gaston providing)

## Reschedule Scenarios Analysis

### Scenario 1: Parent A (Reciprocal Requester) Accepts Reschedule from Parent B

**Current State:**
- Parent B initiates reschedule for their providing block (`2025-09-09 19:00-23:00`)
- Parent A has a receiving block at that time (`2025-09-09 19:00-23:00`)

**Expected Behavior:**
1. **Initiation**: Parent B creates new providing block at new time with their child (Saralicious)
2. **Acceptance**: Parent A's child (Sarah Grace) should be moved to Parent B's new providing block
3. **Result**: Parent A sees receiving block at new time with Sarah Grace

**Key Issue**: Parent A is the RECIPROCAL requester, so their child should be added to the NEW providing block created by Parent B.

### Scenario 2: Parent A (Reciprocal Requester) Accepts Reschedule from Parent C (Open Block)

**Current State:**
- Parent C initiates reschedule for their providing block (`2025-09-11 13:00-17:00`)
- Parent A has a receiving block at that time (`2025-09-11 13:00-17:00`)

**Expected Behavior:**
1. **Initiation**: Parent C creates new providing block at new time with their child (Santiago)
2. **Acceptance**: Parent A's child (Sarah Grace) should be moved to Parent C's new providing block
3. **Result**: Parent A sees receiving block at new time with Sarah Grace

**Key Issue**: Parent A is the ORIGINAL requester for the open block, so their child should be added to the NEW providing block created by Parent C.

### Scenario 3: Parent C (Open Block) Accepts Reschedule from Parent A

**Current State:**
- Parent A initiates reschedule for their providing block (`2025-09-10 07:30-11:30`)
- Parent C has a receiving block at that time (`2025-09-10 07:30-11:30`)

**Expected Behavior:**
1. **Initiation**: Parent A creates new providing block at new time with their child (Sarah Grace)
2. **Acceptance**: Parent C's child (Santiago) should be moved to Parent A's new providing block
3. **Result**: Parent C sees receiving block at new time with Santiago

**Key Issue**: Parent C is an OPEN BLOCK participant, so their child should be added to the NEW providing block created by Parent A.

## Critical Child Allocation Rules

### Rule 1: Rescheduler's Child
- **Always** goes to the new providing block they create
- **Always** removed from original block during initiation

### Rule 2: Accepting Parent's Child
- **Always** goes to the new providing block (created by rescheduler)
- **Always** removed from original receiving block
- **Always** gets new receiving block at new date/time

### Rule 3: Non-Responding Parents
- **Keep** their children in original blocks (orange/rescheduled status)
- **Move** to new blocks only when they accept

### Rule 4: Original Block Cleanup
- **Delete** rescheduler's original block when all parents respond
- **Keep** other parents' original blocks until they respond

## Current Function Issues

### Issue 1: Child Selection During Initiation
- Function correctly selects rescheduler's child ✅
- Function correctly removes rescheduler's child from original block ✅

### Issue 2: Child Allocation During Acceptance
- Function correctly moves accepting parent's child to new block ✅
- Function correctly creates new receiving block for accepting parent ✅

### Issue 3: Parent A Special Case
- **Problem**: Parent A (reciprocal requester) accepting reschedule from others
- **Issue**: Parent A's child not being added to their own receiving block
- **Root Cause**: Logic doesn't differentiate between who initiated vs who's accepting

## Recommended Solution

### Enhanced Child Allocation Logic

```sql
-- When Parent A accepts reschedule from Parent B:
-- 1. Move Parent A's child to Parent B's new providing block
-- 2. Create new receiving block for Parent A at new date/time
-- 3. Add Parent A's child to their own receiving block

-- When Parent C accepts reschedule from Parent A:
-- 1. Move Parent C's child to Parent A's new providing block  
-- 2. Create new receiving block for Parent C at new date/time
-- 3. Add Parent C's child to their own receiving block
```

### Key Implementation Points

1. **Always create receiving block for accepting parent** at new date/time
2. **Always add accepting parent's child to their own receiving block**
3. **Always add accepting parent's child to rescheduler's providing block**
4. **Differentiate between rescheduler and accepting parent** for proper child allocation

## Testing Scenarios

1. **Parent A accepts Parent B's reschedule** - Should see Sarah Grace in new receiving block
2. **Parent A accepts Parent C's reschedule** - Should see Sarah Grace in new receiving block  
3. **Parent C accepts Parent A's reschedule** - Should see Santiago in new receiving block
4. **Parent D accepts Parent A's reschedule** - Should see Gaston in new receiving block

## Next Steps

1. Update `handle_simple_reschedule_response` function
2. Add logic to create receiving block for accepting parent
3. Add logic to add accepting parent's child to their own receiving block
4. Test all scenarios with current database state
