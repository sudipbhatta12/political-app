-- =============================================
-- Daily Reports Schema Extension
-- Run this in Supabase SQL Editor to enable daily report generation
-- =============================================

-- Daily Reports Table (stores generated reports)
CREATE TABLE IF NOT EXISTS daily_reports (
    id SERIAL PRIMARY KEY,
    report_date DATE NOT NULL UNIQUE,
    total_posts_analyzed INTEGER DEFAULT 0,
    total_comments_analyzed INTEGER DEFAULT 0,
    total_sources INTEGER DEFAULT 0,
    overall_positive REAL DEFAULT 0,
    overall_negative REAL DEFAULT 0,
    overall_neutral REAL DEFAULT 0,
    summary_text TEXT,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Report Summaries Table (stores per-source breakdowns)
CREATE TABLE IF NOT EXISTS report_summaries (
    id SERIAL PRIMARY KEY,
    report_id INTEGER NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    source_type TEXT CHECK (source_type = ANY (ARRAY['candidate'::text, 'news_media'::text, 'political_party'::text])),
    source_id INTEGER,
    source_name TEXT,
    total_posts INTEGER DEFAULT 0,
    total_comments INTEGER DEFAULT 0,
    avg_positive REAL DEFAULT 0,
    avg_negative REAL DEFAULT 0,
    avg_neutral REAL DEFAULT 0,
    key_topics TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_summaries ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for viewing reports)
CREATE POLICY "allow_public_read_daily_reports" ON daily_reports
    FOR SELECT USING (true);

CREATE POLICY "allow_public_read_report_summaries" ON report_summaries
    FOR SELECT USING (true);

-- Allow authenticated users to create/update reports
CREATE POLICY "allow_insert_daily_reports" ON daily_reports
    FOR INSERT WITH CHECK (true);

CREATE POLICY "allow_update_daily_reports" ON daily_reports
    FOR UPDATE USING (true);

CREATE POLICY "allow_insert_report_summaries" ON report_summaries
    FOR INSERT WITH CHECK (true);

CREATE POLICY "allow_delete_report_summaries" ON report_summaries
    FOR DELETE USING (true);

-- Index for faster date lookups
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_report_summaries_report_id ON report_summaries(report_id);

-- =============================================
-- IMPORTANT: After running this script, go back to your app 
-- and try generating a daily report again.
-- =============================================
