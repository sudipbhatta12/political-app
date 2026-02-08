-- Extension to Supabase Schema for Source Library
-- Run this in the Supabase SQL Editor

-- Political Parties table
CREATE TABLE IF NOT EXISTS political_parties (
    id SERIAL PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_np TEXT,
    abbreviation TEXT,
    website_url TEXT,
    facebook_url TEXT,
    twitter_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- News Media table
CREATE TABLE IF NOT EXISTS news_media (
    id SERIAL PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_np TEXT,
    website_url TEXT,
    facebook_url TEXT,
    twitter_url TEXT,
    youtube_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Media Posts table (to link posts to sources)
-- This table consolidates posts from various sources (News, Parties) distinct from the 'posts' table which might be candidate-specific
CREATE TABLE IF NOT EXISTS media_posts (
    id SERIAL PRIMARY KEY,
    source_type TEXT CHECK(source_type IN ('news_media', 'political_party')),
    source_id INTEGER NOT NULL,
    post_url TEXT,
    title TEXT,
    content TEXT,
    published_date TIMESTAMPTZ,
    sentiment_score REAL DEFAULT 0,
    positive_percentage REAL DEFAULT 0,
    negative_percentage REAL DEFAULT 0,
    neutral_percentage REAL DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_political_parties_active ON political_parties(is_active);
CREATE INDEX IF NOT EXISTS idx_news_media_active ON news_media(is_active);
CREATE INDEX IF NOT EXISTS idx_media_posts_source ON media_posts(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_media_posts_date ON media_posts(published_date);

-- RLS Policies
ALTER TABLE political_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read" ON political_parties;
CREATE POLICY "Allow public read" ON political_parties FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read" ON news_media;
CREATE POLICY "Allow public read" ON news_media FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read" ON media_posts;
CREATE POLICY "Allow public read" ON media_posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert" ON political_parties;
CREATE POLICY "Allow authenticated insert" ON political_parties FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated update" ON political_parties;
CREATE POLICY "Allow authenticated update" ON political_parties FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated insert" ON news_media;
CREATE POLICY "Allow authenticated insert" ON news_media FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated update" ON news_media;
CREATE POLICY "Allow authenticated update" ON news_media FOR UPDATE USING (auth.role() = 'authenticated');
