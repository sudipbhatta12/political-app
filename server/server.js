/**
 * Express Server - Political Social Media Assessment
 * REST API for Nepal election candidate sentiment tracking
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const os = require('os');
const db = require('./database');
const { analyzeComments } = require('./ai-controller');

// Configure upload
const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});
// Authentication configuration
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'adminnepal2026';
const VIEWER_PASSWORD = process.env.VIEWER_PASSWORD || 'nepal2026';
const SECRET_KEY = process.env.SECRET_KEY || crypto.randomBytes(32).toString('hex');
const tokens = new Set(); // Store valid tokens in memory

const app = express();
const PORT = process.env.PORT || 3000;



// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public'), { index: false }));

// ============================================
// Authentication Routes
// ============================================

// Health check for Cloud Run
app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/_ah/health', (req, res) => res.status(200).send('OK')); // App Engine standard

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { password } = req.body;
    let role = null;

    if (password === ADMIN_PASSWORD) {
        role = 'admin';
    } else if (password === VIEWER_PASSWORD) {
        role = 'viewer';
    }

    if (role) {
        const token = crypto.randomBytes(32).toString('hex');

        // Store in memory for immediate access/fallback
        tokens.add(token);

        // Try to persist to DB, but don't block login if it fails (e.g. local dev without DB)
        try {
            await db.createSession(token);
        } catch (err) {
            console.error("Database session creation failed (using in-memory):", err.message);
        }

        res.json({ success: true, token, role });
    } else {
        res.json({ success: false, message: 'Invalid password' });
    }
});

// Verify token endpoint
app.post('/api/verify', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);

        // Check memory first
        if (tokens.has(token)) {
            return res.json({ valid: true });
        }

        const isValid = await db.verifySession(token);
        res.json({ valid: isValid });
    } else {
        res.json({ valid: false });
    }
});

// Logout endpoint
app.post('/api/logout', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        tokens.delete(token); // Remove from memory
        await db.deleteSession(token);
    }
    res.json({ success: true });
});

// Serve main app (protected)
app.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Redirect root to login
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

// ============================================
// Province Routes
// ============================================
app.get('/api/provinces', async (req, res) => {
    try {
        const provinces = await db.getAllProvinces();
        res.json(provinces);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// District Routes
// ============================================
app.get('/api/districts/:provinceId', async (req, res) => {
    try {
        const districts = await db.getDistrictsByProvince(parseInt(req.params.provinceId));
        res.json(districts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Constituency Routes
// ============================================
app.get('/api/recent-constituencies', async (req, res) => {
    try {
        const constituencies = await db.getRecentConstituencies();
        res.json(constituencies);
    } catch (error) {
        console.error("Database error in /recent-constituencies (Offline Fallback):", error.message);
        res.json([]); // Return empty array to prevent crash
    }
});

app.get('/api/constituencies/:districtId', async (req, res) => {
    try {
        const constituencies = await db.getConstituenciesByDistrict(parseInt(req.params.districtId));
        res.json(constituencies);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get available dates for a constituency
app.get('/api/constituency/:id/dates', async (req, res) => {
    try {
        const dates = await db.getConstituencyDates(parseInt(req.params.id));
        res.json(dates);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Candidate Routes
// ============================================

// Get candidates by constituency
app.get('/api/candidates', async (req, res) => {
    try {
        const { constituency_id, search, date } = req.query;

        if (search) {
            const candidates = await db.searchCandidates(search);
            return res.json(candidates);
        }

        if (constituency_id) {
            const candidates = await db.getCandidatesByConstituency(parseInt(constituency_id), date);
            // Group posts by candidate
            const candidatesMap = new Map();
            for (const row of candidates) {
                if (!candidatesMap.has(row.id)) {
                    candidatesMap.set(row.id, {
                        id: row.id,
                        name: row.name,
                        party_name: row.party_name,
                        constituency_id: row.constituency_id,
                        created_at: row.created_at,
                        updated_at: row.updated_at,
                        posts: []
                    });
                }
                if (row.post_id) {
                    candidatesMap.get(row.id).posts.push({
                        id: row.post_id,
                        post_url: row.post_url,
                        published_date: row.published_date,
                        positive_percentage: row.positive_percentage,
                        negative_percentage: row.negative_percentage,
                        neutral_percentage: row.neutral_percentage,
                        positive_remarks: row.positive_remarks,
                        negative_remarks: row.negative_remarks,
                        neutral_remarks: row.neutral_remarks,
                        conclusion: row.conclusion,
                        comment_count: row.comment_count,
                        popular_comments: row.popular_comments
                    });
                }
            }
            return res.json(Array.from(candidatesMap.values()));
        }

        res.json([]);
    } catch (error) {
        console.error("Database error in /candidates (Offline Fallback):", error.message);

        // Mock Data for Offline Mode
        const mockCandidates = [
            {
                id: 101,
                name: "Ravi Lamichhane (Demo)",
                party_name: "RSP",
                constituency_id: Number(req.query.constituency_id) || 1,
                posts: [
                    {
                        id: 1,
                        published_date: new Date().toISOString(),
                        positive_percentage: 65,
                        negative_percentage: 15,
                        neutral_percentage: 20,
                        comment_count: 154,
                        post_url: "https://facebook.com/demo1",
                        positive_remarks: "Strong support for new policies",
                        negative_remarks: "Concerns about implementation speed",
                        neutral_remarks: "Waiting to see results",
                        conclusion: "Overall sentiment remains highly positive due to recent announcements.",
                        popular_comments: JSON.stringify([{ content: "Great job!", likes: 10 }, { content: "Keep it up", likes: 5 }])
                    }
                ]
            },
            {
                id: 102,
                name: "Gagan Thapa (Demo)",
                party_name: "Nepali Congress",
                constituency_id: Number(req.query.constituency_id) || 1,
                posts: [
                    {
                        id: 2,
                        published_date: new Date().toISOString(),
                        positive_percentage: 45,
                        negative_percentage: 35,
                        neutral_percentage: 20,
                        comment_count: 89,
                        post_url: "https://facebook.com/demo2",
                        positive_remarks: "Appreciated verification tour",
                        negative_remarks: "Criticism on delay",
                        conclusion: "Mixed reactions from the recent town hall.",
                        popular_comments: JSON.stringify([])
                    }
                ]
            }
        ];

        res.json(mockCandidates);
    }
});

// Get all candidates with posts (Library view)
app.get('/api/library', async (req, res) => {
    try {
        const allCandidates = await db.getAllCandidatesWithPosts();

        // Transform to include constituency name and single post object
        const result = allCandidates.map(row => ({
            id: row.id,
            name: row.name,
            party_name: row.party_name,
            constituency_id: row.constituency_id,
            district_id: row.district_id,
            province_id: row.province_id,
            constituency_name: row.constituency_name,
            post: row.post_id ? {
                id: row.post_id,
                post_url: row.post_url,
                published_date: row.published_date,
                positive_percentage: row.positive_percentage,
                negative_percentage: row.negative_percentage,
                neutral_percentage: row.neutral_percentage,
                positive_remarks: row.positive_remarks,
                negative_remarks: row.negative_remarks,
                neutral_remarks: row.neutral_remarks,
                conclusion: row.conclusion
            } : null
        }));

        res.json(result);
    } catch (error) {
        console.error("Database error in /library (Offline Fallback):", error.message);

        // Mock Data for Library
        const mockLibrary = [
            {
                id: 101,
                name: "Ravi Lamichhane (Demo)",
                party_name: "RSP",
                constituency_name: "Chitwan 2",
                post: {
                    id: 1,
                    published_date: new Date().toISOString(),
                    positive_percentage: 65,
                    negative_percentage: 15,
                    neutral_percentage: 20,
                    conclusion: "Strong support observed."
                }
            }
        ];
        res.json(mockLibrary);
    }
});

// Create candidate
app.post('/api/candidates', async (req, res) => {
    try {
        const { name, party_name, constituency_id } = req.body;

        if (!name || !party_name || !constituency_id) {
            return res.status(400).json({ error: 'Name, party name, and constituency are required' });
        }

        // Check if constituency already has 5 candidates
        const existingCandidates = await db.getCandidatesByConstituency(constituency_id);
        const uniqueCandidates = new Set(existingCandidates.map(c => c.id));
        if (uniqueCandidates.size >= 5) {
            return res.status(400).json({ error: 'Maximum 5 candidates per constituency allowed' });
        }

        const candidateId = await db.createCandidate({ name, party_name, constituency_id });
        res.status(201).json({ id: candidateId, message: 'Candidate created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update candidate
app.put('/api/candidates/:id', async (req, res) => {
    try {
        const { name, party_name } = req.body;
        await db.updateCandidate(parseInt(req.params.id), { name, party_name });
        res.json({ message: 'Candidate updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete candidate
app.delete('/api/candidates/:id', async (req, res) => {
    try {
        await db.deleteCandidate(parseInt(req.params.id));
        res.json({ message: 'Candidate deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Post Routes
// ============================================

// Get posts by candidate
app.get('/api/candidates/:candidateId/posts', async (req, res) => {
    try {
        const posts = await db.getPostsByCandidate(parseInt(req.params.candidateId));
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create post
app.post('/api/posts', async (req, res) => {
    try {
        const {
            candidate_id, post_url, published_date,
            positive_percentage, negative_percentage, neutral_percentage,
            positive_remarks, negative_remarks, neutral_remarks, conclusion
        } = req.body;

        if (!candidate_id) {
            return res.status(400).json({ error: 'Candidate ID is required' });
        }

        // Validate percentages add up to ~100
        const total = (positive_percentage || 0) + (negative_percentage || 0) + (neutral_percentage || 0);
        if (total > 0 && (total < 99 || total > 101)) {
            return res.status(400).json({ error: 'Sentiment percentages should add up to 100%' });
        }

        const postId = await db.createPost({
            candidate_id,
            post_url,
            published_date,
            positive_percentage: positive_percentage || 0,
            negative_percentage: negative_percentage || 0,
            neutral_percentage: neutral_percentage || 0,
            positive_remarks: positive_remarks || '',
            negative_remarks: negative_remarks || '',
            neutral_remarks: neutral_remarks || '',
            conclusion: conclusion || ''
        });

        res.status(201).json({ id: postId, message: 'Post created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update post
app.put('/api/posts/:id', async (req, res) => {
    try {
        const {
            post_url, published_date,
            positive_percentage, negative_percentage, neutral_percentage,
            positive_remarks, negative_remarks, neutral_remarks, conclusion
        } = req.body;
        await db.updatePost(parseInt(req.params.id), {
            post_url,
            published_date,
            positive_percentage,
            negative_percentage,
            neutral_percentage,
            positive_remarks,
            negative_remarks,
            neutral_remarks,
            conclusion
        });
        res.json({ message: 'Post updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete post
app.delete('/api/posts/:id', async (req, res) => {
    try {
        await db.deletePost(parseInt(req.params.id));
        res.json({ message: 'Post deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Comment Routes
// ============================================

// Get comments for a post
app.get('/api/posts/:postId/comments', async (req, res) => {
    try {
        const { sentiment } = req.query;
        const comments = await db.getCommentsByPost(parseInt(req.params.postId), sentiment);
        res.json(comments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create comment
app.post('/api/posts/:postId/comments', async (req, res) => {
    try {
        const { content, sentiment } = req.body;

        if (!content || !sentiment) {
            return res.status(400).json({ error: 'Content and sentiment are required' });
        }

        if (!['positive', 'negative', 'neutral'].includes(sentiment)) {
            return res.status(400).json({ error: 'Sentiment must be positive, negative, or neutral' });
        }

        const commentId = await db.createComment({
            post_id: parseInt(req.params.postId),
            content,
            sentiment
        });

        res.status(201).json({ id: commentId, message: 'Comment added successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete comment
app.delete('/api/comments/:id', async (req, res) => {
    try {
        await db.deleteComment(parseInt(req.params.id));
        res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Analytics Routes
// ============================================

// Get sentiment summary for a constituency
app.get('/api/analytics/constituency/:id', async (req, res) => {
    try {
        const summary = await db.getSentimentSummaryByConstituency(parseInt(req.params.id));
        res.json(summary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// AI Analysis Routes
// ============================================

app.post('/api/ai-analyze', upload.array('files', 10), analyzeComments);

// ============================================
// News Media Routes
// ============================================
const newsMediaLib = require('./libraries/news-media');

// Get all news media agencies
app.get('/api/news-media', async (req, res) => {
    try {
        const includeInactive = req.query.includeInactive === 'true';
        const withSentiment = req.query.withSentiment === 'true';

        if (withSentiment) {
            const data = await newsMediaLib.getAllNewsMediaWithSentiment();
            return res.json(data);
        }

        const data = await newsMediaLib.getAllNewsMedia(includeInactive);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get news media by ID
app.get('/api/news-media/:id', async (req, res) => {
    try {
        const data = await newsMediaLib.getNewsMediaById(parseInt(req.params.id));
        if (!data) return res.status(404).json({ error: 'News media not found' });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create news media (only name_en required)
app.post('/api/news-media', async (req, res) => {
    try {
        const { name_en } = req.body;
        if (!name_en) {
            return res.status(400).json({ error: 'Name (English) is required' });
        }
        const id = await newsMediaLib.createNewsMedia(req.body);
        res.status(201).json({ id, message: 'News media created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update news media
app.put('/api/news-media/:id', async (req, res) => {
    try {
        const success = await newsMediaLib.updateNewsMedia(parseInt(req.params.id), req.body);
        if (success) {
            res.json({ message: 'News media updated successfully' });
        } else {
            res.status(500).json({ error: 'Update failed' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete news media
app.delete('/api/news-media/:id', async (req, res) => {
    try {
        await newsMediaLib.deleteNewsMedia(parseInt(req.params.id));
        res.json({ message: 'News media deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get posts by news media
app.get('/api/news-media/:id/posts', async (req, res) => {
    try {
        const options = {
            platform: req.query.platform,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            limit: req.query.limit ? parseInt(req.query.limit) : undefined
        };
        const posts = await newsMediaLib.getPostsByNewsMedia(parseInt(req.params.id), options);
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create post for news media
app.post('/api/news-media/:id/posts', async (req, res) => {
    try {
        const postId = await newsMediaLib.createNewsMediaPost(parseInt(req.params.id), req.body);
        res.status(201).json({ id: postId, message: 'Post created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get news media sentiment summary
app.get('/api/news-media/:id/sentiment', async (req, res) => {
    try {
        const dateRange = {
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };
        const summary = await newsMediaLib.getNewsMediaSentimentSummary(parseInt(req.params.id), dateRange);
        res.json(summary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Political Parties Routes
// ============================================
const partiesLib = require('./libraries/political-parties');

// Get all parties
app.get('/api/parties', async (req, res) => {
    try {
        const includeInactive = req.query.includeInactive === 'true';
        const withSentiment = req.query.withSentiment === 'true';

        if (withSentiment) {
            const data = await partiesLib.getAllPartiesWithSentiment();
            return res.json(data);
        }

        const data = await partiesLib.getAllParties(includeInactive);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get party by ID
app.get('/api/parties/:id', async (req, res) => {
    try {
        const data = await partiesLib.getPartyById(parseInt(req.params.id));
        if (!data) return res.status(404).json({ error: 'Party not found' });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create party (only name_en required)
app.post('/api/parties', async (req, res) => {
    try {
        const { name_en } = req.body;
        if (!name_en) {
            return res.status(400).json({ error: 'Name (English) is required' });
        }
        const id = await partiesLib.createParty(req.body);
        res.status(201).json({ id, message: 'Party created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update party
app.put('/api/parties/:id', async (req, res) => {
    try {
        const success = await partiesLib.updateParty(parseInt(req.params.id), req.body);
        if (success) {
            res.json({ message: 'Party updated successfully' });
        } else {
            res.status(500).json({ error: 'Update failed' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete party
app.delete('/api/parties/:id', async (req, res) => {
    try {
        await partiesLib.deleteParty(parseInt(req.params.id));
        res.json({ message: 'Party deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get posts by party
app.get('/api/parties/:id/posts', async (req, res) => {
    try {
        const options = {
            platform: req.query.platform,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            limit: req.query.limit ? parseInt(req.query.limit) : undefined
        };
        const posts = await partiesLib.getPostsByParty(parseInt(req.params.id), options);
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create post for party
app.post('/api/parties/:id/posts', async (req, res) => {
    try {
        const postId = await partiesLib.createPartyPost(parseInt(req.params.id), req.body);
        res.status(201).json({ id: postId, message: 'Post created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get party sentiment summary
app.get('/api/parties/:id/sentiment', async (req, res) => {
    try {
        const dateRange = {
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };
        const summary = await partiesLib.getPartySentimentSummary(parseInt(req.params.id), dateRange);
        res.json(summary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get party candidates
app.get('/api/parties/:id/candidates', async (req, res) => {
    try {
        const party = await partiesLib.getPartyById(parseInt(req.params.id));
        if (!party) return res.status(404).json({ error: 'Party not found' });

        const candidates = await partiesLib.getPartyCandidates(party.name_en);
        res.json(candidates);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Daily Reports Routes
// ============================================
const dailyReportService = require('./services/daily-report');

// Generate daily report (for today or specific date)
app.post('/api/reports/generate', async (req, res) => {
    try {
        const { date } = req.body;
        const result = await dailyReportService.generateDailyReport(date);

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get today's report
app.get('/api/reports/daily', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const report = await dailyReportService.getReportByDate(today);

        if (report) {
            res.json(report);
        } else {
            res.json({
                message: 'No report for today. Generate one first.',
                report_date: today,
                exists: false
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get report for specific date
app.get('/api/reports/daily/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const report = await dailyReportService.getReportByDate(date);

        if (report) {
            res.json(report);
        } else {
            res.status(404).json({
                message: 'No report found for this date',
                report_date: date,
                exists: false
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get report history
app.get('/api/reports/history', async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 30;
        const history = await dailyReportService.getReportHistory(limit);
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete report
app.delete('/api/reports/:id', async (req, res) => {
    try {
        const result = await dailyReportService.deleteReport(parseInt(req.params.id));
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// Get chart data for a report
app.get('/api/reports/:id/charts', async (req, res) => {
    try {
        const chartData = await dailyReportService.getChartData(parseInt(req.params.id));

        if (chartData) {
            res.json(chartData);
        } else {
            res.status(404).json({ error: 'Report not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get sentiment trends
app.get('/api/reports/trends', async (req, res) => {
    try {
        const days = req.query.days ? parseInt(req.query.days) : 7;
        const trends = await dailyReportService.getSentimentTrends(days);
        res.json(trends);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Unified Library Routes
// ============================================
const candidatesLib = require('./libraries/candidates');

// Get all sources combined
app.get('/api/library/all', async (req, res) => {
    try {
        const dateRange = {};
        if (req.query.date) {
            dateRange.startDate = req.query.date;
            dateRange.endDate = req.query.date;
        }

        const [newsMedia, parties, candidates] = await Promise.all([
            newsMediaLib.getAllNewsMediaWithSentiment(dateRange),
            partiesLib.getAllPartiesWithSentiment(dateRange),
            candidatesLib.getAllCandidatesWithSentiment({ ...req.query, dateRange }) // candidatesLib takes options
        ]);

        res.json({
            news_media: newsMedia,
            political_parties: parties,
            top_candidates: candidates // Note: getTopCandidatesByEngagement is different, usually for dashboard. Library usually lists all.
            // Wait, line 874 called getTopCandidatesByEngagement(20). 
            // The Library UI usually shows a LIST. 
            // getAllCandidatesWithSentiment returns list.
            // If /library/all is used for the modal "All" view (if exists) or preloading?
            // The user wants "all of them". 
            // The frontend likely calls individual endpoints or this aggregate one?
            // Existing code (lines 871-874):
            // newsMediaLib.getAllNewsMediaWithSentiment(),
            // partiesLib.getAllPartiesWithSentiment(),
            // candidatesLib.getTopCandidatesByEngagement(20)

            // If I change getTopCandidatesByEngagement to accept dateRange, I need to update THAT function too.
            // But `candidates.js` (line 105) getTopCandidatesByEngagement(limit=10) doesn't take dateRange.
            // getAllCandidatesWithSentiment DOES.
            // If /library/all returns `top_candidates`, maybe it's just for a summary?
            // I'll stick to updating what's there. 
            // If `getTopCandidatesByEngagement` doesn't support date, I won't pass it yet, or I'll update it later if needed.
            // But for `newsMedia` and `parties`, I CAN pass dateRange.
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get news media library
app.get('/api/library/news-media', async (req, res) => {
    try {
        const dateRange = {};
        if (req.query.date) {
            dateRange.startDate = req.query.date;
            dateRange.endDate = req.query.date;
        }
        const data = await newsMediaLib.getAllNewsMediaWithSentiment(dateRange);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get parties library
app.get('/api/library/parties', async (req, res) => {
    try {
        const dateRange = {};
        if (req.query.date) {
            dateRange.startDate = req.query.date;
            dateRange.endDate = req.query.date;
        }
        const data = await partiesLib.getAllPartiesWithSentiment(dateRange);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get candidates library (enhanced) - Returns candidates with their latest post
app.get('/api/library/candidates', async (req, res) => {
    try {
        const dateFilter = req.query.date || null;

        // Simple query: just get posts with basic candidate join
        let postsQuery = db.supabase.from('posts').select(`
            id,
            candidate_id,
            post_url,
            published_date,
            positive_percentage,
            negative_percentage,
            neutral_percentage,
            positive_remarks,
            negative_remarks,
            neutral_remarks,
            conclusion,
            comment_count
        `).order('published_date', { ascending: false });

        if (dateFilter) {
            postsQuery = postsQuery.eq('published_date', dateFilter);
        }

        const { data: posts, error: postsError } = await postsQuery.limit(500);

        if (postsError) {
            console.error('Library posts error:', postsError.message);
            return res.status(500).json({ error: postsError.message });
        }

        if (!posts || posts.length === 0) {
            return res.json([]);
        }

        // Get unique candidate IDs
        const candidateIds = [...new Set(posts.map(p => p.candidate_id))];

        // Fetch candidates separately
        const { data: candidates, error: candidatesError } = await db.supabase
            .from('candidates')
            .select('id, name, party_name, constituency_id')
            .in('id', candidateIds);

        if (candidatesError) {
            console.error('Library candidates error:', candidatesError.message);
        }

        // Create lookup map
        const candidateMap = {};
        (candidates || []).forEach(c => { candidateMap[c.id] = c; });

        // Transform to the format frontend expects
        const result = posts.map(post => {
            const candidate = candidateMap[post.candidate_id];
            if (!candidate) return null;

            return {
                id: candidate.id,
                name: candidate.name,
                party_name: candidate.party_name,
                constituency_id: candidate.constituency_id,
                constituency_name: '', // Will be empty for now, but can be fetched separately
                post: {
                    id: post.id,
                    post_url: post.post_url,
                    published_date: post.published_date,
                    positive_percentage: post.positive_percentage || 0,
                    negative_percentage: post.negative_percentage || 0,
                    neutral_percentage: post.neutral_percentage || 0,
                    positive_remarks: post.positive_remarks,
                    negative_remarks: post.negative_remarks,
                    neutral_remarks: post.neutral_remarks,
                    conclusion: post.conclusion,
                    comment_count: post.comment_count || 0
                }
            };
        }).filter(Boolean);

        res.json(result);
    } catch (error) {
        console.error('Library candidates error:', error);
        res.status(500).json({ error: error.message });
    }
});


// ============================================
// Serve frontend
// ============================================

// Route for reports page
app.get('/reports.html', (req, res) => {
    res.sendFile('reports.html', { root: './public' });
});

// Route for sources page
app.get('/sources.html', (req, res) => {
    res.sendFile('sources.html', { root: './public' });
});

app.get('*', (req, res) => {
    // For any unknown routes, redirect to login
    res.redirect('/');
});

// ============================================
// Start server
// ============================================
async function startServer() {
    // 1. Start listening IMMEDIATELY to satisfy Cloud Run health checks
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║     POLITICAL SOCIAL MEDIA ASSESSMENT - SERVER STARTED     ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log(`║  Local:   http://localhost:${PORT}                           ║`);
        console.log(`║  Port:    ${PORT}                                            ║`);
        console.log('╚════════════════════════════════════════════════════════════╝');
    });

    // 2. Initialize database in background
    try {
        console.log('🔄 Connecting to Database...');
        await db.initDatabase();
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
    }
}

startServer();
