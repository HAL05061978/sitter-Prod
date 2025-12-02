# Scheduled Care Conflict Validation

## ✅ What This Does

**Prevents creating a pet care request if you already have scheduled pet care during those dates.**

### Business Rule
You cannot request pet care for dates when you already have pet care commitments (either providing or receiving).

---

## 🎯 How It Works

### Validation Logic (app/calendar/page.tsx:1643-1666)

```typescript
// 1. Get the request date range
const requestStart = new Date(newRequestData.date);
const requestEnd = new Date(newRequestData.end_date || newRequestData.date);

// 2. Find any existing pet care blocks that overlap
const conflictingBlocks = scheduledCare.filter(block => {
  if (block.care_category !== 'pet') return false;  // Only check pet care

  const blockStart = new Date(block.care_date);
  const blockEnd = new Date(block.end_date || block.care_date);

  // Check if date ranges overlap
  return blockStart <= requestEnd && blockEnd >= requestStart;
});

// 3. If conflicts found, show error and prevent creation
if (conflictingBlocks.length > 0) {
  alert('Cannot create pet care request: You already have scheduled pet care...');
  return;
}
```

---

## 📋 Example Scenarios

### ❌ Scenario 1: Complete Overlap
**Existing:** Nov 15-20 (providing pet care)
**Try to create:** Nov 17-19 (request pet care)
**Result:** ❌ Blocked
**Message:** "You already have scheduled pet care during these dates (Nov 15 - Nov 20)"

### ❌ Scenario 2: Partial Overlap (Start)
**Existing:** Nov 15-20 (receiving pet care)
**Try to create:** Nov 18-25 (request pet care)
**Result:** ❌ Blocked
**Message:** "You already have scheduled pet care during these dates (Nov 15 - Nov 20)"

### ❌ Scenario 3: Partial Overlap (End)
**Existing:** Nov 20-25 (providing pet care)
**Try to create:** Nov 15-22 (request pet care)
**Result:** ❌ Blocked
**Message:** "You already have scheduled pet care during these dates (Nov 20 - Nov 25)"

### ❌ Scenario 4: Single Day Overlap
**Existing:** Nov 17 (providing pet care)
**Try to create:** Nov 15-20 (request pet care)
**Result:** ❌ Blocked
**Message:** "You already have scheduled pet care during these dates (Nov 17)"

### ✅ Scenario 5: No Overlap
**Existing:** Nov 15-20 (any pet care)
**Try to create:** Nov 22-25 (request pet care)
**Result:** ✅ Allowed
**Message:** "Pet care request created successfully!"

### ✅ Scenario 6: Adjacent Dates (No Overlap)
**Existing:** Nov 15-20 (any pet care)
**Try to create:** Nov 21-25 (request pet care)
**Result:** ✅ Allowed
**Message:** "Pet care request created successfully!"

---

## 🔍 What Gets Checked

### Includes:
- ✅ Providing pet care blocks
- ✅ Receiving pet care blocks
- ✅ Single-day blocks
- ✅ Multi-day blocks
- ✅ Confirmed blocks

### Excludes:
- ❌ Child care blocks (not checked)
- ❌ Hangout/sleepover blocks (not checked)
- ❌ Rescheduled/pending blocks (only checks confirmed)

---

## ⚠️ Important Notes

### Why This Validation Matters

1. **Logical Consistency:** Can't request care if you're already committed elsewhere
2. **Calendar Clarity:** Prevents confusing double-bookings
3. **User Protection:** Stops users from creating impossible scenarios

### When Validation Runs

- **Frontend only** (app/calendar/page.tsx)
- **Before** calling `create_pet_care_request`
- Uses already-loaded `scheduledCare` data (no extra query needed)

### Child Care NOT Affected

This validation only applies to pet care. Child care requests are unaffected.

---

## 🧪 Testing Guide

### Test 1: Create Request with Existing Block
1. Have existing pet care: Nov 15-20
2. Try to create request: Nov 17-19
3. ✅ Should see: Alert blocking creation

### Test 2: Create Request Adjacent to Block
1. Have existing pet care: Nov 15-20
2. Try to create request: Nov 21-25
3. ✅ Should succeed: No overlap

### Test 3: Multiple Conflicts
1. Have existing blocks: Nov 10-12, Nov 15-17, Nov 20-22
2. Try to create request: Nov 11-21
3. ✅ Should see: Alert showing all conflicting dates

### Test 4: Child Care Doesn't Block
1. Have existing child care: Nov 15-20
2. Try to create pet care request: Nov 17-19
3. ✅ Should succeed: Child care not checked

---

## 📦 Code Location

**File:** `app/calendar/page.tsx`

**Lines:** 1643-1666

**Function:** `handleCreateNewRequest` (inside pet_care block)

---

## 🚀 Deployment

**This is frontend-only:**
- No SQL changes needed
- Just deploy Vercel
- Works immediately

---

## ✨ User Experience

### Before (Without Validation):
1. Create request during existing block
2. Request gets created
3. Calendar shows double-booking
4. User confused about conflicts

### After (With Validation):
1. Try to create request during existing block
2. ❌ Alert shows immediately
3. Clear message explains the conflict
4. User picks different dates
5. ✅ Successful creation with no conflicts

---

## 🎉 Summary

This validation prevents a common mistake: trying to request pet care when you're already committed to providing/receiving care during those dates.

It's a simple frontend check that provides immediate feedback and keeps the calendar clean and logical.
