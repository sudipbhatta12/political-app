-- =============================================
-- Cleanup Duplicate Records in news_media and political_parties
-- Run this in Supabase SQL Editor
-- =============================================

-- Step 1: Remove duplicate news_media entries (keep the one with the lowest ID)
DELETE FROM news_media
WHERE id NOT IN (
    SELECT MIN(id)
    FROM news_media
    GROUP BY name_en
);

-- Step 2: Remove duplicate political_parties entries (keep the one with the lowest ID)
DELETE FROM political_parties
WHERE id NOT IN (
    SELECT MIN(id)
    FROM political_parties
    GROUP BY name_en
);

-- Step 3: Add unique constraints to prevent future duplicates
-- (This will fail if duplicates still exist, run the DELETE statements first)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'news_media_name_en_unique'
    ) THEN
        ALTER TABLE news_media ADD CONSTRAINT news_media_name_en_unique UNIQUE (name_en);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'political_parties_name_en_unique'
    ) THEN
        ALTER TABLE political_parties ADD CONSTRAINT political_parties_name_en_unique UNIQUE (name_en);
    END IF;
END $$;

-- Verification: Check remaining counts
SELECT 'news_media' as table_name, COUNT(*) as count FROM news_media
UNION ALL
SELECT 'political_parties' as table_name, COUNT(*) as count FROM political_parties;
