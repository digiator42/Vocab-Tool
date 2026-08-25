// api/youtube-transcript.js
// Serverless function to fetch YouTube transcripts server-side (no CORS issues)
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { videoId } = req.query;
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        res.status(400).json({ error: 'Invalid videoId parameter' });
        return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    // Helper to parse XML timedtext
    const parseXMLTranscript = (xmlText) => {
        try {
            const parser = new DOMParser();
            const xml = parser.parseFromString(xmlText, 'text/xml');
            const texts = xml.querySelectorAll('text');
            const result = [];
            texts.forEach(text => {
                const start = parseFloat(text.getAttribute('start')) || 0;
                const dur = parseFloat(text.getAttribute('dur')) || 0;
                const content = text.textContent
                    .replace(/&/g, '&')
                    .replace(/</g, '<')
                    .replace(/>/g, '>')
                    .replace(/'/g, "'")
                    .replace(/"/g, '"');
                if (content.trim()) {
                    result.push({ text: content.trim(), start, dur });
                }
            });
            return result;
        } catch (e) {
            console.error('XML parse error:', e);
            return [];
        }
    };

    // Try multiple transcript sources
    const transcriptUrls = [
        `https://video.google.com/timedtext?lang=de&v=${videoId}`,
        `https://video.google.com/timedtext?lang=en&v=${videoId}`,
        `https://video.google.com/timedtext?lang=de-DE&v=${videoId}`,
        `https://video.google.com/timedtext?lang=en-US&v=${videoId}`,
        `https://yewtu.be/api/v1/captions/${videoId}`,
    ];

    for (const url of transcriptUrls) {
        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            });

            if (!response.ok) continue;

            let result;
            if (url.includes('yewtu.be')) {
                result = await response.json();
            } else {
                const text = await response.text();
                result = parseXMLTranscript(text);
            }

            if (result && result.length > 0) {
                res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
                return res.status(200).json({ transcript: result, source: url });
            }
        } catch (e) {
            // Try next URL
        }
    }

    // Fallback: try noembed for description
    try {
        const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`, {
            signal: controller.signal,
        });
        if (response.ok) {
            const data = await response.json();
            if (data.description) {
                res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
                return res.status(200).json({
                    transcript: [{ text: data.description, start: 0, dur: 0 }],
                    source: 'noembed'
                });
            }
        }
    } catch (e) { }

    clearTimeout(timer);
    res.status(404).json({ error: 'No transcript found. Video may not have captions enabled.' });
}