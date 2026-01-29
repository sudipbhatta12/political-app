const https = require('https');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const response = JSON.parse(data);
            if (response.error) {
                console.error("❌ API Error:", response.error.message);
                return;
            }

            console.log("\n📦 AVAILABLE GEMINI MODELS:\n");
            const models = response.models || [];
            
            // Filter for Flash models
            const flashModels = models.filter(m => m.name.toLowerCase().includes('flash'));
            
            flashModels.forEach(model => {
                console.log(`• ${model.name.replace('models/', '')}`);
                console.log(`  Version: ${model.version}`);
                console.log(`  Description: ${model.description.substring(0, 100)}...`);
                console.log('');
            });

            // Check specifically for "3"
            const hasGemini3 = models.some(m => m.name.includes('gemini-3'));
            if (!hasGemini3) {
                console.log("ℹ️  NOTE: 'gemini-3-flash' was NOT found in the list.");
            } else {
                console.log("✅ 'gemini-3' WAS found!");
            }

        } catch (e) {
            console.error("Parse Error:", e.message);
        }
    });
}).on('error', (err) => {
    console.error("Network Error:", err.message);
});
