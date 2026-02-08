-- =============================================
-- Cleanup Duplicate Posts in media_posts table
-- Run this in Supabase SQL Editor
-- =============================================

-- This script removes duplicate media_posts entries that have the same
-- (source_type, source_id, post_url) combination, keeping only the most recent one.

-- Step 1: Identify and delete duplicate posts (keep the one with highest ID = most recent)
DELETE FROM media_posts
WHERE id NOT IN (
    SELECT MAX(id)
    FROM media_posts
    WHERE post_url IS NOT NULL AND post_url != ''
    GROUP BY source_type, source_id, post_url
)
AND post_url IS NOT NULL 
AND post_url != '';

-- Step 2: Add a unique constraint to prevent future duplicates
-- (This is optional but recommended - only run if you want to enforce uniqueness at DB level)
-- Note: This will fail if there are still duplicates, so run the DELETE first
-- DO $$
-- BEGIN
--     IF NOT EXISTS (
--         SELECT 1 FROM pg_constraint WHERE conname = 'media_posts_unique_url'
--     ) THEN
--         ALTER TABLE media_posts ADD CONSTRAINT media_posts_unique_url 
--         UNIQUE (source_type, source_id, post_url);
--     END IF;
-- END $$;

-- Step 3: Verify - Show remaining posts count per source
SELECT 
    source_type, 
    COUNT(*) as total_posts,
    COUNT(DISTINCT post_url) as unique_urls
FROM media_posts 
GROUP BY source_type;
