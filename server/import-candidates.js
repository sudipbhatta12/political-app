/**
 * Import Candidates from CSV
 * Imports all candidates from the election CSV file into the database
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

// Database and CSV paths  
const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'assessment.db');
const csvPath = path.join(__dirname, '..', 'source_data', 'candidates_2082.csv');

// District name mapping (Nepali to ID) - Based on districts.json
// Includes all spelling variations found in CSV
const DISTRICT_NAME_MAP = {
    // Province 1
    'ताप्लेजुङ': 12,
    'पाँचथर': 8,
    'इलाम': 3,
    'झापा': 4,
    'संखुवासभा': 9,
    'तेह्रथुम': 13,
    'भोजपुर': 1,
    'धनकुटा': 2,
    'मोरङ': 6,
    'सुनसरी': 11,
    'सोलुखुम्बु': 10,
    'खोटाङ': 5,
    'ओखलढुंगा': 7,
    'ओखलढुङ्गा': 7,
    'उदयपुर': 14,

    // Province 2
    'सप्तरी': 15,
    'सिराहा': 16,
    'धनुषा': 17,
    'महोत्तरी': 18,
    'सर्लाही': 19,
    'रौतहट': 20,
    'बारा': 21,
    'पर्सा': 22,

    // Bagmati Pradesh
    'सिन्धुली': 23,
    'रामेछाप': 24,
    'दोलखा': 25,
    'सिन्धुपाल्चोक': 26,
    'काभ्रेपलाञ्चोक': 27,
    'काभ्रे': 27,
    'ललितपुर': 28,
    'भक्तपुर': 29,
    'काठमाडौं': 30,
    'काठमाण्डौं': 30,
    'नुवाकोट': 31,
    'रसुवा': 32,
    'धादिङ': 33,
    'मकवानपुर': 34,
    'चितवन': 35,

    // Gandaki Pradesh
    'गोरखा': 36,
    'लमजुङ': 37,
    'तनहुँ': 38,
    'स्याङ्जा': 39,
    'स्याङजा': 39, // CSV variation
    'कास्की': 40,
    'मनाङ': 41,
    'मुस्ताङ': 42,
    'म्याग्दी': 43,
    'पर्वत': 44,
    'बाग्लुङ': 45,
    'नवलपुर': 46,
    'नवलपुर (सुस्ता पूर्व)': 46,
    'नवलपरासी (बर्दघाट सुस्ता पूर्व)': 46, // East Nawalparasi - same as Nawalpur

    // Lumbini Pradesh
    'रुपन्देही': 47,
    'रूपन्देही': 47, // CSV variation
    'कपिलवस्तु': 48,
    'कपिलबस्तु': 48, // CSV variation
    'अर्घाखाँची': 49,
    'गुल्मी': 50,
    'पाल्पा': 51,
    'नवलपरासी': 52,
    'नवलपरासी (बर्दघाट सुस्ता पश्चिम)': 52,
    'दाङ': 53,
    'प्युठान': 54,
    'प्यूठान': 54, // CSV variation
    'रोल्पा': 55,
    'रुकुम पूर्व': 56,
    'रुकुम (पूर्व भाग)': 56,
    'रुकुम (पूर्वी भाग)': 56, // CSV variation
    'बाँके': 57,
    'बर्दिया': 58,

    // Karnali Pradesh
    'रुकुम पश्चिम': 59,
    'रुकुम (पश्चिम भाग)': 59,
    'सल्यान': 60,
    'डोल्पा': 61,
    'हुम्ला': 62,
    'जुम्ला': 63,
    'कालिकोट': 64,
    'मुगु': 65,
    'सुर्खेत': 66,
    'दैलेख': 67,
    'जाजरकोट': 68,

    // Sudurpashchim Pradesh
    'कैलाली': 69,
    'अछाम': 70,
    'डोटी': 71,
    'बझाङ': 72,
    'बाजुरा': 73,
    'कञ्चनपुर': 74,
    'डडेल्धुरा': 75,
    'डडेलधुरा': 75, // CSV variation
    'बैतडी': 76,
    'दार्चुला': 77
};

// Database instance
let db = null;

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

/**
 * Run a SQL statement
 */
function run(sql, params = []) {
    try {
        const stmt = db.prepare(sql);
        if (params.length > 0) {
            stmt.bind(params);
        }
        stmt.step();
        stmt.free();
    } catch (e) {
        console.error('Run error:', sql, params, e.message);
    }
}

/**
 * Run a SQL statement and get last insert ID
 */
function runAndGetId(sql, params = []) {
    try {
        const stmt = db.prepare(sql);
        if (params.length > 0) {
            stmt.bind(params);
        }
        stmt.step();
        stmt.free();

        const result = db.exec('SELECT last_insert_rowid() as id');
        return result.length > 0 ? result[0].values[0][0] : 0;
    } catch (e) {
        console.error('RunAndGetId error:', sql, params, e.message);
        return 0;
    }
}

/**
 * Query and get results as array of objects
 */
function query(sql, params = []) {
    try {
        const stmt = db.prepare(sql);
        if (params.length > 0) {
            stmt.bind(params);
        }
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
    } catch (e) {
        console.error('Query error:', sql, e.message);
        return [];
    }
}

/**
 * Save database to file
 */
function saveDatabase() {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
}

/**
 * Main import function
 */
async function importCandidates() {
    console.log('🚀 Starting candidate import...\n');

    // Initialize SQL.js
    const SQL = await initSqlJs();

    // Load existing database
    if (fs.existsSync(dbPath)) {
        const fileBuffer = fs.readFileSync(dbPath);
        db = new SQL.Database(fileBuffer);
        console.log('✅ Database loaded');
    } else {
        console.error('❌ Database not found. Run the server first to create it.');
        process.exit(1);
    }

    // Read CSV file
    if (!fs.existsSync(csvPath)) {
        console.error('❌ CSV file not found:', csvPath);
        process.exit(1);
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());

    console.log(`📄 Found ${lines.length - 1} candidate records in CSV\n`);

    // Skip header
    const dataLines = lines.slice(1);

    // Track constituencies we've created
    const constituencyMap = new Map();

    // First, get existing constituencies
    const existingConstituencies = query('SELECT id, name, district_id FROM constituencies');
    for (const c of existingConstituencies) {
        const key = `${c.district_id}-${c.name}`;
        constituencyMap.set(key, c.id);
    }
    console.log(`📍 Found ${existingConstituencies.length} existing constituencies`);

    // Clear existing candidates to avoid duplicates
    console.log('🗑️  Clearing existing candidates...');
    run('DELETE FROM comments');
    run('DELETE FROM posts');
    run('DELETE FROM candidates');

    // Track statistics
    let imported = 0;
    let skipped = 0;
    let missingDistricts = new Set();
    let createdConstituencies = 0;

    // Process each candidate
    for (const line of dataLines) {
        const fields = parseCSVLine(line);

        if (fields.length < 6) {
            skipped++;
            continue;
        }

        const [serialNo, districtName, constituencyNo, partyName, candidateName, age, gender] = fields;

        // Skip if no candidate name
        if (!candidateName || candidateName.trim() === '') {
            skipped++;
            continue;
        }

        // Get district ID from Nepali name
        const districtId = DISTRICT_NAME_MAP[districtName.trim()];
        if (!districtId) {
            missingDistricts.add(districtName.trim());
            skipped++;
            continue;
        }

        // Get or create constituency
        const constituencyName = `निर्वाचन क्षेत्र नं. ${constituencyNo}`;
        const constituencyKey = `${districtId}-${constituencyName}`;

        let constituencyId = constituencyMap.get(constituencyKey);

        if (!constituencyId) {
            // Create new constituency
            constituencyId = runAndGetId(
                'INSERT INTO constituencies (name, district_id) VALUES (?, ?)',
                [constituencyName, districtId]
            );
            constituencyMap.set(constituencyKey, constituencyId);
            createdConstituencies++;
        }

        // Insert candidate
        if (constituencyId) {
            run(
                'INSERT INTO candidates (name, party_name, constituency_id) VALUES (?, ?, ?)',
                [candidateName.trim(), partyName.trim(), constituencyId]
            );
            imported++;

            // Log progress every 500 records
            if (imported % 500 === 0) {
                console.log(`   📊 Imported ${imported} candidates...`);
            }
        } else {
            skipped++;
        }
    }

    // Save database
    console.log('\n💾 Saving database...');
    saveDatabase();

    // Print summary
    console.log('\n' + '═'.repeat(50));
    console.log('📊 IMPORT SUMMARY');
    console.log('═'.repeat(50));
    console.log(`✅ Candidates imported: ${imported}`);
    console.log(`📍 New constituencies created: ${createdConstituencies}`);
    console.log(`⏭️  Records skipped: ${skipped}`);

    if (missingDistricts.size > 0) {
        console.log('\n⚠️  Districts not found in mapping:');
        for (const d of missingDistricts) {
            console.log(`   - "${d}"`);
        }
    }

    // Verify data
    console.log('\n' + '─'.repeat(50));
    console.log('🔍 VERIFICATION');
    console.log('─'.repeat(50));

    const totalCandidates = query('SELECT COUNT(*) as count FROM candidates')[0].count;
    const totalConstituencies = query('SELECT COUNT(*) as count FROM constituencies')[0].count;
    const totalDistricts = query('SELECT COUNT(*) as count FROM districts')[0].count;

    console.log(`   Total candidates in DB: ${totalCandidates}`);
    console.log(`   Total constituencies: ${totalConstituencies}`);
    console.log(`   Total districts: ${totalDistricts}`);

    // Sample check
    console.log('\n📋 Sample candidates:');
    const samples = query(`
        SELECT c.name, c.party_name, co.name as constituency, d.name_np as district
        FROM candidates c
        JOIN constituencies co ON c.constituency_id = co.id
        JOIN districts d ON co.district_id = d.id
        LIMIT 5
    `);
    for (const s of samples) {
        console.log(`   - ${s.name} (${s.party_name}) - ${s.district}, ${s.constituency}`);
    }

    console.log('\n✅ Import completed successfully!');
    console.log('🌐 Restart the server to see the imported data.\n');
}

// Run import
importCandidates().catch(console.error);
