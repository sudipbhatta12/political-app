/**
 * Daily Report Service - Redesigned
 * Generates comprehensive daily reports with AI analysis
 * 
 * Structure:
 * - EXPORTS: generateDailyReport, getReportByDate, getReportHistory, deleteReport, getSentimentTrends, getChartData
 * - INTERNAL: fetchPostsForDate, calculateSentiments, generateSummary, saveReport
 */

const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// ============================================
// Configuration
// ============================================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ Daily Report Service: Missing Supabase credentials');
}

const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseKey || 'placeholder-key'
);

// Initialize Gemini AI (optional)
const genAI = process.env.GEMINI_API_KEY
    ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    : null;

// ============================================
// Helper Functions
// ============================================

/**
 * Validate and normalize date string to YYYY-MM-DD format
 */
function normalizeDate(dateInput) {
    if (!dateInput) {
        // Return today's date
        return new Date().toISOString().split('T')[0];
    }

    // If already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        return dateInput;
    }

    // Try to parse the date
    const parsed = new Date(dateInput);
    if (isNaN(parsed.getTime())) {
        throw new Error(`Invalid date format: ${dateInput}. Use YYYY-MM-DD format.`);
    }

    return parsed.toISOString().split('T')[0];
}

/**
 * Format date for user display
 */
function formatDateForDisplay(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// ============================================
// Data Fetching
// ============================================

/**
 * Fetch all posts for a specific date from media_posts table
 * Uses proper date comparison instead of ILIKE
 */
async function fetchMediaPostsForDate(date) {
    console.log(`📰 Fetching media posts for ${date}...`);

    // Try exact date match first
    let { data, error } = await supabase
        .from('media_posts')
        .select('*')
        .eq('published_date', date);

    if (error) {
        console.error('❌ fetchMediaPostsForDate error:', error.message);
        return { posts: [], error: error.message };
    }

    // If no results, try with date range (handles datetime columns)
    if (!data || data.length === 0) {
        const startOfDay = `${date}T00:00:00`;
        const endOfDay = `${date}T23:59:59`;

        const rangeResult = await supabase
            .from('media_posts')
            .select('*')
            .gte('published_date', startOfDay)
            .lte('published_date', endOfDay);

        if (!rangeResult.error && rangeResult.data) {
            data = rangeResult.data;
        }
    }

    console.log(`   Found ${data?.length || 0} media posts`);
    return { posts: data || [], error: null };
}

/**
 * Fetch all candidate posts for a specific date from posts table
 */
async function fetchCandidatePostsForDate(date) {
    console.log(`👤 Fetching candidate posts for ${date}...`);

    // Try exact date match first
    let { data, error } = await supabase
        .from('posts')
        .select(`
            *,
            candidates (id, name, party_name)
        `)
        .eq('published_date', date);

    if (error) {
        console.error('❌ fetchCandidatePostsForDate error:', error.message);
        return { posts: [], error: error.message };
    }

    // If no results, try with date range
    if (!data || data.length === 0) {
        const startOfDay = `${date}T00:00:00`;
        const endOfDay = `${date}T23:59:59`;

        const rangeResult = await supabase
            .from('posts')
            .select(`
                *,
                candidates (id, name, party_name)
            `)
            .gte('published_date', startOfDay)
            .lte('published_date', endOfDay);

        if (!rangeResult.error && rangeResult.data) {
            data = rangeResult.data;
        }
    }

    console.log(`   Found ${data?.length || 0} candidate posts`);
    return { posts: data || [], error: null };
}

/**
 * Fetch ALL posts for a date (combined)
 */
async function fetchAllPostsForDate(date) {
    const [mediaResult, candidateResult] = await Promise.all([
        fetchMediaPostsForDate(date),
        fetchCandidatePostsForDate(date)
    ]);

    return {
        mediaPosts: mediaResult.posts,
        candidatePosts: candidateResult.posts,
        allPosts: [...mediaResult.posts, ...candidateResult.posts],
        errors: [mediaResult.error, candidateResult.error].filter(Boolean)
    };
}

// ============================================
// Sentiment Calculation
// ============================================

/**
 * Calculate weighted sentiment from posts
 * Uses comment volume for weighting when available
 */
function calculateSentiments(posts) {
    if (!posts || posts.length === 0) {
        return {
            overall_positive: 0,
            overall_negative: 0,
            overall_neutral: 0,
            total_comments: 0,
            total_engagement: 0
        };
    }

    const totalComments = posts.reduce((sum, p) => sum + (p.comment_count || 0), 0);
    const totalEngagement = posts.reduce((sum, p) => sum + (p.engagement_count || 0), 0);

    // If no comments, use simple average
    if (totalComments === 0) {
        const n = posts.length;
        return {
            overall_positive: posts.reduce((s, p) => s + (p.positive_percentage || 0), 0) / n,
            overall_negative: posts.reduce((s, p) => s + (p.negative_percentage || 0), 0) / n,
            overall_neutral: posts.reduce((s, p) => s + (p.neutral_percentage || 0), 0) / n,
            total_comments: 0,
            total_engagement: totalEngagement
        };
    }

    // Volume-weighted average
    let weightedPositive = 0, weightedNegative = 0, weightedNeutral = 0;

    for (const p of posts) {
        const weight = (p.comment_count || 0) / totalComments;
        weightedPositive += (p.positive_percentage || 0) * weight;
        weightedNegative += (p.negative_percentage || 0) * weight;
        weightedNeutral += (p.neutral_percentage || 0) * weight;
    }

    return {
        overall_positive: weightedPositive,
        overall_negative: weightedNegative,
        overall_neutral: weightedNeutral,
        total_comments: totalComments,
        total_engagement: totalEngagement
    };
}

// ============================================
// Source Summaries
// ============================================

/**
 * Generate per-source breakdowns
 */
async function generateSourceSummaries(mediaPosts, candidatePosts) {
    const summaries = [];

    // Group media posts by source
    const mediaBySource = {};
    for (const post of mediaPosts) {
        const key = `${post.source_type}_${post.source_id}`;
        if (!mediaBySource[key]) {
            mediaBySource[key] = {
                source_type: post.source_type,
                source_id: post.source_id,
                posts: []
            };
        }
        mediaBySource[key].posts.push(post);
    }

    // Process each source group
    for (const key of Object.keys(mediaBySource)) {
        const group = mediaBySource[key];
        const sentiment = calculateSentiments(group.posts);

        // Get source name
        let sourceName = 'Unknown';
        if (group.source_type === 'news_media') {
            const { data } = await supabase.from('news_media').select('name_en').eq('id', group.source_id).single();
            sourceName = data?.name_en || 'Unknown News Media';
        } else if (group.source_type === 'political_party') {
            const { data } = await supabase.from('political_parties').select('name_en').eq('id', group.source_id).single();
            sourceName = data?.name_en || 'Unknown Party';
        }

        summaries.push({
            source_type: group.source_type,
            source_id: group.source_id,
            source_name: sourceName,
            post_count: group.posts.length,
            comment_count: sentiment.total_comments,
            engagement_count: sentiment.total_engagement,
            avg_positive: sentiment.overall_positive,
            avg_negative: sentiment.overall_negative,
            avg_neutral: sentiment.overall_neutral,
            positive_remarks: group.posts.map(p => p.positive_remarks).filter(Boolean).slice(0, 2).join(' | '),
            negative_remarks: group.posts.map(p => p.negative_remarks).filter(Boolean).slice(0, 2).join(' | ')
        });
    }

    // Group candidate posts by party
    const candidatesByParty = {};
    for (const post of candidatePosts) {
        const partyName = post.candidates?.party_name || 'Independent';
        if (!candidatesByParty[partyName]) {
            candidatesByParty[partyName] = [];
        }
        candidatesByParty[partyName].push(post);
    }

    for (const partyName of Object.keys(candidatesByParty)) {
        const partyPosts = candidatesByParty[partyName];
        const sentiment = calculateSentiments(partyPosts);

        summaries.push({
            source_type: 'candidate',
            source_id: 0,
            source_name: `${partyName} Candidates`,
            post_count: partyPosts.length,
            comment_count: sentiment.total_comments,
            engagement_count: 0,
            avg_positive: sentiment.overall_positive,
            avg_negative: sentiment.overall_negative,
            avg_neutral: sentiment.overall_neutral
        });
    }

    return summaries;
}

// ============================================
// Summary Generation
// ============================================

/**
 * Generate AI-powered summary (with fallback)
 */
async function generateSummary(reportData) {
    // Try AI summary first
    if (genAI) {
        try {
            console.log('🤖 Generating AI summary...');
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

            const prompt = `You are a strategic political analyst for Nepal.
Analyze this daily social media sentiment data and provide a detailed strategic briefing WITH SPECIFIC EXAMPLES.

Data Summary:
- Date: ${reportData.report_date}
- Total Posts Analyzed: ${reportData.total_posts_analyzed}
- Overall Sentiment: ${reportData.overall_positive.toFixed(1)}% Positive / ${reportData.overall_negative.toFixed(1)}% Negative / ${reportData.overall_neutral.toFixed(1)}% Neutral

Top Sources with Sentiment Details:
${reportData.source_summaries?.slice(0, 8).map(s =>
                `- ${s.source_name}: ${s.post_count} posts (${s.avg_positive.toFixed(1)}% positive, ${s.avg_negative.toFixed(1)}% negative)
      Positive Themes: ${s.positive_remarks || 'N/A'}
      Negative Themes: ${s.negative_remarks || 'N/A'}`
            ).join('\n') || 'No source data available'}

Provide a detailed strategic briefing with these sections:
1. **Executive Summary**: 2-3 sentences summarizing the overall state of public opinion today.
2. **What People Praised**: List specific themes people were positive about, WITH example quotes or paraphrases from the data above.
3. **What People Criticized**: List specific themes people were negative about, WITH example quotes or paraphrases from the data above.
4. **Strategic Recommendation**: 1-2 actionable insights for decision makers.

Use **bold** for emphasis. Include specific examples in each section.`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            console.log('✅ AI summary generated');
            return { text: response.text(), source: 'ai' };
        } catch (error) {
            console.error('⚠️ AI summary failed:', error.message);
            // Fall through to algorithmic summary
        }
    }

    // Fallback: Algorithmic summary
    console.log('📊 Using algorithmic summary...');
    return {
        text: generateAlgorithmicSummary(reportData),
        source: 'algorithm'
    };
}

/**
 * Generate a simple algorithmic summary
 */
function generateAlgorithmicSummary(reportData) {
    const { overall_positive, overall_negative, total_posts_analyzed, report_date } = reportData;
    const dateDisplay = formatDateForDisplay(report_date);

    let trend = 'neutral';
    if (overall_positive > overall_negative + 10) trend = 'positive';
    else if (overall_negative > overall_positive + 10) trend = 'negative';
    else if (overall_positive > overall_negative) trend = 'slightly positive';
    else if (overall_negative > overall_positive) trend = 'slightly negative';

    let summary = `**Daily Summary - ${dateDisplay}**\n\n`;
    summary += `Analyzed ${total_posts_analyzed} posts. Overall sentiment is ${trend} `;
    summary += `(${overall_positive.toFixed(1)}% positive vs ${overall_negative.toFixed(1)}% negative).\n\n`;

    if (reportData.source_summaries && reportData.source_summaries.length > 0) {
        const topSource = reportData.source_summaries.sort((a, b) => b.post_count - a.post_count)[0];
        summary += `Most active source: ${topSource.source_name} with ${topSource.post_count} posts.`;
    }

    return summary;
}

// ============================================
// Database Operations
// ============================================

/**
 * Save or update report in database
 */
async function saveReport(reportData) {
    const { report_date, total_posts_analyzed, total_comments_analyzed, total_sources,
        overall_positive, overall_negative, overall_neutral, summary_text, source_summaries } = reportData;

    // Check if report exists
    const { data: existing } = await supabase
        .from('daily_reports')
        .select('id')
        .eq('report_date', report_date)
        .single();

    let reportId;

    if (existing) {
        // Update existing
        const { error } = await supabase
            .from('daily_reports')
            .update({
                total_posts_analyzed,
                total_comments_analyzed,
                total_sources,
                overall_positive,
                overall_negative,
                overall_neutral,
                summary_text,
                generated_at: new Date().toISOString()
            })
            .eq('id', existing.id);

        if (error) {
            console.error('❌ Update report error:', error.message);
            return { success: false, error: error.message };
        }

        reportId = existing.id;

        // Delete old summaries
        await supabase.from('report_summaries').delete().eq('report_id', reportId);
    } else {
        // Create new
        const { data: newReport, error } = await supabase
            .from('daily_reports')
            .insert({
                report_date,
                total_posts_analyzed,
                total_comments_analyzed,
                total_sources,
                overall_positive,
                overall_negative,
                overall_neutral,
                summary_text
            })
            .select('id')
            .single();

        if (error) {
            // Check for missing table
            if (error.message.includes('does not exist') || error.code === '42P01') {
                return {
                    success: false,
                    error: 'Database tables not initialized. Please run the daily_reports_schema.sql script.',
                    error_code: 'MISSING_TABLE'
                };
            }
            console.error('❌ Create report error:', error.message);
            return { success: false, error: error.message };
        }

        reportId = newReport.id;
    }

    // Insert source summaries
    for (const summary of source_summaries || []) {
        await supabase.from('report_summaries').insert({
            report_id: reportId,
            source_type: summary.source_type,
            source_id: summary.source_id,
            source_name: summary.source_name,
            total_posts: summary.post_count,
            total_comments: summary.comment_count,
            avg_positive: summary.avg_positive,
            avg_negative: summary.avg_negative,
            avg_neutral: summary.avg_neutral
        });
    }

    return { success: true, reportId };
}

// ============================================
// EXPORTED FUNCTIONS
// ============================================

module.exports = {
    /**
     * Generate daily report for a specific date
     * @param {string} date - Date in YYYY-MM-DD format (optional, defaults to today)
     */
    generateDailyReport: async (date = null) => {
        try {
            const targetDate = normalizeDate(date);
            console.log(`\n📊 ========================================`);
            console.log(`📊 GENERATING DAILY REPORT: ${targetDate}`);
            console.log(`📊 ========================================\n`);

            // Fetch all posts
            const { mediaPosts, candidatePosts, allPosts, errors } = await fetchAllPostsForDate(targetDate);

            if (errors.length > 0) {
                console.warn('⚠️ Some errors occurred while fetching:', errors);
            }

            if (allPosts.length === 0) {
                console.log('❌ No posts found for this date');
                return {
                    success: false,
                    message: `No posts found for ${formatDateForDisplay(targetDate)}. Try a different date or add some posts first.`,
                    report_date: targetDate,
                    posts_found: 0
                };
            }

            console.log(`✅ Found ${allPosts.length} total posts (${mediaPosts.length} media, ${candidatePosts.length} candidate)`);

            // Calculate sentiments
            const overallSentiment = calculateSentiments(allPosts);

            // Count unique sources
            const uniqueSources = new Set(mediaPosts.map(p => `${p.source_type}_${p.source_id}`));
            const totalSources = uniqueSources.size + (candidatePosts.length > 0 ? 1 : 0);

            // Generate source summaries
            const sourceSummaries = await generateSourceSummaries(mediaPosts, candidatePosts);

            // Build report data
            const reportData = {
                report_date: targetDate,
                total_posts_analyzed: allPosts.length,
                total_comments_analyzed: overallSentiment.total_comments,
                total_sources: totalSources,
                overall_positive: overallSentiment.overall_positive,
                overall_negative: overallSentiment.overall_negative,
                overall_neutral: overallSentiment.overall_neutral,
                source_summaries: sourceSummaries
            };

            // Generate summary
            const summary = await generateSummary(reportData);
            reportData.summary_text = summary.text;
            reportData.summary_source = summary.source;

            // Save to database
            const saveResult = await saveReport(reportData);

            if (!saveResult.success) {
                return {
                    success: false,
                    message: saveResult.error,
                    error_code: saveResult.error_code,
                    report_date: targetDate
                };
            }

            console.log(`\n✅ Report generated successfully (ID: ${saveResult.reportId})`);
            console.log(`📊 ========================================\n`);

            return {
                success: true,
                report_id: saveResult.reportId,
                ...reportData
            };

        } catch (error) {
            console.error('❌ generateDailyReport error:', error);
            return {
                success: false,
                message: error.message,
                report_date: date
            };
        }
    },

    /**
     * Get report by date
     */
    getReportByDate: async (date) => {
        try {
            const targetDate = normalizeDate(date);

            const { data: report, error } = await supabase
                .from('daily_reports')
                .select('*')
                .eq('report_date', targetDate)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('getReportByDate error:', error.message);
                return null;
            }

            if (!report) return null;

            // Get summaries
            const { data: summaries } = await supabase
                .from('report_summaries')
                .select('*')
                .eq('report_id', report.id)
                .order('total_posts', { ascending: false });

            return {
                ...report,
                source_summaries: summaries || []
            };
        } catch (error) {
            console.error('getReportByDate exception:', error);
            return null;
        }
    },

    /**
     * Get report history
     */
    getReportHistory: async (limit = 30) => {
        const { data, error } = await supabase
            .from('daily_reports')
            .select('id, report_date, total_posts_analyzed, total_comments_analyzed, overall_positive, overall_negative, overall_neutral, generated_at')
            .order('report_date', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('getReportHistory error:', error.message);
            return [];
        }

        return data || [];
    },

    /**
     * Get chart data for a report
     */
    getChartData: async (reportId) => {
        const { data: report } = await supabase
            .from('daily_reports')
            .select('*')
            .eq('id', reportId)
            .single();

        if (!report) return null;

        const { data: summaries } = await supabase
            .from('report_summaries')
            .select('*')
            .eq('report_id', reportId);

        return {
            sentimentPie: {
                labels: ['Positive', 'Negative', 'Neutral'],
                data: [report.overall_positive, report.overall_negative, report.overall_neutral],
                colors: ['#10B981', '#EF4444', '#6B7280']
            },
            sourceBar: {
                labels: (summaries || []).map(s => s.source_name),
                datasets: [
                    { label: 'Positive %', data: (summaries || []).map(s => s.avg_positive), color: '#10B981' },
                    { label: 'Negative %', data: (summaries || []).map(s => s.avg_negative), color: '#EF4444' }
                ]
            },
            stats: {
                total_posts: report.total_posts_analyzed,
                total_comments: report.total_comments_analyzed,
                total_sources: report.total_sources,
                report_date: report.report_date
            }
        };
    },

    /**
     * Get sentiment trends over time
     */
    getSentimentTrends: async (days = 7) => {
        const { data, error } = await supabase
            .from('daily_reports')
            .select('report_date, overall_positive, overall_negative, overall_neutral, total_posts_analyzed')
            .order('report_date', { ascending: true })
            .limit(days);

        if (error) {
            console.error('getSentimentTrends error:', error.message);
            return null;
        }

        return {
            labels: (data || []).map(d => d.report_date),
            datasets: [
                { label: 'Positive', data: (data || []).map(d => d.overall_positive), color: '#10B981' },
                { label: 'Negative', data: (data || []).map(d => d.overall_negative), color: '#EF4444' },
                { label: 'Neutral', data: (data || []).map(d => d.overall_neutral), color: '#6B7280' }
            ]
        };
    },

    /**
     * Delete a report by ID
     */
    deleteReport: async (id) => {
        const { error } = await supabase
            .from('daily_reports')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('deleteReport error:', error.message);
            return { success: false, message: error.message };
        }

        return { success: true };
    }
};
