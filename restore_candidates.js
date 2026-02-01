/**
 * Restore Deleted Candidates Script
 * Reads candidates from CSV and inserts any that are missing from the database
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// District name to ID mapping (from your seed data)
const districtNameToId = {
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
    'ओखलढुङ्गा': 7,
    'उदयपुर': 14,
    'सप्तरी': 15,
    'सिराहा': 16,
    'दोलखा': 25,
    'रामेछाप': 24,
    'सिन्धुली': 23,
    'धनुषा': 17,
    'महोत्तरी': 18,
    'सर्लाही': 19,
    'रसुवा': 32,
    'धादिङ': 33,
    'नुवाकोट': 31,
    'काठमाडौं': 30,
    'भक्तपुर': 29,
    'ललितपुर': 28,
    'काभ्रेपलाञ्चोक': 27,
    'सिन्धुपाल्चोक': 26,
    'मकवानपुर': 34,
    'रौतहट': 20,
    'बारा': 21,
    'पर्सा': 22,
    'चितवन': 35,
    'गोरखा': 36,
    'मनाङ': 41,
    'लमजुङ': 37,
    'कास्की': 40,
    'तनहुँ': 38,
    'गुल्मी': 50,
    'पाल्पा': 51,
    'अर्घाखाँची': 49,
    'मुस्ताङ': 42,
    'म्याग्दी': 43,
    'बाग्लुङ': 45,
    'पर्वत': 44,
    'रोल्पा': 55,
    'सल्यान': 60,
    'दाङ': 53,
    'डोल्पा': 61,
    'मुगु': 65,
    'जुम्ला': 63,
    'कालिकोट': 64,
    'हुम्ला': 62,
    'जाजरकोट': 68,
    'दैलेख': 67,
    'सुर्खेत': 66,
    'बाँके': 57,
    'बर्दिया': 58,
    'बाजुरा': 73,
    'अछाम': 70,
    'बझाङ': 72,
    'डोटी': 71,
    'कैलाली': 69,
    'दार्चुला': 77,
    'बैतडी': 76,
    'कञ्चनपुर': 74,
    'नवलपरासी (बर्दघाट सुस्ता पश्चिम)': 52,
    'रुकुम पश्चिम': 59,
    'स्याङ्जा': 39,
    'नवलपुर': 46,
    'रुपन्देही': 47,
    'कपिलवस्तु': 48,
    'रुकुम पूर्व': 56,
    'प्युठान': 54,
    'डडेल्धुरा': 75
};

async function getConstituencyId(districtId, constituencyNumber) {
    const { data, error } = await supabase
        .from('constituencies')
        .select('id')
        .eq('district_id', districtId)
        .ilike('name', `%${constituencyNumber}%`);

    if (error || !data || data.length === 0) {
        // Try to find by exact constituency number in name
        const { data: allConstituencies } = await supabase
            .from('constituencies')
            .select('id, name')
            .eq('district_id', districtId);

        if (allConstituencies) {
            // Find one that matches the number
            const match = allConstituencies.find(c =>
                c.name.includes(constituencyNumber.toString()) ||
                c.name.includes(`नं. ${constituencyNumber}`)
            );
            if (match) return match.id;
        }
        return null;
    }

    return data[0]?.id || null;
}

async function getExistingCandidates() {
    const { data, error } = await supabase
        .from('candidates')
        .select('name, party_name, constituency_id');

    if (error) {
        console.error('Error fetching existing candidates:', error.message);
        return [];
    }

    return data || [];
}

async function restoreCandidates() {
    console.log('🔄 Reading candidates from CSV...');

    // Read CSV file
    const csvPath = path.join(__dirname, 'source_data', 'candidates_2082.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').slice(1); // Skip header

    console.log(`📊 Found ${lines.length} candidates in CSV`);

    // Get existing candidates
    const existingCandidates = await getExistingCandidates();
    console.log(`📁 Found ${existingCandidates.length} candidates in database`);

    // Create a set for quick lookup
    const existingSet = new Set(
        existingCandidates.map(c => `${c.name}_${c.party_name}_${c.constituency_id}`)
    );

    let restored = 0;
    let skipped = 0;
    let errors = 0;

    for (const line of lines) {
        if (!line.trim()) continue;

        // Parse CSV line (handle quoted fields)
        const parts = line.match(/(?:^|,)("(?:[^"]*(?:""[^"]*)*)"|[^,]*)/g);
        if (!parts || parts.length < 5) continue;

        // Clean up parsed values
        const cleanValue = (val) => val.replace(/^,?"?|"?$/g, '').replace(/""/g, '"').trim();

        const district = cleanValue(parts[1]);
        const constituencyNum = cleanValue(parts[2]);
        const party = cleanValue(parts[3]);
        const name = cleanValue(parts[4]);

        // Get district ID
        const districtId = districtNameToId[district];
        if (!districtId) {
            console.log(`⚠️ Unknown district: ${district}`);
            errors++;
            continue;
        }

        // Get constituency ID
        const constituencyId = await getConstituencyId(districtId, constituencyNum);
        if (!constituencyId) {
            console.log(`⚠️ Constituency not found: ${district} - ${constituencyNum}`);
            errors++;
            continue;
        }

        // Check if candidate exists
        const key = `${name}_${party}_${constituencyId}`;
        if (existingSet.has(key)) {
            skipped++;
            continue;
        }

        // Insert missing candidate
        const { error } = await supabase
            .from('candidates')
            .insert({
                name: name,
                party_name: party,
                constituency_id: constituencyId
            });

        if (error) {
            console.log(`❌ Error inserting ${name}: ${error.message}`);
            errors++;
        } else {
            console.log(`✅ Restored: ${name} (${party})`);
            restored++;
            existingSet.add(key); // Add to set to avoid duplicates
        }
    }

    console.log('\n📋 Summary:');
    console.log(`   ✅ Restored: ${restored}`);
    console.log(`   ⏭️ Already exist: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
}

// Run the restore
restoreCandidates()
    .then(() => {
        console.log('\n🎉 Done!');
        process.exit(0);
    })
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
