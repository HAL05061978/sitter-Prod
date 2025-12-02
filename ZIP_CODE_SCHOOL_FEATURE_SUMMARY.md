# ZIP Code and School Lookup Feature

## Overview
This feature automatically populates town/city information based on ZIP code entry and provides a dropdown of schools for that ZIP code in both the Dashboard Children section and Signup page.

## Features Implemented

### 1. ZIP Code to Town Lookup
- Automatically fetches town/city when user enters a 5-digit ZIP code
- Uses the free Zippopotam.us API for real-time lookups
- Works for all US ZIP codes
- Town field is auto-populated but can be manually edited if needed

### 2. School Dropdown by ZIP Code
- Database table `schools` stores schools linked to ZIP codes
- When user enters a ZIP code, available schools are fetched from database
- Dropdown appears with schools for that ZIP code
- Option to select "Other (type manually)" if school is not in the list
- Falls back to text input if no schools found for that ZIP code

### 3. Implementation Locations

#### Dashboard - Children Tab
**File:** `app/dashboard/page.tsx`
- Add Child form includes ZIP code lookup
- Edit Child form includes ZIP code lookup
- Both forms show school dropdown when schools are available
- Console logging added for debugging child updates

#### Signup Page
**File:** `app/signup/page.tsx`
- Child information form includes ZIP code lookup
- School dropdown functionality for each child
- Works with multiple children on the same form

## Files Created/Modified

### New Files
1. **`app/lib/zipcode-utils.ts`** - ZIP code lookup utilities
   - `lookupZipCode()` function for API calls
   - `formatZipCode()` helper function

2. **`migrations/create_schools_table.sql`** - Database migration
   - Creates `schools` table
   - Includes sample schools for Trumbull, CT (06611)
   - Sets up RLS policies

3. **`DEPLOY_SCHOOLS_TABLE.md`** - Deployment guide for database migration

4. **`ZIP_CODE_SCHOOL_FEATURE_SUMMARY.md`** - This document

### Modified Files
1. **`app/dashboard/page.tsx`**
   - Added ZIP code lookup handlers
   - Added school dropdown logic
   - Updated Child interface to include new fields
   - Enhanced edit form with all child details
   - Fixed child update functionality

2. **`app/signup/page.tsx`**
   - Added ZIP code lookup for each child
   - Added school dropdown for each child
   - Reordered fields for better UX (ZIP code before town)

## Database Schema

### Schools Table
```sql
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    zip_code TEXT NOT NULL,
    town TEXT NOT NULL,
    state TEXT DEFAULT 'CT',
    address TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexes:**
- `idx_schools_zip_code` on `zip_code`
- `idx_schools_name` on `name`

**RLS Policies:**
- All authenticated users can read schools
- Only service_role can insert/update schools

### Sample Data
Includes 9 schools from Trumbull, CT (ZIP 06611):
- Tashua Elementary School
- Daniels Farm Elementary School
- Frenchtown Elementary School
- Middlebrook Elementary School
- Booth Hill Elementary School
- Jane Ryan Elementary School
- Trumbull High School
- Madison Middle School
- Hillcrest Middle School

## User Experience Flow

### Adding/Editing a Child

1. User enters a 5-digit ZIP code
2. Town automatically populates (if ZIP code is valid)
3. School dropdown appears with available schools for that ZIP code
4. User selects a school from dropdown OR chooses "Other" to type manually
5. User fills in remaining fields (name, birthdate, grade)
6. Saves the child information

### If School Not in List
- User can select "Other (type manually)"
- A new text input appears below the dropdown
- User can type any school name

### If No Schools for ZIP Code
- Text input is shown instead of dropdown
- User can manually type school name
- Placeholder text indicates "Enter school name or ZIP code first"

## API Used

### Zippopotam.us API
- **Endpoint:** `https://api.zippopotam.us/us/{zipcode}`
- **Free:** No API key required
- **Response:** Returns city, state, county information
- **Coverage:** All US ZIP codes

**Example Response:**
```json
{
  "post code": "06611",
  "country": "United States",
  "country abbreviation": "US",
  "places": [
    {
      "place name": "Trumbull",
      "state": "Connecticut",
      "state abbreviation": "CT"
    }
  ]
}
```

## Adding More Schools

To add schools for additional ZIP codes:

1. Connect to Supabase SQL Editor
2. Run INSERT statement:

```sql
INSERT INTO schools (name, zip_code, town, state, address) VALUES
    ('School Name', 'ZIP', 'Town', 'ST', 'Address');
```

Example:
```sql
INSERT INTO schools (name, zip_code, town, state, address) VALUES
    ('Westport Elementary', '06880', 'Westport', 'CT', '110 Myrtle Avenue');
```

## Testing

### To Test Dashboard
1. Navigate to Dashboard → Children tab
2. Click "Add Child"
3. Enter ZIP code "06611"
4. Verify town auto-populates as "Trumbull"
5. Verify school dropdown appears with 9 schools
6. Select a school and save
7. Click Edit on the child
8. Verify all fields are populated correctly including school

### To Test Signup
1. Navigate to Signup page
2. Fill in parent information
3. In child information, enter ZIP code "06611"
4. Verify town auto-populates
5. Verify school dropdown appears
6. Test with multiple children

### To Test with Invalid/Unknown ZIP Code
1. Enter ZIP code "00000"
2. Verify town doesn't auto-populate (or shows error)
3. Verify text input is shown for school
4. User can manually enter all information

## Browser Console Debugging

The Dashboard now includes console logging for child updates:
- `Updating child with data:` - Shows data being sent to database
- `Update result:` - Shows success/error from database
- `Fetched children after update:` - Shows refreshed child data

Check browser console (F12) to debug if child updates aren't working.

## Known Limitations

1. **ZIP Code API**: Depends on external Zippopotam.us API. If API is down, town auto-population won't work, but manual entry still works.

2. **School Database**: Only contains sample schools for Trumbull, CT. Needs to be populated with more schools for other areas.

3. **ZIP+4 Format**: Currently only supports 5-digit ZIP codes. ZIP+4 (9-digit) codes are limited to 5 digits.

## Future Enhancements

1. **Bulk School Import**: Create a script to import schools from a CSV file
2. **School Search**: Add ability to search schools by name across all ZIP codes
3. **School Details**: Add more fields like district, type (public/private), website
4. **Offline Fallback**: Cache ZIP code lookups for offline use
5. **ZIP Code Validation**: Add more robust ZIP code validation
6. **International Support**: Extend to support postal codes from other countries

## Deployment Checklist

- [ ] Run database migration (`migrations/create_schools_table.sql`)
- [ ] Verify schools table created successfully
- [ ] Add schools for your target ZIP codes
- [ ] Test ZIP code lookup in Dashboard
- [ ] Test ZIP code lookup in Signup
- [ ] Test with valid and invalid ZIP codes
- [ ] Test school dropdown selection
- [ ] Test manual school name entry
- [ ] Deploy to production environment
- [ ] Monitor for any API rate limiting issues

## Support & Maintenance

### Adding Schools for New Areas
When expanding to new geographic areas, add schools using the SQL INSERT statements documented above.

### Monitoring ZIP Code API
The Zippopotam.us API is free and doesn't require authentication, but monitor for:
- API availability/uptime
- Response times
- Any rate limiting

### Database Maintenance
- Schools table includes `updated_at` timestamp
- Create indexes on commonly queried fields if performance becomes an issue
- Consider partitioning if table grows very large (>100K records)
