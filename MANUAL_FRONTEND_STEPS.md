# Manual Frontend Update Steps

I've successfully updated some parts of `app/scheduler/page.tsx` automatically:

## ✅ Already Done Automatically:
1. ✅ Added `groupChildren` state (line 326)
2. ✅ Added `fetchAllGroupChildren()` function (line 1258)
3. ✅ Updated `resetNewRequestForm()` to clear groupChildren (line 1582)

## 🔧 Need to Do Manually:

### Step 1: Update `handleCreateRequest` Function

Find the `handleCreateRequest` function around **line 1363**.

Replace the ENTIRE function (from `const handleCreateRequest = async...` to the closing `};`) with the code from:
**`SCHEDULER_FORM_UPDATE.tsx`** (first section)

### Step 2: Update the Form JSX

Find the New Care Request Modal form around **line 2168**. Look for:
```tsx
<form onSubmit={handleCreateRequest} className="p-6 space-y-4">
```

Replace everything INSIDE the `<form>` tags (between `<form>` and `</form>`) with the JSX code from:
**`SCHEDULER_FORM_UPDATE.tsx`** (second section)

## 🎯 What This Will Do:

**Care Type Selector**: Shows 3 buttons (Care Request, Hangout, Sleepover)
**Conditional Fields**:
- Care Request → Shows single child selector
- Hangout/Sleepover → Shows:
  - Hosting children (checkboxes for your kids)
  - Invited children (checkboxes for other group kids)
  - End date field (sleepover only)

**Smart Validation**:
- Reciprocal: requires child_id
- Hangout/Sleepover: requires hosting_child_ids[] and invited_child_ids[]
- Sleepover: also requires end_date

## 📝 Testing After Changes:

1. Save the file
2. Refresh your browser
3. Click "Create New Care Request"
4. You should see 3 buttons at the top: **Care Request**, **Hangout**, **Sleepover**
5. Try clicking each one and watch the form change

## 🐛 If You Get Errors:

**TypeScript errors about `care_type`?**
- Make sure the state declaration includes all the new fields

**Can't see group children?**
- Check that `fetchAllGroupChildren` was added correctly
- Check that it's called when group changes

**Form doesn't submit?**
- Check that `handleCreateRequest` has all three care type handlers

Need help? Let me know what error you're seeing!
