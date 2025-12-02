-- Migration: Add additional profile fields
-- Created: 2025-01-11
-- Description: Adds address, city, zip_code, bio, profile_photo_url, emergency_contact, emergency_contact_phone, profession, and employer to profiles table

-- Add new columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state VARCHAR(2),
ADD COLUMN IF NOT EXISTS zip_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS profession TEXT,
ADD COLUMN IF NOT EXISTS employer TEXT;

-- Add comment to document the fields
COMMENT ON COLUMN profiles.address IS 'Street address of the user';
COMMENT ON COLUMN profiles.city IS 'City/Town of the user';
COMMENT ON COLUMN profiles.state IS 'State abbreviation (2 characters)';
COMMENT ON COLUMN profiles.zip_code IS 'ZIP/Postal code of the user';
COMMENT ON COLUMN profiles.bio IS 'User bio or about me section';
COMMENT ON COLUMN profiles.profile_photo_url IS 'URL to user profile photo';
COMMENT ON COLUMN profiles.emergency_contact IS 'Emergency contact name';
COMMENT ON COLUMN profiles.emergency_contact_phone IS 'Emergency contact phone number';
COMMENT ON COLUMN profiles.profession IS 'User profession/job title';
COMMENT ON COLUMN profiles.employer IS 'User employer/company name';
