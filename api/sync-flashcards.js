// api/sync-flashcards.js - No npm needed
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

async function supabaseQuery(method, data = null) {
    const options = {
        method: method,
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        }
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/flashcards`, options);
    return response.json();
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
        }

        // Get the real password from environment variable
        const REAL_PASSWORD = process.env.SYNC_PASSWORD;

        if (!REAL_PASSWORD) {
            console.error('SYNC_PASSWORD environment variable not set');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Server configuration error' })
            };
        }

        const { data, password, action, timestamp } = JSON.parse(event.body);

        // Verify the actual password (not hash)
        if (password !== REAL_PASSWORD) {
            console.log('Unauthorized access attempt');
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Unauthorized' })
            };
        }

        // Rest of your function...
        let storage = {};

        // Rate limiting
        const now = Date.now();
        if (storage.lastRequest && (now - storage.lastRequest < 2000)) {
            return {
                statusCode: 429,
                headers,
                body: JSON.stringify({ error: 'Too many requests' })
            };
        }
        storage.lastRequest = now;

        if (action === 'upload') {
            await supabaseQuery('POST', {
                data: data,
                timestamp: new Date().toISOString()
            });
        }

        if (action === 'download') {
            const result = await supabaseQuery('GET');
            const latest = result[result.length - 1];
            return latest.data;
        }
        else {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid action' })
            };
        }

    } catch (error) {
        console.error('Server error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};