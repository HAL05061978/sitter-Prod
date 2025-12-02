# Deploy Schools Table Migration

## Overview
This migration adds a schools table to enable ZIP code-based school lookups and dropdowns in the Children forms.

## Prerequisites
- Supabase project access
- Database connection

## Steps to Deploy

### 1. Run the Migration SQL

Connect to your Supabase database and run the SQL script at `migrations/create_schools_table.sql`

**IMPORTANT:** If you already deployed the schools table, you need to fix the RLS policy by running `migrations/fix_schools_rls_policy.sql` to allow unauthenticated users (signup page) to access schools.

**Via Supabase Dashboard:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to SQL Editor
4. Copy and paste the contents of `migrations/create_schools_table.sql`
5. Click "Run"

**Via Command Line (if you have `psql` access):**
```bash
psql -h <your-db-host> -U postgres -d postgres -f migrations/create_schools_table.sql
```

### 2. Verify Installation

Run this query to verify the table was created:
```sql
SELECT COUNT(*) FROM schools;
```

You should see 9 sample schools for Trumbull, CT (ZIP code 06611).

### 3. Add More Schools (Optional)

To add more schools for your area, use this INSERT statement:
```sql
INSERT INTO schools (name, zip_code, town, state, address) VALUES
    ('Your School Name', '12345', 'Your Town', 'ST', 'School Address');
```

## Features Enabled

After deployment, users can:
1. Enter a ZIP code in the Children form
2. Town will auto-populate from the ZIP code
3. A dropdown of schools for that ZIP code will appear
4. Users can select from the list or type a custom school name

## Rollback

If you need to remove the table:
```sql
DROP TABLE IF EXISTS schools CASCADE;
```

## Notes

- The table is protected by RLS (Row Level Security)
- All authenticated users can read schools
- Only service_role can insert/update schools
- Sample data includes schools from Trumbull, CT (06611)
- You can expand the school list by running additional INSERT statements
