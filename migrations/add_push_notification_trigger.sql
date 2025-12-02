-- Migration: Add push notification trigger
-- Run this in your Supabase SQL Editor AFTER deploying the send-push-notification edge function

-- Function to send push notification via Edge Function
CREATE OR REPLACE FUNCTION send_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  notification_title TEXT;
  notification_body TEXT;
  notification_data JSONB;
BEGIN
  -- Determine notification title and body based on type
  CASE NEW.type
    WHEN 'care_request' THEN
      notification_title := 'New Care Request';
      notification_body := COALESCE(NEW.data->>'requester_name', 'Someone') || ' sent you a care request';
    WHEN 'care_accepted' THEN
      notification_title := 'Care Request Accepted';
      notification_body := 'Your care request has been accepted!';
    WHEN 'care_declined' THEN
      notification_title := 'Care Request Update';
      notification_body := 'A provider couldn''t accept your care request';
    WHEN 'reschedule_request' THEN
      notification_title := 'Reschedule Request';
      notification_body := COALESCE(NEW.data->>'requester_name', 'Someone') || ' wants to reschedule';
    WHEN 'reschedule_accepted' THEN
      notification_title := 'Reschedule Accepted';
      notification_body := 'Your reschedule request was accepted';
    WHEN 'reschedule_declined' THEN
      notification_title := 'Reschedule Declined';
      notification_body := 'Your reschedule request was declined';
    WHEN 'open_block_invitation' THEN
      notification_title := 'New Care Offer';
      notification_body := COALESCE(NEW.data->>'sender_name', 'Someone') || ' is offering care time';
    WHEN 'hangout_invitation' THEN
      notification_title := 'Hangout Invitation';
      notification_body := COALESCE(NEW.data->>'sender_name', 'Someone') || ' invited your child for a hangout';
    WHEN 'hangout_accepted' THEN
      notification_title := 'Hangout Accepted';
      notification_body := 'Your hangout invitation was accepted!';
    WHEN 'message' THEN
      notification_title := 'New Message';
      notification_body := COALESCE(NEW.data->>'sender_name', 'Someone') || ' sent you a message';
    ELSE
      notification_title := 'SitterApp';
      notification_body := 'You have a new notification';
  END CASE;

  -- Prepare notification data
  notification_data := jsonb_build_object(
    'type', NEW.type,
    'notification_id', NEW.id,
    'data', NEW.data
  );

  -- Call the Edge Function to send push notification
  -- Note: This uses pg_net extension for async HTTP calls
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', notification_title,
      'body', notification_body,
      'data', notification_data
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail the insert if push notification fails
    RAISE WARNING 'Failed to send push notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on notifications table
DROP TRIGGER IF EXISTS trigger_send_push_notification ON notifications;
CREATE TRIGGER trigger_send_push_notification
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_push_notification();

-- Note: You also need to enable the pg_net extension and set the app settings
-- Run these commands as a superuser:
--
-- CREATE EXTENSION IF NOT EXISTS pg_net;
--
-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
-- ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';
