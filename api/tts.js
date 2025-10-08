// api/tts.js
export default async function handler(req, res) {
    try {
        const { text, lang = "de", slow = "false" } = req.query;

        if (!text) {
            res.status(400).json({ error: "Missing text parameter" });
            return;
        }

        const speed = slow === "true" ? "0.15" : "1";
        const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=gtx&tl=${lang}&q=${encodeURIComponent(text)}&ttsspeed=${speed}`;

        const response = await fetch(googleUrl, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            },
        });

        if (!response.ok) {
            res.status(response.status).json({ error: "Failed to fetch TTS" });
            return;
        }

        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");

        const buffer = Buffer.from(await response.arrayBuffer());
        res.send(buffer);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
}
