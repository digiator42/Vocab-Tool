// PDF Reader for the vocab tool.
//
// Uses pdf.js to extract the text AND the layout of each PDF page, then renders
// every word as its own absolutely-positioned <span> inside a page container that
// keeps the original page aspect ratio. Because the spans live inside #output and
// carry the same classes the vocab tool expects, the existing click / drag /
// touch selection + translation system works on PDF text without any changes.

const PDFJS_VERSION = '3.11.174';
const PDFJS_DIST = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}`;
const PDFJS_BASE = `${PDFJS_DIST}/build`;
const PDFJS_LIB_URL = `${PDFJS_BASE}/pdf.min.js`;
const PDFJS_WORKER_URL = `${PDFJS_BASE}/pdf.worker.min.js`;
const PDFJS_STANDARD_FONTS_URL = `${PDFJS_DIST}/standard_fonts/`;
const PDFJS_CMAPS_URL = `${PDFJS_DIST}/cmaps/`;

let pdfjsLibPromise = null;

function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!pdfjsLibPromise) {
        pdfjsLibPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = PDFJS_LIB_URL;
            script.onload = () => {
                if (window.pdfjsLib) {
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
                    resolve(window.pdfjsLib);
                } else {
                    reject(new Error('pdf.js loaded but window.pdfjsLib is missing'));
                }
            };
            script.onerror = () => reject(new Error('Failed to load pdf.js from CDN'));
            document.head.appendChild(script);
        });
    }
    return pdfjsLibPromise;
}

export class PdfReader {
    constructor(main) {
        this.main = main;
        this.measureCanvas = null;
    }

    guessFontFamily(fontName) {
        const n = (fontName || '').toLowerCase();
        if (/times|roman|garamond|georgia|serif/.test(n)) return 'serif';
        if (/courier|mono|consol/.test(n)) return 'monospace';
        return 'sans-serif';
    }

    measureText(text, fs, family) {
        if (!this.measureCanvas) {
            this.measureCanvas = document.createElement('canvas');
            this.measureCanvas.width = 4096;
            this.measureCanvas.height = 128;
        }
        const ctx = this.measureCanvas.getContext('2d');
        ctx.font = `${fs}px ${family}`;
        return ctx.measureText(text).width;
    }

    async loadPdf(file) {
        const pdfjsLib = await loadPdfJs();
        const data = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({
            data,
            standardFontDataUrl: PDFJS_STANDARD_FONTS_URL,
            cMapUrl: PDFJS_CMAPS_URL,
            cMapPacked: true
        }).promise;

        const pages = [];
        const texts = [];

        for (let i = 1; i <= pdf.numPages; i++) {
            if (this.main.setStatus) {
                this.main.setStatus(`Extracting text… page ${i} of ${pdf.numPages}`);
            }
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1 });
            const content = await page.getTextContent();
            const extracted = this.extractPage(i, content.items, viewport);
            pages.push(extracted);
            texts.push(extracted.text);
        }

        await pdf.destroy();

        this.main.pdfMode = true;
        this.main.pdfData = { name: file.name, pages };
        this.main.input.value = texts.join('\n\n').trim();
        this.main.isProcessed = true;
        this.main.renderPdfPages();
    }

    extractPage(pageNumber, items, viewport) {
        const W = viewport.width;
        const H = viewport.height;

        const norm = [];
        for (const it of items) {
            if (!it || !it.str) continue;
            if (!it.str.trim()) continue;
            const t = it.transform;
            if (!t || t.length < 6) continue;
            const fs = Math.max(Math.hypot(t[0], t[1]) || 1, 1);
            const baseline = t[5];
            const height = it.height || fs;
            const top = H - baseline - height;
            norm.push({
                str: it.str,
                x: t[4],
                top,
                fs,
                width: it.width || 0,
                fontName: it.fontName,
                family: this.guessFontFamily(it.fontName)
            });
        }

        norm.sort((a, b) => (a.top - b.top) || (a.x - b.x));

        // Group items into lines by vertical proximity.
        const lines = [];
        for (const item of norm) {
            let line = lines[lines.length - 1];
            const tol = (line ? Math.min(line.fs, item.fs) : item.fs) * 0.5;
            if (!line || Math.abs(line.y - item.top) > tol) {
                line = { y: item.top, fs: item.fs, items: [] };
                lines.push(line);
            } else {
                line.fs = Math.max(line.fs, item.fs);
            }
            line.items.push(item);
        }

        lines.sort((a, b) => a.y - b.y);
        for (const line of lines) {
            line.items.sort((a, b) => a.x - b.x);
        }

        // Split each item into word tokens. Per-word widths are estimated with a
        // canvas, then corrected by k = item.width / measuredWidth so the total
        // width of every text item matches the real PDF width.
        for (const line of lines) {
            const fs = line.fs;
            const words = [];
            for (const item of line.items) {
                const family = item.family;
                let measuredWhole = this.measureText(item.str, fs, family);
                if (!(measuredWhole > 0)) measuredWhole = item.str.length * fs * 0.5;
                const k = item.width > 0 ? item.width / measuredWhole : 1;
                let rx = item.x;
                const parts = item.str.split(/(\s+)/);
                for (const part of parts) {
                    if (!part) continue;
                    if (/^\s+$/.test(part)) {
                        rx += this.measureText(part, fs, family) * k;
                        continue;
                    }
                    const w = this.measureText(part, fs, family) * k;
                    words.push({ text: part, x: rx, width: w, fs, family });
                    rx += w;
                }
            }
            line.words = words;
        }

        // Plain text (used for the textarea so sentence lookup etc. still work).
        const text = lines.map(line => line.items.map(it => it.str).join(' ')).join('\n');

        return { pageNumber, width: W, height: H, lines, text };
    }

    renderPdf(pdfData) {
        const output = this.main.output;
        output.innerHTML = '';
        output.style.whiteSpace = 'normal';
        output.style.textAlign = 'center';
        output.style.lineHeight = '1.4';
        output.style.padding = '1.5rem';

        const avail = Math.max(320, (output.clientWidth || 800) - 120);
        const targetW = Math.min(820, avail);

        const wrapper = document.createElement('div');
        wrapper.className = 'pdf-container';

        // Toolbar with file info + close button
        const toolbar = document.createElement('div');
        toolbar.className = 'pdf-toolbar';
        const info = document.createElement('span');
        info.className = 'pdf-toolbar-info';
        info.textContent = `📄 ${pdfData.name} — ${pdfData.pages.length} page${pdfData.pages.length === 1 ? '' : 's'}`;
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'pdf-close-btn';
        closeBtn.textContent = '✕ Close PDF';
        closeBtn.addEventListener('click', () => this.main.exitPdfMode());
        toolbar.appendChild(info);
        toolbar.appendChild(closeBtn);
        wrapper.appendChild(toolbar);

        for (const page of pdfData.pages) {
            const scale = page.width > 0 ? targetW / page.width : 1;

            const pageEl = document.createElement('div');
            pageEl.className = 'pdf-page';
            pageEl.dataset.page = page.pageNumber;
            pageEl.style.width = `${Math.round(page.width * scale)}px`;
            pageEl.style.height = `${Math.round(page.height * scale)}px`;

            let wordCount = 0;
            for (const line of page.lines) {
                const topPx = line.y * scale;
                for (const word of line.words) {
                    const span = document.createElement('span');
                    span.textContent = word.text;
                    span.className = 'pdf-word cursor-pointer';
                    // Inline position is required: the app stylesheet's
                    // `#output span { position: relative }` would otherwise
                    // override the .pdf-word class and scatter the words.
                    span.style.position = 'absolute';
                    span.style.left = `${Math.round(word.x * scale * 10) / 10}px`;
                    span.style.top = `${Math.round(topPx * 10) / 10}px`;
                    span.style.fontSize = `${Math.round(word.fs * scale * 10) / 10}px`;
                    span.style.fontFamily = word.family;
                    pageEl.appendChild(span);
                    wordCount++;
                }
            }

            wrapper.appendChild(pageEl);

            const label = document.createElement('div');
            label.className = 'pdf-page-label';
            if (wordCount === 0) {
                label.textContent = `Page ${page.pageNumber} — no selectable text (scanned image?)`;
            } else {
                label.textContent = `Page ${page.pageNumber}`;
            }
            wrapper.appendChild(label);
        }

        output.appendChild(wrapper);
    }
}
