# Deploy Functions to Production Supabase

## Method 1: Supabase Dashboard (Recommended)

1. Go to: https://supabase.com/dashboard/project/hilkelodfneancwwzvoh
2. Click on "SQL Editor" in the left sidebar
3. Copy the entire contents of `sync_functions_to_production.sql`
4. Paste it into the SQL Editor
5. Click "Run" to execute all functions

## Method 2: Essential Functions Only

If you want to start with just the essential functions, run these one by one:

### 1. Calendar Function
```sql
CREATE OR REPLACE FUNCTION get_scheduled_care_for_calendar(
  p_user_id UUID,
  p_start_date DATE DEFAULT CURRENT_DATE,
  p_end_date DATE DEFAULT CURRENT_DATE + INTERVAL '30 days'
)
RETURNS TABLE (
  care_id UUID,
  child_name TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  status TEXT,
  event_title TEXT,
  related_request_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sc.id as care_id,
    c.full_name as child_name,
    sc.start_time,
    sc.end_time,
    sc.status,
    sc.event_title,
    sc.related_request_id
  FROM scheduled_care sc
  JOIN children c ON sc.child_id = c.id
  WHERE sc.parent_id = p_user_id
    AND sc.start_time::date BETWEEN p_start_date AND p_end_date
  ORDER BY sc.start_time;
END;
$$;
```

### 2. Open Block Invitations
```sql
CREATE OR REPLACE FUNCTION get_open_block_invitations(
  p_user_id UUID
)
RETURNS TABLE (
  invitation_id UUID,
  group_name TEXT,
  existing_block_id UUID,
  existing_block_start TIMESTAMPTZ,
  existing_block_end TIMESTAMPTZ,
  requester_name TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    obi.id as invitation_id,
    g.name as group_name,
    obi.existing_block_id,
    obi.existing_block_start,
    obi.existing_block_end,
    p.full_name as requester_name,
    obi.created_at
  FROM open_block_invitations obi
  JOIN groups g ON obi.group_id = g.id
  JOIN profiles p ON obi.requester_id = p.id
  WHERE obi.status = 'pending'
    AND obi.group_id IN (
      SELECT gm.group_id 
      FROM group_members gm 
      WHERE gm.profile_id = p_user_id
    );
END;
$$;
```

### 3. Accept Open Block Function
```sql
CREATE OR REPLACE FUNCTION accept_open_block_invitation(
  p_invitation_id UUID,
  p_accepted_by UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_record RECORD;
BEGIN
  -- Get invitation details
  SELECT * INTO invitation_record
  FROM open_block_invitations
  WHERE id = p_invitation_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Update invitation status
  UPDATE open_block_invitations
  SET status = 'accepted', accepted_by = p_accepted_by, accepted_at = NOW()
  WHERE id = p_invitation_id;
  
  -- Create scheduled care entry
  INSERT INTO scheduled_care (
    parent_id,
    child_id,
    start_time,
    end_time,
    status,
    event_title,
    related_request_id
  )
  SELECT 
    p_accepted_by,
    c.id,
    invitation_record.existing_block_start,
    invitation_record.existing_block_end,
    'scheduled',
    'Open Block Care',
    invitation_record.id
  FROM children c
  WHERE c.parent_id = p_accepted_by
  LIMIT 1;
  
  RETURN TRUE;
END;
$$;
```

## After Deploying Functions

1. **Test your app**: Go back to https://sitter-prod-d4r76bv19-hugo-lopezs-projects-7f2cf14f.vercel.app
2. **Check the console**: The 404 errors should be gone
3. **Test the calendar**: Navigate to the calendar page to see if it loads
4. **Test the scheduler**: Try the Accept functionality

## Expected Results

After deploying these functions:
- ✅ Calendar page should load properly
- ✅ Scheduler page should show invitations
- ✅ Accept button should work
- ✅ Console errors should be reduced significantly
