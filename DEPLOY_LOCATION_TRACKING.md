# Location Tracking Feature - Deployment Guide

## Overview

This feature adds native location tracking for care blocks, allowing receiving care parents to monitor the providing care host's location in real-time.

## Architecture

### 1. **Database Layer** (`migrations/20250129_add_location_tracking.sql`)
- `location_tracking_sessions` - Manages drop-off/pick-up lifecycle
- `location_updates` - Stores GPS coordinates
- Functions: `request_dropoff`, `confirm_dropoff`, `request_pickup`, `confirm_pickup`, `update_location`

### 2. **Service Layer** (`app/services/locationTracking.ts`)
- Native geolocation via Capacitor
- Background location tracking
- Real-time location updates to backend

### 3. **Hook Layer** (`hooks/useLocationTracking.ts`)
- React hooks for easy integration
- State management for tracking sessions
- Real-time subscriptions to location updates

### 4. **UI Layer**
- `components/care/LocationMap.tsx` - Interactive map with live location
- `components/care/LocationTrackingPanel.tsx` - Drop-off/pick-up workflow UI

## Workflow

```
1. RECEIVER (Parent receiving care):
   - Clicks "Drop Off" button when dropping off child
   - System sends request to provider

2. PROVIDER (Parent providing care):
   - Receives notification of drop-off request
   - Clicks "Confirm Drop-Off"
   - System requests location permission (if not granted)
   - Location tracking starts automatically
   - GPS coordinates sent to backend every 10 seconds

3. RECEIVER:
   - Views live map showing provider's location
   - Clicks "Pick Up" button when picking up child
   - System sends pick-up request to provider

4. PROVIDER:
   - Receives notification of pick-up request
   - Clicks "Confirm Pick-Up"
   - Location tracking stops automatically
```

## Deployment Steps

### Step 1: Deploy Database Migration

```bash
# Navigate to Supabase dashboard > SQL Editor
# Copy and paste the contents of migrations/20250129_add_location_tracking.sql
# Click "Run"
```

Or via CLI:
```bash
supabase db push --project-ref YOUR_PROJECT_REF
```

### Step 2: Configure iOS Project

```bash
# Add iOS platform (if not already added)
npm run cap:add:ios

# Sync files
npm run cap:sync
```

Edit `ios/App/App/Info.plist` and add location permission strings:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location to help parents track their children during care sessions</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>We need your location to continuously track care provider location for child safety</string>

<key>NSLocationAlwaysUsageDescription</key>
<string>We need your location even when the app is in the background to ensure continuous monitoring during care sessions</string>

<key>UIBackgroundModes</key>
<array>
    <string>location</string>
</array>
```

### Step 3: Configure Android Project

```bash
# Add Android platform (if not already added)
npm run cap:add:android

# Sync files
npm run cap:sync
```

Edit `android/app/src/main/AndroidManifest.xml` and add:

```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-feature android:name="android.hardware.location.gps" />
```

### Step 4: Build Mobile App

```bash
# Build the Next.js app for mobile
npm run build:mobile

# This will:
# 1. Create a static export in the 'out' directory
# 2. Sync files to iOS/Android projects

# Open in Xcode (iOS)
npm run cap:open:ios

# Open in Android Studio (Android)
npm run cap:open:android
```

### Step 5: Test on Device

**IMPORTANT**: Location tracking only works on real devices, not simulators/emulators.

#### iOS:
1. Connect iPhone via USB
2. In Xcode, select your device
3. Click "Run" (▶️ button)
4. Grant location permissions when prompted

#### Android:
1. Enable USB debugging on Android device
2. Connect via USB
3. In Android Studio, select your device
4. Click "Run" (▶️ button)
5. Grant location permissions when prompted

## Integration Examples

### Example 1: Add to Calendar Page

```typescript
// app/calendar/page.tsx
import LocationTrackingPanel from '../../components/care/LocationTrackingPanel';

// Inside your care block rendering:
{careBlock.status === 'confirmed' && (
  <LocationTrackingPanel
    scheduledCareId={careBlock.id}
    providerId={careBlock.provider_id}
    providerName={careBlock.provider_name}
    receiverId={careBlock.receiver_id}
    receiverName={careBlock.receiver_name}
    careDate={careBlock.care_date}
    startTime={careBlock.start_time}
    endTime={careBlock.end_time}
    isProvider={user.id === careBlock.provider_id}
  />
)}
```

### Example 2: Standalone Page

```typescript
// app/tracking/[scheduledCareId]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LocationTrackingPanel from '../../../components/care/LocationTrackingPanel';

export default function TrackingPage() {
  const params = useParams();
  const [careBlock, setCareBlock] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCareBlock();
  }, [params.scheduledCareId]);

  const loadCareBlock = async () => {
    const { data } = await supabase
      .from('scheduled_care')
      .select('*')
      .eq('id', params.scheduledCareId)
      .single();

    setCareBlock(data);
    setLoading(false);
  };

  if (loading) return <div>Loading...</div>;
  if (!careBlock) return <div>Care block not found</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Location Tracking</h1>
      <LocationTrackingPanel {...careBlock} />
    </div>
  );
}
```

## Testing Checklist

### Database
- [ ] Migration runs without errors
- [ ] Tables created with proper RLS policies
- [ ] Functions callable from authenticated users
- [ ] Real-time subscriptions work for location_updates

### Permissions
- [ ] iOS: Location permission prompt appears
- [ ] Android: Location permission prompt appears
- [ ] Background location permission granted (iOS 13+, Android 10+)
- [ ] App can access location when in background

### Drop-Off Flow
- [ ] Receiver can click "Drop Off" button
- [ ] Provider receives notification (check console for now)
- [ ] Provider can click "Confirm Drop-Off"
- [ ] Location tracking starts automatically
- [ ] Map appears showing provider's location
- [ ] Location updates every 10 seconds

### Pick-Up Flow
- [ ] Receiver can click "Pick Up" button while tracking active
- [ ] Provider receives notification (check console for now)
- [ ] Provider can click "Confirm Pick-Up"
- [ ] Location tracking stops automatically
- [ ] Session status changes to "completed"

### Real-Time Updates
- [ ] Location updates appear on receiver's map in real-time
- [ ] Accuracy indicator shows on map
- [ ] Last update timestamp displays correctly
- [ ] Map centers on new location automatically

## Troubleshooting

### Location Not Updating

**Issue**: Location not updating on provider's device

**Solutions**:
1. Check location permissions are granted
2. Ensure device has GPS signal (go outside if needed)
3. Check browser console for errors
4. Verify `location_updates` table is receiving data

### Map Not Displaying

**Issue**: Map component shows "Loading map..." forever

**Solutions**:
1. Check Leaflet CSS is loaded
2. Verify component is client-side only (`'use client'`)
3. Check browser console for errors
4. Ensure network can reach OpenStreetMap tiles

### Background Tracking Stops

**Issue**: Location stops updating when app is in background

**Solutions**:
1. **iOS**: Ensure `UIBackgroundModes` includes `location` in Info.plist
2. **Android**: Ensure `ACCESS_BACKGROUND_LOCATION` permission granted
3. **iOS**: Check "Background App Refresh" is enabled in device settings
4. **Android**: Disable battery optimization for the app

### Permission Denied

**Issue**: Location permission is denied

**Solutions**:
1. **iOS**: Go to Settings > Privacy > Location Services > SitterApp > Allow
2. **Android**: Go to Settings > Apps > SitterApp > Permissions > Location > Allow all the time
3. Uninstall and reinstall app to reset permissions

## Production Considerations

### 1. **Push Notifications**
Currently, notifications are logged to console. Implement push notifications:

```typescript
// In locationTracking.ts functions, replace console.log with:
import { LocalNotifications } from '@capacitor/local-notifications';

await LocalNotifications.schedule({
  notifications: [{
    title: 'Drop-Off Requested',
    body: `${receiverName} has dropped off their child`,
    id: 1,
    schedule: { at: new Date(Date.now() + 1000) }
  }]
});
```

### 2. **Battery Optimization**
Adjust update frequency based on battery level:

```typescript
// In locationTracking.ts
private updateInterval: number = 10000; // 10 seconds default

// Adjust based on battery
if (batteryLevel < 20) {
  this.updateInterval = 30000; // 30 seconds when low battery
}
```

### 3. **Data Retention**
Implement cleanup for old location data:

```sql
-- Run this as a scheduled job
DELETE FROM location_updates
WHERE recorded_at < NOW() - INTERVAL '7 days';
```

### 4. **Privacy**
- Location data is only shared during active care sessions
- Data is automatically deleted after care block ends (via CASCADE)
- Only provider and receiver can see location data (enforced by RLS)

## API Reference

### Functions

#### `request_dropoff(p_scheduled_care_id, p_receiver_id)`
Receiving parent requests drop-off confirmation from provider.

#### `confirm_dropoff(p_session_id, p_provider_id)`
Provider confirms drop-off and starts location tracking.

#### `request_pickup(p_session_id, p_receiver_id)`
Receiving parent requests pick-up confirmation from provider.

#### `confirm_pickup(p_session_id, p_provider_id)`
Provider confirms pick-up and stops location tracking.

#### `update_location(p_session_id, p_latitude, p_longitude, ...)`
Provider's device sends location update.

#### `get_latest_location(p_session_id)`
Get the most recent location for a session.

#### `get_active_tracking_sessions(p_user_id)`
Get all active tracking sessions for a user.

## Support

For issues or questions:
1. Check browser/Xcode/Android Studio console for errors
2. Verify database migration ran successfully
3. Test on real device (not simulator)
4. Review this guide's troubleshooting section

## Next Steps

- [ ] Implement push notifications for drop-off/pick-up requests
- [ ] Add battery-aware location update frequency
- [ ] Implement location history playback
- [ ] Add geofencing alerts (e.g., if provider leaves designated area)
- [ ] Add estimated time of arrival (ETA) feature
