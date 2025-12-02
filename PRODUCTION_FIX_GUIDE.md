# Production Fix Guide

## Overview
This guide will help you fix the production database issues causing 404, 406, and 400 errors in your SitterApp deployment.

## Issues Identified
1. **Missing Database Functions**: Functions like `get_open_block_invitations`, `get_reciprocal_care_requests`, etc. don't exist in production
2. **Missing Tables**: Tables like `event_invitations`, `group_invitations`, `reschedule_requests` don't exist
3. **Parameter Mismatches**: API calls using `p_parent_id` instead of `p_user_id`
4. **Environment Configuration**: Need to verify Supabase connection

## Step 1: Fix Database Schema

### Option A: Using Supabase Dashboard (Recommended)
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your production project
3. Go to **SQL Editor** (left sidebar)
4. Copy the entire contents of `production_database_fix.sql`
5. Paste into the SQL editor
6. Click **Run** and wait for completion
7. Verify no errors in the execution log

### Option B: Using Supabase CLI
```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Run the SQL script
supabase db reset --db-url "postgresql://postgres:[YOUR_PASSWORD]@db.[YOUR_PROJECT_REF].supabase.co:5432/postgres" < production_database_fix.sql
```

## Step 2: Verify Environment Variables

### In Vercel Dashboard:
1. Go to your project settings
2. Navigate to **Environment Variables**
3. Ensure these are set:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   NEXT_PUBLIC_APP_ENV=production
   NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
   NODE_ENV=production
   ```

### Verify in Supabase Dashboard:
1. Go to **Settings** → **API**
2. Copy your **Project URL** and **anon public** key
3. Ensure they match your Vercel environment variables

## Step 3: Redeploy Application

### Option A: Automatic Redeploy
If you have auto-deploy enabled, the changes will deploy automatically when you push to your main branch.

### Option B: Manual Redeploy
```bash
# Commit your changes
git add .
git commit -m "Fix production database schema and API parameters"
git push origin main

# Or trigger a manual deploy in Vercel dashboard
```

## Step 4: Test the Application

### Test Checklist:
- [ ] Calendar page loads without errors
- [ ] Scheduler page loads without errors
- [ ] No 404 errors in browser console
- [ ] No 406 errors in browser console
- [ ] No 400 errors in browser console
- [ ] User authentication works
- [ ] Database functions are accessible

### Debug Steps:
1. Open browser developer tools (F12)
2. Go to **Console** tab
3. Navigate through your app pages
4. Check for any remaining errors
5. If errors persist, check the **Network** tab for failed requests

## Step 5: Verify Database Functions

### Test in Supabase SQL Editor:
```sql
-- Test if functions exist
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE 'get_%';

-- Test a function call (replace with your user ID)
SELECT * FROM get_open_block_invitations('your-user-id-here');
```

## Common Issues and Solutions

### Issue: Still getting 404 errors
**Solution**: Verify the database functions were created successfully. Check the Supabase SQL editor execution log.

### Issue: Still getting 406 errors
**Solution**: Check your Supabase URL and anon key in Vercel environment variables.

### Issue: Still getting 400 errors
**Solution**: Verify the parameter names in your API calls match the function signatures.

### Issue: Functions exist but return empty results
**Solution**: Check if you have data in the related tables (profiles, groups, etc.).

## Files Modified

### Database Schema:
- `production_database_fix.sql` - Complete database schema fix

### Code Fixes:
- `app/scheduler/page.tsx` - Fixed parameter names
- `app/calendar/page.tsx` - Fixed parameter names  
- `app/components/Header.tsx` - Fixed parameter names

### Deployment Scripts:
- `deploy-production-fixes.sh` - Linux/Mac deployment script
- `deploy-production-fixes.bat` - Windows deployment script

## Verification Commands

### Check if tables exist:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'groups', 'scheduled_care', 'open_block_invitations');
```

### Check if functions exist:
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE 'get_%';
```

### Test function calls:
```sql
-- Test with your actual user ID
SELECT * FROM get_open_block_invitations('your-user-id-here');
SELECT * FROM get_scheduled_care_for_calendar('your-user-id-here', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days');
```

## Success Indicators

✅ **Database Functions**: All functions return data without errors  
✅ **API Calls**: No 404/406/400 errors in browser console  
✅ **Calendar Page**: Loads and displays scheduled care  
✅ **Scheduler Page**: Loads and displays invitations and requests  
✅ **Authentication**: User login/logout works correctly  

## Support

If you continue to experience issues:

1. Check the Supabase logs in your dashboard
2. Verify all environment variables are correctly set
3. Ensure your database has the proper RLS policies
4. Test the functions directly in the Supabase SQL editor

The application should now work correctly in production! 🎉

