# Supabase Export/Import Guide

## The Problem
You have a working database and a new database connected to Vercel. You need to copy the exact schema from the working database to the new database.

## Solution: Use Supabase's Built-in Export/Import

### Step 1: Export from Working Database

1. **Go to your working database** in Supabase Dashboard
2. **Go to Settings > Database**
3. **Click "Export"** 
4. **Select "Schema + Data"** (or just "Schema" if you don't want data)
5. **Download the SQL file**

### Step 2: Import to New Database

1. **Go to your new database** in Supabase Dashboard
2. **Go to SQL Editor**
3. **Paste the exported SQL** from Step 1
4. **Run the script**

### Alternative: Use Supabase CLI

If you have Supabase CLI installed:

```bash
# Export from working database
supabase db dump --db-url "your-working-db-url" > working-database.sql

# Import to new database
supabase db reset --db-url "your-new-db-url" < working-database.sql
```

## Manual Approach (If Export/Import Doesn't Work)

### Step 1: Get the Exact Schema

1. **Connect to your working database** via SQL Editor
2. **Run this query** to get the complete schema:

```sql
-- Get complete schema
SELECT 
    'CREATE TABLE ' || tablename || ' (' ||
    string_agg(
        column_name || ' ' || data_type || 
        CASE WHEN character_maximum_length IS NOT NULL 
             THEN '(' || character_maximum_length || ')' 
             ELSE '' 
        END ||
        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
        CASE WHEN column_default IS NOT NULL 
             THEN ' DEFAULT ' || column_default 
             ELSE '' 
        END,
        ', '
    ) || ');' as create_statement
FROM information_schema.columns c
JOIN information_schema.tables t ON c.table_name = t.table_name
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
GROUP BY tablename
ORDER BY tablename;
```

### Step 2: Get All Functions

```sql
-- Get all functions
SELECT 
    'CREATE OR REPLACE FUNCTION ' || routine_name || '(...) RETURNS ...' as function_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_type = 'FUNCTION'
ORDER BY routine_name;
```

### Step 3: Get All Policies

```sql
-- Get all policies
SELECT 
    'CREATE POLICY "' || policyname || '" ON ' || tablename || ' ...' as policy_definition
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

## Recommended Approach

**Use Supabase's built-in export/import** - it's the most reliable way to copy everything exactly.

## Next Steps

1. **Try the Supabase export/import first**
2. **If that doesn't work, use the manual approach**
3. **Test that everything works after import**

## Notes

- Keep your CSV files as backup
- Test the import on a copy first if possible
- Make sure to backup your new database before importing


