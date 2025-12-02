# Children and Pet Photos - Deployment Guide

## Overview
This update adds photo upload functionality to Children and Pets sections in the Dashboard, matching the same camera/gallery upload process used for Profile photos.

## New Features Added

### Children Photo Upload
- **Photo Upload** - Camera/gallery upload with automatic compression
- **Photo Display** - Actual photos displayed in view mode (with gradient placeholder fallback)
- **Photo Management** - Users can update photos when editing children

### Pet Photo Upload
- **Photo Upload** - Camera/gallery upload with automatic compression
- **Photo Display** - Actual photos displayed in view mode (with gradient placeholder fallback)
- **Photo Management** - Users can update photos when editing pets

## Changes Made

### 1. Database Migration - Add photo_url columns
**File**: `migrations/20250111000002_add_child_pet_photos.sql`
- Adds `photo_url` column to `children` table
- Adds `photo_url` column to `pets` table
- Safe to run multiple times (uses `IF NOT EXISTS`)

### 2. Storage Bucket Setup
**File**: `migrations/20250111000003_create_children_photos_bucket.sql`
- Creates RLS policies for `children-photos` bucket
- Bucket must be created manually via Supabase UI first

**File**: `migrations/20250111000004_create_pet_photos_bucket.sql`
- Creates RLS policies for `pet-photos` bucket
- Bucket must be created manually via Supabase UI first

### 3. Dashboard Updates
**File**: `app/dashboard/page.tsx`

#### Child Interface Update:
```typescript
interface Child {
  // ... existing fields
  photo_url?: string | null;  // ADDED
}
```

#### Pet Interface Update:
```typescript
interface Pet {
  // ... existing fields
  photo_url?: string | null;  // ADDED
}
```

#### New State Variables:
```typescript
// Children photo upload state
const [uploadingChildPhoto, setUploadingChildPhoto] = useState(false);
const [childPhotoError, setChildPhotoError] = useState<string | null>(null);
const [editChildPhotoUrl, setEditChildPhotoUrl] = useState("");

// Pet photo upload state
const [uploadingPetPhoto, setUploadingPetPhoto] = useState(false);
const [petPhotoError, setPetPhotoError] = useState<string | null>(null);
const [editPetPhotoUrl, setEditPetPhotoUrl] = useState("");
```

#### New Upload Handlers:
- `handleChildPhotoUpload()` - Handles child photo upload with compression
- `handlePetPhotoUpload()` - Handles pet photo upload with compression

Both handlers:
- Validate file type (images only)
- Validate file size (max 10MB before compression)
- Compress images to 800x800px, 85% quality JPEG
- Upload to respective Supabase Storage bucket
- Update edit state with public URL

#### Updated Functions:
- `handleEditChild()` - Includes `setEditChildPhotoUrl(child.photo_url || "")`
- `handleSaveChildEdit()` - Includes `photo_url: editChildPhotoUrl?.trim() || null` in update
- `handleEditPet()` - Includes `setEditPetPhotoUrl(pet.photo_url || "")`
- `handleSavePetEdit()` - Includes `photo_url: editPetPhotoUrl?.trim() || null` in update

#### UI Updates:
**Children Edit Form:**
- Photo upload section at top of edit form
- Blue-themed camera button
- Upload progress indicators
- Photo preview (24x24px rounded)
- Error messaging

**Children View:**
- Displays actual photo if `photo_url` exists
- Falls back to gradient placeholder (blue/cyan) if no photo
- Error handling for failed image loads

**Pets Edit Form:**
- Photo upload section at top of edit form
- Purple-themed camera button
- Upload progress indicators
- Photo preview (24x24px rounded)
- Error messaging

**Pets View:**
- Displays actual photo if `photo_url` exists
- Falls back to gradient placeholder (purple/pink) if no photo
- Error handling for failed image loads

## Deployment Steps

### Step 1: Run Database Migration (Add photo_url columns)
Add the photo_url columns to children and pets tables:

**Via Supabase Dashboard:**
1. Go to SQL Editor in Supabase Dashboard
2. Copy and paste the contents of `migrations/20250111000002_add_child_pet_photos.sql`
3. Click "Run"

**Via Supabase CLI:**
```bash
supabase db push
```

### Step 2: Create Storage Buckets Manually
**IMPORTANT**: The storage buckets must be created through the UI due to permissions.

#### Create children-photos bucket:
1. Go to Supabase Dashboard > **Storage**
2. Click **"Create a new bucket"**
3. Bucket name: `children-photos`
4. **Check "Public bucket"** (important!)
5. Click **"Create bucket"**

#### Create pet-photos bucket:
1. Click **"Create a new bucket"** again
2. Bucket name: `pet-photos`
3. **Check "Public bucket"** (important!)
4. Click **"Create bucket"**

### Step 3: Setup RLS Policies for Storage

#### For children-photos bucket:
**Via Supabase Dashboard:**
1. Go to SQL Editor in Supabase Dashboard
2. Copy and paste the contents of `migrations/20250111000003_create_children_photos_bucket.sql`
3. Click "Run"

#### For pet-photos bucket:
1. Go to SQL Editor in Supabase Dashboard
2. Copy and paste the contents of `migrations/20250111000004_create_pet_photos_bucket.sql`
3. Click "Run"

This will create the RLS policies that:
- Allow users to upload/update/delete only their own photos
- Allow everyone to view photos (since buckets are public)

### Step 4: Verify Storage Setup
1. Go to Storage in Supabase Dashboard
2. Confirm both `children-photos` and `pet-photos` buckets exist and are marked as "Public"
3. Click on each bucket and go to "Policies" tab
4. Verify 4 policies are active for each bucket:
   - Users can upload their own [children/pet] photos
   - [Children/Pet] photos are publicly accessible
   - Users can update their own [children/pet] photos
   - Users can delete their own [children/pet] photos

### Step 5: Deploy Frontend Changes
Deploy the updated file:
- `app/dashboard/page.tsx`

### Step 6: Test the Changes

#### Test Children Photo Upload:
1. Log in to the app
2. Go to Dashboard > Children tab
3. Click "Edit" on an existing child
4. **Test Photo Upload:**
   - Click "Choose Photo" button
   - Select an image from camera/gallery
   - Verify upload progress indicator appears
   - Verify photo preview appears after upload (24x24px circular)
   - Verify photo is compressed (check network tab - should be < 200KB)
5. Click "Save"
6. Verify photo displays in view mode (24x24px circular on left)
7. Verify gradient placeholder shows if no photo

#### Test Pet Photo Upload:
1. Go to Dashboard > Pets tab
2. Click "Edit" on an existing pet
3. **Test Photo Upload:**
   - Click "Choose Photo" button (purple-themed)
   - Select an image from camera/gallery
   - Verify upload progress indicator appears
   - Verify photo preview appears after upload (24x24px circular)
   - Verify photo is compressed (check network tab - should be < 200KB)
4. Click "Save"
5. Verify photo displays in view mode (24x24px circular on left)
6. Verify gradient placeholder shows if no photo

#### Test Storage Security:
1. Try uploading photos for different children/pets
2. Verify users can only see/delete their own uploads in storage
3. Verify photos are publicly viewable via URL
4. Check that file paths follow pattern: `{user_id}/{timestamp}_{filename}`

## Image Specifications

### Compression Settings
- **Maximum Dimensions**: 800x800px (maintains aspect ratio)
- **Format**: JPEG
- **Quality**: 85%
- **Maximum File Size (before compression)**: 10MB
- **Typical Compressed Size**: < 200KB

### Display Sizes
- **View Mode**: 24x24px circular avatar on left side
- **Edit Mode Preview**: 24x24px circular preview
- **Border**: 4px border (blue for children, purple for pets)

### Gradient Placeholders
- **Children**: Blue to cyan gradient with first letter of name
- **Pets**: Purple to pink gradient with first letter of name

## Field Information

### Database Schema
```sql
-- children table
ALTER TABLE children
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- pets table
ALTER TABLE pets
ADD COLUMN IF NOT EXISTS photo_url TEXT;
```

### Storage Structure
```
children-photos/
  {user_id}/
    {timestamp}_{filename}.jpg

pet-photos/
  {user_id}/
    {timestamp}_{filename}.jpg
```

## Troubleshooting

### Upload Fails with "Failed to upload photo"
- Check that the storage buckets are created and set to **Public**
- Verify RLS policies are active
- Check browser console for detailed error messages

### Photos Don't Display
- Verify photo URLs are saved correctly in database
- Check that buckets are marked as **Public**
- Verify RLS policies allow SELECT for public users
- Check browser console for CORS or loading errors

### "Bucket not found" Error
- Ensure storage buckets are created manually via Supabase UI
- Bucket names must be exactly: `children-photos` and `pet-photos`
- Buckets must be marked as **Public**

### Compression Issues
- Ensure file is a valid image format (JPEG, PNG, GIF, WebP)
- File must be under 10MB before compression
- Check browser console for detailed compression errors

## Rollback Plan

If issues arise, you can rollback by:

1. **Database**: Drop the photo_url columns (optional, as they're nullable)
```sql
ALTER TABLE children DROP COLUMN IF EXISTS photo_url;
ALTER TABLE pets DROP COLUMN IF EXISTS photo_url;
```

2. **Storage**: Delete the storage buckets via Supabase UI
   - Go to Storage > children-photos > Settings > Delete bucket
   - Go to Storage > pet-photos > Settings > Delete bucket

3. **Frontend**: Revert the changes to dashboard using git:
```bash
git checkout HEAD~1 -- app/dashboard/page.tsx
```

## Success Criteria

- ✅ Users can upload photos for children from camera/gallery
- ✅ Users can upload photos for pets from camera/gallery
- ✅ Photos are automatically compressed to reasonable sizes
- ✅ Photos display correctly in view mode
- ✅ Gradient placeholders show when no photo is set
- ✅ Upload progress and errors are clearly communicated
- ✅ Photos persist after saving
- ✅ No errors in console
- ✅ Responsive on all screen sizes

## Security Considerations

### RLS Policies Implemented
- Users can only upload photos to their own user folder
- Users can only update/delete their own photos
- All photos are publicly viewable (required for display)

### File Validation
- Only image files accepted (checked via MIME type)
- Maximum file size enforced (10MB)
- Files are renamed to prevent injection attacks
- Timestamps prevent filename collisions

---

**Deployment Status**: Ready for Production
**Testing Required**: Yes (Manual testing recommended)
**Breaking Changes**: None
**Database Changes**: Additive only (no data loss)
**Depends On**: Profile photo upload feature (migrations 20250111000000 and 20250111000001)
