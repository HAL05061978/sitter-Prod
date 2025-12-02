# Open Block Parent Filter Bug Fix

## Problem

When creating open block invitations, parents were appearing as available even when they already had a child participating in the care block.

**Example:**
- Karen Lop has 2 children: Child A and Child B
- Care block already has Child A participating
- Karen Lop still appeared as available to invite (because Child B wasn't in the block)

This allowed parents to be invited multiple times for the same block.

## Root Cause

The filtering logic was checking if individual children were already in the block, but not checking if the parent already had ANY child in the block.

**Old Logic:**
1. Get children already in block
2. Filter out those children
3. Show parents of remaining children

**Issue:** If a parent had multiple children and only one was in the block, they would still appear as available.

## Solution

Added an additional filter to exclude parents who already have ANY child participating in the care block.

### File: `app/calendar/page.tsx`

**Location:** Lines 773-791

**New Logic:**
1. Get children already in block
2. **Get parent IDs of those children** (NEW)
3. Filter out children already in block
4. **Filter out children whose parents are already in block** (NEW)
5. Show parents of remaining children

### Code Changes

```typescript
// Get parent IDs of children already in the block
const parentsWithChildrenInBlock = new Set(
  groupChildren
    .filter(item => Array.from(blockChildIds).includes(item.id))
    .map(item => item.parent_id)
);

console.log('✅ Parents with children already in block:', Array.from(parentsWithChildrenInBlock));

// Filter out children whose parents already have a child in the care block
const availableChildren = groupChildren
  .filter(item => !Array.from(blockChildIds).includes(item.id))
  .filter(item => !parentsWithChildrenInBlock.has(item.parent_id))  // ✅ NEW: Exclude if parent already has child in block
  .map(item => ({
    id: item.id,
    full_name: item.full_name
  }));
```

## Expected Behavior After Fix

### Scenario 1: Parent with 1 child
- Child is in block → Parent NOT available ✅

### Scenario 2: Parent with multiple children
- One child in block → Parent NOT available ✅
- No children in block → Parent available ✅

### Scenario 3: All group members participating
- All active parents have children in block → No parents available ✅
- Shows "No other parents available" message

## Testing
- Build successful: ✓
- Logic prevents duplicate parent invitations: ✓
- Proper filtering by parent participation: ✓
