# Care-N-Care Notification System

This document outlines the comprehensive notification system implemented for the Care-N-Care application, including both internal and external notifications.

## 🎯 Overview

The notification system supports:
- **Internal Notifications**: For existing users (in-app messages, push notifications)
- **External Notifications**: For new users (email invitations, confirmations)
- **Mobile Push Notifications**: For iOS/Android apps
- **Email Notifications**: For external users and important updates

## 🏗️ Architecture

### Components

1. **Email Service** (`lib/email-service.ts`)
   - Handles external email sending
   - Supports development and production modes
   - Integrates with Supabase Edge Functions

2. **Notification Service** (`lib/notification-service.ts`)
   - Manages internal notifications
   - Handles push notifications
   - Provides notification preferences

3. **Supabase Edge Functions**
   - `send-group-invite`: Sends group invitation emails
   - `send-confirmation`: Sends account confirmation emails
   - `send-welcome`: Sends welcome emails

4. **Database Tables**
   - `notifications`: Internal notifications
   - `push_tokens`: Mobile push notification tokens
   - `notification_preferences`: User notification settings

## 📧 Email System

### Development Mode
In development, emails are logged to the console instead of being sent.

### Production Mode
In production, emails are sent via Supabase Edge Functions using SMTP.

### Email Types

1. **Group Invitation Email**
   - Sent to external users when invited to a group
   - Contains signup link with invitation ID
   - Includes custom message from inviter

2. **Account Confirmation Email**
   - Sent after user creates account
   - Contains confirmation link
   - Expires in 24 hours

3. **Welcome Email**
   - Sent after account confirmation
   - Contains app features and getting started info

## 🔔 Internal Notifications

### Notification Types
- `group_invite`: Group invitation notifications
- `care_request`: Care request notifications
- `care_response`: Care response notifications
- `reschedule`: Reschedule notifications
- `message`: Direct message notifications
- `system`: System notifications

### Priority Levels
- `low`: Non-urgent notifications
- `medium`: Standard notifications (default)
- `high`: Urgent notifications

### Status States
- `unread`: New notification
- `read`: User has seen the notification
- `archived`: Old notification (auto-archived after 30 days)

## 📱 Mobile Push Notifications

### Supported Platforms
- iOS
- Android
- Web (Progressive Web App)

### Token Management
- Users can register multiple devices
- Tokens are stored securely in `push_tokens` table
- Inactive tokens are automatically cleaned up

## 🚀 Deployment

### Prerequisites
1. **Supabase Project**: Production project with Edge Functions enabled
2. **SMTP Service**: Configured SMTP provider (Resend, SendGrid, etc.)
3. **Vercel Account**: For hosting the application

### Setup Steps

1. **Configure Environment Variables**
   ```bash
   cp env.production.template .env.production
   # Update .env.production with your production values
   ```

2. **Deploy Database Migrations**
   ```bash
   supabase db push --project-ref YOUR_PROJECT_REF
   ```

3. **Deploy Edge Functions**
   ```bash
   supabase functions deploy send-group-invite --project-ref YOUR_PROJECT_REF
   supabase functions deploy send-confirmation --project-ref YOUR_PROJECT_REF
   supabase functions deploy send-welcome --project-ref YOUR_PROJECT_REF
   ```

4. **Deploy Application**
   ```bash
   npm run deploy:prod
   ```

### SMTP Configuration

Configure your SMTP settings in Supabase Dashboard:
1. Go to Authentication > Settings
2. Scroll to "SMTP Settings"
3. Enter your SMTP provider details:
   - Hostname
   - Port (587 for TLS)
   - Username
   - Password
   - From email address

### Recommended SMTP Providers

1. **Resend** (Recommended)
   - Easy setup
   - Good deliverability
   - Free tier available

2. **SendGrid**
   - Enterprise-grade
   - Advanced analytics
   - Good for high volume

3. **Postmark**
   - Great for transactional emails
   - Excellent deliverability
   - Good developer experience

## 🧪 Testing

### Development Testing
1. Start the development server: `npm run dev`
2. Test group invitations - emails will be logged to console
3. Test signup flow - confirmation emails will be logged

### Production Testing
1. Deploy to staging environment first
2. Test with real email addresses
3. Verify email delivery and formatting
4. Test mobile push notifications

## 📊 Monitoring

### Email Monitoring
- Check Supabase Edge Function logs
- Monitor SMTP provider dashboard
- Set up email delivery alerts

### Notification Monitoring
- Monitor notification delivery rates
- Track user engagement with notifications
- Set up alerts for failed notifications

## 🔧 Configuration

### Notification Preferences
Users can configure their notification preferences:
- Email notifications (immediate, daily, weekly, never)
- Push notifications (immediate, daily, weekly, never)
- In-app notifications (always enabled)

### Rate Limiting
- Email notifications: Respect SMTP provider limits
- Push notifications: Respect platform limits
- Internal notifications: No rate limiting (internal use)

## 🛠️ Troubleshooting

### Common Issues

1. **Emails not sending**
   - Check SMTP configuration
   - Verify Edge Function deployment
   - Check Supabase logs

2. **Push notifications not working**
   - Verify push token registration
   - Check platform-specific settings
   - Test with different devices

3. **Internal notifications not appearing**
   - Check database permissions
   - Verify RLS policies
   - Check notification service logs

### Debug Mode
Enable debug logging by setting `NODE_ENV=development` in your environment variables.

## 📈 Future Enhancements

### Planned Features
1. **Email Templates**: Customizable email templates
2. **Notification Scheduling**: Delayed notifications
3. **Bulk Notifications**: Send to multiple users
4. **Analytics**: Notification engagement tracking
5. **A/B Testing**: Test different notification formats

### Mobile App Integration
1. **React Native**: Full mobile app support
2. **Expo**: Cross-platform development
3. **Push Notifications**: Native push notification support
4. **Offline Support**: Queue notifications when offline

## 📚 API Reference

### Email Service
```typescript
// Send group invitation
await emailService.sendGroupInviteEmail({
  to: 'user@example.com',
  groupName: 'My Group',
  senderName: 'John Doe',
  customNote: 'Join us!',
  inviteId: 'uuid',
  appUrl: 'https://care-n-care.com'
})

// Send confirmation email
await emailService.sendConfirmationEmail({
  to: 'user@example.com',
  userName: 'John Doe',
  confirmationLink: 'https://care-n-care.com/confirm?token=xyz',
  appUrl: 'https://care-n-care.com'
})
```

### Notification Service
```typescript
// Send internal notification
await notificationService.sendInternalNotification({
  userId: 'user-uuid',
  type: 'group_invite',
  title: 'New Group Invitation',
  message: 'You have been invited to join a group',
  data: { groupId: 'group-uuid' },
  priority: 'medium'
})

// Send push notification
await notificationService.sendPushNotification({
  userId: 'user-uuid',
  title: 'New Message',
  body: 'You have a new message',
  data: { messageId: 'message-uuid' }
})
```

## 🤝 Contributing

When adding new notification types:
1. Update the notification type enum
2. Add appropriate email templates
3. Update the notification service
4. Add tests for the new functionality
5. Update this documentation

## 📄 License

This notification system is part of the Care-N-Care application and follows the same license terms.
