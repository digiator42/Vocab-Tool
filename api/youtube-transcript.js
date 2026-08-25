// api/youtube-transcript.js
// Serverless function to fetch YouTube transcripts server-side (no CORS issues)

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function decodeEntities(text) {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&#34;/g, '"')
        .replace(/&quot;/g, '"')
        .replace(/\n/g, ' ');
}

function parseJson3(jsonText) {
    try {
        const data = JSON.parse(jsonText);
        const result = [];
        for (const event of data.events || []) {
            if (!event.segs) continue;
            const text = event.segs.map(s => s.utf8).join('').replace(/\n/g, ' ').trim();
            if (!text || text === '\u00a0') continue;
            result.push({
                text,
                start: (event.tStartMs || 0) / 1000,
                dur: (event.dDurationMs || 0) / 1000,
            });
        }
        return result;
    } catch (e) {
        return [];
    }
}

function parseXmlTimedtext(xmlText) {
    const result = [];
    const re = /<text[^>]*start="([\d.]+)"[^>]*(?:dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g;
    let m;
    while ((m = re.exec(xmlText)) !== null) {
        const text = decodeEntities(m[3]).trim();
        if (text) {
            result.push({ text, start: parseFloat(m[1]) || 0, dur: parseFloat(m[2]) || 0 });
        }
    }
    return result;
}

async function getPlayerResponse(videoId) {
    // Method 1: youtubei player API (InnerTube)
    try {
        const response = await fetch('https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
            body: JSON.stringify({
                context: { client: { clientName: 'ANDROID', clientVersion: '19.09.37', androidSdkVersion: 30 } },
                videoId,
            }),
            signal: AbortSignal.timeout(10000),
        });
        if (response.ok) {
            const data = await response.json();
            if (data?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length) {
                return data.captions.playerCaptionsTracklistRenderer.captionTracks;
            }
        }
    } catch (e) { /* fall through */ }

    // Method 2: scrape watch page for ytInitialPlayerResponse
    try {
        const response = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
            headers: {
                'User-Agent': UA,
                'Accept-Language': 'en-US,en;q=0.9',
            },
            signal: AbortSignal.timeout(10000),
        });
        if (response.ok) {
            const html = await response.text();
            const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var|const|let|<\/script>|if\s*\()/s);
            if (match) {
                const data = JSON.parse(match[1]);
                return data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
            }
        }
    } catch (e) { /* fall through */ }

    return [];
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { videoId, lang } = req.query;
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return res.status(400).json({ error: 'Invalid videoId parameter' });
    }

    try {
        const tracks = await getPlayerResponse(videoId);
        if (!tracks.length) {
            return res.status(404).json({ error: 'No caption tracks found for this video.' });
        }

        // Prefer requested language, then original, then first available
        const preferredLang = typeof lang === 'string' ? lang.split('-')[0] : null;
        const track =
            (preferredLang && tracks.find(t => t.languageCode === lang)) ||
            (preferredLang && tracks.find(t => t.languageCode === preferredLang)) ||
            tracks.find(t => !t.kind) ||
            tracks[0];

        const baseUrl = track.baseUrl.replace(/&fmt=\w+/, '');
        const formats = ['json3', 'srv3', ''];

        for (const fmt of formats) {
            const url = fmt ? `${baseUrl}&fmt=${fmt}` : baseUrl;
            try {
                const response = await fetch(url, {
                    headers: { 'User-Agent': UA },
                    signal: AbortSignal.timeout(10000),
                });
                if (!response.ok) continue;
                const body = await response.text();
                if (!body.trim()) continue;

                const transcript = fmt === 'json3' ? parseJson3(body) : parseXmlTimedtext(body);
                if (transcript.length) {
                    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
                    return res.status(200).json({
                        transcript,
                        source: 'youtube',
                        language: track.languageCode,
                        availableLanguages: tracks.map(t => ({ code: t.languageCode, name: t.name?.simpleText || t.name?.runs?.[0]?.text, kind: t.kind })),
                    });
                }
            } catch (e) { /* try next format */ }
        }

        return res.status(404).json({ error: 'Caption tracks exist but could not be fetched.' });
    } catch (e) {
        console.error('youtube-transcript error:', e);
        return res.status(500).json({ error: 'Failed to fetch transcript' });
    }
}
