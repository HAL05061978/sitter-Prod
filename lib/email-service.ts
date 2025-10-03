import { createClient } from '@supabase/supabase-js'

// Email service for handling external notifications
export class EmailService {
  private supabase: any
  private isProduction: boolean

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    this.isProduction = process.env.NODE_ENV === 'production'
  }

  /**
   * Send group invitation email to external users
   */
  async sendGroupInviteEmail({
    to,
    groupName,
    senderName,
    customNote,
    inviteId,
    appUrl
  }: {
    to: string
    groupName: string
    senderName: string
    customNote?: string
    inviteId: string
    appUrl: string
  }): Promise<{ success: boolean; error?: string }> {
    try {
      // In development, just log the email
      if (!this.isProduction) {
        console.log('📧 GROUP INVITE EMAIL (Development Mode):')
        console.log(`To: ${to}`)
        console.log(`Subject: Group Invitation: ${groupName}`)
        console.log(`From: ${senderName}`)
        console.log(`Signup Link: ${appUrl}/signup?invite=${inviteId}`)
        console.log(`Custom Note: ${customNote || 'None'}`)
        return { success: true }
      }

      // In production, use Supabase Edge Function for email sending
      const { data, error } = await this.supabase.functions.invoke('send-group-invite', {
        body: {
          to,
          groupName,
          senderName,
          customNote,
          inviteId,
          appUrl
        }
      })

      if (error) {
        console.error('Email sending error:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('Email service error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Send account confirmation email
   */
  async sendConfirmationEmail({
    to,
    userName,
    confirmationLink,
    appUrl
  }: {
    to: string
    userName: string
    confirmationLink: string
    appUrl: string
  }): Promise<{ success: boolean; error?: string }> {
    try {
      // In development, just log the email
      if (!this.isProduction) {
        console.log('📧 CONFIRMATION EMAIL (Development Mode):')
        console.log(`To: ${to}`)
        console.log(`Subject: Welcome to Care-N-Care - Confirm Your Account`)
        console.log(`Confirmation Link: ${confirmationLink}`)
        return { success: true }
      }

      // In production, use Supabase Edge Function
      const { data, error } = await this.supabase.functions.invoke('send-confirmation', {
        body: {
          to,
          userName,
          confirmationLink,
          appUrl
        }
      })

      if (error) {
        console.error('Confirmation email error:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('Confirmation email service error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Send welcome email after successful signup
   */
  async sendWelcomeEmail({
    to,
    userName,
    appUrl
  }: {
    to: string
    userName: string
    appUrl: string
  }): Promise<{ success: boolean; error?: string }> {
    try {
      // In development, just log the email
      if (!this.isProduction) {
        console.log('📧 WELCOME EMAIL (Development Mode):')
        console.log(`To: ${to}`)
        console.log(`Subject: Welcome to Care-N-Care!`)
        console.log(`App URL: ${appUrl}`)
        return { success: true }
      }

      // In production, use Supabase Edge Function
      const { data, error } = await this.supabase.functions.invoke('send-welcome', {
        body: {
          to,
          userName,
          appUrl
        }
      })

      if (error) {
        console.error('Welcome email error:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('Welcome email service error:', error)
      return { success: false, error: error.message }
    }
  }
}

// Export singleton instance
export const emailService = new EmailService()
