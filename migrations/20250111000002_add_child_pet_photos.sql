-- Migration: Add photo URLs to children and pets tables
-- Created: 2025-01-11
-- Description: Adds photo_url column to children and pets tables for profile pictures

-- Add photo_url to children table
ALTER TABLE children
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add photo_url to pets table
ALTER TABLE pets
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add comments to document the fields
COMMENT ON COLUMN children.photo_url IS 'URL to child profile photo';
COMMENT ON COLUMN pets.photo_url IS 'URL to pet profile photo';
