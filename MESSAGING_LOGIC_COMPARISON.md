# Messaging and Read/Unread Logic Comparison

## Key Differences Between Old (Working) and Current (Broken) Versions

### 1. Reschedule Notifications Query

**OLD VERSION (Working)** - Line 1962:
```typescript
.in('type', ['reschedule_accepted', 'reschedule_declined', 'reschedule_counter_sent', 'reschedule_counter_accepted', 'reschedule_counter_declined'])
```

**CURRENT VERSION (Broken)** - Line 1995:
```typescript
.in('type', ['reschedule_accepted', 'reschedule_declined', 'reschedule_counter_sent', 'reschedule_counter_accepted', 'reschedule_counter_declined', 'care_response', 'open_block_provider_notified'])
```

**ISSUE**: Adding `'care_response'` causes duplicate messages because:
- `care_response` notifications are created for BOTH acceptor and provider
- Acceptor already sees accepted invitation message from invitations array
- This creates the duplicate "Open Block Accepted" message

### 2. Unread Messages Initialization

**OLD VERSION (Working)** - Lines 3312-3393:
- Builds `pendingMessages` set from data
- ALL messages of certain types are added unconditionally
- Then merges with localStorage to filter out previously read messages
- Simple logic: if it exists in localStorage saved unread set, keep it; otherwise remove it

**CURRENT VERSION (Over-complicated)** - Lines 3381-3488:
- Loads localStorage FIRST
- Checks localStorage for EVERY message type before adding
- Adds `if (!savedUnread || savedUnreadSet.has(messageId))` checks everywhere
- Added dependencies: `mySubmittedResponses`, `groupInvitations`, `eventInvitations`
- More complex, harder to debug

**ISSUE**: The localStorage checking logic was applied inconsistently, causing flickering and unread status not working correctly

### 3. Missing Message Types in Old Version

**OLD VERSION**: Does NOT include in unread initialization:
- `mySubmittedResponses` (accepted/declined reciprocal responses)
- No special handling needed - wasn't tracked as unread

**CURRENT VERSION**: Added `mySubmittedResponses` check (lines 3472-3481)
- This is GOOD - needed to show accepted/declined messages as unread

### 4. Open Block Accepted Messages

**OLD VERSION**:
- Only shows accepted invitation messages from invitations array
- Does NOT fetch `care_response` notifications
- No duplicate messages

**CURRENT VERSION**:
- Shows BOTH accepted invitation AND care_response notification
- Tried to filter with `acceptor_id` check (lines 601-608)
- Still causing issues

## Recommendation: Hybrid Approach

### What to Keep from CURRENT:
1. ✅ mySubmittedResponses tracking (lines 3472-3481)
2. ✅ Improved Header localStorage read (simpler, faster)

### What to REVERT to OLD:
1. ❌ Remove `'care_response'` and `'open_block_provider_notified'` from reschedule notifications query
2. ❌ Simplify unread initialization - use old merge logic instead of checking localStorage upfront for every message
3. ❌ Remove the acceptor_id filtering logic (lines 599-608)

### How Old Logic Worked Better:

1. **Build pendingMessages** - Add ALL messages that should show up
2. **Load localStorage** - Get previously saved unread messages
3. **Merge** - Keep only messages that are:
   - In pendingMessages (still exist in data)
   - In savedUnreadSet (haven't been marked as read)
4. **Save** - Update localStorage with merged set

This is simpler and more reliable than checking localStorage before adding each message.

## The Root Problem

We tried to use the `notifications` table for open block acceptance messages, but:
- The notifications are created for BOTH users (acceptor and provider)
- We already have accepted invitation messages from the invitations query
- This created duplicates

**Better approach**: Don't use `notifications` table for open block acceptances. The accepted invitations from the invitations query are sufficient and already work correctly.
