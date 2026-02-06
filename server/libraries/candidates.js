/**
 * Enhanced Candidates Library
 * Extended functionality for candidate management with sentiment analysis
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder-key');

module.exports = {
    /**
     * Get all candidates with location info
     */
    getAllCandidates: async (options = {}) => {
        let query = supabase.from('candidates').select(`
            *,
            provinces (name_en, name_np),
            districts (name_en, name_np),
            constituencies (name_en, name_np)
        `).order('name');

        if (options.partyName) query = query.ilike('party_name', `%${options.partyName}%`);
        if (options.constituencyId) query = query.eq('constituency_id', options.constituencyId);
        if (options.districtId) query = query.eq('district_id', options.districtId);
        if (options.limit) query = query.limit(options.limit);

        const { data, error } = await query;
        if (error) console.error('getAllCandidates error:', error.message);
        return data || [];
    },

    /**
     * Get all candidates with sentiment summaries
     */
    /**
     * Get all candidates with sentiment summaries
     */
    getAllCandidatesWithSentiment: async (options = {}) => {
        const candidates = await module.exports.getAllCandidates(options);

        // Extract date range from options if present
        const dateRange = options.dateRange || null;

        const results = [];
        for (const candidate of candidates) {
            const sentiment = await module.exports.getCandidateSentimentSummary(candidate.id, dateRange);
            results.push({ ...candidate, sentiment });
        }
        return results;
    },

    /**
     * Get candidate by ID with posts
     */
    getCandidateById: async (id) => {
        const { data: candidate, error } = await supabase.from('candidates').select(`
            *,
            provinces (name_en, name_np),
            districts (name_en, name_np),
            constituencies (name_en, name_np)
        `).eq('id', id).single();

        if (error) {
            console.error('getCandidateById error:', error.message);
            return null;
        }

        // Get posts
        const { data: posts } = await supabase.from('posts').select('*').eq('candidate_id', id).order('published_date', { ascending: false });

        return { ...candidate, posts: posts || [] };
    },

    /**
     * Get candidates by party
     */
    getCandidatesByParty: async (partyName) => {
        const { data, error } = await supabase.from('candidates').select('*').ilike('party_name', `%${partyName}%`).order('name');
        if (error) console.error('getCandidatesByParty error:', error.message);
        return data || [];
    },

    /**
     * Get candidates by constituency
     */
    getCandidatesByConstituency: async (constituencyId) => {
        const { data, error } = await supabase.from('candidates').select('*').eq('constituency_id', constituencyId).order('name');
        if (error) console.error('getCandidatesByConstituency error:', error.message);
        return data || [];
    },

    /**
     * Get sentiment summary for a candidate
     */
    getCandidateSentimentSummary: async (candidateId, dateRange = null) => {
        let query = supabase.from('posts').select('*').eq('candidate_id', candidateId);

        if (dateRange?.startDate) query = query.gte('published_date', dateRange.startDate);
        if (dateRange?.endDate) query = query.lte('published_date', dateRange.endDate);

        const { data: posts } = await query;
        return module.exports.calculateSentiment(posts || []);
    },

    /**
     * Get top candidates by engagement
     */
    getTopCandidatesByEngagement: async (limit = 10) => {
        const { data: posts } = await supabase.from('posts').select('candidate_id, positive_percentage, negative_percentage, neutral_percentage, comment_count');

        if (!posts || posts.length === 0) return [];

        // Group by candidate
        const byCandidate = {};
        for (const post of posts) {
            if (!byCandidate[post.candidate_id]) {
                byCandidate[post.candidate_id] = [];
            }
            byCandidate[post.candidate_id].push(post);
        }

        // Calculate sentiment and total comments per candidate
        const candidateStats = [];
        for (const [candidateId, candidatePosts] of Object.entries(byCandidate)) {
            const sentiment = module.exports.calculateSentiment(candidatePosts);
            candidateStats.push({
                candidate_id: parseInt(candidateId),
                ...sentiment
            });
        }

        // Sort by total comments
        candidateStats.sort((a, b) => b.comment_count - a.comment_count);
        const topIds = candidateStats.slice(0, limit).map(s => s.candidate_id);

        // Get candidate details
        const { data: candidates } = await supabase.from('candidates').select('*').in('id', topIds);

        // Merge with stats
        return candidateStats.slice(0, limit).map(stat => {
            const candidate = (candidates || []).find(c => c.id === stat.candidate_id);
            return { ...candidate, sentiment: stat };
        });
    },

    /**
     * Create media post for candidate (in unified table)
     */
    createCandidateMediaPost: async (candidateId, postData) => {
        const { data, error } = await supabase.from('media_posts').insert({
            source_type: 'candidate',
            source_id: candidateId,
            ...postData
        }).select('id').single();
        if (error) throw new Error(error.message);
        return data.id;
    },

    /**
     * Calculate sentiment from posts
     */
    calculateSentiment: (posts) => {
        if (!posts.length) return { avg_positive: 0, avg_negative: 0, avg_neutral: 0, post_count: 0, comment_count: 0 };

        const totalComments = posts.reduce((s, p) => s + (p.comment_count || 0), 0);

        if (totalComments === 0) {
            return {
                avg_positive: posts.reduce((s, p) => s + (p.positive_percentage || 0), 0) / posts.length,
                avg_negative: posts.reduce((s, p) => s + (p.negative_percentage || 0), 0) / posts.length,
                avg_neutral: posts.reduce((s, p) => s + (p.neutral_percentage || 0), 0) / posts.length,
                post_count: posts.length,
                comment_count: 0
            };
        }

        let wPos = 0, wNeg = 0, wNeu = 0;
        for (const p of posts) {
            const w = (p.comment_count || 0) / totalComments;
            wPos += (p.positive_percentage || 0) * w;
            wNeg += (p.negative_percentage || 0) * w;
            wNeu += (p.neutral_percentage || 0) * w;
        }

        return { avg_positive: wPos, avg_negative: wNeg, avg_neutral: wNeu, post_count: posts.length, comment_count: totalComments };
    }
};
