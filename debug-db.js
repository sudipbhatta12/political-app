const initSqlJs = require('sql.js');
const fs = require('fs');

async function debug() {
    const SQL = await initSqlJs();
    const db = new SQL.Database(fs.readFileSync('./data/assessment.db'));

    console.log('=== Districts with Kathmandu ===');
    const districts = db.exec("SELECT id, name_en FROM districts WHERE name_en LIKE '%Kathmandu%'");
    console.log(districts[0]?.values || 'None found');

    // Find Kathmandu district ID
    const kathmandu = db.exec("SELECT id FROM districts WHERE name_en = 'Kathmandu'");
    const kathmanduId = kathmandu[0]?.values[0]?.[0];
    console.log('\nKathmandu District ID:', kathmanduId);

    if (kathmanduId) {
        console.log('\n=== Constituencies in Kathmandu ===');
        const constits = db.exec(`SELECT id, name FROM constituencies WHERE district_id = ${kathmanduId}`);
        console.log(constits[0]?.values || 'None');

        const firstConstId = constits[0]?.values[0]?.[0];
        if (firstConstId) {
            console.log('\n=== Candidates in first Kathmandu constituency ===');
            const cands = db.exec(`SELECT id, name, party_name FROM candidates WHERE constituency_id = ${firstConstId} LIMIT 5`);
            console.log(cands[0]?.values || 'None');
        }
    }

    // Check "Test Candidate"
    console.log('\n=== Test Candidate info ===');
    const test = db.exec("SELECT c.id, c.name, c.party_name, c.constituency_id, co.name as const_name, co.district_id FROM candidates c LEFT JOIN constituencies co ON c.constituency_id = co.id WHERE c.name LIKE '%Test%'");
    console.log(test[0]?.values || 'None');

    // Count by constituency
    console.log('\n=== Candidate count per constituency (top 10) ===');
    const counts = db.exec("SELECT constituency_id, COUNT(*) as cnt FROM candidates GROUP BY constituency_id ORDER BY cnt DESC LIMIT 10");
    console.log(counts[0]?.values || 'None');
}

debug().catch(console.error);
