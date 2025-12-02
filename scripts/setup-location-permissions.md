# Location Permissions Setup Guide

## Overview

This guide will help you configure location permissions for iOS and Android platforms.

## Prerequisites

1. Capacitor platforms must be added:
   ```bash
   npm run cap:add:ios
   npm run cap:add:android
   ```

2. Sync your project:
   ```bash
   npm run cap:sync
   ```

## iOS Configuration

### Step 1: Edit Info.plist

File location: `ios/App/App/Info.plist`

Add the following keys just before the closing `</dict>` tag:

```xml
<!-- Location Permissions -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location to help parents track their children during care sessions for safety and peace of mind</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>We need your location to continuously track care provider location for child safety, even when the app is in the background</string>

<key>NSLocationAlwaysUsageDescription</key>
<string>We need your location even when the app is in the background to ensure continuous monitoring during care sessions</string>

<!-- Background Modes -->
<key>UIBackgroundModes</key>
<array>
    <string>location</string>
    <string>fetch</string>
</array>

<!-- Privacy - Motion Usage (for better location accuracy) -->
<key>NSMotionUsageDescription</key>
<string>We use motion data to improve location accuracy while tracking care providers</string>
```

### Step 2: Configure Signing

1. Open Xcode:
   ```bash
   npm run cap:open:ios
   ```

2. Select your project in the navigator
3. Go to "Signing & Capabilities"
4. Add "Background Modes" capability if not present
5. Check "Location updates" and "Background fetch"

### Step 3: Test on Device

**IMPORTANT**: Location services do not work reliably on iOS Simulator. Always test on a real device.

```bash
# Connect your iPhone via USB
# In Xcode, select your device from the dropdown
# Click Run (▶️ button)
```

When the app launches:
1. App will request "Allow While Using App" permission
2. After confirming drop-off, it will request "Change to Always Allow"
3. Grant "Always Allow" for background tracking to work

## Android Configuration

### Step 1: Edit AndroidManifest.xml

File location: `android/app/src/main/AndroidManifest.xml`

Add the following permissions inside the `<manifest>` tag, before `<application>`:

```xml
<!-- Location Permissions -->
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />

<!-- Required features -->
<uses-feature android:name="android.hardware.location.gps" android:required="false" />
<uses-feature android:name="android.hardware.location.network" android:required="false" />

<!-- Foreground service for background location (Android 10+) -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
```

### Step 2: Configure Build

File location: `android/app/build.gradle`

Ensure `targetSdkVersion` is at least 31:

```gradle
android {
    defaultConfig {
        targetSdkVersion 33  // or higher
    }
}
```

### Step 3: Test on Device

```bash
# Enable USB debugging on your Android device
# Connect via USB
# Open Android Studio
npm run cap:open:android

# Click Run (▶️ button)
```

When the app launches:
1. App will request location permission
2. Select "While using the app" or "Only this time"
3. After confirming drop-off, it will request "Allow all the time"
4. Grant "Allow all the time" for background tracking to work

## Handling Different Android Versions

### Android 10+ (API Level 29+)

Background location requires additional user action:

```typescript
// The app will automatically request this after initial permission
// User will see a dialog to "Change to allow all the time"
```

### Android 11+ (API Level 30+)

Must request background location separately from foreground:

```typescript
// 1. Request foreground permission first
// 2. Then request background permission
// This is handled automatically by the locationTrackingService
```

## Testing Location Permissions

### Test Checklist

#### iOS
- [ ] App requests "While Using" permission
- [ ] After confirming drop-off, app requests "Always" permission
- [ ] App can access location when in background
- [ ] Location updates continue when screen is locked
- [ ] Location icon appears in status bar when tracking

#### Android
- [ ] App requests location permission
- [ ] After confirming drop-off, app requests "Allow all the time"
- [ ] App can access location when in background
- [ ] Location updates continue when screen is locked
- [ ] Notification appears for foreground service (Android 8+)

### Verify Permissions Granted

#### iOS
Settings > Privacy & Security > Location Services > SitterApp
- Should show "Always" when tracking is active

#### Android
Settings > Apps > SitterApp > Permissions > Location
- Should show "Allow all the time" when tracking is active

## Common Issues

### Issue: Permission dialog doesn't appear

**iOS**:
- Delete app from device
- Clean build folder in Xcode (Product > Clean Build Folder)
- Rebuild and reinstall

**Android**:
- Uninstall app
- Clear app data
- Reinstall

### Issue: Background tracking stops

**iOS**:
1. Check Settings > General > Background App Refresh is ON
2. Check Settings > Privacy > Location Services > SitterApp is "Always"
3. Verify Info.plist has UIBackgroundModes with "location"

**Android**:
1. Check Settings > Apps > SitterApp > Battery > "Unrestricted"
2. Disable "Battery optimization" for SitterApp
3. Check notification permission is granted (for foreground service)

### Issue: "Location permission denied" error

**Solution**:
```typescript
// User denied permission - show instructions
// iOS: Settings > Privacy > Location Services > SitterApp
// Android: Settings > Apps > SitterApp > Permissions > Location
```

## Production Recommendations

### 1. Request Permissions at Right Time

Don't request permissions immediately on app launch. Wait until:
- User is about to confirm drop-off
- User views a care block that supports tracking
- User explicitly opts in to location features

### 2. Explain Why

Before requesting permissions, show a modal explaining:
```
"We need your location to help keep children safe during care sessions.
Parents can see where their child is being cared for in real-time."
```

### 3. Graceful Degradation

If user denies permission:
- Don't block the app
- Show care blocks without location features
- Provide a way to enable later

### 4. Battery Considerations

Inform users about battery impact:
```
"Location tracking may increase battery usage during care sessions.
Tracking automatically stops when care ends."
```

## Debugging

### iOS

View location logs in Xcode Console:
```bash
# Filter for location-related logs
# In Xcode console, enter: location
```

### Android

View location logs in Logcat:
```bash
# In Android Studio, Logcat tab
# Filter: location
```

### Browser Console (Development)

For development with `npm run dev`:
```javascript
// Check if running in Capacitor
if (Capacitor.isNativePlatform()) {
  console.log('Running on native platform');
} else {
  console.log('Running in browser - location features limited');
}
```

## Next Steps

After configuring permissions:

1. Run database migration (see DEPLOY_LOCATION_TRACKING.md)
2. Build mobile app: `npm run build:mobile`
3. Test on real devices (iOS and Android)
4. Review full deployment guide

## Support

If you encounter issues:
1. Check Xcode/Android Studio console for errors
2. Verify Info.plist/AndroidManifest.xml changes
3. Test on real device (not simulator/emulator)
4. Check device settings for app permissions
