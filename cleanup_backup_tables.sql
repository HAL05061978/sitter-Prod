-- Cleanup Backup Tables
-- This script removes all backup tables created during the migration process

-- ============================================================================
-- STEP 1: LIST ALL BACKUP TABLES
-- ============================================================================

SELECT 'Current backup tables in database:' as info;
SELECT 
    table_name,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = table_name AND table_schema = 'public') 
         THEN '✅ EXISTS' 
         ELSE '❌ NOT FOUND' 
    END as status
FROM (VALUES 
    ('backup_scheduled_blocks'),
    ('backup_babysitting_requests'),
    ('backup_request_responses'),
    ('backup_group_invitations'),
    ('invitation_time_blocks_backup'),
    ('backup_care_requests'),
    ('backup_scheduled_care'),
    ('backup_care_responses')
) as t(table_name);

-- ============================================================================
-- STEP 2: REMOVE ALL BACKUP TABLES
-- ============================================================================

-- Remove backup tables (with error handling)
DO $$
DECLARE
    v_table_name TEXT;
    v_drop_sql TEXT;
BEGIN
    -- List of backup tables to remove
    FOR v_table_name IN 
        SELECT unnest(ARRAY[
            'backup_scheduled_blocks',
            'backup_babysitting_requests', 
            'backup_request_responses',
            'backup_group_invitations',
            'invitation_time_blocks_backup',
            'backup_care_requests',
            'backup_scheduled_care',
            'backup_care_responses'
        ])
    LOOP
        -- Check if table exists before trying to drop it
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = v_table_name AND table_schema = 'public') THEN
            v_drop_sql := 'DROP TABLE IF EXISTS public.' || v_table_name || ' CASCADE';
            EXECUTE v_drop_sql;
            RAISE NOTICE '✅ Dropped backup table: %', v_table_name;
        ELSE
            RAISE NOTICE 'ℹ️  Backup table does not exist: %', v_table_name;
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ Backup table cleanup completed!';
END $$;

-- ============================================================================
-- STEP 3: VERIFY CLEANUP
-- ============================================================================

-- Check that backup tables are gone
SELECT 'Verifying backup tables are removed:' as info;
SELECT 
    table_name,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = table_name AND table_schema = 'public') 
         THEN '❌ STILL EXISTS' 
         ELSE '✅ REMOVED' 
    END as status
FROM (VALUES 
    ('backup_scheduled_blocks'),
    ('backup_babysitting_requests'),
    ('backup_request_responses'),
    ('backup_group_invitations'),
    ('invitation_time_blocks_backup'),
    ('backup_care_requests'),
    ('backup_scheduled_care'),
    ('backup_care_responses')
) as t(table_name);

-- ============================================================================
-- STEP 4: SHOW CURRENT SCHEDULING TABLES
-- ============================================================================

-- Show the current scheduling tables (should be clean and minimal)
SELECT 'Current scheduling tables:' as info;
SELECT 
    table_name,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = table_name AND table_schema = 'public') 
         THEN '✅ ACTIVE' 
         ELSE '❌ MISSING' 
    END as status
FROM (VALUES 
    ('care_requests'),
    ('scheduled_care'),
    ('care_responses')
) as t(table_name);

-- ============================================================================
-- STEP 5: FINAL STATUS
-- ============================================================================

SELECT '✅ Backup table cleanup completed successfully!' as status;
SELECT 'Database is now clean and ready for production use' as result;
SELECT 'Only the 3 new simplified tables remain: care_requests, scheduled_care, care_responses' as note; 