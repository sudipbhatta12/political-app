/**
 * Generate SQL INSERT statements for candidates to seed Supabase
 * Run with: node generate_candidates_sql.js
 */

const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'source_data', 'candidates_2082.csv');
const outputPath = path.join(__dirname, 'candidates_seed.sql');

// District name mapping (Nepali to ID) - Matches the database
const DISTRICT_NAME_MAP = {
    'ताप्लेजुङ': 12, 'पाँचथर': 8, 'इलाम': 3, 'झापा': 4,
    'संखुवासभा': 9, 'तेह्रथुम': 13, 'भोजपुर': 1, 'धनकुटा': 2,
    'मोरङ': 6, 'सुनसरी': 11, 'सोलुखुम्बु': 10, 'खोटाङ': 5,
    'ओखलढुंगा': 7, 'ओखलढुङ्गा': 7, 'उदयपुर': 14,
    'सप्तरी': 15, 'सिराहा': 16, 'धनुषा': 17, 'महोत्तरी': 18,
    'सर्लाही': 19, 'रौतहट': 20, 'बारा': 21, 'पर्सा': 22,
    'सिन्धुली': 23, 'रामेछाप': 24, 'दोलखा': 25, 'सिन्धुपाल्चोक': 26,
    'काभ्रेपलाञ्चोक': 27, 'काभ्रे': 27, 'ललितपुर': 28, 'भक्तपुर': 29,
    'काठमाडौं': 30, 'काठमाण्डौं': 30, 'नुवाकोट': 31, 'रसुवा': 32,
    'धादिङ': 33, 'मकवानपुर': 34, 'चितवन': 35,
    'गोरखा': 36, 'लमजुङ': 37, 'तनहुँ': 38, 'स्याङ्जा': 39, 'स्याङजा': 39,
    'कास्की': 40, 'मनाङ': 41, 'मुस्ताङ': 42, 'म्याग्दी': 43,
    'पर्वत': 44, 'बाग्लुङ': 45, 'नवलपुर': 46,
    'नवलपरासी (बर्दघाट सुस्ता पूर्व)': 46,
    'रुपन्देही': 47, 'रूपन्देही': 47, 'कपिलवस्तु': 48, 'कपिलबस्तु': 48,
    'अर्घाखाँची': 49, 'गुल्मी': 50, 'पाल्पा': 51, 'नवलपरासी': 52,
    'नवलपरासी (बर्दघाट सुस्ता पश्चिम)': 52,
    'दाङ': 53, 'प्युठान': 54, 'प्यूठान': 54, 'रोल्पा': 55,
    'रुकुम पूर्व': 56, 'रुकुम (पूर्व भाग)': 56, 'रुकुम (पूर्वी भाग)': 56,
    'बाँके': 57, 'बर्दिया': 58,
    'रुकुम पश्चिम': 59, 'रुकुम (पश्चिम भाग)': 59,
    'सल्यान': 60, 'डोल्पा': 61, 'हुम्ला': 62, 'जुम्ला': 63,
    'कालिकोट': 64, 'मुगु': 65, 'सुर्खेत': 66, 'दैलेख': 67, 'जाजरकोट': 68,
    'कैलाली': 69, 'अछाम': 70, 'डोटी': 71, 'बझाङ': 72, 'बाजुरा': 73,
    'कञ्चनपुर': 74, 'डडेल्धुरा': 75, 'डडेलधुरा': 75, 'बैतडी': 76, 'दार्चुला': 77
};

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
        else current += char;
    }
    result.push(current.trim());
    return result;
}

function escapeSql(str) {
    if (!str) return '';
    return str.replace(/'/g, "''");
}

async function generateSQL() {
    console.log('📖 Reading CSV file...');

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    const dataLines = lines.slice(1); // Skip header

    console.log(`📊 Found ${dataLines.length} candidate records`);

    // Group candidates by district+constituency for efficient queries
    const candidatesByConstituency = new Map();
    let skipped = 0;

    for (const line of dataLines) {
        const fields = parseCSVLine(line);
        if (fields.length < 5) { skipped++; continue; }

        const districtName = fields[1]?.trim();
        const constituencyNo = fields[2]?.trim();
        const partyName = fields[3]?.trim() || 'स्वतन्त्र';
        const candidateName = fields[4]?.trim();

        if (!candidateName) { skipped++; continue; }

        const districtId = DISTRICT_NAME_MAP[districtName];
        if (!districtId) {
            console.log(`⚠️ Unknown district: ${districtName}`);
            skipped++;
            continue;
        }

        const constituencyName = `निर्वाचन क्षेत्र नं. ${constituencyNo}`;
        const key = `${districtId}|${constituencyName}`;

        if (!candidatesByConstituency.has(key)) {
            candidatesByConstituency.set(key, {
                districtId,
                constituencyName,
                candidates: []
            });
        }

        candidatesByConstituency.get(key).candidates.push({
            name: candidateName,
            party: partyName
        });
    }

    console.log(`✅ Processed ${candidatesByConstituency.size} constituencies`);
    console.log(`⏭️ Skipped ${skipped} records`);

    // Generate SQL
    let sql = `-- Candidate Seed Data for Political Social Media Assessment
-- Generated from candidates_2082.csv on ${new Date().toISOString()}
-- Total candidates: ~${dataLines.length - skipped}
-- 
-- IMPORTANT: Run supabase_seed.sql FIRST to create provinces, districts, constituencies
-- Then run this file to add all election candidates.

`;

    // For each constituency group, generate INSERT statements
    let totalCandidates = 0;

    for (const [key, data] of candidatesByConstituency) {
        const { districtId, constituencyName, candidates } = data;

        sql += `-- District ${districtId}, ${constituencyName} (${candidates.length} candidates)\n`;
        sql += `INSERT INTO candidates (name, party_name, constituency_id)\n`;
        sql += `SELECT v.name, v.party, c.id\n`;
        sql += `FROM (VALUES\n`;

        const values = candidates.map(cand => {
            const name = escapeSql(cand.name);
            const party = escapeSql(cand.party);
            return `    ('${name}', '${party}')`;
        });

        sql += values.join(',\n');
        sql += `\n) AS v(name, party)\n`;
        sql += `CROSS JOIN constituencies c\n`;
        sql += `WHERE c.district_id = ${districtId} AND c.name = '${escapeSql(constituencyName)}'\n`;
        sql += `ON CONFLICT DO NOTHING;\n\n`;

        totalCandidates += candidates.length;
    }

    // Write to file
    fs.writeFileSync(outputPath, sql, 'utf-8');
    console.log(`\n✅ Generated: ${outputPath}`);
    console.log(`📝 Total candidates: ${totalCandidates}`);
    console.log(`📍 Constituencies: ${candidatesByConstituency.size}`);
    console.log(`\n📋 Next steps:`);
    console.log(`   1. Go to Supabase SQL Editor`);
    console.log(`   2. First run supabase_seed.sql (provinces, districts, constituencies)`);
    console.log(`   3. Then run candidates_seed.sql (this file)`);
}

generateSQL().catch(console.error);
