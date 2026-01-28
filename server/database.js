/**
 * Database Module - Political Social Media Assessment
 * SQLite database using sql.js (pure JavaScript, no native compilation needed)
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

// Database file path
const dataDir = process.env.DATABASE_PATH ? path.dirname(process.env.DATABASE_PATH) : path.join(__dirname, '..', 'data');
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'assessment.db');

// Database instance
let db = null;

// Load initial data
const provincesData = require('./data/provinces.json');
const districtsData = require('./data/districts.json');
const constituenciesData = require('./data/constituencies.json');

/**
 * Convert Devanagari text to Romanized (Latin) text for phonetic search
 */
function romanize(text) {
    if (!text) return '';

    const mapping = {
        // Vowels
        'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri',
        'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'अं': 'am', 'अः': 'ah',

        // Matras (Vowel signs)
        'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ri',
        'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ं': 'n', 'ः': 'h', 'ँ': 'n',

        // Halant/Virama - suppresses inherent vowel
        '्': '',

        // Consonants
        'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
        'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
        'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
        'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
        'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
        'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'w',
        'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
        'क्ष': 'ksh', 'त्र': 'tr', 'ज्ञ': 'gy',

        // Numbers (Nepali digits)
        '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
        '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
    };

    let result = '';
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (mapping[char] !== undefined) {
            result += mapping[char];
        } else {
            result += char;
        }
    }

    // Normalize for loose matching
    return result.toLowerCase()
        .replace(/aa/g, 'a')
        .replace(/ee/g, 'i')
        .replace(/oo/g, 'u')
        .replace(/chh/g, 'ch')
        .replace(/kh/g, 'k')
        .replace(/gh/g, 'g')
        .replace(/th/g, 't')
        .replace(/dh/g, 'd')
        .replace(/ph/g, 'p')
        .replace(/bh/g, 'b');
}


/**
 * Initialize database
 */
async function initDatabase() {
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const SQL = await initSqlJs();

    // Load existing database or create new one
    if (fs.existsSync(dbPath)) {
        const fileBuffer = fs.readFileSync(dbPath);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }

    // Register custom function for Romanization
    db.create_function('romanize', romanize);

    initializeSchema();
    seedData();
    saveDatabase();

    console.log('✅ Database initialized successfully!');
    return db;
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
 * Initialize database schema
 */
function initializeSchema() {
    db.run(`
        CREATE TABLE IF NOT EXISTS provinces (
            id INTEGER PRIMARY KEY,
            name_en TEXT NOT NULL,
            name_np TEXT
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS districts (
            id INTEGER PRIMARY KEY,
            name_en TEXT NOT NULL,
            name_np TEXT,
            province_id INTEGER NOT NULL,
            FOREIGN KEY (province_id) REFERENCES provinces(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS constituencies (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            district_id INTEGER NOT NULL,
            FOREIGN KEY (district_id) REFERENCES districts(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS candidates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            party_name TEXT NOT NULL,
            constituency_id INTEGER NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (constituency_id) REFERENCES constituencies(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL,
            post_url TEXT,
            published_date TEXT,
            positive_percentage REAL DEFAULT 0,
            negative_percentage REAL DEFAULT 0,
            neutral_percentage REAL DEFAULT 0,
            positive_remarks TEXT,
            negative_remarks TEXT,
            neutral_remarks TEXT,
            conclusion TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (candidate_id) REFERENCES candidates(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            sentiment TEXT CHECK(sentiment IN ('positive', 'negative', 'neutral')),
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (post_id) REFERENCES posts(id)
        )
    `);

    // Create indexes
    try {
        db.run(`CREATE INDEX IF NOT EXISTS idx_districts_province ON districts(province_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_constituencies_district ON constituencies(district_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_candidates_constituency ON candidates(constituency_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_posts_candidate ON posts(candidate_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id)`);
    } catch (e) {
        // Indexes may already exist
    }
}

/**
 * Seed initial Nepal electoral data
 */
function seedData() {
    const result = db.exec('SELECT COUNT(*) as count FROM provinces');
    const count = result.length > 0 ? result[0].values[0][0] : 0;

    if (count === 0) {
        console.log('📦 Seeding provinces...');
        for (const p of provincesData) {
            db.run('INSERT OR IGNORE INTO provinces (id, name_en, name_np) VALUES (?, ?, ?)', [p.id, p.name_en, p.name_np]);
        }

        console.log('📦 Seeding districts...');
        for (const d of districtsData) {
            db.run('INSERT OR IGNORE INTO districts (id, name_en, name_np, province_id) VALUES (?, ?, ?, ?)', [d.id, d.name_en, d.name_np, d.province_id]);
        }

        console.log('📦 Seeding constituencies...');
        for (const c of constituenciesData) {
            db.run('INSERT OR IGNORE INTO constituencies (id, name, district_id) VALUES (?, ?, ?)', [c.id, c.name, c.district_id]);
        }

        console.log('✅ Database seeded with Nepal electoral data!');
    }
}

/**
 * Helper to convert sql.js result to array of objects
 */
function resultToObjects(result) {
    if (!result || result.length === 0) return [];
    const columns = result[0].columns;
    return result[0].values.map(row => {
        const obj = {};
        columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
    });
}

/**
 * Run a SELECT query and return array of objects
 */
function query(sql, params = []) {
    try {
        const stmt = db.prepare(sql);
        if (params.length > 0) {
            stmt.bind(params);
        }
        const results = [];
        while (stmt.step()) {
            const row = stmt.getAsObject();
            results.push(row);
        }
        stmt.free();
        return results;
    } catch (e) {
        console.error('Query error:', sql, params, e);
        return [];
    }
}

/**
 * Run a statement that modifies data and return last insert ID
 */
function runAndGetId(sql, params = []) {
    try {
        const stmt = db.prepare(sql);
        if (params.length > 0) {
            stmt.bind(params);
        }
        stmt.step();
        stmt.free();

        // Get last insert rowid immediately after insert
        const result = db.exec('SELECT last_insert_rowid() as id');
        const lastId = result.length > 0 ? result[0].values[0][0] : 0;

        saveDatabase();
        return lastId;
    } catch (e) {
        console.error('Run error:', sql, params, e);
        saveDatabase();
        return 0;
    }
}

/**
 * Run a statement that modifies data (no return value needed)
 */
function run(sql, params = []) {
    try {
        const stmt = db.prepare(sql);
        if (params.length > 0) {
            stmt.bind(params);
        }
        stmt.step();
        stmt.free();
        saveDatabase();
    } catch (e) {
        console.error('Run error:', sql, params, e);
        saveDatabase();
    }
}

/**
 * Get last insert row id (deprecated - use runAndGetId instead)
 */
function getLastInsertId() {
    const result = db.exec('SELECT last_insert_rowid() as id');
    return result.length > 0 ? result[0].values[0][0] : 0;
}

/**
 * Get recent constituencies
 */
function getRecentConstituencies(limit = 5) {
    const stmt = db.prepare(`
        SELECT 
            con.id as constituency_id, 
            con.name as constituency_name,
            d.id as district_id,
            d.name_en as district_name,
            p.id as province_id,
            p.name_en as province_name,
            MAX(c.created_at) as last_updated
        FROM candidates c
        JOIN constituencies con ON c.constituency_id = con.id
        JOIN districts d ON con.district_id = d.id
        JOIN provinces p ON d.province_id = p.id
        GROUP BY con.id
        ORDER BY last_updated DESC
        LIMIT $limit
    `);

    stmt.bind({ $limit: limit });

    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

// Export module functions
module.exports = {
    initDatabase,

    // Province queries
    getAllProvinces: () => query('SELECT * FROM provinces ORDER BY id'),

    // District queries
    getDistrictsByProvince: (provinceId) =>
        query('SELECT * FROM districts WHERE province_id = ? ORDER BY name_en', [provinceId]),

    // Constituency queries
    getConstituenciesByDistrict: (districtId) =>
        query('SELECT * FROM constituencies WHERE district_id = ? ORDER BY name', [districtId]),

    // Candidate queries
    getCandidatesByConstituency: (constituencyId) =>
        query(`
            SELECT c.*, 
                   p.id as post_id, p.post_url, p.published_date,
                   p.positive_percentage, p.negative_percentage, p.neutral_percentage,
                   p.positive_remarks, p.negative_remarks, p.neutral_remarks, p.conclusion
            FROM candidates c
            LEFT JOIN posts p ON c.id = p.candidate_id
            WHERE c.constituency_id = ?
            ORDER BY c.created_at DESC
        `, [constituencyId]),

    getAllCandidatesWithPosts: () =>
        query(`
            SELECT c.*, 
                   co.name as constituency_name,
                   p.id as post_id, p.post_url, p.published_date,
                   p.positive_percentage, p.negative_percentage, p.neutral_percentage,
                   p.positive_remarks, p.negative_remarks, p.neutral_remarks, p.conclusion
            FROM candidates c
            LEFT JOIN constituencies co ON c.constituency_id = co.id
            LEFT JOIN posts p ON c.id = p.candidate_id
            WHERE p.id IS NOT NULL
            ORDER BY p.created_at DESC
        `),

    searchCandidates: (searchQuery) => {
        try {
            // Fetch all data for filtering (JS filtering is safer and more flexible)
            const results = query(`
                SELECT c.*, co.name as constituency_name, d.name_en as district_name, d.name_np as district_name_np, pr.name_en as province_name
                FROM candidates c
                JOIN constituencies co ON c.constituency_id = co.id
                JOIN districts d ON co.district_id = d.id
                JOIN provinces pr ON d.province_id = pr.id
            `);

            if (!searchQuery) return results.slice(0, 50);

            const q = searchQuery.toLowerCase();
            const romanizedQ = romanize(searchQuery);

            return results.filter(row => {
                const name = (row.name || '').toLowerCase();
                const party = (row.party_name || '').toLowerCase();
                const distEn = (row.district_name || '').toLowerCase();
                const distNp = (row.district_name_np || '');
                const constName = (row.constituency_name || '').toLowerCase();
                const provName = (row.province_name || '').toLowerCase();

                // Check direct matches
                if (name.includes(q) || party.includes(q) ||
                    distEn.includes(q) || constName.includes(q) || provName.includes(q)) {
                    return true;
                }

                // Check phonetic/romanized matches
                const rName = romanize(row.name);
                const rDistNp = romanize(distNp);
                const rConst = romanize(row.constituency_name); // In case constituency name is Nepali

                if (rName.includes(q) || rName.includes(romanizedQ)) return true;
                if (rDistNp.includes(q) || rDistNp.includes(romanizedQ)) return true;
                if (rConst.includes(q) || rConst.includes(romanizedQ)) return true;

                return false;
            }).slice(0, 50);
        } catch (e) {
            console.error('Search error:', e);
            return [];
        }
    },

    createCandidate: (data) => {
        return runAndGetId(`INSERT INTO candidates (name, party_name, constituency_id) VALUES (?, ?, ?)`,
            [data.name, data.party_name, data.constituency_id]);
    },

    updateCandidate: (id, data) => {
        run(`UPDATE candidates SET name = ?, party_name = ?, updated_at = datetime('now') WHERE id = ?`,
            [data.name, data.party_name, id]);
    },

    deleteCandidate: (id) => {
        run('DELETE FROM posts WHERE candidate_id = ?', [id]);
        run('DELETE FROM candidates WHERE id = ?', [id]);
    },

    // Post queries
    createPost: (data) => {
        return runAndGetId(`INSERT INTO posts (candidate_id, post_url, published_date, positive_percentage, negative_percentage, neutral_percentage, positive_remarks, negative_remarks, neutral_remarks, conclusion)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.candidate_id, data.post_url, data.published_date,
            data.positive_percentage || 0, data.negative_percentage || 0, data.neutral_percentage || 0,
            data.positive_remarks || '', data.negative_remarks || '', data.neutral_remarks || '', data.conclusion || '']);
    },

    updatePost: (id, data) => {
        run(`UPDATE posts SET post_url = ?, published_date = ?, 
             positive_percentage = ?, negative_percentage = ?, neutral_percentage = ?,
             positive_remarks = ?, negative_remarks = ?, neutral_remarks = ?, conclusion = ? WHERE id = ?`,
            [data.post_url, data.published_date, data.positive_percentage,
            data.negative_percentage, data.neutral_percentage,
            data.positive_remarks, data.negative_remarks, data.neutral_remarks, data.conclusion, id]);
    },

    deletePost: (id) => {
        run('DELETE FROM comments WHERE post_id = ?', [id]);
        run('DELETE FROM posts WHERE id = ?', [id]);
    },

    getPostsByCandidate: (candidateId) =>
        query('SELECT * FROM posts WHERE candidate_id = ? ORDER BY published_date DESC', [candidateId]),

    // Comment queries
    getCommentsByPost: (postId, sentiment = null) => {
        if (sentiment) {
            return query('SELECT * FROM comments WHERE post_id = ? AND sentiment = ? ORDER BY created_at DESC', [postId, sentiment]);
        }
        return query('SELECT * FROM comments WHERE post_id = ? ORDER BY created_at DESC', [postId]);
    },

    createComment: (data) => {
        return runAndGetId('INSERT INTO comments (post_id, content, sentiment) VALUES (?, ?, ?)',
            [data.post_id, data.content, data.sentiment]);
    },

    deleteComment: (id) => {
        run('DELETE FROM comments WHERE id = ?', [id]);
    },

    // Analytics
    getSentimentSummaryByConstituency: (constituencyId) =>
        query(`
            SELECT 
                c.party_name,
                c.name as candidate_name,
                AVG(p.positive_percentage) as avg_positive,
                AVG(p.negative_percentage) as avg_negative,
                AVG(p.neutral_percentage) as avg_neutral,
                COUNT(p.id) as post_count
            FROM candidates c
            LEFT JOIN posts p ON c.id = p.candidate_id
            WHERE c.constituency_id = ?
        GROUP BY c.id
            ORDER BY c.party_name
        `, [constituencyId]),

    getRecentConstituencies
};
