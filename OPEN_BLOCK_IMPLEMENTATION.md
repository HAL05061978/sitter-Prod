# Open Block Implementation for Sitter Application

## Overview

The Open Block functionality allows Parent B (who accepted a reciprocal request) to open their care providing block to other parents in the group (excluding Parent A). This creates a first-come-first-serve booking system where other parents can request to join the care block.

## Workflow

### 1. Reciprocal Request Completion
- Parent A sends a reciprocal care request
- Parent B responds with reciprocal care times
- Parent A accepts Parent B's response
- Both care blocks are scheduled in the calendar

### 2. Open Block Creation
- Parent B double-clicks on their care providing block in the calendar
- System shows confirmation dialog asking if they want to open the block
- Parent B selects other parents to invite (excluding Parent A)
- Parent B specifies care times they need for each selected parent
- System creates open block requests for each selected parent

### 3. Open Block Response
- Other parents see the open block requests in their request list
- They can accept the open block request (simple accept, no reciprocal times needed)
- When accepted, two care blocks are created:
  - Parent B provides care for Parent C's child (reciprocal time)
  - Parent C provides care for Parent B's child (original time)

## Database Schema

### Care Requests Table
```sql
CREATE TABLE public.care_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id),
    requester_id UUID NOT NULL REFERENCES public.profiles(id),
    child_id UUID NOT NULL REFERENCES public.children(id),
    requested_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL,
    notes TEXT,
    request_type TEXT NOT NULL CHECK (request_type IN ('simple', 'reciprocal', 'event', 'open_block')),
    status TEXT NOT NULL DEFAULT 'pending',
    responder_id UUID REFERENCES public.profiles(id),
    response_notes TEXT,
    
    -- Open block specific fields
    open_block_slots INTEGER DEFAULT 1,
    open_block_slots_used INTEGER DEFAULT 0,
    open_block_parent_id UUID REFERENCES public.profiles(id),
    
    -- Reciprocal fields (used for open block)
    reciprocal_parent_id UUID REFERENCES public.profiles(id),
    reciprocal_child_id UUID REFERENCES public.children(id),
    reciprocal_date DATE,
    reciprocal_start_time TIME,
    reciprocal_end_time TIME,
    reciprocal_status TEXT DEFAULT 'pending',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

### Care Responses Table
```sql
CREATE TABLE public.care_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.care_requests(id),
    responder_id UUID NOT NULL REFERENCES public.profiles(id),
    response_type TEXT NOT NULL CHECK (response_type IN ('accept', 'decline', 'pending')),
    status TEXT NOT NULL DEFAULT 'pending',
    response_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(request_id, responder_id)
);
```

### Scheduled Care Table
```sql
CREATE TABLE public.scheduled_care (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id),
    parent_id UUID NOT NULL REFERENCES public.profiles(id),
    child_id UUID NOT NULL REFERENCES public.children(id),
    care_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL,
    care_type TEXT NOT NULL CHECK (care_type IN ('needed', 'provided', 'event')),
    status TEXT NOT NULL DEFAULT 'confirmed',
    related_request_id UUID REFERENCES public.care_requests(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

## Implementation Details

### Frontend Components

#### 1. Open Block Modal (`showOpenBlockModal`)
- Displays the care block details that Parent B is opening
- Shows list of available parents (excluding Parent A and Parent B)
- Dynamic form for each selected parent to specify care times
- Allows Parent B to specify dates, times, and children for each parent

#### 2. Request Display
- Open block requests are displayed with special styling
- Shows clear explanation of what happens when accepted
- Displays both the original care block and the reciprocal care times

#### 3. Response Handling
- Open block requests use simple accept/decline responses
- No reciprocal times needed from responders
- First-come-first-serve booking system

### Backend Functions

#### 1. `handleOpenBlockSubmit()`
- Creates open block requests for each selected parent
- Stores original care block information in reciprocal fields
- Links the open block to the original reciprocal request

#### 2. `acceptResponse()` - Open Block Branch
- Creates two care blocks when open block is accepted:
  - Parent B provides care for Parent C's child (reciprocal time)
  - Parent C provides care for Parent B's child (original time)
- Updates response status and open block slots used

#### 3. `respondToCareRequest()` - Open Block Branch
- Creates simple accept response for open block requests
- No reciprocal times needed from responder

## Usage Instructions

### For Parent B (Opening the Block)

1. **Complete a Reciprocal Request**: First, complete a reciprocal care exchange with Parent A
2. **Find Your Care Block**: Look for your care providing block in the calendar
3. **Double-Click the Block**: Double-click on your care providing block
4. **Confirm Opening**: Click "Yes" when asked if you want to open the block
5. **Select Parents**: Choose which other parents to invite (excluding Parent A)
6. **Specify Care Times**: For each selected parent, specify:
   - Date when you need care
   - Start and end times
   - Which child needs care
7. **Send Invitations**: Click "Send Invitations" to create the open block requests

### For Other Parents (Responding to Open Block)

1. **View Requests**: Check the "Care Requests" section
2. **Find Open Block**: Look for requests marked as "Open Block Invitation"
3. **Review Details**: Read the explanation of what happens when you accept
4. **Accept Request**: Click "Agree" to accept the open block request
5. **Confirmation**: Both care blocks will be created automatically

## Key Features

### 1. First-Come-First-Serve
- Only one parent can accept each open block request
- Once accepted, the request is no longer available to others

### 2. Clear Communication
- Open block requests clearly explain what happens when accepted
- Shows both the original care block and the reciprocal care times

### 3. Automatic Block Creation
- When accepted, two care blocks are created automatically
- No manual scheduling required

### 4. Exclusion Logic
- Parent A (original requester) is automatically excluded from open block invitations
- Only other group members can be invited

## Error Handling

### 1. Validation
- Ensures all required fields are filled
- Validates time ranges (end time after start time)
- Checks that selected parents have children in the group

### 2. Database Constraints
- Unique constraint on request_id + responder_id prevents duplicate responses
- Foreign key constraints ensure data integrity
- Check constraints validate request types and statuses

### 3. User Feedback
- Clear error messages for validation failures
- Success confirmations for completed actions
- Loading states during database operations

## Future Enhancements

### 1. Multiple Slots
- Allow Parent B to specify multiple care slots
- Each slot can be accepted by a different parent

### 2. Time Conflicts
- Check for time conflicts when creating open block requests
- Warn users about overlapping care times

### 3. Notifications
- Send email/push notifications for open block invitations
- Notify when open block requests are accepted

### 4. Analytics
- Track open block usage statistics
- Monitor success rates of open block invitations

## Testing

### Manual Testing Steps

1. **Create Reciprocal Request**
   - Parent A creates a reciprocal request
   - Parent B responds with reciprocal times
   - Parent A accepts the response

2. **Open Block Creation**
   - Parent B double-clicks their care block
   - Selects other parents to invite
   - Specifies care times for each parent
   - Sends invitations

3. **Open Block Response**
   - Other parents see the open block requests
   - Accept the requests
   - Verify that care blocks are created

4. **Calendar Display**
   - Check that all care blocks appear correctly in the calendar
   - Verify the correct parent-child relationships

### Database Testing

1. **Schema Validation**
   - Run the `open_block_schema.sql` file
   - Verify all tables and constraints are created

2. **Data Integrity**
   - Create test open block requests
   - Verify foreign key relationships
   - Test unique constraints

3. **RLS Policies**
   - Test that users can only see requests in their groups
   - Verify that users can only create responses for requests in their groups

## Files Modified

1. **`app/schedule/page.tsx`**
   - Added open block modal and form state
   - Updated `handleBlockDoubleClick()` for open block detection
   - Added `handleOpenBlockSubmit()` function
   - Updated `acceptResponse()` for open block handling
   - Added UI components for open block display

2. **`open_block_schema.sql`**
   - Complete database schema for open block functionality
   - RLS policies for security
   - Indexes for performance

3. **`OPEN_BLOCK_IMPLEMENTATION.md`**
   - This documentation file

## Conclusion

The Open Block functionality provides a powerful way for parents to extend their care arrangements to other group members. It maintains the reciprocal nature of care exchanges while allowing for flexible, first-come-first-serve booking. The implementation is secure, user-friendly, and integrates seamlessly with the existing care request system. 