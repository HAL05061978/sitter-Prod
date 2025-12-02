# Open Block Acceptance - Active Child Assignment Fix

## Problem

When a parent accepted an open block invitation, the system was automatically assigning an **inactive** child to the care block instead of the active one.

**Example:**
- Karen Lop has 2 children: Child A (active in Group X) and Child B (inactive in Group X)
- Open block invitation is for Group X
- System was assigning Child B (inactive) instead of Child A (active)

## Root Cause

The query that fetches available children when accepting an open block was filtering by:
1. `parent_id` - Current user's children ✅
2. `active = true` - Active children ✅

**BUT** it wasn't filtering by the specific group! This meant:
- It returned ALL active children across ALL groups
- If a child was inactive in Group X but active in Group Y, they could still be selected
- The first child found was auto-selected, regardless of whether they were active in the invitation's group

## Solution

Added group filtering to ensure only children active in the **specific group** are returned.

### File: `app/scheduler/page.tsx`

**Changed in 2 locations (lines ~139-146 and ~2611-2619):**

**Before:**
```typescript
const { data: childrenData, error: childrenError } = await supabase
  .from('child_group_members')
  .select(`
    child_id,
    children!inner(id, full_name, parent_id)
  `)
  .eq('parent_id', user.id)
  .eq('active', true);  // ❌ Gets active children from ANY group
```

**After:**
```typescript
const { data: childrenData, error: childrenError } = await supabase
  .from('child_group_members')
  .select(`
    child_id,
    group_id,
    children!inner(id, full_name, parent_id)
  `)
  .eq('parent_id', user.id)
  .eq('group_id', invitation.group_id)  // ✅ Filter by the invitation's specific group
  .eq('active', true);
```

## Expected Behavior After Fix

### Scenario 1: Parent with 1 active child in group
- Child is active in Group X → Child is auto-selected ✅
- Child is inactive in Group X → No children available, error message ✅

### Scenario 2: Parent with multiple children
- Child A active in Group X, Child B inactive in Group X
- Invitation for Group X → Child A is auto-selected ✅
- Child B is completely ignored ✅

### Scenario 3: Parent with children in multiple groups
- Child A active in Group X
- Child B active in Group Y (but inactive in Group X)
- Invitation for Group X → Only Child A is available ✅
- Child B is not shown as an option ✅

## Technical Details

The fix ensures that when a parent accepts an open block invitation:
1. Only children active in the SPECIFIC group are fetched
2. The first active child in that group is auto-selected
3. Inactive children in that group are never assigned to the care block
4. Children active in OTHER groups are not considered

## Testing
- Build successful: ✓
- Group-specific filtering: ✓
- Active status check maintained: ✓
- Auto-selection of correct child: ✓
