const { createClient } = require('@supabase/supabase-js');

// Credentials provided by user
const SUPABASE_URL = 'https://mngppigfbtqkhlkrmtiz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uZ3BwaWdmYnRxa2hsa3JtdGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1OTU5NDEsImV4cCI6MjA4NTE3MTk0MX0.WXNI--w6UY8vWfCxI8s36cz25cBp--Me1etk2ohiPPY';

console.log('Connecting to:', SUPABASE_URL);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkData() {
    console.log('Fetching last 10 posts to check date format...');

    const { data: posts, error } = await supabase
        .from('posts')
        .select('id, published_date, created_at')
        .order('id', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching posts:', error.message);
        return;
    }

    if (posts.length === 0) {
        console.log('No posts found in the database at all.');
    } else {
        console.log(`Found ${posts.length} posts. Formatting samples:`);
        posts.forEach(p => {
            console.log(`ID: ${p.id}, Published: "${p.published_date}", Created: ${p.created_at}`);
        });
    }
}

checkData();
