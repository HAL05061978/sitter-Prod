import { createClient } from '@supabase/supabase-js'

// Notification service for handling internal and external notifications
export class NotificationService {
  private supabase: any

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  /**
   * Send internal notification (for existing users)
   */
  async sendInternalNotification({
    userId,
    type,
    title,
    message,
    data = {},
    priority = 'medium'
  }: {
    userId: string
    type: 'group_invite' | 'care_request' | 'care_response' | 'reschedule' | 'message'
    title: string
    message: string
    data?: Record<string, any>
    priority?: 'low' | 'medium' | 'high'
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type,
          title,
          message,
          data,
          priority,
          status: 'unread',
          created_at: new Date().toISOString()
        })

      if (error) {
        console.error('Internal notification error:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('Internal notification service error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Send push notification (for mobile apps)
   */
  async sendPushNotification({
    userId,
    title,
    body,
    data = {}
  }: {
    userId: string
    title: string
    body: string
    data?: Record<string, any>
  }): Promise<{ success: boolean; error?: string }> {
    try {
      // Get user's push tokens
      const { data: tokens, error: tokenError } = await this.supabase
        .from('push_tokens')
        .select('token, platform')
        .eq('user_id', userId)
        .eq('active', true)

      if (tokenError) {
        console.error('Push token error:', tokenError)
        return { success: false, error: tokenError.message }
      }

      if (!tokens || tokens.length === 0) {
        console.log('No push tokens found for user:', userId)
        return { success: true } // Not an error, just no tokens
      }

      // Send push notification via Supabase Edge Function
      const { data: result, error } = await this.supabase.functions.invoke('send-push-notification', {
        body: {
          tokens,
          title,
          body,
          data
        }
      })

      if (error) {
        console.error('Push notification error:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('Push notification service error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Send email notification (for external users or important updates)
   */
  async sendEmailNotification({
    to,
    type,
    subject,
    templateData
  }: {
    to: string
    type: 'group_invite' | 'care_request' | 'care_response' | 'reschedule' | 'welcome' | 'confirmation'
    subject: string
    templateData: Record<string, any>
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await this.supabase.functions.invoke('send-email-notification', {
        body: {
          to,
          type,
          subject,
          templateData
        }
      })

      if (error) {
        console.error('Email notification error:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('Email notification service error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .update({ 
          status: 'read',
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId)

      if (error) {
        console.error('Mark as read error:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('Mark as read service error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(
    userId: string, 
    limit = 50, 
    offset = 0
  ): Promise<{ data: any[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        console.error('Get notifications error:', error)
        return { data: [], error: error.message }
      }

      return { data: data || [] }
    } catch (error: any) {
      console.error('Get notifications service error:', error)
      return { data: [], error: error.message }
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<{ count: number; error?: string }> {
    try {
      const { count, error } = await this.supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'unread')

      if (error) {
        console.error('Get unread count error:', error)
        return { count: 0, error: error.message }
      }

      return { count: count || 0 }
    } catch (error: any) {
      console.error('Get unread count service error:', error)
      return { count: 0, error: error.message }
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService()
