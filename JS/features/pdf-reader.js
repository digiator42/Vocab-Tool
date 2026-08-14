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

// How many pages are rendered into the DOM at once. Rendering a huge PDF
// (100-200+ pages) as one giant DOM tree freezes the browser, so pages are
// appended in batches via a "load more" button.
const DEFAULT_PDF_PAGE_CHUNK = 10;

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
        this.renderedPages = 0;
        this.pageChunk = DEFAULT_PDF_PAGE_CHUNK;
        this.pdfDoc = null;
        this.renderTasks = new Set();
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
        this.cancelPendingRenders();
        if (this.pdfDoc) {
            await this.pdfDoc.destroy();
            this.pdfDoc = null;
        }
        const pdf = await pdfjsLib.getDocument({
            data,
            standardFontDataUrl: PDFJS_STANDARD_FONTS_URL,
            cMapUrl: PDFJS_CMAPS_URL,
            cMapPacked: true
        }).promise;
        this.pdfDoc = pdf;

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

        this.main.pdfMode = true;
        this.main.pdfData = { name: file.name, pages };
        this.main.input.value = texts.join('\n\n').trim();
        this.main.isProcessed = true;
        this.main.renderPdfPages();
    }

    cancelPendingRenders() {
        for (const task of this.renderTasks) {
            try { task.cancel(); } catch (e) { /* already finished */ }
        }
        this.renderTasks.clear();
    }

    destroy() {
        this.cancelPendingRenders();
        if (this.pdfDoc) {
            this.pdfDoc.destroy().catch(() => {});
            this.pdfDoc = null;
        }
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

            // Enforce a minimum visual gap between consecutive words. PDF word
            // coordinates sometimes leave no room for the space glyph (or the
            // embedded font is more condensed than our guessed system font), which
            // makes words look jammed. Nudge words right only where the gap is too
            // small, so most of the original layout is preserved.
            if (words.length > 1) {
                const minGap = fs * 0.28;
                let lastEnd = words[0].x + words[0].width;
                for (let i = 1; i < words.length; i++) {
                    const gap = words[i].x - lastEnd;
                    if (gap < minGap) {
                        const shift = minGap - gap;
                        for (let j = i; j < words.length; j++) {
                            words[j].x += shift;
                        }
                    }
                    lastEnd = words[i].x + words[i].width;
                }
            }
        }

        // Plain text (used for the textarea so sentence lookup etc. still work).
        const text = lines.map(line => line.items.map(it => it.str).join(' ')).join('\n');

        return { pageNumber, width: W, height: H, lines, text, hasText: lines.some(line => line.words.length > 0) };
    }

    renderPdf(pdfData) {
        this.cancelPendingRenders();
        const output = this.main.output;
        output.innerHTML = '';
        output.style.whiteSpace = 'normal';
        output.style.textAlign = 'center';
        output.style.lineHeight = '1.4';
        output.style.padding = '1.5rem';

        // In focus mode #output fills the whole viewport, so use the window
        // width and a larger page cap instead of the collapsed output width.
        // Cap the focus page at Tailwind's 7xl (1280px) or 80% of the screen.
        const isFocus = !!this.main.isFocusMode;
        const targetW = isFocus
            ? Math.max(320, Math.min(900, (window.innerWidth || 900) * 0.8))
            : Math.min(820, Math.max(320, (output.clientWidth || 800) - 120));

        this.renderedPages = 0;
        this.pageChunk = (typeof this.main.pdfPageSize === 'number' && this.main.pdfPageSize > 0)
            ? this.main.pdfPageSize
            : DEFAULT_PDF_PAGE_CHUNK;

        const wrapper = document.createElement('div');
        wrapper.className = 'pdf-container' + (isFocus ? ' pdf-container-focus' : '');

        // Toolbar with file info, per-view page count, and close button
        const toolbar = document.createElement('div');
        toolbar.className = 'pdf-toolbar';
        const info = document.createElement('span');
        info.className = 'pdf-toolbar-info';
        info.textContent = `📄 ${pdfData.name} — ${pdfData.pages.length} page${pdfData.pages.length === 1 ? '' : 's'}`;
        toolbar.appendChild(info);

        const perView = document.createElement('select');
        perView.className = 'pdf-per-view';
        perView.title = 'Pages to show at a time';
        const options = [
            { value: '10', label: '10 pages' },
            { value: '25', label: '25 pages' },
            { value: '50', label: '50 pages' },
            { value: 'all', label: 'All pages' }
        ];
        for (const opt of options) {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            perView.appendChild(option);
        }
        perView.value = this.pageChunk === Infinity ? 'all' : String(this.pageChunk);
        perView.addEventListener('change', () => {
            this.pageChunk = perView.value === 'all' ? Infinity : parseInt(perView.value, 10) || DEFAULT_PDF_PAGE_CHUNK;
            this.main.pdfPageSize = this.pageChunk;
            this.renderPdf(pdfData);
        });
        toolbar.appendChild(perView);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'pdf-close-btn';
        closeBtn.textContent = '✕ Close PDF';
        closeBtn.addEventListener('click', () => this.main.exitPdfMode());
        toolbar.appendChild(closeBtn);
        wrapper.appendChild(toolbar);

        this.appendPageBatch(wrapper, pdfData, targetW);
        output.appendChild(wrapper);
    }

    appendPageBatch(wrapper, pdfData, targetW) {
        const pages = pdfData.pages;
        const chunk = this.pageChunk === Infinity ? pages.length : this.pageChunk;
        const end = Math.min(this.renderedPages + chunk, pages.length);
        const start = this.renderedPages;

        for (let i = start; i < end; i++) {
            const page = pages[i];
            const scale = page.width > 0 ? targetW / page.width : 1;

            const pageEl = document.createElement('div');
            pageEl.className = 'pdf-page';
            pageEl.dataset.page = page.pageNumber;
            pageEl.style.width = `${Math.round(page.width * scale)}px`;
            pageEl.style.height = `${Math.round(page.height * scale)}px`;

            let wordCount = 0;
            if (page.hasText) {
                const pageW = Math.round(page.width * scale);
                const rightMarginPx = 6;
                // Vertical guard: a line must never start above the previous
                // line's glyph bottom (clamping a near-top line to y=0 can push
                // it into the next line). Track the bottom of each line's glyphs.
                let prevGlyphBottom = 0;
                for (const line of page.lines) {
                    const words = line.words;
                    if (!words.length) continue;

                    const glyphH = line.fs * scale;
                    const topPx = Math.max(prevGlyphBottom, Math.max(0, line.y * scale));

                    // Words carry the 1.1x spacing tweak, applied RELATIVE to the
                    // line start: it stretches the gaps between words (fixing
                    // jammed text) but keeps the line's true left position, so the
                    // page margin is never inflated. It can still push long lines
                    // past the right edge, so squeeze just the lines that overflow
                    // (positions AND font size) to keep them inside.
                    const lineStartPdf = words[0].x;
                    const lastWord = words[words.length - 1];
                    let lineStartPx = lineStartPdf * scale;
                    let lineEndPx = (lineStartPdf + (lastWord.x + lastWord.width - lineStartPdf) * 1.1) * scale;

                    // If the line starts outside the page's left edge, shift it right.
                    const shiftPx = lineStartPx < 0 ? -lineStartPx : 0;
                    if (shiftPx) {
                        lineStartPx += shiftPx;
                        lineEndPx += shiftPx;
                    }

                    const maxRightPx = pageW - rightMarginPx;
                    const fitF = (lineEndPx > maxRightPx && lineEndPx > lineStartPx)
                        ? (maxRightPx - lineStartPx) / (lineEndPx - lineStartPx)
                        : 1;

                    prevGlyphBottom = topPx + glyphH;

                    for (const word of words) {
                        let leftPx = (lineStartPdf + (word.x - lineStartPdf) * 1.1) * scale + shiftPx;
                        if (fitF !== 1) {
                            leftPx = lineStartPx + (leftPx - lineStartPx) * fitF;
                        }
                        const span = document.createElement('span');
                        span.textContent = word.text;
                        span.className = 'pdf-word cursor-pointer';
                        // Inline position is required: the app stylesheet's
                        // `#output span { position: relative }` would otherwise
                        // override the .pdf-word class and scatter the words.
                        span.style.position = 'absolute';
                        span.style.left = `${Math.round(leftPx * 10) / 10}px`;
                        span.style.top = `${Math.round(topPx * 10) / 10}px`;
                        span.style.fontSize = `${Math.round(word.fs * scale * (fitF === 1 ? 1 : fitF) * 10) / 10}px`;
                        span.style.fontFamily = word.family;
                        pageEl.appendChild(span);
                        wordCount++;
                    }
                }
            } else {
                // Scanned / image-only page: render it as an image.
                this.renderPageImage(page, pageEl, scale);
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

        this.renderedPages = end;

        // Yield to the browser between batches so large files never freeze the UI.
        if (this.renderedPages < pages.length) {
            const remaining = pages.length - this.renderedPages;
            const loadMore = document.createElement('button');
            loadMore.type = 'button';
            loadMore.className = 'pdf-load-more-btn';
            loadMore.textContent = `Load next ${Math.min(chunk, remaining)} page${Math.min(chunk, remaining) === 1 ? '' : 's'} (${this.renderedPages} of ${pages.length})`;
            loadMore.addEventListener('click', () => {
                loadMore.remove();
                this.appendPageBatch(wrapper, pdfData, targetW);
            });
            wrapper.appendChild(loadMore);
        }
    }

    async renderPageImage(page, pageEl, scale) {
        if (!this.pdfDoc) return;
        const pdfPage = await this.pdfDoc.getPage(page.pageNumber);
        const viewport = pdfPage.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-page-image';
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const task = pdfPage.render({
            canvasContext: canvas.getContext('2d'),
            viewport
        });
        this.renderTasks.add(task);
        try {
            await task.promise;
        } catch (e) {
            // render was cancelled (re-render or new PDF) or failed
        } finally {
            this.renderTasks.delete(task);
            pdfPage.cleanup();
        }
        if (pageEl.isConnected) {
            pageEl.appendChild(canvas);
        }
    }
}
