# Messaging System Fixes - Deployment Guide

## Issues Fixed

### 1. New Messages Not Showing as Unread
**Problem**: When reciprocal responses were accepted/declined, they didn't show as unread if localStorage already existed

**Root Cause**: The merge logic only kept messages that existed in BOTH localStorage AND current data. New messages were excluded.

**Fix** (app/scheduler/page.tsx:3412-3446): Updated merge logic to include:
- Old unread messages that still exist (were in localStorage, still in data)
- NEW messages that weren't in localStorage yet

```typescript
// Add old unread messages that still exist
savedUnreadSet.forEach(id => {
  if (pendingMessages.has(id)) {
    mergedUnread.add(id);
  }
});

// Add new messages that weren't in savedUnread
pendingMessages.forEach(id => {
  if (!savedUnreadSet.has(id)) {
    mergedUnread.add(id);
  }
});
```

### 2. Duplicate Open Block Messages
**Problem**: "Open Block Accepted" message appeared twice

**Fix** (app/scheduler/page.tsx:2008): Removed `'care_response'` and `'open_block_provider_notified'` from reschedule notifications query
- Only fetch actual reschedule notifications
- Open block accepted messages come from invitations array only

### 3. Flickering Message Counter
**Problem**: Counter showed "1" briefly then went to "0" on every page load

**Fix** (app/components/Header.tsx:192-199): Header now reads directly from localStorage instead of re-querying database
- Single source of truth: localStorage
- No race conditions or flickering

## Files Modified

### app/scheduler/page.tsx
1. **Line 2008**: Removed open block types from reschedule notifications query
2. **Lines 638-646**: Removed care_response subtitle logic
3. **Lines 1311-1340**: Removed care_response expanded content
4. **Lines 3418-3441**: Fixed merge logic to detect new messages
5. **Line 3448**: Simplified dependencies (removed rescheduleNotifications, groupInvitations, eventInvitations)

### app/components/Header.tsx
1. **Lines 192-199**: Simplified to read count from localStorage only
2. **Lines 358-363**: handleSchedulerUpdated reads from localStorage instead of refetching

## How It Works Now

### Message Lifecycle:

**1. New Message Arrives:**
- Scheduler page detects it in data
- Adds to `pendingMessages` set
- Not in localStorage yet → Added to `mergedUnread`
- Shows with blue dot indicator
- Counter increments

**2. User Clicks Message:**
- `markMessageAsRead` called
- Removes from `unreadMessages` state
- Removes from localStorage
- Dispatches `schedulerUpdated` event
- Header reads from localStorage, counter updates immediately

**3. Page Refresh:**
- Loads localStorage
- Merges with current data
- Previously read messages: NOT in `mergedUnread` (removed from localStorage)
- Still unread messages: IN `mergedUnread` (still in localStorage)
- New messages: IN `mergedUnread` (not in localStorage yet, so they're new)

## Message Types Tracked:

✅ Pending open block invitations (grouped by parent)
✅ Accepted open block invitations (provider and acceptor views)
✅ Group invitations (pending)
✅ Event invitations
✅ Pending care responses
✅ Responded/accepted care responses
✅ Responses to my care requests
✅ My submitted responses (accepted/declined)

## Testing Checklist

- [ ] Send reciprocal care request
- [ ] Responder submits reciprocal response
- [ ] Requester accepts response
- [ ] Verify responder sees "Accepted" message as unread
- [ ] Click to expand message
- [ ] Verify blue dot disappears and counter decrements
- [ ] Refresh page
- [ ] Verify message stays marked as read
- [ ] Send open block invitation
- [ ] Acceptor accepts invitation
- [ ] Verify provider sees acceptance message as unread
- [ ] Verify NO duplicate messages
- [ ] Click to read message
- [ ] Verify counter updates immediately (no refresh needed)

## Deployment Steps

```bash
git add .
git commit -m "Fix: Messaging system - new messages show as unread, no duplicates, no flickering"
git push
```

## Build Status
✓ Build successful
✓ No TypeScript errors
✓ Reduced bundle size (removed complex Header logic)

## Known Issue to Address Next

**Counter-decline not removing selected blocks**: When declining a counter-proposal, the selected block isn't removed for either parent. This is a separate SQL function issue that needs to be addressed.
