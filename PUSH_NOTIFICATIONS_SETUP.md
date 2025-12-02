# Push Notifications Setup Guide for SitterApp

This guide walks you through setting up push notifications for your iOS app.

## Overview

The push notification system consists of:
1. **Device Token Storage** - Stores device tokens in Supabase
2. **APNs Configuration** - Apple Push Notification service setup
3. **Edge Function** - Server-side function to send notifications
4. **Database Trigger** - Automatically sends push when notifications are created

---

## Step 1: Run Database Migration

Run this SQL in your **Supabase Dashboard → SQL Editor**:

```sql
-- Copy contents from: migrations/add_device_tokens_table.sql
```

This creates the `device_tokens` table to store device tokens.

---

## Step 2: Configure APNs in Apple Developer Portal

### 2.1 Create an APNs Key

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Navigate to **Certificates, Identifiers & Profiles** → **Keys**
3. Click **+** to create a new key
4. Enter a name: `SitterApp Push Key`
5. Check **Apple Push Notifications service (APNs)**
6. Click **Continue** → **Register**
7. **Download** the `.p8` key file (save it securely!)
8. Note the **Key ID** shown on the page

### 2.2 Find Your Team ID

1. Go to **Membership** in the Apple Developer Portal
2. Your **Team ID** is displayed there

### 2.3 Save Your Credentials

You'll need these three values:
- **Key ID**: From step 2.1 (e.g., `ABC123DEFG`)
- **Team ID**: From step 2.2 (e.g., `XYZ987654`)
- **Private Key**: Contents of the `.p8` file

---

## Step 3: Add Push Notification Capability in Xcode

1. Open the project in Xcode: `npx cap open ios`
2. Select the **App** target in the project navigator
3. Go to **Signing & Capabilities** tab
4. Click **+ Capability**
5. Add **Push Notifications**
6. Also add **Background Modes** and check:
   - **Remote notifications**

---

## Step 4: Deploy the Edge Function

### 4.1 Set Supabase Secrets

In your terminal, set the APNs credentials as secrets:

```bash
# Set your APNs Key ID
supabase secrets set APNS_KEY_ID=your_key_id

# Set your Team ID
supabase secrets set APNS_TEAM_ID=your_team_id

# Set your private key (the contents of the .p8 file)
# Replace newlines with \n
supabase secrets set APNS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_CONTENT_HERE\n-----END PRIVATE KEY-----"
```

### 4.2 Deploy the Function

```bash
# From your project root
supabase functions deploy send-push-notification --project-ref YOUR_PROJECT_REF
```

---

## Step 5: Set Up Database Trigger (Optional - Advanced)

If you want automatic push notifications when database notifications are created:

1. Enable the pg_net extension in Supabase (Dashboard → Database → Extensions)
2. Run the migration: `migrations/add_push_notification_trigger.sql`
3. Set the app settings in your database

**Note**: This is an advanced setup. You can also call the Edge Function directly from your app or other Edge Functions.

---

## Step 6: Test Push Notifications

### 6.1 Build and Install the App

```bash
BUILD_MODE=capacitor npm run build && npx cap sync ios
```

Then run from Xcode on your physical device.

### 6.2 Enable Notifications

1. Open the app
2. Go to **Settings** (gear icon)
3. Tap **Enable** under Push Notifications
4. Allow notifications when prompted

### 6.3 Test Sending a Notification

You can test by calling the Edge Function directly:

```bash
curl -X POST 'https://YOUR_PROJECT.supabase.co/functions/v1/send-push-notification' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "user_id": "USER_UUID_HERE",
    "title": "Test Notification",
    "body": "This is a test push notification!",
    "data": {"type": "test"}
  }'
```

---

## Troubleshooting

### Notifications not appearing?

1. **Check device token** - Make sure the token is saved in `device_tokens` table
2. **Check APNs credentials** - Verify Key ID, Team ID, and Private Key are correct
3. **Check Bundle ID** - Must match `com.sitterapp.care` in the Edge Function
4. **Physical device required** - Push notifications don't work in the simulator

### Badge not showing?

1. Make sure **Badge** is enabled in notification settings
2. Check that the badge count is being set correctly

### App not requesting permissions?

1. Make sure Push Notification capability is added in Xcode
2. Ensure the app is running on a physical device

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   iOS App       │────▶│   Supabase      │────▶│   APNs          │
│   (Capacitor)   │     │   Edge Function │     │   (Apple)       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │                       │
        ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ device_tokens   │     │  notifications  │
│ table           │     │  table          │
└─────────────────┘     └─────────────────┘
```

1. App registers for push notifications → receives device token
2. Device token is saved to `device_tokens` table
3. When a notification is created (e.g., new message), trigger fires
4. Trigger calls Edge Function with user_id, title, body
5. Edge Function looks up device tokens for user
6. Edge Function sends push via APNs
7. Apple delivers notification to device

---

## Files Created

- `lib/push-notifications.ts` - Push notification service
- `lib/remembered-users.ts` - Remember users service
- `hooks/usePushNotifications.ts` - React hook for push notifications
- `components/NotificationSettings.tsx` - Settings UI component
- `app/settings/page.tsx` - Settings page
- `ios/App/App/AppDelegate.swift` - Updated for push notifications
- `supabase/functions/send-push-notification/index.ts` - Edge function
- `migrations/add_device_tokens_table.sql` - Database migration
- `migrations/add_push_notification_trigger.sql` - Database trigger
