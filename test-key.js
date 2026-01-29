const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function testKey() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Try to list models to verify connection
        // Note: listModels is not directly on genAI instance in all versions, 
        // but we can try getting a model and running a simple prompt.
        
        console.log("Testing API Key with gemini-1.5-flash...");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hello");
        console.log("✅ Success! Response:", result.response.text());
        
        console.log("Testing API Key with gemini-2.0-flash-exp...");
        const model2 = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
        const result2 = await model2.generateContent("Hello");
        console.log("✅ Success! Response:", result2.response.text());

        console.log("\nTesting gemini-3.0-flash...");
        const model3 = genAI.getGenerativeModel({ model: "gemini-3.0-flash" });
        const result3 = await model3.generateContent("Hello");
        console.log("✅ Success with 3.0!", result3.response.text());

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

testKey();
