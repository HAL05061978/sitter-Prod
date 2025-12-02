# Missing School Notification Feature

## Overview
This feature allows users to report schools that are not in the database dropdown. When a user selects "School not shown", they can enter the missing school name and an email notification is automatically sent to the admin.

## Implementation Status

### ✅ Dashboard - Add Child Form (COMPLETED)
The Dashboard add child form now includes:
- "🔔 School not shown (notify admin)" option in dropdown
- "✏️ Other (type manually)" option for manual entry without notification
- When "School not shown" is selected:
  - Shows text input for missing school name
  - Displays message: "We'll notify the admin to add this school to the database"
  - Shows "Back to school list" button to cancel
- Sends email to admin when child is saved with missing school info

### 🔄 Dashboard - Edit Child Form (TODO)
Need to apply the same changes to the edit child form. Follow the same pattern as add child.

### 🔄 Signup Page (TODO)
Need to apply the same changes to the signup page child forms. Follow the same pattern.

## How It Works

### User Flow
1. User enters ZIP code → Town auto-fills, schools dropdown appears
2. User clicks dropdown and sees:
   - List of schools for that ZIP code
   - "🔔 School not shown (notify admin)"
   - "✏️ Other (type manually)"
3. If user selects "School not shown":
   - Dropdown is replaced with text input
   - User types the missing school name
   - Helper text shows: "We'll notify the admin..."
   - "Back to school list" button allows canceling
4. User completes the form and saves
5. Email is automatically sent to admin with:
   - School name entered by user
   - ZIP code
   - Town
   - User's email (who reported it)

### Email Notification
The `notifyMissingSchool()` function sends an email containing:
```
Subject: Missing School: [School Name] in [Town] ([ZIP Code])

Body:
- School Name: [entered by user]
- ZIP Code: [from form]
- Town: [from form]
- Reported by: [user's email]
```

## Configuration Required

### Set Admin Email
Add this to your `.env.local` file:
```
NEXT_PUBLIC_ADMIN_EMAIL=your-admin-email@example.com
```

If not set, emails will go to `admin@example.com` by default.

### Email Service
The feature uses the existing `emailService` from `lib/email-service.ts`. Make sure this is properly configured with your email provider (Resend, SendGrid, etc.).

## Code Changes Made

### Files Modified

#### `app/dashboard/page.tsx`
1. **Added state variables:**
   ```typescript
   const [missingSchoolName, setMissingSchoolName] = useState("");
   const [showMissingSchoolInput, setShowMissingSchoolInput] = useState(false);
   // Similar for edit form
   ```

2. **Added `notifyMissingSchool()` function:**
   - Sends email notification to admin
   - Includes school name, ZIP code, town, user email
   - Non-blocking (won't stop user if email fails)

3. **Updated school dropdown:**
   - Added "__missing__" option
   - Shows special input when selected
   - Handles state properly

4. **Updated `handleAddChild()`:**
   - Checks if missing school was entered
   - Calls `notifyMissingSchool()` before saving
   - Clears missing school state after save

## TODO: Apply to Edit Form

Update the edit child form in Dashboard:

1. Add to dropdown options:
```tsx
<option value="__missing__">🔔 School not shown (notify admin)</option>
```

2. Add conditional rendering for missing school input (same as add form)

3. Update `handleSaveChildEdit()`:
```typescript
// Before saving
if (editShowMissingSchoolInput && editMissingSchoolName && editChildZipCode) {
  await notifyMissingSchool(editMissingSchoolName, editChildZipCode, editChildTown);
}
```

## TODO: Apply to Signup Page

Update signup page similarly:

1. Add state per child index:
```typescript
const [missingSchoolByChild, setMissingSchoolByChild] = useState<{[key: number]: string}>({});
const [showMissingByChild, setShowMissingByChild] = useState<{[key: number]: boolean}>({});
```

2. Update school dropdown in `app/signup/page.tsx` (follow Dashboard pattern)

3. Create a `notifyMissingSchool()` function in signup page

4. Call notification in the signup handler before creating user account

**Note:** For signup page, you won't have `user?.email` yet, so either:
- Use the email from the signup form
- Or send "Anonymous (from signup)" in the notification

## Testing

### Test Missing School Notification

1. Go to Dashboard → Children → Add Child
2. Enter ZIP code "06611"
3. From school dropdown, select "🔔 School not shown (notify admin)"
4. Text input should appear
5. Type "Test Missing School"
6. Complete rest of form and click "Add Child"
7. Check admin email for notification
8. Check browser console for: "Missing school notification sent successfully"

### Test Manual Entry (No Notification)

1. From school dropdown, select "✏️ Other (type manually)"
2. Type school name
3. Save - no email should be sent

## Benefits

1. **User Experience**
   - Users can always complete the form even if school is missing
   - Clear indication that admin will be notified
   - Option to type manually without notification

2. **Admin Workflow**
   - Automatic notifications when schools are missing
   - Includes all needed info to add school
   - Tracks who reported it

3. **Data Quality**
   - Gradually improves school database
   - User-driven data collection
   - No manual checking needed

## Security Notes

- No database writes from user input (prevents injection)
- Email validation handled by email service
- Admin email address not exposed to client
- Rate limiting should be added to prevent spam (future enhancement)

## Future Enhancements

1. **Rate Limiting** - Prevent spam notifications
2. **Duplicate Detection** - Check if school already reported
3. **Admin Dashboard** - View all missing school requests
4. **Batch Import** - Allow admin to import multiple schools at once
5. **User Feedback** - Show confirmation when notification sent
6. **Analytics** - Track most requested schools
