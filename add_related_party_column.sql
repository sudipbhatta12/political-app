-- Migration: Add related_party_id to media_posts table
-- This allows news articles to be associated with the political party they discuss
-- Run this in Supabase SQL Editor

-- Add the new column
ALTER TABLE media_posts ADD COLUMN IF NOT EXISTS related_party_id INTEGER REFERENCES political_parties(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_media_posts_related_party ON media_posts(related_party_id);

-- Done! Now news articles can be tagged with which party they're about.
