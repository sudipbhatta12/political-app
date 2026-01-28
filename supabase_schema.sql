-- Supabase Schema for Political Social Media Assessment
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Provinces table
CREATE TABLE IF NOT EXISTS provinces (
    id INTEGER PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_np TEXT
);

-- Districts table
CREATE TABLE IF NOT EXISTS districts (
    id INTEGER PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_np TEXT,
    province_id INTEGER NOT NULL REFERENCES provinces(id)
);

-- Constituencies table
CREATE TABLE IF NOT EXISTS constituencies (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    district_id INTEGER NOT NULL REFERENCES districts(id)
);

-- Candidates table
CREATE TABLE IF NOT EXISTS candidates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    party_name TEXT NOT NULL,
    constituency_id INTEGER NOT NULL REFERENCES constituencies(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posts (Remarks) table
CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    post_url TEXT,
    published_date TEXT,
    positive_percentage REAL DEFAULT 0,
    negative_percentage REAL DEFAULT 0,
    neutral_percentage REAL DEFAULT 0,
    positive_remarks TEXT,
    negative_remarks TEXT,
    neutral_remarks TEXT,
    conclusion TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    sentiment TEXT CHECK(sentiment IN ('positive', 'negative', 'neutral')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_districts_province ON districts(province_id);
CREATE INDEX IF NOT EXISTS idx_constituencies_district ON constituencies(district_id);
CREATE INDEX IF NOT EXISTS idx_candidates_constituency ON candidates(constituency_id);
CREATE INDEX IF NOT EXISTS idx_posts_candidate ON posts(candidate_id);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE constituencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public read/write (for demo purposes)
CREATE POLICY "Allow public read" ON provinces FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON districts FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON constituencies FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON candidates FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON candidates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON candidates FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON candidates FOR DELETE USING (true);
CREATE POLICY "Allow public read" ON posts FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON posts FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON posts FOR DELETE USING (true);
CREATE POLICY "Allow public read" ON comments FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete" ON comments FOR DELETE USING (true);
