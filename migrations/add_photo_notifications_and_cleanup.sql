-- =====================================================
-- PHOTO NOTIFICATIONS AND AUTOMATIC CLEANUP
-- =====================================================
-- 1. Notify receiving parents when photos are uploaded
-- 2. Automatically delete photos 3 days after care date

-- =====================================================
-- PART 1: NOTIFICATION FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION notify_photo_upload(
    p_scheduled_care_id UUID,
    p_uploader_id UUID,
    p_photo_count INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_care_record RECORD;
    v_care_date DATE;
    v_uploader_name TEXT;
    v_notification_message TEXT;
    v_receiving_parent_id UUID;
BEGIN
    -- Get care block details
    SELECT
        sc.care_date,
        sc.care_type,
        sc.related_request_id,
        sc.group_id,
        sc.start_time,
        sc.end_time,
        p.full_name as uploader_name
    INTO v_care_record
    FROM scheduled_care sc
    JOIN profiles p ON sc.parent_id = p.id
    WHERE sc.id = p_scheduled_care_id;

    v_care_date := v_care_record.care_date;
    v_uploader_name := v_care_record.uploader_name;

    -- Create notification message
    v_notification_message := format(
        '%s uploaded %s photo%s. Photos will be automatically deleted 3 days after the care date (%s).',
        v_uploader_name,
        p_photo_count,
        CASE WHEN p_photo_count > 1 THEN 's' ELSE '' END,
        to_char(v_care_date + INTERVAL '3 days', 'Mon DD, YYYY')
    );

    -- Notify based on care type
    IF v_care_record.care_type = 'provided' THEN
        -- For providing care, notify the receiving parent
        SELECT sc_receiver.parent_id INTO v_receiving_parent_id
        FROM scheduled_care sc_receiver
        WHERE sc_receiver.group_id = v_care_record.group_id
        AND sc_receiver.care_date = v_care_record.care_date
        AND sc_receiver.start_time = v_care_record.start_time
        AND sc_receiver.end_time = v_care_record.end_time
        AND sc_receiver.care_type = 'needed'
        AND sc_receiver.related_request_id = v_care_record.related_request_id
        AND sc_receiver.parent_id != p_uploader_id
        LIMIT 1;

        IF v_receiving_parent_id IS NOT NULL THEN
            INSERT INTO notifications (user_id, message, type, related_care_id, created_at)
            VALUES (
                v_receiving_parent_id,
                v_notification_message,
                'photo_upload',
                p_scheduled_care_id,
                NOW()
            );
        END IF;

    ELSIF v_care_record.care_type IN ('hangout', 'sleepover') THEN
        -- For hangout/sleepover, notify all attendees except the host
        INSERT INTO notifications (user_id, message, type, related_care_id, created_at)
        SELECT DISTINCT
            sc_attendee.parent_id,
            v_notification_message,
            'photo_upload',
            p_scheduled_care_id,
            NOW()
        FROM scheduled_care sc_attendee
        WHERE sc_attendee.group_id = v_care_record.group_id
        AND sc_attendee.care_date = v_care_record.care_date
        AND sc_attendee.start_time = v_care_record.start_time
        AND sc_attendee.end_time = v_care_record.end_time
        AND sc_attendee.care_type = v_care_record.care_type
        AND sc_attendee.related_request_id = v_care_record.related_request_id
        AND sc_attendee.parent_id != p_uploader_id;  -- Exclude the uploader
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION notify_photo_upload(UUID, UUID, INTEGER) TO authenticated;

COMMENT ON FUNCTION notify_photo_upload IS 'Notifies receiving parents/attendees when photos are uploaded. Includes 3-day deletion warning.';

-- =====================================================
-- PART 2: AUTOMATIC PHOTO CLEANUP
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_old_photos()
RETURNS TABLE (
    deleted_count INTEGER,
    storage_freed_mb NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cutoff_date DATE;
    v_deleted_files INTEGER := 0;
    v_care_block RECORD;
    v_photo_url TEXT;
    v_file_path TEXT;
BEGIN
    -- Calculate cutoff date (3 days ago)
    v_cutoff_date := CURRENT_DATE - INTERVAL '3 days';

    -- Find all care blocks older than 3 days with photos
    FOR v_care_block IN
        SELECT id, care_date, photo_urls
        FROM scheduled_care
        WHERE care_date <= v_cutoff_date
        AND photo_urls IS NOT NULL
        AND array_length(photo_urls, 1) > 0
    LOOP
        -- Delete each photo from storage
        FOREACH v_photo_url IN ARRAY v_care_block.photo_urls
        LOOP
            -- Extract file path from URL
            -- URL format: https://.../storage/v1/object/public/care-photos/{path}
            v_file_path := substring(v_photo_url from 'care-photos/(.+)$');

            IF v_file_path IS NOT NULL THEN
                -- Delete from Supabase Storage
                -- Note: This will be called via Edge Function that has storage access
                PERFORM storage.objects
                FROM storage.objects
                WHERE bucket_id = 'care-photos'
                AND name = v_file_path;

                v_deleted_files := v_deleted_files + 1;
            END IF;
        END LOOP;

        -- Clear photo_urls array in database
        UPDATE scheduled_care
        SET photo_urls = NULL
        WHERE id = v_care_block.id;
    END LOOP;

    -- Return summary
    RETURN QUERY SELECT
        v_deleted_files,
        (v_deleted_files * 0.3)::NUMERIC;  -- Estimate ~300KB per photo
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_old_photos() TO service_role;

COMMENT ON FUNCTION cleanup_old_photos IS 'Deletes photos from care blocks older than 3 days. Should be run daily via cron job.';

-- =====================================================
-- PART 3: HELPER FUNCTION TO GET PHOTO COUNT
-- =====================================================

CREATE OR REPLACE FUNCTION get_photo_count(p_photo_urls TEXT[])
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT COALESCE(array_length(p_photo_urls, 1), 0);
$$;

GRANT EXECUTE ON FUNCTION get_photo_count(TEXT[]) TO authenticated;

-- =====================================================
-- PART 4: CREATE NOTIFICATIONS TABLE IF NOT EXISTS
-- =====================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    type TEXT NOT NULL,  -- 'photo_upload', 'care_reminder', etc.
    related_care_id UUID REFERENCES scheduled_care(id) ON DELETE SET NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- RLS Policies for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
ON notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

COMMENT ON TABLE notifications IS 'Stores user notifications including photo upload alerts with 3-day deletion warning.';
