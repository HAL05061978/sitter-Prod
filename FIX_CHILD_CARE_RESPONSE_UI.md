## Fix for Child Care Response UI Issue

### Problem
Invited parents are not seeing the "Respond to Request" button/form for reciprocal child care requests. Instead, they see the requester's view showing "All Responses" with incomplete data.

### Root Cause
The `get_reciprocal_care_requests` function has an overly restrictive WHERE clause that filters by both `response_type` and `status`, causing it to return 0 rows for valid pending invitations.

### Solution

#### Step 1: Deploy SQL Fix to Supabase
Run the SQL in `DEPLOY_FIX_CHILD_CARE_RESPONSES.sql` in your Supabase SQL Editor.

Key change: Removed `AND cr.response_type = 'pending'` from the WHERE clause, keeping only `AND cr.status = 'pending'`.

#### Step 2: Verify Frontend Changes
The frontend changes in `app/scheduler/page.tsx` have already been made:
- Line 1787: Now calls `get_reciprocal_care_responses` for requests where user is requester
- Line 1832: Now calls `get_reciprocal_care_requests` for invitations where user is responder

#### Step 3: Deploy to Vercel
After applying the SQL fix to Supabase, redeploy the frontend to Vercel:

```bash
git add .
git commit -m "Fix child care reciprocal response UI - swap RPC function calls"
git push
```

Vercel will automatically rebuild and deploy.

### Testing
1. Log in as an invited parent (e.g., user ID: 1ddffe94-817a-4fad-859e-df7adae45e31)
2. Navigate to the Scheduler page
3. You should now see: "A child care request for Nov 9, 2025 from 19:00 to 20:00 has been sent from Hugo Lopez"
4. Click the "Respond to Request" button
5. Fill out the reciprocal date/time form and submit

### Verification Query
Run this in Supabase to verify the function returns data:

```sql
SELECT * FROM get_reciprocal_care_requests('1ddffe94-817a-4fad-859e-df7adae45e31');
```

Should return 1 row for the pending invitation.
