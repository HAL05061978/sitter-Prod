# Reciprocal Care Location Tracking Fix

## Problem
Receiver and Provider have separate care blocks with different IDs but linked by `related_request_id`. When receiver creates a location tracking session on their care block ID, provider can't see it because they're looking at a different care block ID.

## Solution
Store BOTH scheduled_care IDs in the session:
- `scheduled_care_id`: Receiver's care block ID (set when session is created)
- `provider_scheduled_care_id`: Provider's care block ID (set when provider confirms)

The `get_active_tracking_sessions` function now looks for sessions on reciprocal care blocks with matching `related_request_id` and same date/time.

## Deployment Steps

### 1. Run Database Migration

Run this in Supabase SQL Editor:

```sql
-- Copy and paste contents of migrations/20250129_add_provider_scheduled_care_id.sql
```

This migration will:
- Add `provider_scheduled_care_id` column to `location_tracking_sessions`
- Update `confirm_dropoff` function to accept and store provider's care block ID
- Update `get_active_tracking_sessions` to find sessions on reciprocal care blocks

### 2. Clean Up Existing Sessions

```sql
DELETE FROM location_tracking_sessions;
```

### 3. Deploy Frontend Code

The following files were updated:
- `app/services/locationTracking.ts` - Added `providerScheduledCareId` parameter
- `hooks/useLocationTracking.ts` - Updated signature
- `components/care/LocationTrackingPanel.tsx` - Pass `scheduledCareId` when confirming

### 4. Test the Workflow

1. **As Receiver (Rosmary)**:
   - Open your "received care" block
   - Click "Drop Off"
   - Should see "Waiting for Confirmation"

2. **As Provider (Alyssa)**:
   - Open your "provided care" block (different ID, but same date/time and related_request_id)
   - Should now see "Confirm Drop-Off" button
   - Click it
   - Location tracking should start

3. **As Receiver (Rosmary)**:
   - Should see map with provider's location
   - Click "Pick Up"

4. **As Provider (Alyssa)**:
   - Should see "Confirm Pick-Up"
   - Click it
   - Session should complete

## How It Works

### Data Flow

1. **Receiver creates session:**
   ```
   scheduled_care_id: b43051d6... (receiver's block)
   provider_scheduled_care_id: NULL
   receiver_id: 88416767... (Rosmary)
   provider_id: 88416767... (temporary)
   status: pending_dropoff
   ```

2. **Provider confirms:**
   ```
   scheduled_care_id: b43051d6... (receiver's block)
   provider_scheduled_care_id: 392905a8... (provider's block) ← ADDED
   receiver_id: 88416767... (Rosmary)
   provider_id: 2a7f3ce2... (Alyssa) ← UPDATED
   status: active
   ```

3. **Both users can now see the session:**
   - Receiver sees it via `scheduled_care_id` matching their block
   - Provider sees it via `provider_scheduled_care_id` matching their block
   - Function also checks reciprocal blocks via `related_request_id`

## Key Points

- The session is created on the RECEIVER's care block ID
- When provider confirms, their care block ID is also stored
- Both users can see the session from their respective care blocks
- The function checks for reciprocal blocks with matching `related_request_id`, `start_time`, and `end_time`
