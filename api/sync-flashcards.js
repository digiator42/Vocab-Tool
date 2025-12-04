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
        // Vercel automatically parses JSON bodies, so req.body is already an object
        const { action, password, data, srSessionData } = req.body;

        console.log('Received request:', { action, hasPassword: !!password, hasData: !!data });

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

            console.log('Uploading data to Supabase...', Object.keys(data).length, 'lists');

            // Upload data to Supabase
            const uploadData = {
                data: data,
                srSessionData: srSessionData || {},
                timestamp: new Date().toISOString(),
                created_at: new Date().toISOString()
            };

            const response = await fetch(`${SUPABASE_URL}/rest/v1/flashcards_sync`, {
                method: 'POST',
                headers: supabaseHeaders,
                body: JSON.stringify(uploadData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Supabase upload error:', response.status, errorText);
                return res.status(500).json({ error: 'Failed to save data to Supabase' });
            }

            const result = await response.json();
            console.log('Upload successful:', result[0].id);

            return res.status(200).json({
                success: true,
                message: 'Data uploaded successfully',
                id: result[0].id,
                timestamp: result[0].timestamp,
                listsCount: Object.keys(data).length,
                totalCards: Object.values(data).reduce((sum, cards) => sum + cards.length, 0),
                totalSRSessions: srSessionData ? Object.keys(srSessionData).length : 0
            });
        }
        else if (action === 'download') {
            console.log('Downloading data from Supabase...');

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
                console.error('Supabase download error:', response.status, errorText);
                return res.status(500).json({ error: 'Failed to fetch data from Supabase' });
            }

            const result = await response.json();
            console.log('Download result:', result.length, 'records found');

            if (!result || result.length === 0) {
                return res.status(404).json({ error: 'No data found' });
            }

            const latest = result[0];
            return res.status(200).json({
                success: true,
                data: latest.data,
                srSessionData: latest.srSessionData || {},
                timestamp: latest.timestamp,
                listsCount: Object.keys(latest.data).length,
                totalCards: Object.values(latest.data).reduce((sum, cards) => sum + cards.length, 0),
                totalSRSessions: latest.srSessionData ? Object.keys(latest.srSessionData).length : 0
            });
        }
        else if (action === 'info') {
            console.log('Getting server info...');

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
                console.error('Supabase info error:', response.status, errorText);
                return res.status(500).json({ error: 'Failed to fetch info from Supabase' });
            }

            const result = await response.json();
            const hasData = result && result.length > 0;
            console.log('Info result:', hasData ? 'Data exists' : 'No data');

            return res.status(200).json({
                success: true,
                hasData: hasData,
                timestamp: hasData ? result[0].timestamp : null,
                listsCount: hasData ? Object.keys(result[0].data).length : 0,
                totalCards: hasData ? Object.values(result[0].data).reduce((sum, cards) => sum + cards.length, 0) : 0,
                totalSRSessions: hasData && result[0].srSessionData ? Object.keys(result[0].srSessionData).length : 0
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