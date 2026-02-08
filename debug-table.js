const { createClient } = require('@supabase/supabase-js');

// Credentials
const SUPABASE_URL = 'https://mngppigfbtqkhlkrmtiz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uZ3BwaWdmYnRxa2hsa3JtdGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1OTU5NDEsImV4cCI6MjA4NTE3MTk0MX0.WXNI--w6UY8vWfCxI8s36cz25cBp--Me1etk2ohiPPY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTable() {
    console.log('Checking media_posts table...');
    const { data, error } = await supabase
        .from('media_posts')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error querying media_posts:', error.message);
    } else {
        console.log('media_posts table exists. Rows found:', data.length);
    }
}

checkTable();
