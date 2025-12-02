// Deploy fix to Supabase production database
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Error: Supabase credentials not found in environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Read the SQL file
const sqlContent = fs.readFileSync('fix_open_block_complete.sql', 'utf8');

console.log('🚀 Deploying open block acceptance fix...');
console.log(`📍 Supabase URL: ${supabaseUrl}`);

// Split SQL into individual statements and execute
async function deploy() {
  try {
    // Execute the SQL using RPC - we need to use the service role key for this
    // Since we only have anon key, we'll need to execute via SQL editor
    console.log('\n⚠️  Note: The anon key cannot execute DDL statements.');
    console.log('Please deploy manually using the Supabase SQL Editor:\n');
    console.log('1. Go to: https://supabase.com/dashboard/project/' + supabaseUrl.split('//')[1].split('.')[0]);
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the contents of fix_open_block_complete.sql');
    console.log('4. Click "Run" to execute\n');
    console.log('✅ The SQL file is ready at: fix_open_block_complete.sql');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deploy();
