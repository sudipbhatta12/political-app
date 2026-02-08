-- Add popular_comments column to media_posts table
-- Run this in Supabase SQL Editor

-- Add the column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media_posts' AND column_name = 'popular_comments'
    ) THEN
        ALTER TABLE media_posts ADD COLUMN popular_comments TEXT DEFAULT '[]';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'media_posts';
