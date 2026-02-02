-- Add comment_count column to posts table
-- Run this in Supabase SQL Editor

ALTER TABLE posts ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;
