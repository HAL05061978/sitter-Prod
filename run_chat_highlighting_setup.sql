-- Run this script to set up message views tracking for chat highlighting
-- This will allow the chat notification badge to disappear when messages are viewed
-- AND highlight groups with unread messages

-- Create a table to track which messages have been viewed by each user
CREATE TABLE IF NOT EXISTS public.message_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, message_id)
);

-- Add RLS policies for message_views table
ALTER TABLE public.message_views ENABLE ROW LEVEL SECURITY;

-- Users can view their own message views
CREATE POLICY "Users can view their own message views" ON public.message_views
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own message views
CREATE POLICY "Users can insert their own message views" ON public.message_views
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own message views
CREATE POLICY "Users can update their own message views" ON public.message_views
    FOR UPDATE USING (auth.uid() = user_id);

-- Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_message_views_user_message ON public.message_views(user_id, message_id);

-- Verify the table was created
SELECT '=== MESSAGE_VIEWS TABLE CREATED FOR CHAT HIGHLIGHTING ===' as info;
SELECT COUNT(*) as message_views_count FROM message_views; 