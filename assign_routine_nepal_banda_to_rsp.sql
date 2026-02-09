-- Update existing "Routine of Nepal Banda" post to assign it to RSP
-- Run this in Supabase SQL Editor

-- Step 1: Find RSP's ID (this will show you the ID)
SELECT id, name_en, abbreviation 
FROM political_parties 
WHERE abbreviation = 'RSP' OR name_en LIKE '%Rastriya Swatantra%';

-- Step 2: Update the media post to assign it to RSP
-- This automatically finds RSP's ID and assigns it
UPDATE media_posts 
SET related_party_id = (
    SELECT id FROM political_parties WHERE abbreviation = 'RSP' LIMIT 1
)
WHERE source_type = 'news_media' 
  AND source_id = (
      SELECT id FROM news_media WHERE name_en = 'Routine of Nepal Banda'
  )
  AND related_party_id IS NULL;

-- Step 3: Verify the update
SELECT 
    mp.id,
    nm.name_en as news_source,
    pp.name_en as related_party,
    mp.published_date
FROM media_posts mp
LEFT JOIN news_media nm ON mp.source_id = nm.id AND mp.source_type = 'news_media'
LEFT JOIN political_parties pp ON mp.related_party_id = pp.id
WHERE nm.name_en = 'Routine of Nepal Banda';
