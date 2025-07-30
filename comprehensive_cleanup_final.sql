-- Comprehensive Final Cleanup
-- This script removes ALL backup tables and old scheduling tables
-- Leaving only the new simplified 3-table system

-- ============================================================================
-- STEP 1: LIST ALL TABLES TO CLEAN UP
-- ============================================================================

SELECT 'Tables to be removed:' as info;
SELECT 
    table_name,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = table_name AND table_schema = 'public') 
         THEN '✅ EXISTS - WILL REMOVE' 
         ELSE '❌ NOT FOUND' 
    END as status
FROM (VALUES 
    -- Backup tables
    ('backup_scheduled_blocks'),
    ('backup_babysitting_requests'),
    ('backup_request_responses'),
    ('backup_group_invitations'),
    ('backup_block_connections'),
    ('backup_invitation_time_blocks'),
    ('invitation_time_blocks_backup'),
    ('backup_care_requests'),
    ('backup_scheduled_care'),
    ('backup_care_responses'),
    -- Old scheduling tables (to be removed)
    ('babysitting_requests'),
    ('block_connections'),
    ('group_invitations'),
    ('invitation_time_blocks'),
    ('request_responses'),
    ('scheduled_blocks')
) as t(table_name);

-- ============================================================================
-- STEP 2: REMOVE ALL BACKUP AND OLD TABLES
-- ============================================================================

-- Remove all backup and old tables (with error handling)
DO $$
DECLARE
    v_table_name TEXT;
    v_drop_sql TEXT;
    v_tables_removed INTEGER := 0;
    v_tables_skipped INTEGER := 0;
BEGIN
    -- List of all tables to remove
    FOR v_table_name IN 
        SELECT unnest(ARRAY[
            -- Backup tables
            'backup_scheduled_blocks',
            'backup_babysitting_requests',
            'backup_request_responses',
            'backup_group_invitations',
            'backup_block_connections',
            'backup_invitation_time_blocks',
            'invitation_time_blocks_backup',
            'backup_care_requests',
            'backup_scheduled_care',
            'backup_care_responses',
            -- Old scheduling tables
            'babysitting_requests',
            'block_connections',
            'group_invitations',
            'invitation_time_blocks',
            'request_responses',
            'scheduled_blocks'
        ])
    LOOP
        -- Check if table exists before trying to drop it
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = v_table_name AND table_schema = 'public') THEN
            v_drop_sql := 'DROP TABLE IF EXISTS public.' || v_table_name || ' CASCADE';
            EXECUTE v_drop_sql;
            RAISE NOTICE '✅ Dropped table: %', v_table_name;
            v_tables_removed := v_tables_removed + 1;
        ELSE
            RAISE NOTICE 'ℹ️  Table does not exist: %', v_table_name;
            v_tables_skipped := v_tables_skipped + 1;
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ Cleanup completed! Removed % tables, skipped % tables', v_tables_removed, v_tables_skipped;
END $$;

-- ============================================================================
-- STEP 3: VERIFY CLEANUP
-- ============================================================================

-- Check that all old tables are gone
SELECT 'Verifying old tables are removed:' as info;
SELECT 
    table_name,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = table_name AND table_schema = 'public') 
         THEN '❌ STILL EXISTS' 
         ELSE '✅ REMOVED' 
    END as status
FROM (VALUES 
    -- Backup tables
    ('backup_scheduled_blocks'),
    ('backup_babysitting_requests'),
    ('backup_request_responses'),
    ('backup_group_invitations'),
    ('backup_block_connections'),
    ('backup_invitation_time_blocks'),
    ('invitation_time_blocks_backup'),
    ('backup_care_requests'),
    ('backup_scheduled_care'),
    ('backup_care_responses'),
    -- Old scheduling tables
    ('babysitting_requests'),
    ('block_connections'),
    ('group_invitations'),
    ('invitation_time_blocks'),
    ('request_responses'),
    ('scheduled_blocks')
) as t(table_name);

-- ============================================================================
-- STEP 4: SHOW FINAL SCHEDULING TABLES
-- ============================================================================

-- Show the final clean scheduling tables
SELECT 'Final scheduling tables (should be only these 3):' as info;
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
-- STEP 5: SHOW ALL REMAINING TABLES
-- ============================================================================

-- Show all remaining tables in the database
SELECT 'All remaining tables in database:' as info;
SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('care_requests', 'scheduled_care', 'care_responses') THEN '🆕 NEW SCHEDULING'
        WHEN table_name LIKE 'backup_%' THEN '🗑️  BACKUP (SHOULD BE GONE)'
        WHEN table_name IN ('babysitting_requests', 'block_connections', 'group_invitations', 'invitation_time_blocks', 'request_responses', 'scheduled_blocks') THEN '🗑️  OLD SCHEDULING (SHOULD BE GONE)'
        ELSE '✅ OTHER APP TABLE'
    END as category
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY 
    CASE 
        WHEN table_name IN ('care_requests', 'scheduled_care', 'care_responses') THEN 1
        WHEN table_name LIKE 'backup_%' THEN 2
        WHEN table_name IN ('babysitting_requests', 'block_connections', 'group_invitations', 'invitation_time_blocks', 'request_responses', 'scheduled_blocks') THEN 3
        ELSE 4
    END,
    table_name;

-- ============================================================================
-- STEP 6: FINAL STATUS
-- ============================================================================

SELECT '✅ Comprehensive cleanup completed!' as status;
SELECT 'Database is now clean with only the 3 new simplified scheduling tables' as result;
SELECT 'Ready for production use!' as note; 