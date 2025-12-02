/**
 * Production Fix Verification Script
 * This script helps verify that the production database fixes are working
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration - Update these with your production values
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyDatabaseFunctions() {
  console.log('🔍 Verifying Database Functions...\n');
  
  const functions = [
    'get_scheduled_care_for_calendar',
    'get_open_block_invitations', 
    'get_reciprocal_care_requests',
    'get_reciprocal_care_responses',
    'get_responses_for_requester',
    'get_pending_group_invitations',
    'get_pending_event_invitations',
    'get_reschedule_requests'
  ];
  
  for (const funcName of functions) {
    try {
      // Test function existence by calling it with a dummy UUID
      const { data, error } = await supabase.rpc(funcName, {
        p_user_id: '00000000-0000-0000-0000-000000000000'
      });
      
      if (error) {
        if (error.code === 'PGRST202') {
          console.log(`❌ ${funcName}: Function not found`);
        } else {
          console.log(`⚠️  ${funcName}: Function exists but has issues - ${error.message}`);
        }
      } else {
        console.log(`✅ ${funcName}: Function exists and callable`);
      }
    } catch (err) {
      console.log(`❌ ${funcName}: Error - ${err.message}`);
    }
  }
}

async function verifyTables() {
  console.log('\n🔍 Verifying Database Tables...\n');
  
  const tables = [
    'profiles',
    'children', 
    'groups',
    'group_members',
    'group_invitations',
    'event_invitations',
    'reschedule_requests',
    'open_block_invitations',
    'reciprocal_care_requests',
    'reciprocal_care_responses',
    'scheduled_care',
    'chat_messages'
  ];
  
  for (const tableName of tables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
        
      if (error) {
        if (error.code === '42P01') {
          console.log(`❌ ${tableName}: Table does not exist`);
        } else {
          console.log(`⚠️  ${tableName}: Table exists but has issues - ${error.message}`);
        }
      } else {
        console.log(`✅ ${tableName}: Table exists and accessible`);
      }
    } catch (err) {
      console.log(`❌ ${tableName}: Error - ${err.message}`);
    }
  }
}

async function verifyEnvironment() {
  console.log('\n🔍 Verifying Environment Configuration...\n');
  
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`Supabase Key: ${SUPABASE_ANON_KEY.substring(0, 20)}...`);
  
  if (SUPABASE_URL.includes('your-project')) {
    console.log('❌ Supabase URL not configured properly');
  } else {
    console.log('✅ Supabase URL configured');
  }
  
  if (SUPABASE_ANON_KEY.includes('your-anon-key')) {
    console.log('❌ Supabase Anon Key not configured properly');
  } else {
    console.log('✅ Supabase Anon Key configured');
  }
}

async function testAuthentication() {
  console.log('\n🔍 Testing Authentication...\n');
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.log(`⚠️  Authentication test failed: ${error.message}`);
    } else if (user) {
      console.log(`✅ User authenticated: ${user.email}`);
    } else {
      console.log('ℹ️  No user currently authenticated (this is normal for testing)');
    }
  } catch (err) {
    console.log(`❌ Authentication error: ${err.message}`);
  }
}

async function main() {
  console.log('🚀 Production Fix Verification Script');
  console.log('=====================================\n');
  
  await verifyEnvironment();
  await verifyTables();
  await verifyDatabaseFunctions();
  await testAuthentication();
  
  console.log('\n✅ Verification complete!');
  console.log('\nIf you see any ❌ errors above, please:');
  console.log('1. Run the production_database_fix.sql script in Supabase');
  console.log('2. Verify your environment variables in Vercel');
  console.log('3. Redeploy your application');
}

// Run the verification
main().catch(console.error);

