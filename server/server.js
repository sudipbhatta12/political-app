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
const os = require('os'); // Import os
const db = require('./database');
const { analyzeComments } = require('./ai-controller');

// Authentication configuration
const APP_PASSWORD = process.env.APP_PASSWORD || 'nepal2026';
const SECRET_KEY = process.env.SECRET_KEY || crypto.randomBytes(32).toString('hex');
const tokens = new Set(); // Store valid tokens in memory

const app = express();
const PORT = process.env.PORT || 3000;

// Configure upload - Use system temp dir for Cloud Run compatibility
const upload = multer({ 
    dest: os.tmpdir(), 
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public'), { index: false }));

// ============================================
// Authentication Routes
// ============================================

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { password } = req.body;

    if (password === APP_PASSWORD) {
        const token = crypto.randomBytes(32).toString('hex');
        const success = await db.createSession(token);

        if (success) {
            res.json({ success: true, token });
        } else {
            res.status(500).json({ success: false, message: 'Database error' });
        }
    } else {
        res.json({ success: false, message: 'Wrong password' });
    }
});

// Verify token endpoint
app.post('/api/verify', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
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
        res.status(500).json({ error: error.message });
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
                        conclusion: row.conclusion
                    });
                }
            }
            return res.json(Array.from(candidatesMap.values()));
        }

        res.json([]);
    } catch (error) {
        res.status(500).json({ error: error.message });
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
        res.status(500).json({ error: error.message });
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
// Serve frontend
// ============================================
app.get('*', (req, res) => {
    // For any unknown routes, redirect to login
    res.redirect('/');
});

// ============================================
// Start server
// ============================================
async function startServer() {
    // 1. Start listening IMMEDIATELY to satisfy Cloud Run health checks
    app.listen(PORT, '0.0.0.0', () => {
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║     POLITICAL SOCIAL MEDIA ASSESSMENT - SERVER STARTED     ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log(`║  Local:   http://localhost:${PORT}                           ║`);
        console.log('║  Cloud:   Listening on port ${PORT}                          ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
    });

    // 2. Initialize database in background
    try {
        await db.initDatabase();
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        // We don't exit process so the container stays alive to report errors
    }
}

startServer();
