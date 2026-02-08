-- Enable Row Level Security on news_media table (if not already enabled)
ALTER TABLE news_media ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users (public role) to insert new news sources
-- This is necessary because the verified frontend "Add New News Source" feature creates new entries.
CREATE POLICY "Allow public insert" ON news_media FOR INSERT WITH CHECK (true);

-- Allow public read access (select) to news_media is likely already there, but good to ensure
-- CREATE POLICY "Allow public read" ON news_media FOR SELECT USING (true);
