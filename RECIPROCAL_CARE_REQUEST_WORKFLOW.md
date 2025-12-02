# Reciprocal Care Request Workflow Documentation

## Overview

This document provides a comprehensive guide to the reciprocal care request workflow in the SitterAp application. The workflow allows parents to create care requests that involve 1-to-1 care agreements where parents exchange care services for their respective children.

## Workflow Summary

The reciprocal care request process involves:
1. **User Initiation** - Double-clicking on calendar cell
2. **Request Creation** - Database function creates request and placeholder responses
3. **Notification** - Group members are notified of the request
4. **Response Handling** - Members can respond with their own care offers
5. **Acceptance** - Requester can accept responses to finalize agreements

---

## Complete Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    RECIPROCAL CARE REQUEST WORKFLOW              │
└─────────────────────────────────────────────────────────────────┘

1. USER INITIATION (Calendar)
   ┌─────────────────┐
   │ User double-clicks │
   │ calendar cell     │
   └─────────┬─────────┘
             │
             ▼
   ┌─────────────────┐
   │ Modal opens for │
   │ new request     │
   └─────────┬─────────┘
             │
             ▼
   ┌─────────────────┐
   │ User selects    │
   │ "care" type     │
   └─────────┬─────────┘
             │
             ▼
   ┌─────────────────┐
   │ handleCreateNew │
   │ Request()       │
   └─────────┬─────────┘
             │
             ▼
   ┌─────────────────┐
   │ Validates times │
   │ & prepares data │
   └─────────┬─────────┘
             │
             ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ CALL: supabase.rpc('create_reciprocal_care_request', {...}) │
   └─────────────────────────────────────────────────────────────┘
             │
             ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ DATABASE FUNCTION: create_reciprocal_care_request           │
   │ ┌─────────────────────────────────────────────────────────┐ │
   │ │ 1. INSERT INTO care_requests                             │ │
   │ │    - request_type = 'reciprocal'                        │ │
   │ │    - status = 'pending'                                 │ │
   │ │    - is_reciprocal = true                               │ │
   │ │    - Returns: care_request_id                           │ │
   │ └─────────────────────────────────────────────────────────┘ │
   │ ┌─────────────────────────────────────────────────────────┐ │
   │ │ 2. FOR each active group member (except requester):     │ │
   │ │    INSERT INTO care_responses                           │ │
   │ │    - status = 'pending'                                 │ │
   │ │    - response_type = 'pending'                         │ │
   │ │    - Prevents duplicates with NOT EXISTS check         │ │
   │ └─────────────────────────────────────────────────────────┘ │
   └─────────────────────────────────────────────────────────────┘
             │
             ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ CALL: supabase.rpc('send_care_request_notifications', {...})  │
   └─────────────────────────────────────────────────────────────┘
             │
             ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ DATABASE FUNCTION: send_care_request_notifications          │
   │ ┌─────────────────────────────────────────────────────────┐ │
   │ │ 1. Get care request details from care_requests          │ │
   │ │ 2. Get requester name from profiles                      │ │
   │ │ 3. Get group name from groups                           │ │
   │ │ 4. Log notification (RAISE NOTICE)                     │ │
   │ │ 5. Return TRUE                                          │ │
   │ └─────────────────────────────────────────────────────────┘ │
   └─────────────────────────────────────────────────────────────┘
             │
             ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ Frontend shows success message:                            │
   │ "Care request created successfully! Messages sent to      │
   │  group members."                                           │
   └─────────────────────────────────────────────────────────────┘
             │
             ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ OTHER GROUP MEMBERS RECEIVE NOTIFICATIONS                 │
   │ (Currently logged, not stored in messages table)          │
   └─────────────────────────────────────────────────────────────┘
             │
             ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ RESPONSE WORKFLOW (When members respond):                  │
   │ ┌─────────────────────────────────────────────────────────┐ │
   │ │ 1. Member calls submit_reciprocal_care_response        │ │
   │ │    - Updates care_responses table                      │ │
   │ │    - Sets status to 'submitted'                       │ │
   │ │    - Returns response_id                               │ │
   │ └─────────────────────────────────────────────────────────┘ │
   │ ┌─────────────────────────────────────────────────────────┐ │
   │ │ 2. Requester calls accept_reciprocal_care_response     │ │
   │ │    - Updates response status to 'accepted'              │ │
   │ │    - Creates scheduled care blocks                     │ │
   │ │    - Updates original request status                   │ │
   │ └─────────────────────────────────────────────────────────┘ │
   └─────────────────────────────────────────────────────────────┘
```

---

## Function Details

### 1. Frontend Function: `handleCreateNewRequest()`

**Location**: `app/calendar/page.tsx:891-937`  
**Type**: TypeScript/React function  
**Purpose**: Handles the UI interaction and calls the database function

#### Parameters
- `newRequestData` (object containing):
  - `type`: 'care' | 'event'
  - `group_id`: UUID
  - `date`: Date
  - `start_time`: Time
  - `end_time`: Time
  - `child_id`: UUID
  - `notes`: string

#### Process
1. Validates times
2. Enhances notes with next-day care information if needed
3. Calls `create_reciprocal_care_request` RPC
4. Calls `send_care_request_notifications` RPC
5. Shows success/error messages

#### Code Example
```typescript
const { data, error } = await supabase.rpc('create_reciprocal_care_request', {
  requester_id: user.id,
  group_id: newRequestData.group_id,
  requested_date: newRequestData.date,
  start_time: newRequestData.start_time,
  end_time: dbEndTime,
  child_id: newRequestData.child_id,
  notes: enhancedNotes || null
});

if (data) {
  await supabase.rpc('send_care_request_notifications', {
    p_care_request_id: data
  });
}
```

---

### 2. Database Function: `create_reciprocal_care_request`

**Location**: `supabase/supabase/migrations/20250115000008_fix_reciprocal_care_request_duplication.sql`  
**Type**: PostgreSQL function  
**Security**: SECURITY DEFINER  
**Language**: plpgsql

#### Function Signature
```sql
CREATE OR REPLACE FUNCTION create_reciprocal_care_request(
    requester_id UUID,
    group_id UUID,
    requested_date DATE,
    start_time TIME,
    end_time TIME,
    child_id UUID,
    notes TEXT DEFAULT NULL
)
RETURNS UUID
```

#### Parameters
- `requester_id`: UUID - ID of the user creating the request
- `group_id`: UUID - ID of the group
- `requested_date`: DATE - Date for the care request
- `start_time`: TIME - Start time for care
- `end_time`: TIME - End time for care
- `child_id`: UUID - ID of the child needing care
- `notes`: TEXT (optional) - Additional notes

#### Returns
- **UUID** - The ID of the created care request

#### Process
1. **Logs creation details** with RAISE NOTICE
2. **Inserts care request** into `care_requests` table:
   ```sql
   INSERT INTO care_requests (
       group_id, requester_id, child_id, requested_date, 
       start_time, end_time, notes, request_type, status, is_reciprocal
   ) VALUES (
       group_id, requester_id, child_id, requested_date, 
       start_time, end_time, notes, 'reciprocal', 'pending', true
   ) RETURNING id INTO care_request_id;
   ```
3. **Creates placeholder responses** for all active group members:
   ```sql
   FOR group_member IN 
       SELECT DISTINCT gm.profile_id
       FROM group_members gm
       JOIN child_group_members cgm ON gm.profile_id = cgm.parent_id
       WHERE gm.group_id = create_reciprocal_care_request.group_id
       AND gm.status = 'active'
       AND cgm.active = true
       AND gm.profile_id != requester_id
       AND NOT EXISTS (
           SELECT 1 FROM care_responses cr 
           WHERE cr.request_id = care_request_id 
           AND cr.responder_id = gm.profile_id
       )
   ```
4. **Inserts response records**:
   ```sql
   INSERT INTO care_responses (
       request_id, responder_id, response_type, status, created_at
   ) VALUES (
       care_request_id, group_member.profile_id, 'pending', 'pending', NOW()
   );
   ```
5. **Returns** the `care_request_id`

---

### 3. Database Function: `send_care_request_notifications`

**Location**: `supabase/supabase/migrations/20250115000012_add_notification_functions.sql`  
**Type**: PostgreSQL function  
**Security**: SECURITY DEFINER  
**Language**: plpgsql

#### Function Signature
```sql
CREATE OR REPLACE FUNCTION send_care_request_notifications(p_care_request_id UUID)
RETURNS BOOLEAN
```

#### Parameters
- `p_care_request_id`: UUID - ID of the care request to notify about

#### Returns
- **BOOLEAN** - TRUE on success

#### Process
1. **Retrieves request details**:
   ```sql
   SELECT group_id, requester_id, requested_date, start_time, end_time
   INTO v_group_id, v_requester_id, v_requested_date, v_start_time, v_end_time
   FROM care_requests WHERE id = p_care_request_id;
   ```
2. **Gets requester name**:
   ```sql
   SELECT full_name INTO v_requester_name
   FROM profiles WHERE id = v_requester_id;
   ```
3. **Gets group name**:
   ```sql
   SELECT name INTO v_group_name
   FROM groups WHERE id = v_group_id;
   ```
4. **Logs notification**:
   ```sql
   RAISE NOTICE 'NOTIFICATION: Care request from % for % on % from % to %', 
       v_requester_name, v_group_name, v_requested_date, v_start_time, v_end_time;
   ```
5. **Returns** TRUE

**Note**: Currently only logs notifications. TODO: Implement actual message storage.

---

### 4. Response Functions

#### `submit_reciprocal_care_response`
**Function Signature**:
```sql
CREATE OR REPLACE FUNCTION submit_reciprocal_care_response(
    care_request_id UUID,
    responding_parent_id UUID,
    reciprocal_date DATE,
    reciprocal_start_time TIME,
    reciprocal_end_time TIME,
    reciprocal_child_id UUID,
    notes TEXT DEFAULT NULL
)
RETURNS UUID
```

**Purpose**: Allows a parent to submit their reciprocal care response  
**Returns**: UUID of the created/updated response

#### `accept_reciprocal_care_response`
**Function Signature**:
```sql
CREATE OR REPLACE FUNCTION accept_reciprocal_care_response(p_care_response_id UUID)
RETURNS BOOLEAN
```

**Purpose**: Allows the requester to accept a reciprocal care response  
**Returns**: BOOLEAN indicating success/failure

---

## Database Tables Involved

### `care_requests`
- Stores the main care request information
- Key fields: `id`, `group_id`, `requester_id`, `child_id`, `requested_date`, `start_time`, `end_time`, `request_type`, `status`, `is_reciprocal`

### `care_responses`
- Stores responses from group members
- Key fields: `id`, `request_id`, `responder_id`, `status`, `response_type`, `created_at`

### `group_members`
- Stores group membership information
- Key fields: `group_id`, `profile_id`, `status`

### `profiles`
- Stores user profile information
- Key fields: `id`, `full_name`

### `groups`
- Stores group information
- Key fields: `id`, `name`

---

## Key Features

### Duplicate Prevention
The system includes several mechanisms to prevent duplicate responses:
- `NOT EXISTS` checks before creating responses
- `DISTINCT` selection of group members
- Validation that responding parent is in the same group

### Status Management
- **Request Status**: `pending` → `confirmed` (when accepted)
- **Response Status**: `pending` → `submitted` → `accepted`
- **Response Type**: `pending` → `reciprocal`

### Error Handling
- Validates that care request exists
- Validates that responding parent is in the group
- Provides detailed logging for debugging
- Returns appropriate error messages

---

## Current Limitations

1. **Notifications**: Currently only logged, not stored in messages table
2. **Real-time Updates**: No real-time notification system implemented
3. **Message Storage**: TODO items in code indicate need for proper message storage

---

## Future Enhancements

1. **Message Storage**: Implement proper message storage in database
2. **Real-time Notifications**: Add WebSocket or similar for real-time updates
3. **Email Notifications**: Send email notifications to group members
4. **Push Notifications**: Mobile push notifications for immediate alerts
5. **Response Tracking**: Better tracking of response status and history

---

## Troubleshooting

### Common Issues
1. **Duplicate Responses**: Check for existing responses before creating new ones
2. **Missing Group Members**: Verify group membership and active status
3. **Function Signature Mismatches**: Ensure frontend calls match database function signatures
4. **Permission Issues**: Verify SECURITY DEFINER permissions are properly set

### Debug Information
The functions include extensive logging with `RAISE NOTICE` statements to help with debugging:
- Request creation details
- Group member selection
- Response creation status
- Notification details

---

*This document was generated from the SitterAp codebase analysis and provides a comprehensive guide to the reciprocal care request workflow.*
