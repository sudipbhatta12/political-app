-- Restore Bablu Gupta to Siraha Constituency 1
-- Run this in Supabase SQL Editor

INSERT INTO candidates (name, party_name, constituency_id)
VALUES ('बब्लु गुप्ता', 'राष्ट्रिय स्वतन्त्र पार्टी', 195);

-- Verify the insertion
SELECT * FROM candidates WHERE name = 'बब्लु गुप्ता';
