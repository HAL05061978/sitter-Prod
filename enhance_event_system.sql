-- Enhanced Event System - Simple Group Events with RSVP and Recurring Events
-- This migration creates a simple event system where all events are group events

-- ============================================================================
-- STEP 1: ADD EVENT-SPECIFIC FIELDS TO CARE_REQUESTS
-- ============================================================================

-- Add event-specific fields to care_requests table
ALTER TABLE public.care_requests 
ADD COLUMN IF NOT EXISTS event_rsvp_deadline TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS event_location TEXT,
ADD COLUMN IF NOT EXISTS event_is_editable BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS event_edit_deadline TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT CHECK (recurrence_pattern IN ('weekly', 'monthly', 'yearly')),
ADD COLUMN IF NOT EXISTS recurrence_end_date DATE,
ADD COLUMN IF NOT EXISTS parent_event_id UUID REFERENCES public.care_requests(id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 2: CREATE EVENT RESPONSES TABLE FOR RSVP SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_request_id UUID NOT NULL REFERENCES public.care_requests(id) ON DELETE CASCADE,
    responder_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    response_type TEXT NOT NULL CHECK (response_type IN ('going', 'maybe', 'not_going')),
    response_notes TEXT, -- Optional notes from responder
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Ensure user can only have one response per event (but can update it)
    UNIQUE(event_request_id, responder_id)
);

-- ============================================================================
-- STEP 3: CREATE EVENT NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_request_id UUID NOT NULL REFERENCES public.care_requests(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('event_created', 'event_updated', 'event_cancelled', 'rsvp_reminder')),
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- STEP 4: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Indexes for event_responses
CREATE INDEX IF NOT EXISTS idx_event_responses_event_request_id ON public.event_responses(event_request_id);
CREATE INDEX IF NOT EXISTS idx_event_responses_responder_id ON public.event_responses(responder_id);
CREATE INDEX IF NOT EXISTS idx_event_responses_response_type ON public.event_responses(response_type);

-- Indexes for event_notifications
CREATE INDEX IF NOT EXISTS idx_event_notifications_event_request_id ON public.event_notifications(event_request_id);
CREATE INDEX IF NOT EXISTS idx_event_notifications_recipient_id ON public.event_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_event_notifications_is_read ON public.event_notifications(is_read);

-- Indexes for enhanced care_requests
CREATE INDEX IF NOT EXISTS idx_care_requests_event_rsvp_deadline ON public.care_requests(event_rsvp_deadline);
CREATE INDEX IF NOT EXISTS idx_care_requests_is_recurring ON public.care_requests(is_recurring);
CREATE INDEX IF NOT EXISTS idx_care_requests_parent_event_id ON public.care_requests(parent_event_id);

-- ============================================================================
-- STEP 5: CREATE FUNCTIONS FOR EVENT MANAGEMENT
-- ============================================================================

-- Function to create event notifications for all group members
CREATE OR REPLACE FUNCTION notify_group_event_members(
    p_event_request_id UUID,
    p_notification_type TEXT,
    p_message TEXT
)
RETURNS VOID AS $$
DECLARE
    v_group_id UUID;
    v_member RECORD;
BEGIN
    -- Get the group ID for this event
    SELECT group_id INTO v_group_id 
    FROM care_requests 
    WHERE id = p_event_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event request not found';
    END IF;
    
    -- Create notifications for all group members
    FOR v_member IN 
        SELECT DISTINCT p.id as profile_id
        FROM group_members gm
        JOIN profiles p ON gm.profile_id = p.id
        WHERE gm.group_id = v_group_id
    LOOP
        INSERT INTO event_notifications (
            event_request_id,
            notification_type,
            recipient_id,
            message
        ) VALUES (
            p_event_request_id,
            p_notification_type,
            v_member.profile_id,
            p_message
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to update event response
CREATE OR REPLACE FUNCTION update_event_response(
    p_event_request_id UUID,
    p_responder_id UUID,
    p_response_type TEXT,
    p_response_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_response_id UUID;
BEGIN
    -- Validate response type
    IF p_response_type NOT IN ('going', 'maybe', 'not_going') THEN
        RAISE EXCEPTION 'Invalid response type. Must be going, maybe, or not_going';
    END IF;
    
    -- Try to insert new response, if conflict then update existing
    INSERT INTO event_responses (
        event_request_id,
        responder_id,
        response_type,
        response_notes
    ) VALUES (
        p_event_request_id,
        p_responder_id,
        p_response_type,
        p_response_notes
    )
    ON CONFLICT (event_request_id, responder_id)
    DO UPDATE SET
        response_type = EXCLUDED.response_type,
        response_notes = EXCLUDED.response_notes,
        updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_response_id;
    
    RETURN v_response_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can edit event
CREATE OR REPLACE FUNCTION can_edit_event(
    p_event_request_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_requester_id UUID;
    v_event_date DATE;
    v_edit_deadline TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get event details
    SELECT requester_id, requested_date, event_edit_deadline
    INTO v_requester_id, v_event_date, v_edit_deadline
    FROM care_requests
    WHERE id = p_event_request_id AND request_type = 'event';
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Only creator can edit
    IF v_requester_id != p_user_id THEN
        RETURN FALSE;
    END IF;
    
    -- Check if event is still editable
    IF v_edit_deadline IS NOT NULL AND timezone('utc'::text, now()) > v_edit_deadline THEN
        RETURN FALSE;
    END IF;
    
    -- Check if event date has passed
    IF v_event_date < CURRENT_DATE THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to create recurring events
CREATE OR REPLACE FUNCTION create_recurring_events(
    p_parent_event_id UUID,
    p_recurrence_pattern TEXT,
    p_recurrence_end_date DATE
)
RETURNS VOID AS $$
DECLARE
    v_parent_event RECORD;
    v_current_date DATE;
    v_new_event_id UUID;
BEGIN
    -- Get parent event details
    SELECT * INTO v_parent_event
    FROM care_requests
    WHERE id = p_parent_event_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Parent event not found';
    END IF;
    
    -- Set current date to next occurrence
    v_current_date := v_parent_event.requested_date;
    
    -- Create recurring events until end date
    WHILE v_current_date <= p_recurrence_end_date LOOP
        -- Calculate next occurrence based on pattern
        CASE p_recurrence_pattern
            WHEN 'weekly' THEN
                v_current_date := v_current_date + INTERVAL '1 week';
            WHEN 'monthly' THEN
                v_current_date := v_current_date + INTERVAL '1 month';
            WHEN 'yearly' THEN
                v_current_date := v_current_date + INTERVAL '1 year';
            ELSE
                RAISE EXCEPTION 'Invalid recurrence pattern';
        END CASE;
        
        -- Skip if we've passed the end date
        IF v_current_date > p_recurrence_end_date THEN
            EXIT;
        END IF;
        
        -- Create new event
        INSERT INTO care_requests (
            group_id,
            requester_id,
            child_id,
            requested_date,
            start_time,
            end_time,
            request_type,
            event_title,
            event_description,
            event_location,
            event_rsvp_deadline,
            event_edit_deadline,
            is_recurring,
            recurrence_pattern,
            recurrence_end_date,
            parent_event_id
        ) VALUES (
            v_parent_event.group_id,
            v_parent_event.requester_id,
            v_parent_event.child_id,
            v_current_date,
            v_parent_event.start_time,
            v_parent_event.end_time,
            'event',
            v_parent_event.event_title,
            v_parent_event.event_description,
            v_parent_event.event_location,
            v_parent_event.event_rsvp_deadline,
            v_parent_event.event_edit_deadline,
            true,
            p_recurrence_pattern,
            p_recurrence_end_date,
            p_parent_event_id
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to reset responses for recurring events after they pass
CREATE OR REPLACE FUNCTION reset_recurring_event_responses()
RETURNS VOID AS $$
DECLARE
    v_passed_event RECORD;
BEGIN
    -- Find events that have passed and are part of a recurring series
    FOR v_passed_event IN 
        SELECT DISTINCT er.event_request_id
        FROM event_responses er
        JOIN care_requests cr ON er.event_request_id = cr.id
        WHERE cr.requested_date < CURRENT_DATE 
        AND cr.is_recurring = true
    LOOP
        -- Delete responses for passed recurring events
        DELETE FROM event_responses 
        WHERE event_request_id = v_passed_event.event_request_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to create event blocks for all group members (bypasses RLS)
CREATE OR REPLACE FUNCTION create_event_blocks(
    p_group_id UUID,
    p_event_request_id UUID,
    p_child_id UUID,
    p_care_date DATE,
    p_start_time TIME,
    p_end_time TIME,
    p_event_title TEXT
)
RETURNS VOID AS $$
DECLARE
    v_member RECORD;
BEGIN
    -- Create scheduled care blocks for all group members
    FOR v_member IN 
        SELECT DISTINCT gm.profile_id
        FROM group_members gm
        WHERE gm.group_id = p_group_id
    LOOP
        INSERT INTO scheduled_care (
            group_id,
            parent_id,
            child_id,
            care_date,
            start_time,
            end_time,
            care_type,
            status,
            related_request_id,
            notes,
            event_title
        ) VALUES (
            p_group_id,
            v_member.profile_id,
            p_child_id,
            p_care_date,
            p_start_time,
            p_end_time,
            'event',
            'confirmed',
            p_event_request_id,
            'Event: ' || p_event_title,
            p_event_title
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 6: CREATE TRIGGERS FOR AUTOMATIC NOTIFICATIONS
-- ============================================================================

-- Trigger function to notify group members when event is created
CREATE OR REPLACE FUNCTION notify_event_created()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.request_type = 'event' THEN
        PERFORM notify_group_event_members(
            NEW.id,
            'event_created',
            'New event created: ' || COALESCE(NEW.event_title, 'Untitled Event')
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_notify_event_created ON public.care_requests;
CREATE TRIGGER trigger_notify_event_created
    AFTER INSERT ON public.care_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_event_created();

-- Trigger function to notify group members when event is updated
CREATE OR REPLACE FUNCTION notify_event_updated()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.request_type = 'event' AND 
       (OLD.event_title != NEW.event_title OR 
        OLD.event_description != NEW.event_description OR
        OLD.requested_date != NEW.requested_date OR
        OLD.start_time != NEW.start_time OR
        OLD.end_time != NEW.end_time OR
        OLD.event_location != NEW.event_location) THEN
        
        PERFORM notify_group_event_members(
            NEW.id,
            'event_updated',
            'Event updated: ' || COALESCE(NEW.event_title, 'Untitled Event')
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_notify_event_updated ON public.care_requests;
CREATE TRIGGER trigger_notify_event_updated
    AFTER UPDATE ON public.care_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_event_updated();

-- ============================================================================
-- STEP 7: ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.event_responses IS 'Stores RSVP responses for group events';
COMMENT ON TABLE public.event_notifications IS 'Stores notifications for event-related activities';
COMMENT ON FUNCTION notify_group_event_members IS 'Sends notifications to all group members for event activities';
COMMENT ON FUNCTION update_event_response IS 'Updates or creates an RSVP response for an event';
COMMENT ON FUNCTION can_edit_event IS 'Checks if a user has permission to edit an event';
COMMENT ON FUNCTION create_recurring_events IS 'Creates recurring events based on pattern and end date';
COMMENT ON FUNCTION reset_recurring_event_responses IS 'Resets responses for passed recurring events';
COMMENT ON FUNCTION create_event_blocks IS 'Creates scheduled care blocks for all group members for an event (bypasses RLS)'; 

-- Add group types to support different requirements for care vs events
ALTER TABLE public.groups ADD COLUMN group_type TEXT NOT NULL DEFAULT 'care' CHECK (group_type IN ('care', 'event'));

-- Add index for group_type
CREATE INDEX idx_groups_group_type ON public.groups(group_type);

-- Update existing groups to be 'care' type (default)
UPDATE public.groups SET group_type = 'care' WHERE group_type IS NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.groups.group_type IS 'Type of group: care (limited to network members) or event (can include external attendees)'; 