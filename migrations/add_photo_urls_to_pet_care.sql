-- Migration: Add photo_urls column to scheduled_pet_care table
-- Created: 2025-01-12
-- Description: Adds support for photo uploads to pet care blocks, matching the child care functionality

-- Add photo_urls column to scheduled_pet_care table
ALTER TABLE scheduled_pet_care
ADD COLUMN IF NOT EXISTS photo_urls TEXT[];

-- Add comment
COMMENT ON COLUMN scheduled_pet_care.photo_urls IS 'Array of URLs to photos uploaded during pet care';
