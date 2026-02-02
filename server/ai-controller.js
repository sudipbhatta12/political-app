const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const pdf = require('pdf-parse');
const XLSX = require('xlsx');
const { parse } = require('csv-parse/sync');
const db = require('./database');

// Initialize Gemini
// CRITICAL: Key must be provided via environment variable GEMINI_API_KEY in Cloud Run
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("❌ GEMINI_API_KEY is missing from environment variables!");
}
const genAI = new GoogleGenerativeAI(apiKey);

// Helper: Extract text from different file types
async function extractTextFromFile(file) {
    const buffer = fs.readFileSync(file.path);
    const mimeType = file.mimetype;
    let comments = [];

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
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            // Flatten and filter
            comments = jsonData.flat().map(c => String(c)).filter(c => c.trim().length > 5);
        } 
        else if (mimeType === 'text/csv' || mimeType === 'application/csv') {
            const records = parse(buffer, { columns: false, skip_empty_lines: true });
            comments = records.flat().map(c => String(c)).filter(c => c.trim().length > 5);
        }
        else {
            throw new Error('Unsupported file type');
        }

        // Limit to first 2000 comments to fit in context window if extremely large
        return comments.slice(0, 2000).join('\n');
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
        for (const file of req.files) {
            console.log(`   - Reading: ${file.originalname}`);
            const text = await extractTextFromFile(file);
            if (text) allComments.push(text);
        }
        
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

        // 3. Save to Database
        // Check if candidate has a post FOR THIS DATE
        const today = new Date().toISOString().split('T')[0];
        const existingPosts = await db.getPostsByCandidate(parseInt(candidate_id));
        const postForToday = existingPosts.find(p => p.published_date === today);
        
        let postId = 0;
        const fileNames = req.files.map(f => f.originalname).join(', ');
        const postUrl = `AI Analysis - ${req.files.length} file(s)`;
        
        if (postForToday) {
            // Update existing post for TODAY
            postId = postForToday.id;
            await db.updatePost(postId, {
                post_url: postUrl,
                published_date: today,
                ...analysis
            });
            console.log(`🔄 Updated existing post ID: ${postId} for date ${today}`);
        } else {
            // Create new post for TODAY (History preserved!)
            postId = await db.createPost({
                candidate_id: parseInt(candidate_id),
                post_url: postUrl,
                published_date: today,
                ...analysis
            });
            console.log(`✨ Created new post ID: ${postId} for date ${today}`);
        }

        // Cleanup uploaded files
        for (const file of req.files) {
            try {
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            } catch (e) { console.error('Cleanup error:', e); }
        }

        res.json({ 
            success: true, 
            message: 'Analysis completed and saved successfully',
            data: analysis 
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
