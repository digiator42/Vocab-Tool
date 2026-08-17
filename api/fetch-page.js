// api/fetch-page.js
// Serverless CORS proxy for the "Load Website" feature. The vocab tool runs in
// the browser, which is blocked by CORS when fetching most external sites. This
// function fetches the page server-side (redirects followed) and returns the
// raw HTML plus the final URL after redirects, so the client can sanitize it
// with zero CORS issues.
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { url } = req.query;
    if (!url || !/^https?:\/\//i.test(url)) {
        res.status(400).json({ error: 'Invalid url parameter' });
        return;
    }

    const controller = new AbortController();
    // Keep upstream fetch under Vercel's default function timeout.
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
        const response = await fetch(url, {
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
        });

        if (!response.ok) {
            res.status(response.status).json({ error: `HTTP ${response.status}` });
            return;
        }

        const html = await response.text();
        const finalUrl = response.url || url;

        res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
        res.status(200).json({ html, url: finalUrl });
    } catch (err) {
        console.error('fetch-page failed:', err && err.message ? err.message : err);
        res.status(502).json({ error: 'Upstream fetch failed' });
    } finally {
        clearTimeout(timer);
    }
}