// Deploy hangout provider fix to production
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read environment variables
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables!');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deployFix() {
  console.log('📦 Deploying hangout providing_parent fix...\n');

  // Read the SQL file
  const sqlPath = path.join(__dirname, 'migrations', '20250122000007_fix_hangout_providing_parent.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('📄 Migration file:', sqlPath);
  console.log('📝 SQL length:', sql.length, 'characters\n');

  // Split into individual statements (separated by $$)
  // This is tricky because we have function definitions with $$ delimiters
  const statements = [];

  // Extract each CREATE OR REPLACE FUNCTION block
  const functionMatches = sql.matchAll(/CREATE OR REPLACE FUNCTION[\s\S]*?\$\$;/g);
  for (const match of functionMatches) {
    statements.push(match[0]);
  }

  // Extract COMMENT statements
  const commentMatches = sql.matchAll(/COMMENT ON FUNCTION[^;]+;/g);
  for (const match of commentMatches) {
    statements.push(match[0]);
  }

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim();
    if (!stmt) continue;

    const preview = stmt.substring(0, 80).replace(/\s+/g, ' ') + '...';
    console.log(`\n[${i + 1}/${statements.length}] Executing: ${preview}`);

    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: stmt });

      // If exec_sql doesn't exist, try direct execution via REST API
      if (error && error.message.includes('exec_sql')) {
        console.log('   ℹ️  Using alternative execution method...');

        // Use the Supabase REST API to execute raw SQL
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ query: stmt })
        });

        if (!response.ok) {
          // For CREATE OR REPLACE, we can execute via a workaround
          // Let's save to temp file and use psql if available
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
      } else if (error) {
        throw error;
      }

      console.log('   ✅ Success');
    } catch (err) {
      console.error('   ❌ Error:', err.message);
      console.error('\nDeployment failed. Please apply manually via Supabase SQL Editor.');
      console.error('SQL File location:', sqlPath);
      process.exit(1);
    }
  }

  console.log('\n\n✨ Migration deployed successfully!\n');
  console.log('Next steps:');
  console.log('1. Test by creating a new hangout invitation');
  console.log('2. Verify the provider name shows correctly in the calendar UI\n');
}

deployFix().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
