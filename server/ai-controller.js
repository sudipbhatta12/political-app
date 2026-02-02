const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const pdf = require('pdf-parse');
const XLSX = require('xlsx');
const { parse } = require('csv-parse/sync');
const db = require('./database');

// Initialize Gemini
// CRITICAL: Key must be provided via environment variable GEMINI_API_KEY
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("❌ GEMINI_API_KEY is missing from environment variables!");
}
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Helper: Extract text from different file types
// Returns { text: string, count: number, structuredComments: array } for tracking comment counts and engagement
async function extractTextFromFile(file) {
    const buffer = fs.readFileSync(file.path);
    const mimeType = file.mimetype;
    let comments = [];
    let structuredComments = []; // For engagement data

    try {
        if (mimeType === 'application/pdf') {
            const data = await pdf(buffer);
            // Split by newlines and filter empty
            comments = data.text.split('\n').filter(line => line.trim().length > 10);
        }
        else if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            mimeType === 'application/vnd.ms-excel') {
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            // Try to parse as structured data with headers first
            const jsonDataWithHeaders = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            if (jsonDataWithHeaders.length > 1) {
                // Check if first row looks like headers
                const headers = jsonDataWithHeaders[0].map(h => String(h || '').toLowerCase().trim());

                // Look for common column names for comments and engagement
                const commentIdx = headers.findIndex(h =>
                    h.includes('comment') || h.includes('text') || h.includes('message') || h.includes('content')
                );
                const likesIdx = headers.findIndex(h =>
                    h.includes('like') || h.includes('reaction') || h.includes('love')
                );
                const repliesIdx = headers.findIndex(h =>
                    h.includes('repl') || h.includes('response')
                );
                const sharesIdx = headers.findIndex(h =>
                    h.includes('share')
                );

                // If we found a comment column, extract structured data
                if (commentIdx !== -1) {
                    for (let i = 1; i < jsonDataWithHeaders.length; i++) {
                        const row = jsonDataWithHeaders[i];
                        const commentText = String(row[commentIdx] || '').trim();

                        if (commentText.length > 5) {
                            const likes = likesIdx !== -1 ? parseInt(row[likesIdx]) || 0 : 0;
                            const replies = repliesIdx !== -1 ? parseInt(row[repliesIdx]) || 0 : 0;
                            const shares = sharesIdx !== -1 ? parseInt(row[sharesIdx]) || 0 : 0;

                            // Calculate engagement score
                            const engagementScore = likes + (replies * 2) + (shares * 3);

                            structuredComments.push({
                                content: commentText,
                                likes,
                                replies,
                                shares,
                                engagement_score: engagementScore
                            });

                            comments.push(commentText);
                        }
                    }
                } else {
                    // No headers found, flatten all cells
                    comments = jsonDataWithHeaders.flat().map(c => String(c)).filter(c => c.trim().length > 5);
                }
            }
        }
        else if (mimeType === 'text/csv' || mimeType === 'application/csv') {
            const records = parse(buffer, { columns: true, skip_empty_lines: true });

            // Try to find comment and engagement columns
            if (records.length > 0) {
                const headers = Object.keys(records[0]).map(h => h.toLowerCase().trim());

                const commentKey = Object.keys(records[0]).find(k => {
                    const lk = k.toLowerCase();
                    return lk.includes('comment') || lk.includes('text') || lk.includes('message') || lk.includes('content');
                });
                const likesKey = Object.keys(records[0]).find(k => {
                    const lk = k.toLowerCase();
                    return lk.includes('like') || lk.includes('reaction');
                });
                const repliesKey = Object.keys(records[0]).find(k => {
                    const lk = k.toLowerCase();
                    return lk.includes('repl') || lk.includes('response');
                });

                if (commentKey) {
                    for (const row of records) {
                        const commentText = String(row[commentKey] || '').trim();
                        if (commentText.length > 5) {
                            const likes = likesKey ? parseInt(row[likesKey]) || 0 : 0;
                            const replies = repliesKey ? parseInt(row[repliesKey]) || 0 : 0;
                            const engagementScore = likes + (replies * 2);

                            structuredComments.push({
                                content: commentText,
                                likes,
                                replies,
                                shares: 0,
                                engagement_score: engagementScore
                            });

                            comments.push(commentText);
                        }
                    }
                } else {
                    // Flatten all values
                    comments = records.flatMap(r => Object.values(r)).map(c => String(c)).filter(c => c.trim().length > 5);
                }
            }
        }
        else {
            throw new Error('Unsupported file type');
        }

        // Store the total count before limiting
        const totalCount = comments.length;

        // Limit to first 2000 comments to fit in context window if extremely large
        const limitedComments = comments.slice(0, 2000);

        return {
            text: limitedComments.join('\n'),
            count: totalCount,
            structuredComments: structuredComments
        };
    } catch (error) {
        console.error('Text extraction error:', error);
        throw new Error('Failed to read file content');
    }
}

async function analyzeComments(req, res) {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const { candidate_id } = req.body;
        if (!candidate_id) {
            return res.status(400).json({ error: 'Candidate ID is required' });
        }

        // 1. Extract Text from ALL files
        console.log(`📂 Processing ${req.files.length} file(s)...`);

        let allComments = [];
        let totalCommentCount = 0;
        let allStructuredComments = []; // Collect all structured comments

        for (const file of req.files) {
            console.log(`   - Reading: ${file.originalname}`);
            const result = await extractTextFromFile(file);
            if (result.text) {
                allComments.push(result.text);
                totalCommentCount += result.count;
            }
            // Collect structured comments for engagement ranking
            if (result.structuredComments && result.structuredComments.length > 0) {
                allStructuredComments = allStructuredComments.concat(result.structuredComments);
            }
        }

        console.log(`📊 Total comments extracted: ${totalCommentCount}`);
        console.log(`📊 Structured comments with engagement: ${allStructuredComments.length}`);

        const commentsText = allComments.join('\n');

        if (commentsText.length < 50) {
            return res.status(400).json({ error: 'Not enough text found in files to analyze' });
        }

        // 2. Call Gemini
        console.log('🤖 Sending data to Gemini Flash...');
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

        const prompt = `
            You are a political analyst expert. Analyze the following list of public comments regarding a political candidate.
            
            Determine the overall sentiment distribution (Positive, Negative, Neutral) as percentages.
            Summarize the key "Positive Remarks" (why people like them), "Negative Remarks" (why people dislike them), and "Neutral Remarks".
            Provide a final "Conclusion" summarizing the public perception.

            Return ONLY raw JSON (no markdown formatting) with this exact structure:
            {
                "positive_percentage": number,
                "negative_percentage": number,
                "neutral_percentage": number,
                "positive_remarks": "string summary",
                "negative_remarks": "string summary",
                "neutral_remarks": "string summary",
                "conclusion": "string summary"
            }

            Ensure percentages sum to exactly 100.

            COMMENTS DATA:
            ${commentsText}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean markdown code blocks if present
        let jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();

        // Robust JSON extraction: Find the first '{' and last '}'
        const firstOpen = jsonStr.indexOf('{');
        const lastClose = jsonStr.lastIndexOf('}');

        if (firstOpen !== -1 && lastClose !== -1) {
            jsonStr = jsonStr.substring(firstOpen, lastClose + 1);
        }

        let analysis;
        try {
            analysis = JSON.parse(jsonStr);
        } catch (e) {
            console.error('JSON Parse Error:', e);
            console.error('Raw Text:', text);
            return res.status(500).json({ error: 'AI returned invalid format. Please try again.' });
        }

        console.log('✅ Analysis complete:', analysis);

        // 3. Get Top 10 Popular Comments by engagement
        let popularComments = [];
        if (allStructuredComments.length > 0) {
            // Sort by engagement score (descending)
            popularComments = allStructuredComments
                .sort((a, b) => b.engagement_score - a.engagement_score)
                .slice(0, 10);
            console.log(`🌟 Top 10 popular comments identified`);
        }

        // 4. Save to Database
        // Check if candidate already has an analysis for this exact source URL
        const sourceUrl = req.body.source_url;
        const existingPosts = await db.getPostsByCandidate(parseInt(candidate_id));

        // Check for duplicate URL (if source URL was provided)
        if (sourceUrl) {
            const duplicatePost = existingPosts.find(p => p.post_url === sourceUrl);
            if (duplicatePost && !req.body.force_reanalyze) {
                // Return warning about duplicate - let frontend ask user
                return res.status(409).json({
                    error: 'duplicate_url',
                    message: 'This post URL has already been analyzed for this candidate.',
                    existingPostId: duplicatePost.id,
                    existingDate: duplicatePost.published_date,
                    askConfirmation: true
                });
            }

            // If force_reanalyze is true, delete the old post first
            if (duplicatePost && req.body.force_reanalyze) {
                await db.deletePost(duplicatePost.id);
                console.log(`🗑️ Deleted existing post ID: ${duplicatePost.id} for re-analysis`);
            }
        }

        let postId = 0;
        const fileNames = req.files.map(f => f.originalname).join(', ');
        const today = new Date().toISOString().split('T')[0];

        // Use the source URL if provided, otherwise use a descriptive text
        const postUrl = sourceUrl || `AI Analysis - ${req.files.length} file(s) - ${today}`;

        // Always create a new post (allows multiple posts per candidate)
        postId = await db.createPost({
            candidate_id: parseInt(candidate_id),
            post_url: postUrl,
            published_date: today,
            comment_count: totalCommentCount,
            popular_comments: JSON.stringify(popularComments),
            ...analysis
        });
        console.log(`✨ Created new post ID: ${postId} for candidate ${candidate_id}`);

        // Cleanup uploaded files
        for (const file of req.files) {
            try {
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            } catch (e) { console.error('Cleanup error:', e); }
        }

        res.json({
            success: true,
            message: 'Analysis completed and saved successfully',
            data: analysis,
            commentCount: totalCommentCount,
            popularComments: popularComments
        });

    } catch (error) {
        console.error('AI Analysis Error:', error);
        // Try to cleanup files on error
        if (req.files) {
            for (const file of req.files) {
                try {
                    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                } catch (e) { }
            }
        }

        res.status(500).json({ error: 'AI Analysis failed: ' + error.message });
    }
}

module.exports = { analyzeComments };
