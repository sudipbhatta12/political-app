/**
 * Political Parties Library
 * CRUD operations and sentiment analysis for political parties
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder-key');

module.exports = {
    /**
     * Get all political parties
     */
    getAllParties: async (includeInactive = false) => {
        let query = supabase.from('political_parties').select('*').order('name_en');
        if (!includeInactive) {
            query = query.eq('is_active', true);
        }
        const { data, error } = await query;
        if (error) console.error('getAllParties error:', error.message);
        return data || [];
    },

    /**
     * Get all parties with sentiment summaries
     */
    /**
     * Get all parties with sentiment summaries
     */
    getAllPartiesWithSentiment: async (dateRange = null) => {
        const { data: parties } = await supabase.from('political_parties').select('*').eq('is_active', true).order('name_en');

        const results = [];
        for (const party of (parties || [])) {
            let query = supabase
                .from('media_posts')
                .select('positive_percentage, negative_percentage, neutral_percentage, comment_count')
                .eq('source_type', 'political_party')
                .eq('source_id', party.id);

            if (dateRange?.startDate) query = query.gte('published_date', dateRange.startDate);
            if (dateRange?.endDate) query = query.lte('published_date', dateRange.endDate);

            const { data: posts } = await query;

            const sentiment = module.exports.calculateSentiment(posts || []);
            results.push({ ...party, sentiment });
        }
        return results;
    },

    /**
     * Get party by ID
     */
    getPartyById: async (id) => {
        const { data, error } = await supabase.from('political_parties').select('*').eq('id', id).single();
        if (error && error.code !== 'PGRST116') console.error('getPartyById error:', error.message);
        return data;
    },

    /**
     * Create party (only name_en required)
     */
    createParty: async (data) => {
        const { data: result, error } = await supabase.from('political_parties').insert({
            name_en: data.name_en,
            name_np: data.name_np || null,
            abbreviation: data.abbreviation || null,
            website_url: data.website_url || null,
            facebook_url: data.facebook_url || null,
            twitter_url: data.twitter_url || null,
            is_active: true
        }).select('id').single();
        if (error) throw new Error(error.message);
        return result.id;
    },

    /**
     * Update party
     */
    updateParty: async (id, data) => {
        const { error } = await supabase.from('political_parties').update(data).eq('id', id);
        if (error) throw new Error(error.message);
        return true;
    },

    /**
     * Delete party
     */
    deleteParty: async (id) => {
        const { error } = await supabase.from('political_parties').delete().eq('id', id);
        if (error) throw new Error(error.message);
        return true;
    },

    /**
     * Get posts by party
     */
    getPostsByParty: async (partyId, options = {}) => {
        let query = supabase.from('media_posts').select('*')
            .eq('source_type', 'political_party')
            .eq('source_id', partyId)
            .order('published_date', { ascending: false });

        if (options.platform) query = query.eq('platform', options.platform);
        if (options.startDate) query = query.gte('published_date', options.startDate);
        if (options.endDate) query = query.lte('published_date', options.endDate);
        if (options.limit) query = query.limit(options.limit);

        const { data, error } = await query;
        if (error) console.error('getPostsByParty error:', error.message);
        return data || [];
    },

    /**
     * Create party post
     */
    createPartyPost: async (partyId, postData) => {
        const { data, error } = await supabase.from('media_posts').insert({
            source_type: 'political_party',
            source_id: partyId,
            post_url: postData.post_url,
            published_date: postData.published_date,
            positive_percentage: postData.positive_percentage,
            negative_percentage: postData.negative_percentage,
            neutral_percentage: postData.neutral_percentage,
            neutral_percentage: postData.neutral_percentage,
            content: postData.remarks || postData.content || ''
        }).select('id').single();
        if (error) throw new Error(error.message);
        return data.id;
    },

    /**
     * Get party sentiment summary
     */
    getPartySentimentSummary: async (partyId, dateRange = null) => {
        let query = supabase.from('media_posts').select('*')
            .eq('source_type', 'political_party')
            .eq('source_id', partyId);

        if (dateRange?.startDate) query = query.gte('published_date', dateRange.startDate);
        if (dateRange?.endDate) query = query.lte('published_date', dateRange.endDate);

        const { data: posts } = await query;
        return module.exports.calculateSentiment(posts || []);
    },

    /**
     * Get candidates by party name
     */
    getPartyCandidates: async (partyName) => {
        const { data, error } = await supabase.from('candidates').select('*').ilike('party_name', `%${partyName}%`);
        if (error) console.error('getPartyCandidates error:', error.message);
        return data || [];
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
