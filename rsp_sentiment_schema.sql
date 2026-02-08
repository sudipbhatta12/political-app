-- =============================================
-- RSP Sentiment Analysis Schema & Data Update
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Add RSP Sentiment Columns to 'posts' table (Candidates)
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS rsp_love_percentage REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS rsp_hate_percentage REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS rsp_neutral_percentage REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS rsp_remarks TEXT;

-- 2. Add RSP Sentiment Columns to 'media_posts' table (News & Parties)
ALTER TABLE media_posts 
ADD COLUMN IF NOT EXISTS rsp_love_percentage REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS rsp_hate_percentage REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS rsp_neutral_percentage REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS rsp_remarks TEXT;

-- 3. Insert 'Routine of Nepal Banda' (RONB) into news_media
-- Using ON CONFLICT to avoid errors if it already exists (assuming name_en is unique or just trying)
-- If name_en is not unique, we can check existence first.
INSERT INTO news_media (name_en, name_np, is_active)
SELECT 'Routine of Nepal Banda', 'Routine of Nepal Banda', true
WHERE NOT EXISTS (
    SELECT 1 FROM news_media WHERE name_en = 'Routine of Nepal Banda'
);

-- =============================================
-- Verification
-- =============================================
-- SELECT * FROM news_media WHERE name_en = 'Routine of Nepal Banda';
