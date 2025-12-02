# Deploy Fixed Pet Care Functions

## Issue Found
The migration had a PostgreSQL naming conflict - the column `status` was ambiguous with the RETURNS TABLE parameter `status`.

## Fix Applied
Changed the return column name from `status` to `response_status` to avoid ambiguity.

## Deploy Instructions

### Step 1: Run the Fixed Migration

Copy and paste the entire contents of this file into Supabase SQL Editor:

**File:** `migrations/20250123000010_pet_care_simple_mirror_child_care.sql`

### Step 2: Verify Functions Work

Run the test queries:

```sql
-- Test as RESPONDER (should see 1 row)
SELECT * FROM get_reciprocal_pet_care_requests('2a7f3ce2-69f8-4241-831f-5c3f38f35890');

-- Test as REQUESTER (should see 0 rows until response is submitted)
SELECT * FROM get_reciprocal_pet_care_responses('1f66fb72-ccfb-4a55-8738-716a12543421');
```

### Step 3: Check Frontend Compatibility

**IMPORTANT:** The frontend may be looking for a field called `status` but the function now returns `response_status`.

Check if you need to update the frontend code in `app/scheduler/page.tsx`:

```typescript
// Change from:
response.status

// To:
response.response_status
```

Or we can alias it back in the function if the frontend expects `status`.

## Alternative: Keep Field Name as "status"

If you want to keep the frontend unchanged, we can use a different approach - qualify the column properly:

Instead of changing the return field name, we explicitly cast and alias:

```sql
RETURNS TABLE (
    ...
    status TEXT,  -- Keep original name
    ...
)

SELECT
    ...
    pcr.status::TEXT as status,  -- Explicit cast and alias
    ...
```

Let me know which approach you prefer:
1. **Change function** (return `response_status`) - requires frontend update
2. **Keep original name** (return `status`) - update function to use explicit table prefix

---

## Current Status

✅ Fixed the ambiguous column error
⚠️ May need frontend adjustment OR function adjustment

Choose your approach and I'll provide the appropriate fix!
