/**
 * News Media Library
 * CRUD operations and sentiment analysis for news agencies
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder-key');

module.exports = {
    /**
     * Get all news media agencies
     */
    getAllNewsMedia: async (includeInactive = false) => {
        let query = supabase.from('news_media').select('*').order('name_en');
        if (!includeInactive) {
            query = query.eq('is_active', true);
        }
        const { data, error } = await query;
        if (error) console.error('getAllNewsMedia error:', error.message);
        return data || [];
    },

    /**
     * Get all news media with sentiment summaries
     */
    /**
     * Get all news media with sentiment summaries
     */
    getAllNewsMediaWithSentiment: async (dateRange = null) => {
        const { data: newsMedia } = await supabase.from('news_media').select('*').eq('is_active', true).order('name_en');

        const results = [];
        for (const nm of (newsMedia || [])) {
            let query = supabase
                .from('media_posts')
                .select('positive_percentage, negative_percentage, neutral_percentage, comment_count')
                .eq('source_type', 'news_media')
                .eq('source_id', nm.id);

            if (dateRange?.startDate) query = query.gte('published_date', dateRange.startDate);
            if (dateRange?.endDate) query = query.lte('published_date', dateRange.endDate);

            const { data: posts } = await query;

            const sentiment = module.exports.calculateSentiment(posts || []);
            // Flatten sentiment into the result for frontend compatibility
            results.push({
                ...nm,
                posts_count: sentiment.post_count,
                avg_positive: sentiment.avg_positive,
                avg_negative: sentiment.avg_negative,
                avg_neutral: sentiment.avg_neutral,
                total_comments: sentiment.comment_count,
                sentiment // Keep nested object for backward compatibility
            });
        }
        return results;
    },

    /**
     * Get news media by ID
     */
    getNewsMediaById: async (id) => {
        const { data, error } = await supabase.from('news_media').select('*').eq('id', id).single();
        if (error && error.code !== 'PGRST116') console.error('getNewsMediaById error:', error.message);
        return data;
    },

    /**
     * Create news media (only name_en required)
     */
    createNewsMedia: async (data) => {
        const { data: result, error } = await supabase.from('news_media').insert({
            name_en: data.name_en,
            name_np: data.name_np || null,
            website_url: data.website_url || null,
            facebook_url: data.facebook_url || null,
            twitter_url: data.twitter_url || null,
            youtube_url: data.youtube_url || null,
            is_active: true
        }).select('id').single();
        if (error) throw new Error(error.message);
        return result.id;
    },

    /**
     * Update news media
     */
    updateNewsMedia: async (id, data) => {
        const { error } = await supabase.from('news_media').update(data).eq('id', id);
        if (error) throw new Error(error.message);
        return true;
    },

    /**
     * Delete news media
     */
    deleteNewsMedia: async (id) => {
        const { error } = await supabase.from('news_media').delete().eq('id', id);
        if (error) throw new Error(error.message);
        return true;
    },

    /**
     * Get posts by news media
     */
    getPostsByNewsMedia: async (newsMediaId, options = {}) => {
        let query = supabase.from('media_posts').select('*')
            .eq('source_type', 'news_media')
            .eq('source_id', newsMediaId)
            .order('published_date', { ascending: false });

        if (options.platform) query = query.eq('platform', options.platform);
        if (options.startDate) query = query.gte('published_date', options.startDate);
        if (options.endDate) query = query.lte('published_date', options.endDate);
        if (options.limit) query = query.limit(options.limit);

        const { data, error } = await query;
        if (error) console.error('getPostsByNewsMedia error:', error.message);
        return data || [];
    },

    /**
     * Create news media post
     */
    createNewsMediaPost: async (newsMediaId, postData) => {
        const { data, error } = await supabase.from('media_posts').insert({
            source_type: 'news_media',
            source_id: newsMediaId,
            post_url: postData.post_url,
            published_date: postData.published_date,
            positive_percentage: postData.positive_percentage,
            negative_percentage: postData.negative_percentage,
            neutral_percentage: postData.neutral_percentage,
            comment_count: postData.comment_count || 0,
            content: postData.comments_summary || postData.remarks || postData.content || ''
        }).select('id').single();
        if (error) throw new Error(error.message);
        return data.id;
    },

    /**
     * Get sentiment summary
     */
    getNewsMediaSentimentSummary: async (newsMediaId, dateRange = null) => {
        let query = supabase.from('media_posts').select('*')
            .eq('source_type', 'news_media')
            .eq('source_id', newsMediaId);

        if (dateRange?.startDate) query = query.gte('published_date', dateRange.startDate);
        if (dateRange?.endDate) query = query.lte('published_date', dateRange.endDate);

        const { data: posts } = await query;
        return module.exports.calculateSentiment(posts || []);
    },

    /**
     * Delete media post by ID
     */
    deleteMediaPost: async (postId) => {
        const { error } = await supabase.from('media_posts').delete().eq('id', postId);
        if (error) throw new Error(error.message);
        return true;
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
