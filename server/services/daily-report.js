/**
 * Daily Report Service
 * Generates comprehensive daily reports with AI analysis and fallback algorithms
 */

const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder-key');

// Initialize Gemini AI
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

/**
 * Format date for display
 */
function formatDateDisplay(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Get all media posts for a specific date
 */
async function getPostsForDate(date) {
    const { data, error } = await supabase
        .from('media_posts')
        .select('*')
        .eq('published_date', date);

    if (error) {
        console.error('getPostsForDate error:', error.message);
        return [];
    }
    return data || [];
}

/**
 * Get candidate posts for a specific date
 */
async function getCandidatePostsForDate(date) {
    const { data, error } = await supabase
        .from('posts')
        .select(`
            *,
            candidates (id, name, party_name)
        `)
        .eq('published_date', date);

    if (error) {
        console.error('getCandidatePostsForDate error:', error.message);
        return [];
    }
    return data || [];
}

/**
 * Calculate aggregated sentiment using algorithm (fallback when AI unavailable)
 */
function calculateSentimentAlgorithm(posts) {
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

    // Volume-weighted average
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

/**
 * Generate AI summary for the report
 */
async function generateAISummary(reportData) {
    if (!genAI) {
        console.log('AI unavailable, using algorithmic summary');
        return generateAlgorithmicSummary(reportData);
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `You are a political analyst generating a daily sentiment report for Nepal's political landscape.

Based on the following data, generate a concise, professional summary (2-3 paragraphs):

Date: ${reportData.report_date}
Total Posts Analyzed: ${reportData.total_posts_analyzed}
Total Comments Analyzed: ${reportData.total_comments_analyzed}

Overall Sentiment:
- Positive: ${reportData.overall_positive.toFixed(1)}%
- Negative: ${reportData.overall_negative.toFixed(1)}%
- Neutral: ${reportData.overall_neutral.toFixed(1)}%

Top Sources by Activity:
${reportData.source_summaries?.slice(0, 5).map(s =>
            `- ${s.source_name}: ${s.post_count} posts, ${s.avg_positive.toFixed(1)}% positive`
        ).join('\n') || 'No source data available'}

Generate a professional summary highlighting:
1. Overall political sentiment trend
2. Notable differences between sources
3. Key observations and implications

Keep it factual and balanced. Write in English.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('AI summary generation failed:', error.message);
        return generateAlgorithmicSummary(reportData);
    }
}

/**
 * Fallback algorithmic summary when AI is unavailable
 */
function generateAlgorithmicSummary(reportData) {
    const { overall_positive, overall_negative, overall_neutral, total_posts_analyzed, total_comments_analyzed } = reportData;

    let sentimentTrend = 'neutral';
    if (overall_positive > overall_negative + 10) sentimentTrend = 'positive';
    else if (overall_negative > overall_positive + 10) sentimentTrend = 'negative';
    else if (overall_positive > overall_negative) sentimentTrend = 'slightly positive';
    else if (overall_negative > overall_positive) sentimentTrend = 'slightly negative';

    const dateStr = formatDateDisplay(reportData.report_date);

    let summary = `Political Sentiment Report for ${dateStr}\n\n`;
    summary += `Today's analysis covered ${total_posts_analyzed} posts with ${total_comments_analyzed.toLocaleString()} comments across all monitored sources. `;
    summary += `The overall sentiment appears ${sentimentTrend} with ${overall_positive.toFixed(1)}% positive, ${overall_negative.toFixed(1)}% negative, and ${overall_neutral.toFixed(1)}% neutral reactions.\n\n`;

    if (reportData.source_summaries && reportData.source_summaries.length > 0) {
        const topSource = reportData.source_summaries.sort((a, b) => b.post_count - a.post_count)[0];
        summary += `The most active source was ${topSource.source_name} with ${topSource.post_count} posts. `;

        const mostPositive = reportData.source_summaries.sort((a, b) => b.avg_positive - a.avg_positive)[0];
        if (mostPositive.source_name !== topSource.source_name) {
            summary += `${mostPositive.source_name} showed the most positive sentiment at ${mostPositive.avg_positive.toFixed(1)}%.`;
        }
    }

    return summary;
}

/**
 * Group posts by source for summary generation
 */
async function generateSourceSummaries(mediaPosts, candidatePosts, date) {
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

    // Get source names and calculate summaries
    for (const key of Object.keys(mediaBySource)) {
        const group = mediaBySource[key];
        const sentiment = calculateSentimentAlgorithm(group.posts);

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
            avg_neutral: sentiment.overall_neutral
        });
    }

    // Add candidate summaries (aggregate by party)
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
        const sentiment = calculateSentimentAlgorithm(partyPosts);

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

module.exports = {
    /**
     * Generate daily report for a specific date
     */
    generateDailyReport: async (date = null) => {
        const targetDate = date || getTodayDate();
        console.log(`📊 Generating daily report for ${targetDate}...`);

        // Get all posts for the date
        const mediaPosts = await getPostsForDate(targetDate);
        const candidatePosts = await getCandidatePostsForDate(targetDate);
        const allPosts = [...mediaPosts, ...candidatePosts];

        if (allPosts.length === 0) {
            console.log('No posts found for this date');
            return {
                success: false,
                message: 'No data available for this date',
                report_date: targetDate
            };
        }

        // Calculate overall sentiment
        const overallSentiment = calculateSentimentAlgorithm(allPosts);

        // Count unique sources
        const uniqueSources = new Set(mediaPosts.map(p => `${p.source_type}_${p.source_id}`));
        const totalSources = uniqueSources.size + (candidatePosts.length > 0 ? 1 : 0);

        // Generate source summaries
        const sourceSummaries = await generateSourceSummaries(mediaPosts, candidatePosts, targetDate);

        // Prepare report data
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

        // Generate AI summary (with fallback)
        const summaryText = await generateAISummary(reportData);
        reportData.summary_text = summaryText;

        // Check if report already exists
        const { data: existing } = await supabase
            .from('daily_reports')
            .select('id')
            .eq('report_date', targetDate)
            .single();

        let reportId;

        if (existing) {
            // Update existing report
            const { error } = await supabase
                .from('daily_reports')
                .update({
                    total_posts_analyzed: reportData.total_posts_analyzed,
                    total_comments_analyzed: reportData.total_comments_analyzed,
                    total_sources: reportData.total_sources,
                    overall_positive: reportData.overall_positive,
                    overall_negative: reportData.overall_negative,
                    overall_neutral: reportData.overall_neutral,
                    summary_text: reportData.summary_text,
                    generated_at: new Date().toISOString()
                })
                .eq('id', existing.id);

            if (error) {
                console.error('Update report error:', error.message);
                return { success: false, message: error.message };
            }

            reportId = existing.id;

            // Delete old summaries
            await supabase.from('report_summaries').delete().eq('report_id', reportId);
        } else {
            // Create new report
            const { data: newReport, error } = await supabase
                .from('daily_reports')
                .insert({
                    report_date: targetDate,
                    total_posts_analyzed: reportData.total_posts_analyzed,
                    total_comments_analyzed: reportData.total_comments_analyzed,
                    total_sources: reportData.total_sources,
                    overall_positive: reportData.overall_positive,
                    overall_negative: reportData.overall_negative,
                    overall_neutral: reportData.overall_neutral,
                    summary_text: reportData.summary_text
                })
                .select('id')
                .single();

            if (error) {
                console.error('Create report error:', error.message);
                return { success: false, message: error.message };
            }

            reportId = newReport.id;
        }

        // Insert source summaries
        for (const summary of sourceSummaries) {
            await supabase.from('report_summaries').insert({
                report_id: reportId,
                source_type: summary.source_type,
                source_id: summary.source_id,
                source_name: summary.source_name,
                avg_positive: summary.avg_positive,
                avg_negative: summary.avg_negative,
                avg_neutral: summary.avg_neutral,
                post_count: summary.post_count,
                comment_count: summary.comment_count,
                engagement_count: summary.engagement_count
            });
        }

        console.log(`✅ Daily report generated successfully (ID: ${reportId})`);

        return {
            success: true,
            report_id: reportId,
            ...reportData
        };
    },

    /**
     * Get report by date
     */
    getReportByDate: async (date) => {
        const { data: report, error } = await supabase
            .from('daily_reports')
            .select('*')
            .eq('report_date', date)
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
            .order('post_count', { ascending: false });

        return {
            ...report,
            source_summaries: summaries || []
        };
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

        // Prepare chart data
        return {
            // Pie chart - overall sentiment
            sentimentPie: {
                labels: ['Positive', 'Negative', 'Neutral'],
                data: [report.overall_positive, report.overall_negative, report.overall_neutral],
                colors: ['#10B981', '#EF4444', '#6B7280']
            },
            // Bar chart - by source type
            sourceBar: {
                labels: (summaries || []).map(s => s.source_name),
                datasets: [
                    {
                        label: 'Positive %',
                        data: (summaries || []).map(s => s.avg_positive),
                        color: '#10B981'
                    },
                    {
                        label: 'Negative %',
                        data: (summaries || []).map(s => s.avg_negative),
                        color: '#EF4444'
                    }
                ]
            },
            // Summary stats
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
                {
                    label: 'Positive',
                    data: (data || []).map(d => d.overall_positive),
                    color: '#10B981'
                },
                {
                    label: 'Negative',
                    data: (data || []).map(d => d.overall_negative),
                    color: '#EF4444'
                },
                {
                    label: 'Neutral',
                    data: (data || []).map(d => d.overall_neutral),
                    color: '#6B7280'
                }
            ]
        };
    }
};
