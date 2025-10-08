export default async function handler(req, res) {
    try {
        const { word } = req.query;

        if (!word) {
            res.status(400).json({ error: "Missing 'word' parameter" });
            return;
        }

        const url = `https://der-artikel.de/en/der/${word}.html`;

        const response = await fetch(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            },
        });

        if (!response.ok) {
            res.status(response.status).json({ error: "Failed to fetch article page" });
            return;
        }

        const html = await response.text();

        const match = html.match(/<h1 class="mb-1"><span[^>]*>(.*?)<\/span>/);
        const article = match?.[1];

        if (!article) {
            res.status(404).json({ error: "Article not found in page" });
            return;
        }

        res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");
        res.status(200).json({ word, article });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
}
