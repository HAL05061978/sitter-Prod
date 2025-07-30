# Simplified Scheduling System - Debugging Checklist

## 🚀 **Phase 1: Initial Setup**

### ✅ **Step 1: Run Migration Script**
```sql
-- Execute the migration script
\i migration_to_simplified_scheduling.sql
```

**Expected Results:**
- ✅ New tables created: `care_requests`, `scheduled_care`, `care_responses`
- ✅ Backup tables created for safety
- ✅ Indexes created for performance
- ✅ RLS policies enabled
- ✅ Helper functions created
- ✅ Permissions granted
- ✅ Realtime enabled

### ✅ **Step 2: Verify Table Creation**
```sql
-- Check that all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('care_requests', 'scheduled_care', 'care_responses');
```

**Expected:** 3 tables should exist

### ✅ **Step 3: Check Indexes**
```sql
-- Verify indexes were created
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('care_requests', 'scheduled_care', 'care_responses');
```

**Expected:** Multiple indexes per table

## 🧪 **Phase 2: Function Testing**

### ✅ **Step 4: Test Helper Functions**
```sql
-- Test time conflict checking
SELECT check_care_time_conflicts(
    'some-uuid-here',
    CURRENT_DATE,
    '14:00:00',
    '16:00:00'
);
```

**Expected:** Returns boolean (true/false)

### ✅ **Step 5: Test Accept Function**
```sql
-- This will be tested in the full test script
\i test_simplified_scheduling.sql
```

## 🔍 **Phase 3: Data Validation**

### ✅ **Step 6: Check Test Data**
```sql
-- Verify we have data to work with
SELECT COUNT(*) as groups_count FROM public.groups;
SELECT COUNT(*) as profiles_count FROM public.profiles;
SELECT COUNT(*) as children_count FROM public.children;
```

**Expected:** All counts > 0

### ✅ **Step 7: Run Comprehensive Tests**
```sql
-- Execute the test script
\i test_simplified_scheduling.sql
```

**Expected Results:**
- ✅ Simple request flow works
- ✅ Reciprocal request flow works
- ✅ Open block flow works
- ✅ Event request flow works
- ✅ Editing functionality works
- ✅ Time conflict checking works

## 🐛 **Phase 4: Common Issues & Fixes**

### ❌ **Issue 1: "Table already exists"**
```sql
-- Fix: Drop and recreate
DROP TABLE IF EXISTS public.care_requests CASCADE;
DROP TABLE IF EXISTS public.scheduled_care CASCADE;
DROP TABLE IF EXISTS public.care_responses CASCADE;
-- Then re-run migration script
```

### ❌ **Issue 2: "Function already exists"**
```sql
-- Fix: Drop and recreate functions
DROP FUNCTION IF EXISTS check_care_time_conflicts(UUID, DATE, TIME, TIME, UUID);
DROP FUNCTION IF EXISTS accept_care_request(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS create_open_block_requests(UUID, UUID[], INTEGER);
DROP FUNCTION IF EXISTS edit_scheduled_care(UUID, UUID, DATE, TIME, TIME, TEXT);
-- Then re-run migration script
```

### ❌ **Issue 3: "Policy already exists"**
```sql
-- Fix: Drop and recreate policies
DROP POLICY IF EXISTS "Users can view care requests in their groups" ON public.care_requests;
DROP POLICY IF EXISTS "Users can create care requests in their groups" ON public.care_requests;
DROP POLICY IF EXISTS "Users can update their own care requests" ON public.care_requests;
-- Repeat for all policies, then re-run migration script
```

### ❌ **Issue 4: "Index already exists"**
```sql
-- Fix: Drop and recreate indexes
DROP INDEX IF EXISTS idx_care_requests_group_id;
DROP INDEX IF EXISTS idx_care_requests_requester_id;
-- Repeat for all indexes, then re-run migration script
```

### ❌ **Issue 5: "No test data available"**
```sql
-- Fix: Create test data
INSERT INTO public.groups (id, name) VALUES (gen_random_uuid(), 'Test Group');
INSERT INTO public.profiles (id, first_name, last_name) VALUES (gen_random_uuid(), 'Test', 'User');
-- Add more test data as needed
```

## 🔧 **Phase 5: Advanced Debugging**

### ✅ **Step 8: Check RLS Policies**
```sql
-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('care_requests', 'scheduled_care', 'care_responses');
```

**Expected:** `rowsecurity = true` for all tables

### ✅ **Step 9: Check Permissions**
```sql
-- Verify permissions are granted
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
AND table_name IN ('care_requests', 'scheduled_care', 'care_responses');
```

**Expected:** `authenticated` role has SELECT, INSERT, UPDATE permissions

### ✅ **Step 10: Check Realtime**
```sql
-- Verify realtime is enabled
SELECT * FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN ('care_requests', 'scheduled_care', 'care_responses');
```

**Expected:** All 3 tables should be in the publication

## 📊 **Phase 6: Performance Testing**

### ✅ **Step 11: Test Query Performance**
```sql
-- Test basic queries
EXPLAIN ANALYZE SELECT * FROM public.care_requests WHERE group_id = 'some-uuid';
EXPLAIN ANALYZE SELECT * FROM public.scheduled_care WHERE parent_id = 'some-uuid';
EXPLAIN ANALYZE SELECT * FROM public.care_responses WHERE request_id = 'some-uuid';
```

**Expected:** Queries should use indexes efficiently

### ✅ **Step 12: Test Function Performance**
```sql
-- Test function performance
EXPLAIN ANALYZE SELECT accept_care_request('request-uuid', 'responder-uuid', 'test');
```

**Expected:** Function should execute without performance issues

## 🚨 **Phase 7: Error Handling**

### ✅ **Step 13: Test Error Conditions**
```sql
-- Test invalid data
INSERT INTO public.care_requests (
    group_id, requester_id, child_id, 
    requested_date, start_time, end_time, 
    request_type
) VALUES (
    'invalid-uuid', 'invalid-uuid', 'invalid-uuid',
    CURRENT_DATE, '16:00:00', '14:00:00', -- Invalid time range
    'invalid-type'
);
```

**Expected:** Should raise appropriate constraint violations

### ✅ **Step 14: Test Business Logic Errors**
```sql
-- Test accepting non-existent request
SELECT accept_care_request('non-existent-uuid', 'some-uuid', 'test');
```

**Expected:** Should raise "Care request not found" exception

## ✅ **Phase 8: Final Verification**

### ✅ **Step 15: Complete System Test**
```sql
-- Run the complete test suite
\i test_simplified_scheduling.sql
```

**Expected Results:**
- ✅ All test cases pass
- ✅ No errors in logs
- ✅ Data integrity maintained
- ✅ Performance acceptable

## 📝 **Phase 9: Documentation**

### ✅ **Step 16: Update Application Code**
- Update frontend to use new table names
- Update API endpoints to use new schema
- Test all user workflows
- Update documentation

### ✅ **Step 17: Cleanup (When Ready)**
```sql
-- Uncomment and run when confident
/*
DROP TABLE IF EXISTS public.babysitting_requests;
DROP TABLE IF EXISTS public.request_responses;
DROP TABLE IF EXISTS public.scheduled_blocks;
DROP TABLE IF EXISTS public.block_connections;
DROP TABLE IF EXISTS public.group_invitations;
*/
```

## 🎯 **Success Criteria**

**System is ready when:**
- ✅ All migration steps complete without errors
- ✅ All test cases pass
- ✅ RLS policies working correctly
- ✅ Functions executing properly
- ✅ Performance is acceptable
- ✅ Application integration successful

## 🆘 **Emergency Rollback**

If issues arise, rollback to old system:
```sql
-- Restore from backup tables
INSERT INTO public.babysitting_requests SELECT * FROM backup_babysitting_requests;
INSERT INTO public.request_responses SELECT * FROM backup_request_responses;
INSERT INTO public.scheduled_blocks SELECT * FROM backup_scheduled_blocks;
-- Continue with other tables as needed
```

---

**Next Steps:**
1. Run the migration script
2. Execute the test script
3. Fix any issues found
4. Integrate with application
5. Monitor for any problems
6. Clean up old tables when confident 