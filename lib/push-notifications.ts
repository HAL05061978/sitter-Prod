// Push Notifications Service for Capacitor iOS/Android

import { Capacitor } from '@capacitor/core'
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications'
import { LocalNotifications } from '@capacitor/local-notifications'

export interface NotificationSettings {
  pushEnabled: boolean
  badgeEnabled: boolean
  soundEnabled: boolean
  messagesEnabled: boolean
  careRequestsEnabled: boolean
  remindersEnabled: boolean
}

const SETTINGS_KEY = 'sitter_notification_settings'

// Default notification settings
const defaultSettings: NotificationSettings = {
  pushEnabled: true,
  badgeEnabled: true,
  soundEnabled: true,
  messagesEnabled: true,
  careRequestsEnabled: true,
  remindersEnabled: true
}

export const pushNotificationService = {
  // Check if we're on a native platform
  isNative(): boolean {
    return Capacitor.isNativePlatform()
  },

  // Get notification settings from storage
  getSettings(): NotificationSettings {
    if (typeof window === 'undefined') return defaultSettings
    try {
      const stored = localStorage.getItem(SETTINGS_KEY)
      return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings
    } catch {
      return defaultSettings
    }
  },

  // Save notification settings
  saveSettings(settings: Partial<NotificationSettings>): void {
    if (typeof window === 'undefined') return
    try {
      const currentSettings = this.getSettings()
      const newSettings = { ...currentSettings, ...settings }
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings))
    } catch (error) {
      console.error('Error saving notification settings:', error)
    }
  },

  // Request push notification permissions
  async requestPermissions(): Promise<boolean> {
    if (!this.isNative()) {
      console.log('Push notifications only available on native platforms')
      return false
    }

    try {
      const permission = await PushNotifications.requestPermissions()
      if (permission.receive === 'granted') {
        await PushNotifications.register()
        return true
      }
      return false
    } catch (error) {
      console.error('Error requesting push permissions:', error)
      return false
    }
  },

  // Check current permission status
  async checkPermissions(): Promise<'granted' | 'denied' | 'prompt'> {
    if (!this.isNative()) return 'denied'

    try {
      const status = await PushNotifications.checkPermissions()
      return status.receive
    } catch (error) {
      console.error('Error checking push permissions:', error)
      return 'denied'
    }
  },

  // Initialize push notification listeners
  initializeListeners(
    onTokenReceived: (token: string) => void,
    onNotificationReceived: (notification: PushNotificationSchema) => void,
    onNotificationTapped: (notification: ActionPerformed) => void
  ): void {
    if (!this.isNative()) return

    // On registration success - save the token
    PushNotifications.addListener('registration', (token: Token) => {
      console.log('Push registration success, token:', token.value)
      onTokenReceived(token.value)
    })

    // On registration error
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Push registration error:', error)
    })

    // On notification received while app is in foreground
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('Push notification received:', notification)
      onNotificationReceived(notification)
    })

    // On notification tapped
    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('Push notification action performed:', action)
      onNotificationTapped(action)
    })
  },

  // Remove all listeners
  removeListeners(): void {
    if (!this.isNative()) return
    PushNotifications.removeAllListeners()
  },

  // Set the app badge number
  async setBadge(count: number): Promise<void> {
    if (!this.isNative()) return

    try {
      // iOS uses Local Notifications to set badge
      if (Capacitor.getPlatform() === 'ios') {
        // Request permissions first if needed
        const permStatus = await LocalNotifications.checkPermissions()
        if (permStatus.display !== 'granted') {
          await LocalNotifications.requestPermissions()
        }

        // Set badge using Local Notifications
        // Note: On iOS, we need to schedule a notification with a badge
        // or use a native bridge. For now, we'll store it for later use.
        await this.storeBadgeCount(count)
      }
    } catch (error) {
      console.error('Error setting badge:', error)
    }
  },

  // Store badge count locally
  async storeBadgeCount(count: number): Promise<void> {
    if (typeof window === 'undefined') return
    localStorage.setItem('sitter_badge_count', count.toString())
  },

  // Get stored badge count
  getBadgeCount(): number {
    if (typeof window === 'undefined') return 0
    const stored = localStorage.getItem('sitter_badge_count')
    return stored ? parseInt(stored, 10) : 0
  },

  // Clear badge
  async clearBadge(): Promise<void> {
    await this.setBadge(0)
  },

  // Show a local notification (for in-app notifications)
  async showLocalNotification(
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<void> {
    if (!this.isNative()) return

    try {
      const permStatus = await LocalNotifications.checkPermissions()
      if (permStatus.display !== 'granted') {
        const request = await LocalNotifications.requestPermissions()
        if (request.display !== 'granted') return
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title,
            body,
            schedule: { at: new Date(Date.now() + 100) }, // Show almost immediately
            extra: data
          }
        ]
      })
    } catch (error) {
      console.error('Error showing local notification:', error)
    }
  }
}
