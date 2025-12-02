# Profile Fields Enhancement - Deployment Guide

## Overview
This update adds comprehensive profile fields to the application, making the Profile section editable and enhancing the onboarding flow.

## New Profile Fields Added

### Professional Information
- **Profession** - User's job title/occupation
- **Employer** - User's company/employer name

### Location Information
- **Address** - Street address
- **City** - City/Town (auto-populated from ZIP code)
- **ZIP Code** - 5-digit ZIP code with auto-lookup

### Emergency Contact
- **Emergency Contact** - Name of emergency contact person
- **Emergency Contact Phone** - Phone number for emergency contact

### Personal Information
- **Bio** - About Me section (text area for longer descriptions)
- **Profile Photo URL** - URL to profile photo with live preview

## Changes Made

### 1. Database Migration (`migrations/20250111000000_add_profile_fields.sql`)
- Adds 9 new columns to the `profiles` table
- Includes proper column comments for documentation
- Safe to run multiple times (uses `IF NOT EXISTS`)

### 2. Storage Bucket Setup (`migrations/20250111000001_create_profile_photos_bucket.sql`)
- Creates `profile-photos` storage bucket in Supabase
- Sets bucket to public (for viewing)
- Implements RLS policies:
  - Users can upload/update/delete only their own photos
  - All users can view all profile photos
  - Photos organized by user ID folders

### 3. Dashboard Profile Section (`app/dashboard/page.tsx`)
**Updated:**
- Profile interface with all new fields
- Profile data fetching to include new fields
- Added state variables for editing all fields
- Added image compression function (`compressProfileImage`)
- Added handler functions:
  - `handleEditProfile()` - Enters edit mode
  - `handleSaveProfile()` - Saves changes with validation
  - `handleCancelProfileEdit()` - Cancels editing
  - `handleProfileZipCodeChange()` - Auto-populates city from ZIP code
  - `handleProfilePhotoUpload()` - Handles photo upload with compression
- Complete UI redesign:
  - Read-only view showing all profile information with photo
  - Edit mode with form fields for all new data
  - **Camera button** for photo upload with live preview
  - Collapsible URL input as alternative method
  - Responsive 2-column grid layout
  - Proper validation (phone 10 digits, ZIP 5 digits)
  - Email is read-only (tied to authentication)

### 4. Onboarding Flow (`app/onboarding/profile/page.tsx`)
**Updated:**
- Added all new fields to the onboarding form
- Added image compression function (`compressProfileImage`)
- Added photo upload handler (`handleProfilePhotoUpload`)
- **Camera button** for photo upload at the top of form
- ZIP code auto-lookup functionality
- Comprehensive form with 2-column responsive layout
- Validation for required fields (name, phone)
- Optional fields for all other information (including photo)
- Better UX with proper placeholders and labels
- Collapsible URL input as alternative to camera upload

## Deployment Steps

### Step 1: Run Database Migration (Profile Fields)
First, add the new columns to the profiles table:

**Via Supabase Dashboard:**
1. Go to SQL Editor in Supabase Dashboard
2. Copy and paste the contents of `migrations/20250111000000_add_profile_fields.sql`
3. Click "Run"

**Via Supabase CLI:**
```bash
supabase db push
```

### Step 2: Create Storage Bucket Manually
**IMPORTANT**: The storage bucket must be created through the UI due to permissions.

1. Go to Supabase Dashboard > **Storage**
2. Click **"Create a new bucket"**
3. Bucket name: `profile-photos`
4. **Check "Public bucket"** (important!)
5. Click **"Create bucket"**

### Step 3: Setup RLS Policies for Storage
Now run the second migration to set up security policies:

**Via Supabase Dashboard:**
1. Go to SQL Editor in Supabase Dashboard
2. Copy and paste the contents of `migrations/20250111000001_create_profile_photos_bucket.sql`
3. Click "Run"

This will create the RLS policies that:
- Allow users to upload/update/delete only their own photos
- Allow everyone to view profile photos (since bucket is public)

### Step 4: Verify Setup
1. Go to Storage in Supabase Dashboard
2. Confirm `profile-photos` bucket exists and is marked as "Public"
3. Click on the bucket and go to "Policies" tab
4. Verify 4 policies are active:
   - Users can upload their own profile photos
   - Profile photos are publicly accessible
   - Users can update their own profile photos
   - Users can delete their own profile photos

### Step 5: Verify Profiles Table RLS Policies
Ensure the existing RLS policies on the `profiles` table allow users to update their own profiles:

```sql
-- Should already exist, but verify:
CREATE POLICY "Users can update own profile."
  ON profiles FOR UPDATE
  USING ( (SELECT auth.uid()) = id );
```

### Step 6: Deploy Frontend Changes
Deploy the updated files:
- `app/dashboard/page.tsx`
- `app/onboarding/profile/page.tsx`

### Step 7: Test the Changes

**Test Dashboard Profile Editing:**
1. Log in to the app
2. Go to Dashboard > Profile tab
3. Click "Edit Profile"
4. **Test Photo Upload:**
   - Click "Choose Photo" button
   - Select an image from camera/gallery
   - Verify upload progress indicator appears
   - Verify photo preview appears after upload
   - Verify photo is compressed (check network tab - should be < 200KB)
5. Test manual URL input (expand "Or enter a photo URL manually")
6. Update other fields
7. Test ZIP code auto-lookup by entering a ZIP code
8. Click "Save Changes"
9. Verify photo displays in read-only view
10. Verify all changes are saved and displayed correctly
11. Test "Cancel" button works

**Test Onboarding Flow:**
1. Create a new account
2. Complete the enhanced profile form during onboarding
3. **Test Photo Upload:**
   - Click "Choose Photo" button at top of form
   - Upload a photo and verify preview
   - Try alternative URL input method
4. Enter a ZIP code and verify city auto-populates
5. Complete form and submit
6. Verify all fields (including photo) save to database
7. Check Supabase Storage to verify photo was uploaded to correct location

**Test Storage Security:**
1. Try uploading photos as different users
2. Verify users can only see/delete their own uploads in storage
3. Verify photos are publicly viewable via URL
4. Check that file paths follow pattern: `{user_id}/{timestamp}_{filename}`

## Field Validations

### Required Fields
- Full Name
- Phone (must be 10 digits)

### Optional Fields (All Others)
- Address
- City (auto-populated from ZIP, can be edited)
- ZIP Code (must be 5 digits if provided)
- Bio
- Emergency Contact
- Emergency Contact Phone
- Profession
- Employer

### Auto-Population
- **City from ZIP Code**: When a valid 5-digit ZIP code is entered, the city is automatically looked up and populated

## UI/UX Features

### Dashboard Profile View
- **Read Mode**: Clean display of all profile information in 2-column grid
  - Profile photo displayed at top (if URL provided)
  - Graceful handling of invalid image URLs
- **Edit Mode**: Full-featured form with all fields editable
  - Profile photo URL input with live preview
  - Preview updates as you type
  - Error handling for invalid images
- **Responsive**: Adapts to mobile, tablet, and desktop screens
- **Validation**: Real-time validation with error messages
- **ZIP Lookup**: Automatic city lookup when ZIP is entered

### Onboarding Flow
- **Comprehensive**: Collects all profile information upfront
- **Profile Photo**: URL input with live preview at the top of the form
- **Optional Fields**: Only name and phone are required
- **Better Layout**: 2-column grid for better space usage
- **Guided Input**: Clear labels and placeholders for all fields

## Data Model

```typescript
interface Profile {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address?: string | null;
  city?: string | null;
  zip_code?: string | null;
  bio?: string | null;
  profile_photo_url?: string | null;
  emergency_contact?: string | null;
  emergency_contact_phone?: string | null;
  profession?: string | null;
  employer?: string | null;
}
```

## Profile Photo Implementation

### Current Implementation (Camera/Gallery Upload + URL Option)
- ✅ **Primary Method**: Camera/Gallery upload with automatic compression
  - Users can choose photos from camera roll or take new photos
  - Automatic image compression (max 800x800px, 85% quality)
  - Uploads to Supabase Storage `profile-photos` bucket
  - Maximum file size: 10MB (before compression)
  - Compressed files are typically < 200KB
- ✅ **Alternative Method**: Manual URL entry (in collapsible section)
  - Users can enter any publicly accessible photo URL
  - Useful for photos already hosted elsewhere
- ✅ Live preview in both dashboard edit mode and onboarding
- ✅ Photo displays as circular avatar (128x128px in view mode, 96x96px in edit/preview)
- ✅ Upload progress indicators
- ✅ Error handling for failed uploads or invalid files
- ✅ Secure storage with RLS policies (users can only upload/delete their own photos)

### Future Enhancements

#### Additional Profile Photo Features
- Avatar display in header and throughout the app
- Default avatar/initials if no photo provided
- Image cropping tool before saving
- Multiple photo sizes (thumbnail, medium, large)

### Enhanced Validations
- Email verification for emergency contact
- Phone number formatting/masking
- Address validation/autocomplete

### Additional Fields to Consider
- Birth date
- Social media links
- Preferred contact method
- Languages spoken
- Availability preferences

## Notes

✅ **Email is Read-Only**: The email field is tied to authentication and cannot be changed through this form. Users would need to change it through account settings.

✅ **Phone Formatting**: Phone numbers are validated for 10 digits and formatted as (XXX) XXX-XXXX for display.

✅ **ZIP Code Lookup**: Uses the existing `lookupZipCode` utility function that's already in use for children.

✅ **Backward Compatible**: All new fields are nullable, so existing profiles will continue to work without issues.

✅ **Following Existing Patterns**: The implementation follows the same patterns used for Children and Pets sections in the dashboard.

## Rollback Plan

If issues arise, you can rollback by:

1. **Database**: Drop the new columns (though this isn't necessary as they're nullable)
```sql
ALTER TABLE profiles
DROP COLUMN IF EXISTS address,
DROP COLUMN IF EXISTS city,
DROP COLUMN IF EXISTS zip_code,
DROP COLUMN IF EXISTS bio,
DROP COLUMN IF EXISTS profile_photo_url,
DROP COLUMN IF EXISTS emergency_contact,
DROP COLUMN IF EXISTS emergency_contact_phone,
DROP COLUMN IF EXISTS profession,
DROP COLUMN IF EXISTS employer;
```

2. **Frontend**: Revert the changes to the two files using git:
```bash
git checkout HEAD~1 -- app/dashboard/page.tsx app/onboarding/profile/page.tsx
```

## Success Criteria

- ✅ Users can view all profile fields in dashboard
- ✅ Users can edit and save profile information
- ✅ New signups can enter profile information during onboarding
- ✅ ZIP code auto-lookup works correctly
- ✅ Validations prevent invalid data
- ✅ No errors in console
- ✅ Responsive on all screen sizes

---

**Deployment Status**: Ready for Production
**Testing Required**: Yes (Manual testing recommended)
**Breaking Changes**: None
**Database Changes**: Additive only (no data loss)
