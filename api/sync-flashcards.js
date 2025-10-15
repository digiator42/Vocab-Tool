// api/sync-flashcards.js
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

        // Get environment variables
        const REAL_PASSWORD = process.env.SYNC_PASSWORD;
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_KEY = process.env.SUPABASE_KEY;

        // Debug: log env status (remove in production)
        console.log('Env check:', {
            hasPassword: !!REAL_PASSWORD,
            hasSupabaseUrl: !!SUPABASE_URL,
            hasSupabaseKey: !!SUPABASE_KEY
        });

        if (!REAL_PASSWORD || !SUPABASE_URL || !SUPABASE_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Server configuration error' })
            };
        }

        const requestBody = JSON.parse(event.body);
        const { data, password, action, timestamp } = requestBody;

        console.log('Action:', action, 'Has data:', !!data);

        // Verify password - use a simple string for testing first
        if (password !== REAL_PASSWORD) {
            console.log('Password mismatch:', { expected: REAL_PASSWORD, received: password });
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Unauthorized' })
            };
        }

        // Supabase configuration
        const supabaseHeaders = {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };

        if (action === 'upload') {
            if (!data) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'No data provided' })
                };
            }

            const uploadData = {
                data: data,
                timestamp: timestamp || new Date().toISOString()
            };

            console.log('Uploading data to Supabase...');

            const response = await fetch(`${SUPABASE_URL}/rest/v1/flashcards_sync`, {
                method: 'POST',
                headers: supabaseHeaders,
                body: JSON.stringify(uploadData)
            });

            console.log('Supabase response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Supabase error:', errorText);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({
                        error: 'Database error',
                        details: errorText
                    })
                };
            }

            const result = await response.json();
            console.log('Upload successful:', result);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Data uploaded successfully',
                    timestamp: result[0].timestamp,
                    listsCount: Object.keys(data).length,
                    totalCards: Object.values(data).reduce((sum, cards) => sum + cards.length, 0)
                })
            };
        }
        else if (action === 'download') {
            console.log('Downloading data from Supabase...');

            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/flashcards_sync?select=*&order=id.desc&limit=1`,
                {
                    method: 'GET',
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`
                    }
                }
            );

            console.log('Download response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Supabase download error:', errorText);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({
                        error: 'Database error',
                        details: errorText
                    })
                };
            }

            const result = await response.json();
            console.log('Download result:', result);

            if (!result || result.length === 0) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ error: 'No data found' })
                };
            }

            const latest = result[0];
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    data: latest.data,
                    timestamp: latest.timestamp,
                    listsCount: Object.keys(latest.data).length,
                    totalCards: Object.values(latest.data).reduce((sum, cards) => sum + cards.length, 0)
                })
            };
        }
        else if (action === 'info') {
            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/flashcards_sync?select=*&order=id.desc&limit=1`,
                {
                    method: 'GET',
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`
                    }
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ error: 'Database error' })
                };
            }

            const result = await response.json();
            const hasData = result && result.length > 0;
            const latest = hasData ? result[0] : null;

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    hasData: hasData,
                    timestamp: latest?.timestamp,
                    listsCount: latest ? Object.keys(latest.data).length : 0,
                    totalCards: latest ? Object.values(latest.data).reduce((sum, cards) => sum + cards.length, 0) : 0
                })
            };
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
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};