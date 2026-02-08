-- Enable Row Level Security on media_posts table (if not already enabled)
ALTER TABLE media_posts ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users (public role) to insert new posts into media_posts
-- This is necessary because the backend currently uses the anon key for submissions.
CREATE POLICY "Allow public insert" ON media_posts FOR INSERT WITH CHECK (true);

-- Optional: Allow public updates if needed (uncomment if required)
-- CREATE POLICY "Allow public update" ON media_posts FOR UPDATE USING (true);
