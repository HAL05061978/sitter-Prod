# Investigation Plan for Reciprocal Workflow Issue

## Current Status
- Frontend shows "Failed to submit response" error
- Console shows 400 Bad Request error (not 404 anymore)
- This means the function exists but there's a parameter/validation issue

## Step-by-Step Investigation

### Step 1: Run Comprehensive Diagnostic
```sql
-- Execute COMPREHENSIVE_DIAGNOSTIC.sql
```
This will show us:
- What functions actually exist
- What data we're working with
- Step-by-step function testing
- Any constraint violations
- RLS policies

### Step 2: Test Simple Function
```sql
-- Execute SIMPLE_TEST_FUNCTION.sql
```
This creates the simplest possible function that just returns a UUID to test if the basic call works.

### Step 3: Debug Frontend Call
```sql
-- Execute DEBUG_FRONTEND_CALL.sql
```
This creates a debug function that logs exactly what the frontend is sending.

### Step 4: Check Frontend Data
We need to verify:
- What is `selectedRequest.care_request_id`?
- What is `reciprocalResponse.reciprocal_date`?
- What is `reciprocalResponse.reciprocal_child_id`?
- Are these values valid?

### Step 5: Check Database State
- Are the UUIDs in the frontend valid?
- Do the records exist in the database?
- Are there any constraint violations?

## Expected Issues

1. **Parameter Mismatch**: Frontend sends different parameter names than database expects
2. **Data Validation**: Some of the data being sent is invalid
3. **Missing Records**: Referenced UUIDs don't exist in database
4. **Constraint Violations**: Data violates database constraints
5. **RLS Policies**: Row Level Security blocking the operation

## Next Steps

1. Run the diagnostic scripts
2. Check the console output for specific error messages
3. Verify the data being sent from frontend
4. Fix any identified issues
5. Test the complete workflow

## Files Created

1. `COMPREHENSIVE_DIAGNOSTIC.sql` - Full diagnostic
2. `SIMPLE_TEST_FUNCTION.sql` - Simple test function
3. `DEBUG_FRONTEND_CALL.sql` - Debug function
4. `INVESTIGATION_PLAN.md` - This plan
