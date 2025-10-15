// api/sync-flashcards.js
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Parse request body
        const body = JSON.parse(req.body);
        const { action, password, data } = body;

        // Verify environment variables
        const SYNC_PASSWORD = process.env.SYNC_PASSWORD;
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_KEY = process.env.SUPABASE_KEY;

        if (!SYNC_PASSWORD || !SUPABASE_URL || !SUPABASE_KEY) {
            console.log('Missing env vars:', {
                SYNC_PASSWORD: !!SYNC_PASSWORD,
                SUPABASE_URL: !!SUPABASE_URL,
                SUPABASE_KEY: !!SUPABASE_KEY
            });
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // Verify password
        if (password !== SYNC_PASSWORD) {
            console.log('Password mismatch');
            return res.status(401).json({ error: 'Unauthorized' });
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
                return res.status(400).json({ error: 'No data provided' });
            }

            // Upload data to Supabase
            const response = await fetch(`${SUPABASE_URL}/rest/v1/flashcards_sync`, {
                method: 'POST',
                headers: supabaseHeaders,
                body: JSON.stringify({
                    data: data,
                    timestamp: new Date().toISOString()
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Supabase upload error:', errorText);
                return res.status(500).json({ error: 'Failed to save data' });
            }

            const result = await response.json();

            return res.status(200).json({
                success: true,
                message: 'Data uploaded successfully',
                id: result[0].id,
                timestamp: result[0].timestamp
            });
        }
        else if (action === 'download') {
            // Download latest data from Supabase
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
                console.error('Supabase download error:', errorText);
                return res.status(500).json({ error: 'Failed to fetch data' });
            }

            const result = await response.json();

            if (!result || result.length === 0) {
                return res.status(404).json({ error: 'No data found' });
            }

            return res.status(200).json({
                success: true,
                data: result[0].data,
                timestamp: result[0].timestamp
            });
        }
        else if (action === 'info') {
            // Get server info
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
                console.error('Supabase info error:', errorText);
                return res.status(500).json({ error: 'Failed to fetch info' });
            }

            const result = await response.json();
            const hasData = result && result.length > 0;

            return res.status(200).json({
                success: true,
                hasData: hasData,
                timestamp: hasData ? result[0].timestamp : null,
                listsCount: hasData ? Object.keys(result[0].data).length : 0
            });
        }
        else {
            return res.status(400).json({ error: 'Invalid action' });
        }

    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}