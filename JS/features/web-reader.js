// Web Reader for the vocab tool.
//
// Fetches a German website and injects its SANITIZED HTML body into the vocab
// tool's output, preserving the site's structure (paragraphs, headings, lists,
// links, images, ...). Every word is still wrapped in a selection span, so the
// existing translation / highlight / flashcard pipeline works on the page.
//
// We deliberately do NOT render the site in an <iframe>. External pages are
// cross-origin, so their DOM is off-limits to scripts and the translation
// system could never select or highlight any word.

const WEB_FETCH_TIMEOUT = 20000;
const WEB_MAX_CHARS = 150000;

// Tags we keep in the imported page. Everything else is removed (scripts,
// forms, embeds...) or unwrapped (header/footer/aside/span keep their children).
// Site <span>s are unwrapped (not kept): a kept <span> would nest around our
// per-word spans and its text would be duplicated when a drag selection spans
// both levels.
const KEEP_TAGS = new Set([
    'A', 'ABBR', 'B', 'BLOCKQUOTE', 'BR', 'CODE', 'DD', 'DIV', 'DL', 'DT',
    'EM', 'FIGCAPTION', 'FIGURE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR',
    'I', 'IMG', 'LI', 'MAIN', 'MARK', 'OL', 'P', 'PRE', 'Q', 'S', 'SECTION',
    'SMALL', 'STRONG', 'SUB', 'SUP', 'TABLE', 'TBODY', 'TD', 'TFOOT',
    'TH', 'THEAD', 'TR', 'U', 'UL'
]);

const REMOVE_SELECTORS = [
    'script', 'style', 'link', 'meta', 'noscript', 'template',
    'iframe', 'frame', 'object', 'embed', 'svg', 'canvas', 'video', 'audio',
    'form', 'button', 'input', 'select', 'textarea', 'option', 'map', 'area', 'nav',
    '[hidden]', '[aria-hidden="true"]',
    '[class*="cookie"]', '[id*="cookie"]',
    '[class*="consent"]', '[id*="consent"]',
    '[class*="gdpr"]', '[id*="gdpr"]',
    '[class*="advert"]', '[id*="advert"]',
    '[class*="ad-"]', '[id*="ad-"]'
];

const ALLOWED_ATTRS = {
    A: ['href', 'title'],
    IMG: [
        'src', 'alt', 'title', 'srcset',
        'data-src', 'data-lazy-src', 'data-lazy', 'data-original',
        'data-url', 'data-image', 'data-image-url', 'data-load', 'data-srcset'
    ]
};

export class WebReader {
    constructor(main) {
        this.main = main;
    }

    normalizeUrl(input) {
        let u = String(input || '').trim();
        if (!u) return '';
        if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
        return u;
    }

    async loadPage(url) {
        // Try our serverless proxy first (no CORS on Vercel), then the direct
        // request, then fall back through public CORS proxies so most sites
        // work even when running locally without the /api function.
        const sources = [
            this.proxyUrl(url),
            url,
            `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
            `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
            `https://cors.eu.org/${encodeURIComponent(url)}`
        ];

        let lastErr = null;
        for (const src of sources) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), WEB_FETCH_TIMEOUT);
            try {
                const res = await fetch(src, { signal: controller.signal, redirect: 'follow' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                let html;
                let finalUrl = url;
                if (src === this.proxyUrl(url)) {
                    // Serverless proxy returns JSON: { html, url (after redirects) }.
                    const data = await res.json();
                    html = data.html || '';
                    finalUrl = this.finalUrl(data.url, url);
                } else {
                    html = await res.text();
                    // redirect:'follow' already follows redirects; res.url is the
                    // final URL. Proxies report their own wrapper URL, so for
                    // those sources keep the original target.
                    finalUrl = this.finalUrl(res.url, url);
                }

                const page = this.sanitize(html, finalUrl);
                if (page.text && page.text.length >= 50) {
                    return { url: finalUrl, html: page.html, text: page.text };
                }
            } catch (err) {
                lastErr = err;
            } finally {
                clearTimeout(timer);
            }
        }
        throw lastErr || new Error('Could not fetch the website.');
    }

    // Build the URL for our own serverless proxy (same-origin on Vercel).
    proxyUrl(url) {
        return `/api/fetch-page?url=${encodeURIComponent(url)}`;
    }

    // Resolve the final URL after redirects, ignoring proxy wrapper URLs.
    finalUrl(responseUrl, originalUrl) {
        if (!responseUrl) return originalUrl;
        if (/allorigins|corsproxy|cors\.eu\.org/i.test(responseUrl)) return originalUrl;
        return responseUrl;
    }

    // Pick the element that holds the main content (no nav bars / sidebars).
    // Prefers semantic landmarks (<main>, [role=main], <article>) and common
    // content wrappers; falls back to the largest text-bearing candidate.
    extractMainContent(doc) {
        const scoreEl = (el) => el.textContent.trim().length;

        let best = null;
        let bestScore = 0;
        const consider = (el) => {
            if (!el || !el.isConnected) return;
            const s = scoreEl(el);
            if (s > bestScore) {
                bestScore = s;
                best = el;
            }
        };

        // Semantic landmarks.
        doc.querySelectorAll('main, [role="main"], article').forEach(consider);

        // Common CMS / framework content wrappers.
        doc.querySelectorAll([
            '#content', '#main', '#main-content', '#mainContent', '#article',
            '#post-content', '#postContent', '#entry-content', '#article-content',
            '.content', '.main-content', '.mainContent', '.site-content',
            '.post-content', '.postContent', '.entry-content', '.article-content',
            '.article-body', '.single-content', '.page-content', '.reading-content'
        ].join(',')).forEach(consider);

        return best;
    }

    sanitize(html, baseUrl) {
        const doc = new DOMParser().parseFromString(html, 'text/html');

        // Scope everything to the main content so site chrome (nav bars, headers,
        // sidebars, footers) is excluded. Falls back to <body> if no candidate.
        const mainRoot = this.extractMainContent(doc) || doc.body;

        // Drop site chrome explicitly (nav / aside are never content).
        mainRoot.querySelectorAll('nav, aside').forEach(el => el.remove());
        // Unwrap header/footer so article titles survive, and unwrap inline
        // wrappers keeping their children (headlines, bylines, bold text...).
        // Site <span>s are unwrapped (not kept): a kept <span> would nest around
        // our per-word spans and its text would be duplicated when a drag
        // selection spans both levels.
        mainRoot.querySelectorAll('header, footer, label, span').forEach(el => {
            const parent = el.parentNode;
            while (el.firstChild) parent.insertBefore(el.firstChild, el);
            el.remove();
        });

        // Drop everything that is never part of the readable content.
        mainRoot.querySelectorAll(REMOVE_SELECTORS.join(',')).forEach(el => el.remove());

        // Keep only whitelisted tags and clean their attributes. This strips
        // event handlers, inline styles and anything that could execute or
        // fight with the tool's own styling.
        const all = [...mainRoot.querySelectorAll('*')];
        for (const el of all) {
            if (!KEEP_TAGS.has(el.tagName)) {
                // Unknown tags (Word's <o:p>, <font>, ...) are usually inline
                // wrappers: keep their children instead of dropping the text.
                const parent = el.parentNode;
                if (parent) {
                    while (el.firstChild) parent.insertBefore(el.firstChild, el);
                    el.remove();
                }
                continue;
            }
            const allowed = ALLOWED_ATTRS[el.tagName] || [];
            for (const attr of [...el.attributes]) {
                if (!allowed.includes(attr.name)) el.removeAttribute(attr.name);
            }
            if (el.tagName === 'A') {
                const href = (el.getAttribute('href') || '').trim();
                if (!href || /^\s*javascript:/i.test(href)) {
                    el.removeAttribute('href');
                } else {
                    el.setAttribute('href', this.resolveUrl(href, baseUrl));
                }
            }
            if (el.tagName === 'IMG') {
                const src = this.pickImageSrc(el);
                if (!src) {
                    el.remove();
                    continue;
                }
                el.setAttribute('src', this.resolveUrl(src, baseUrl));
                el.setAttribute('loading', 'lazy');
                if (!(el.getAttribute('alt') || '').trim()) el.setAttribute('alt', '');
                el.removeAttribute('width');
                el.removeAttribute('height');
                el.removeAttribute('srcset');
                el.removeAttribute('data-src');
                el.removeAttribute('data-lazy-src');
                el.removeAttribute('data-lazy');
                el.removeAttribute('data-original');
                el.removeAttribute('data-url');
                el.removeAttribute('data-image');
                el.removeAttribute('data-image-url');
                el.removeAttribute('data-load');
                el.removeAttribute('data-srcset');
            }
        }

        // Prune elements that ended up empty (no text, no image).
        mainRoot.querySelectorAll('p, div, section, article, span, figure, li, td, th, tr').forEach(el => {
            if (!el.textContent.trim() && !el.querySelector('img')) el.remove();
        });

        // Move content into a container so we can serialize cleanly.
        const container = doc.createElement('div');
        while (mainRoot.firstChild) container.appendChild(mainRoot.firstChild);

        // Limit the size so huge pages don't freeze the renderer.
        this.truncateRoot(container, WEB_MAX_CHARS);

        return {
            html: container.innerHTML,
            text: this.textOf(container)
        };
    }

    resolveUrl(u, base) {
        if (!u || !base) return u;
        if (/^https?:\/\//i.test(u) || /^\/\//.test(u) || u.startsWith('data:')) return u;
        try {
            return new URL(u, base).href;
        } catch (e) {
            return u;
        }
    }

    // Many news sites lazy-load images: the real URL lives in data-src/srcset
    // and <img src> is a 1px placeholder. Find the first real image URL.
    pickImageSrc(el) {
        const PLACEHOLDER = /^data:image\/(?:gif|png|jpe?g|webp);base64,R0lGOD/i;
        const candidates = [
            'src', 'data-src', 'data-lazy-src', 'data-lazy', 'data-original',
            'data-url', 'data-image', 'data-image-url', 'data-load'
        ];
        for (const name of candidates) {
            const v = (el.getAttribute(name) || '').trim();
            if (v && !PLACEHOLDER.test(v)) return v;
        }
        for (const name of ['srcset', 'data-srcset']) {
            const v = (el.getAttribute(name) || '').trim();
            if (!v) continue;
            const first = v.split(',')[0].trim().split(/\s+/)[0];
            if (first && !PLACEHOLDER.test(first)) return first;
        }
        return '';
    }

    truncateRoot(root, maxChars) {
        let budget = maxChars;
        const walk = (node) => {
            if (budget <= 0) {
                node.remove();
                return;
            }
            if (node.nodeType === 3) { // TEXT_NODE
                const len = node.textContent.length;
                if (len > budget) {
                    node.textContent = node.textContent.slice(0, budget) + '…';
                    budget = 0;
                } else {
                    budget -= len;
                }
                return;
            }
            if (node.nodeType !== 1) return;
            for (const child of [...node.childNodes]) walk(child);
        };
        for (const child of [...root.childNodes]) walk(child);
    }

    textOf(root) {
        const BLOCK = new Set([
            'P', 'DIV', 'SECTION', 'ARTICLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
            'LI', 'TR', 'UL', 'OL', 'BLOCKQUOTE', 'TABLE', 'PRE',
            'FIGCAPTION', 'DETAILS', 'SUMMARY'
        ]);
        let out = '';
        const walk = (node) => {
            if (node.nodeType === 3) { // TEXT_NODE
                out += node.textContent;
                return;
            }
            if (node.nodeType !== 1) return;
            const tag = node.tagName;
            if (tag === 'BR') {
                out += '\n';
                return;
            }
            if (BLOCK.has(tag)) out += '\n';
            for (const child of node.childNodes) walk(child);
            if (BLOCK.has(tag)) out += '\n';
        };
        walk(root);
        return out
            .replace(/\u00a0/g, ' ')
            .split('\n')
            .map(line => line.replace(/[ \t\u200b\u200c\u200d\ufeff]+/g, ' ').trim())
            .filter(Boolean)
            .join('\n');
    }
}
