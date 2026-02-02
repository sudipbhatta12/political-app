/**
 * Database Module - Political Social Media Assessment
 * Supabase (PostgreSQL) cloud database for persistent storage
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY environment variables!');
    console.error('Please set them in your .env file or Render environment settings.');
}

// Create Supabase client
// Create Supabase client (Safe initialization)
// If keys are missing, we pass empty strings to avoid crash on startup.
// The app will fail later when trying to query, but it allows the server to bind to port 8080.
const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder-key');

// Load initial data for seeding
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
 * Initialize database - seed data if empty
 */
async function initDatabase() {
    console.log('🔗 Connecting to Supabase...');

    // Check if provinces exist (means DB is already seeded)
    const { data: provinces, error } = await supabase
        .from('provinces')
        .select('id')
        .limit(1);

    if (error) {
        console.error('❌ Supabase connection error:', error.message);
        console.error('Make sure you have run the supabase_schema.sql in your Supabase SQL Editor!');
        return;
    }

    if (!provinces || provinces.length === 0) {
        console.log('📦 Seeding database with Nepal electoral data...');
        await seedData();
    }

    console.log('✅ Supabase database initialized successfully!');
    return supabase;
}

/**
 * Seed initial Nepal electoral data
 */
async function seedData() {
    // Seed provinces
    console.log('📦 Seeding provinces...');
    const { error: provError } = await supabase
        .from('provinces')
        .upsert(provincesData, { onConflict: 'id' });
    if (provError) console.error('Province seed error:', provError.message);

    // Seed districts
    console.log('📦 Seeding districts...');
    const { error: distError } = await supabase
        .from('districts')
        .upsert(districtsData, { onConflict: 'id' });
    if (distError) console.error('District seed error:', distError.message);

    // Seed constituencies
    console.log('📦 Seeding constituencies...');
    const { error: constError } = await supabase
        .from('constituencies')
        .upsert(constituenciesData, { onConflict: 'id' });
    if (constError) console.error('Constituency seed error:', constError.message);

    console.log('✅ Database seeded with Nepal electoral data!');
}

/**
 * Initialize Sessions Table
 */
async function initSessionTable() {
    const { error } = await supabase
        .from('sessions')
        .select('token')
        .limit(1);

    // If error code is '42P01' (undefined_table), we technically can't create tables via JS client 
    // without using the SQL editor URL or specialized RPCs in most Supabase setups unless we have admin rights.
    // However, if we assume standard access, we might rely on the user running the SQL. 
    // BUT, for this specific task, I'll attempt to implement the logic assuming the table exists 
    // or provide a fallback if the user needs to run SQL.

    // Actually, in many agent scenarios, we can't CREATE TABLE easily via the JS client standard API 
    // unless we use a specific rpc or the management API.
    // I will add the methods and assume the table creation is handled or I'll provide the SQL.
    // For "doing the fix", I'll implement the JS logic and update the schema file.

    // Ideally, we should check connection.
}

// Export module functions
module.exports = {
    initDatabase,

    // Session Management
    createSession: async (token) => {
        const { error } = await supabase
            .from('sessions')
            .insert({ token });

        if (error) {
            console.error('createSession error:', error.message);
            return false;
        }
        return true;
    },

    verifySession: async (token) => {
        const { data, error } = await supabase
            .from('sessions')
            .select('token')
            .eq('token', token)
            .single();

        if (error || !data) return false;
        return true;
    },

    deleteSession: async (token) => {
        const { error } = await supabase
            .from('sessions')
            .delete()
            .eq('token', token);

        if (error) console.error('deleteSession error:', error.message);
    },

    // Province queries
    getAllProvinces: async () => {
        const { data, error } = await supabase
            .from('provinces')
            .select('*')
            .order('id');
        if (error) console.error('getAllProvinces error:', error.message);
        return data || [];
    },

    // District queries
    getDistrictsByProvince: async (provinceId) => {
        const { data, error } = await supabase
            .from('districts')
            .select('*')
            .eq('province_id', provinceId)
            .order('name_en');
        if (error) console.error('getDistrictsByProvince error:', error.message);
        return data || [];
    },

    // Constituency queries
    getConstituenciesByDistrict: async (districtId) => {
        const { data, error } = await supabase
            .from('constituencies')
            .select('*')
            .eq('district_id', districtId)
            .order('name');
        if (error) console.error('getConstituenciesByDistrict error:', error.message);
        return data || [];
    },

    // Candidate queries
    getCandidatesByConstituency: async (constituencyId, date = null) => {
        // Build query
        let query = supabase
            .from('candidates')
            .select(`
                *,
                posts (
                    id, post_url, published_date,
                    positive_percentage, negative_percentage, neutral_percentage,
                    positive_remarks, negative_remarks, neutral_remarks, conclusion,
                    comment_count, created_at, popular_comments
                )
            `)
            .eq('constituency_id', constituencyId)
            .order('created_at', { ascending: false });

        // If date is provided, we want to filter the JOINED posts.
        // Supabase/PostgREST syntax for filtering nested resource:
        if (date) {
            query = query.eq('posts.published_date', date);
        }

        const { data, error } = await query;

        if (error) {
            console.error('getCandidatesByConstituency error:', error.message);
            return [];
        }

        // Return candidates with ALL their posts (sorted by date desc)
        // Each row is one candidate with a "posts" array containing all their analyses
        const result = [];
        for (const c of (data || [])) {
            // Sort posts by published_date descending
            const sortedPosts = (c.posts || [])
                .filter(p => p.id) // Only include posts that have an id
                .sort((a, b) => new Date(b.published_date || b.created_at) - new Date(a.published_date || a.created_at));

            // Create one row per post for backward compatibility with existing code
            if (sortedPosts.length > 0) {
                for (const post of sortedPosts) {
                    result.push({
                        id: c.id,
                        name: c.name,
                        party_name: c.party_name,
                        constituency_id: c.constituency_id,
                        created_at: c.created_at,
                        updated_at: c.updated_at,
                        post_id: post.id,
                        post_url: post.post_url,
                        published_date: post.published_date,
                        positive_percentage: post.positive_percentage || 0,
                        negative_percentage: post.negative_percentage || 0,
                        neutral_percentage: post.neutral_percentage || 0,
                        positive_remarks: post.positive_remarks || '',
                        negative_remarks: post.negative_remarks || '',
                        neutral_remarks: post.neutral_remarks || '',
                        conclusion: post.conclusion || '',
                        comment_count: post.comment_count || 0,
                        popular_comments: post.popular_comments || '[]'
                    });
                }
            } else {
                // Candidate without posts - still include them
                result.push({
                    id: c.id,
                    name: c.name,
                    party_name: c.party_name,
                    constituency_id: c.constituency_id,
                    created_at: c.created_at,
                    updated_at: c.updated_at,
                    post_id: null,
                    post_url: null,
                    published_date: null,
                    positive_percentage: 0,
                    negative_percentage: 0,
                    neutral_percentage: 0,
                    positive_remarks: '',
                    negative_remarks: '',
                    neutral_remarks: '',
                    conclusion: '',
                    comment_count: 0,
                    popular_comments: '[]'
                });
            }
        }

        return result;
    },

    getConstituencyDates: async (constituencyId) => {
        // Get all unique published_dates for candidates in this constituency
        const { data, error } = await supabase
            .from('candidates')
            .select(`
                posts (published_date)
            `)
            .eq('constituency_id', constituencyId);

        if (error) {
            console.error('getConstituencyDates error:', error.message);
            return [];
        }

        // Extract and dedup dates
        const dates = new Set();
        (data || []).forEach(c => {
            if (c.posts) {
                c.posts.forEach(p => {
                    if (p.published_date) dates.add(p.published_date);
                });
            }
        });

        // Return sorted array (newest first)
        return Array.from(dates).sort((a, b) => new Date(b) - new Date(a));
    },

    getAllCandidatesWithPosts: async () => {
        const { data, error } = await supabase
            .from('candidates')
            .select(`
                *,
                constituencies!inner (
                    id, name,
                    districts!inner (
                        id, name_en, name_np, province_id
                    )
                ),
                posts!inner (
                    id, post_url, published_date,
                    positive_percentage, negative_percentage, neutral_percentage,
                    positive_remarks, negative_remarks, neutral_remarks, conclusion,
                    created_at
                )
            `)
            .order('created_at', { foreignTable: 'posts', ascending: false });

        if (error) {
            console.error('getAllCandidatesWithPosts error:', error.message);
            return [];
        }

        // Flatten to match old format
        return (data || []).map(c => {
            const post = c.posts && c.posts.length > 0 ? c.posts[0] : {};
            const con = c.constituencies || {};
            const dist = con.districts || {};
            return {
                ...c,
                constituency_name: con.name,
                district_id: dist.id,
                province_id: dist.province_id,
                post_id: post.id || null,
                post_url: post.post_url || null,
                published_date: post.published_date || null,
                positive_percentage: post.positive_percentage || 0,
                negative_percentage: post.negative_percentage || 0,
                neutral_percentage: post.neutral_percentage || 0,
                positive_remarks: post.positive_remarks || '',
                negative_remarks: post.negative_remarks || '',
                neutral_remarks: post.neutral_remarks || '',
                conclusion: post.conclusion || ''
            };
        });
    },

    searchCandidates: async (searchQuery) => {
        try {
            // Fetch all candidates with their location info
            const { data, error } = await supabase
                .from('candidates')
                .select(`
                    *,
                    constituencies (
                        name,
                        districts (
                            name_en, name_np,
                            provinces (name_en)
                        )
                    )
                `)
                .limit(200);

            if (error) {
                console.error('searchCandidates error:', error.message);
                return [];
            }

            // Flatten data
            const results = (data || []).map(c => {
                const con = c.constituencies || {};
                const dist = con.districts || {};
                const prov = dist.provinces || {};
                return {
                    ...c,
                    constituency_name: con.name,
                    district_name: dist.name_en,
                    district_name_np: dist.name_np,
                    province_name: prov.name_en
                };
            });

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
                const rConst = romanize(row.constituency_name);

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

    createCandidate: async (data) => {
        const { data: result, error } = await supabase
            .from('candidates')
            .insert({
                name: data.name,
                party_name: data.party_name,
                constituency_id: data.constituency_id
            })
            .select('id')
            .single();

        if (error) {
            console.error('createCandidate error:', error.message);
            return 0;
        }
        return result?.id || 0;
    },

    updateCandidate: async (id, data) => {
        const { error } = await supabase
            .from('candidates')
            .update({
                name: data.name,
                party_name: data.party_name,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) console.error('updateCandidate error:', error.message);
    },

    deleteCandidate: async (id) => {
        // Posts will be deleted via CASCADE
        const { error } = await supabase
            .from('candidates')
            .delete()
            .eq('id', id);

        if (error) console.error('deleteCandidate error:', error.message);
    },

    // Post queries
    createPost: async (data) => {
        const { data: result, error } = await supabase
            .from('posts')
            .insert({
                candidate_id: data.candidate_id,
                post_url: data.post_url,
                published_date: data.published_date,
                positive_percentage: data.positive_percentage || 0,
                negative_percentage: data.negative_percentage || 0,
                neutral_percentage: data.neutral_percentage || 0,
                positive_remarks: data.positive_remarks || '',
                negative_remarks: data.negative_remarks || '',
                neutral_remarks: data.neutral_remarks || '',
                conclusion: data.conclusion || '',
                comment_count: data.comment_count || 0,
                popular_comments: data.popular_comments || '[]'
            })
            .select('id')
            .single();

        if (error) {
            console.error('createPost error:', error.message);
            return 0;
        }
        return result?.id || 0;
    },

    updatePost: async (id, data) => {
        const { error } = await supabase
            .from('posts')
            .update({
                post_url: data.post_url,
                published_date: data.published_date,
                positive_percentage: data.positive_percentage,
                negative_percentage: data.negative_percentage,
                neutral_percentage: data.neutral_percentage,
                positive_remarks: data.positive_remarks,
                negative_remarks: data.negative_remarks,
                neutral_remarks: data.neutral_remarks,
                conclusion: data.conclusion,
                comment_count: data.comment_count
            })
            .eq('id', id);

        if (error) console.error('updatePost error:', error.message);
    },

    deletePost: async (id) => {
        // Comments will be deleted via CASCADE
        const { error } = await supabase
            .from('posts')
            .delete()
            .eq('id', id);

        if (error) console.error('deletePost error:', error.message);
    },

    getPostsByCandidate: async (candidateId) => {
        const { data, error } = await supabase
            .from('posts')
            .select('*')
            .eq('candidate_id', candidateId)
            .order('published_date', { ascending: false });

        if (error) console.error('getPostsByCandidate error:', error.message);
        return data || [];
    },

    // Comment queries
    getCommentsByPost: async (postId, sentiment = null) => {
        let query = supabase
            .from('comments')
            .select('*')
            .eq('post_id', postId)
            .order('created_at', { ascending: false });

        if (sentiment) {
            query = query.eq('sentiment', sentiment);
        }

        const { data, error } = await query;
        if (error) console.error('getCommentsByPost error:', error.message);
        return data || [];
    },

    createComment: async (data) => {
        const { data: result, error } = await supabase
            .from('comments')
            .insert({
                post_id: data.post_id,
                content: data.content,
                sentiment: data.sentiment
            })
            .select('id')
            .single();

        if (error) {
            console.error('createComment error:', error.message);
            return 0;
        }
        return result?.id || 0;
    },

    deleteComment: async (id) => {
        const { error } = await supabase
            .from('comments')
            .delete()
            .eq('id', id);

        if (error) console.error('deleteComment error:', error.message);
    },

    // Analytics
    getSentimentSummaryByConstituency: async (constituencyId) => {
        const { data, error } = await supabase
            .from('candidates')
            .select(`
                id, name, party_name,
                posts (
                    positive_percentage,
                    negative_percentage,
                    neutral_percentage
                )
            `)
            .eq('constituency_id', constituencyId);

        if (error) {
            console.error('getSentimentSummaryByConstituency error:', error.message);
            return [];
        }

        // Calculate averages
        return (data || []).map(c => {
            const posts = c.posts || [];
            const postCount = posts.length;
            const avgPositive = postCount > 0 ? posts.reduce((s, p) => s + (p.positive_percentage || 0), 0) / postCount : 0;
            const avgNegative = postCount > 0 ? posts.reduce((s, p) => s + (p.negative_percentage || 0), 0) / postCount : 0;
            const avgNeutral = postCount > 0 ? posts.reduce((s, p) => s + (p.neutral_percentage || 0), 0) / postCount : 0;

            return {
                party_name: c.party_name,
                candidate_name: c.name,
                avg_positive: avgPositive,
                avg_negative: avgNegative,
                avg_neutral: avgNeutral,
                post_count: postCount
            };
        });
    },

    getRecentConstituencies: async (limit = 5) => {
        const { data, error } = await supabase
            .from('candidates')
            .select(`
                created_at,
                constituencies!inner (
                    id, name,
                    districts!inner (
                        id, name_en,
                        provinces!inner (id, name_en)
                    )
                )
            `)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error('getRecentConstituencies error:', error.message);
            return [];
        }

        // Group by constituency and get the most recent
        const seen = new Map();
        for (const c of data || []) {
            const con = c.constituencies;
            if (!seen.has(con.id)) {
                seen.set(con.id, {
                    constituency_id: con.id,
                    constituency_name: con.name,
                    district_id: con.districts.id,
                    district_name: con.districts.name_en,
                    province_id: con.districts.provinces.id,
                    province_name: con.districts.provinces.name_en,
                    last_updated: c.created_at
                });
            }
            if (seen.size >= limit) break;
        }

        return Array.from(seen.values());
    }
};
