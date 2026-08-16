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

// Text layout settings, editable via the toolbar's "Text layout" panel. The
// defaults reproduce the reader's original look (1.1x word spacing, 6px right
// margin, natural font size).
const DEFAULT_LAYOUT = { fontSize: 100, wordGap: 110, marginLeft: 0, marginRight: 6, marginTop: 0, marginBottom: 0 };
const LAYOUT_STORAGE_KEY = 'vtPdfLayout';

// Minimum space kept between two words during re-flow, as a fraction of the
// font size. PDFs with tightly-set (jammed) text have almost no inter-word
// gap; without this floor the rendered words look glued together.
const MIN_WORD_GAP = 0.4;

let pdfjsLibPromise = null;

// Matches words (in document order) against the operator-list text runs so each
// word can inherit the fill color that was active when the PDF drew it.
class ColorRunMatcher {
    constructor(runs) {
        this.runs = runs;
        this.ri = 0;
        this.pos = 0;
        this.synced = true;
    }

    consume(str) {
        if (!this.synced || !str) return null;
        const direct = this.matchFrom(this.ri, this.pos, str);
        if (direct) {
            this.ri = direct.ri;
            this.pos = direct.pos;
            return direct.color;
        }
        // The stream and the text content can diverge (e.g. invisible OCR text
        // layers): skip ahead to the next occurrence of the string.
        const found = this.findAhead(str, this.ri, this.pos);
        if (found) {
            this.ri = found.ri;
            this.pos = found.pos;
            return found.color;
        }
        this.synced = false;
        return null;
    }

    matchFrom(ri, pos, str) {
        let idx = 0;
        let firstColor = null;
        while (idx < str.length) {
            while (ri < this.runs.length && pos >= this.runs[ri].text.length) { ri++; pos = 0; }
            if (ri >= this.runs.length) return null;
            const run = this.runs[ri];
            const take = Math.min(run.text.length - pos, str.length - idx);
            if (run.text.substr(pos, take) !== str.substr(idx, take)) return null;
            if (firstColor === null) firstColor = run.color;
            idx += take;
            pos += take;
        }
        return { ri, pos, color: firstColor };
    }

    findAhead(str, ri, pos) {
        if (!str) return null;
        const limit = 20000;
        let scanned = 0;
        while (scanned < limit) {
            while (ri < this.runs.length && pos >= this.runs[ri].text.length) { ri++; pos = 0; }
            if (ri >= this.runs.length) return null;
            const run = this.runs[ri];
            const rest = run.text.slice(pos);
            const at = rest.indexOf(str);
            if (at >= 0) {
                let p2 = pos + at + str.length;
                let r2 = ri;
                if (p2 >= this.runs[r2].text.length) { r2++; p2 = 0; }
                return { ri: r2, pos: p2, color: run.color };
            }
            scanned += rest.length;
            ri++;
            pos = 0;
        }
        return null;
    }
}

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
        this.pdfjsLib = null;
        this.renderTasks = new Set();
        this.layoutSettings = this.loadLayoutSettings();
        this._layoutRenderTimer = null;
        this._pdfRenderPages = null;
    }

    loadLayoutSettings() {
        const base = { ...DEFAULT_LAYOUT };
        try {
            const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
            if (raw) {
                const saved = JSON.parse(raw);
                for (const k of Object.keys(DEFAULT_LAYOUT)) {
                    if (typeof saved[k] === 'number' && Number.isFinite(saved[k])) base[k] = saved[k];
                }
            }
        } catch (e) {
            /* fall back to defaults */
        }
        return base;
    }

    saveLayoutSettings() {
        try {
            localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(this.layoutSettings));
        } catch (e) {
            /* non-persistent storage is fine */
        }
    }

    // Debounced re-render of just the rendered pages (toolbar + settings panel
    // stay in place so sliders don't blink while dragging).
    scheduleLayoutRender() {
        this.saveLayoutSettings();
        if (this._layoutRenderTimer) clearTimeout(this._layoutRenderTimer);
        this._layoutRenderTimer = setTimeout(() => {
            this._layoutRenderTimer = null;
            if (typeof this._pdfRenderPages === 'function') this._pdfRenderPages();
        }, 80);
    }

    buildLayoutSettingsPanel(toolbar) {
        const wrap = document.createElement('div');
        wrap.className = 'pdf-settings-wrap';

        // Toggle switch (reuses the app's .switch-input styles).
        const switchRow = document.createElement('div');
        switchRow.className = 'flex flex-row items-center space-x-1';
        switchRow.title = 'Adjust the PDF text size, word spacing and margins';

        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.id = 'pdf-layout-chk';
        chk.className = 'switch-input';

        const swLabel = document.createElement('label');
        swLabel.htmlFor = 'pdf-layout-chk';
        swLabel.className = 'text-sm font-medium';

        const swText = document.createElement('span');
        swText.textContent = 'Text layout';

        chk.addEventListener('change', () => panel.classList.toggle('open', chk.checked));
        switchRow.appendChild(chk);
        switchRow.appendChild(swLabel);
        switchRow.appendChild(swText);
        wrap.appendChild(switchRow);

        const panel = document.createElement('div');
        panel.className = 'pdf-settings';

        const head = document.createElement('div');
        head.className = 'pdf-settings-head';
        head.textContent = 'Text layout';
        panel.appendChild(head);

        const defs = [
            { key: 'fontSize', label: 'Text size', unit: '%', min: 50, max: 200, step: 1 },
            { key: 'wordGap', label: 'Word spacing', unit: '%', min: 50, max: 250, step: 1 },
            { key: 'marginLeft', label: 'Left margin', unit: 'px', min: -60, max: 100, step: 1 },
            { key: 'marginRight', label: 'Right margin', unit: 'px', min: -60, max: 100, step: 1 },
            { key: 'marginTop', label: 'Top margin', unit: 'px', min: -60, max: 100, step: 1 },
            { key: 'marginBottom', label: 'Bottom margin', unit: 'px', min: -60, max: 100, step: 1 }
        ];

        const syncPanel = () => {
            const inputs = panel.querySelectorAll('input[type="range"]');
            for (const inp of inputs) {
                inp.value = String(this.layoutSettings[inp.dataset.key]);
                const val = panel.querySelector(`[data-val="${inp.dataset.key}"]`);
                if (val) val.textContent = this.layoutSettings[inp.dataset.key] + inp.dataset.unit;
            }
        };

        for (const d of defs) {
            const row = document.createElement('div');
            row.className = 'pdf-setting-row';

            const headRow = document.createElement('span');
            headRow.className = 'pdf-setting-head-row';

            const name = document.createElement('span');
            name.className = 'pdf-setting-name';
            name.textContent = d.label;

            const val = document.createElement('span');
            val.className = 'pdf-setting-val';
            val.dataset.val = d.key;
            val.textContent = this.layoutSettings[d.key] + d.unit;

            headRow.appendChild(name);
            headRow.appendChild(val);

            const input = document.createElement('input');
            input.type = 'range';
            input.min = d.min;
            input.max = d.max;
            input.step = d.step;
            input.dataset.key = d.key;
            input.dataset.unit = d.unit;
            input.value = String(this.layoutSettings[d.key]);

            input.addEventListener('input', () => {
                this.layoutSettings[d.key] = parseInt(input.value, 10);
                val.textContent = this.layoutSettings[d.key] + d.unit;
                this.scheduleLayoutRender();
            });

            row.appendChild(headRow);
            row.appendChild(input);
            panel.appendChild(row);
        }

        const reset = document.createElement('button');
        reset.type = 'button';
        reset.className = 'pdf-settings-reset';
        reset.textContent = 'Reset to defaults';
        reset.addEventListener('click', () => {
            this.layoutSettings = { ...DEFAULT_LAYOUT };
            syncPanel();
            this.saveLayoutSettings();
            this.scheduleLayoutRender();
        });
        panel.appendChild(reset);

        wrap.appendChild(panel);
        toolbar.appendChild(wrap);
    }

    guessFontFamily(fontName) {
        const n = (fontName || '').toLowerCase();
        if (/times|roman|garamond|georgia|serif/.test(n)) return 'serif';
        if (/courier|mono|consol/.test(n)) return 'monospace';
        return 'sans-serif';
    }

    isBoldFont(fontName) {
        return /bold|black|heavy|semibold|demibold/i.test(fontName || '');
    }

    isItalicFont(fontName) {
        return /italic|oblique/i.test(fontName || '');
    }

    measureText(text, fs, family, bold = false, italic = false) {
        if (!this.measureCanvas) {
            this.measureCanvas = document.createElement('canvas');
            this.measureCanvas.width = 4096;
            this.measureCanvas.height = 128;
        }
        const ctx = this.measureCanvas.getContext('2d');
        ctx.font = `${italic ? 'italic ' : ''}${bold ? '700 ' : '400 '}${fs}px ${family}`;
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
        this.pdfjsLib = pdfjsLib;

        const pages = [];
        const texts = [];

        for (let i = 1; i <= pdf.numPages; i++) {
            if (this.main.setStatus) {
                this.main.setStatus(`Extracting text… page ${i} of ${pdf.numPages}`);
            }
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1 });
            const content = await page.getTextContent();

            // One operator-list pass gives the per-glyph fill colors (for the
            // words). Image pixels are resolved later, page by page, at render
            // time so big PDFs don't keep all decoded images in memory.
            let colorRuns = null;
            try {
                const opList = await page.getOperatorList();
                colorRuns = this.analyzeOperators(opList).runs;
            } catch (err) {
                // colors are a best-effort improvement; fall back to plain black
            }
            page.cleanup();

            const extracted = this.extractPage(i, content.items, viewport, colorRuns);
            pages.push(extracted);
            texts.push(extracted.text);
        }

        this.main.pdfMode = true;
        this.main.pdfData = { name: file.name, pages };
        this.main.webMode = false;
        this.main.webData = null;
        this.main.input.value = texts.join('\n\n').trim();
        this.main.isProcessed = true;
        this.main.renderPdfPages();
    }

    // Walks a page's operator list and extracts, in drawing order:
    //   runs   -> [{ text, color }] for the words (text colors),
    //   images -> [{ objId|inline, matrix }] positions for the page images.
    analyzeOperators(opList) {
        const OPS = this.pdfjsLib.OPS;
        const runs = [];
        const images = [];
        let fill = '#000000';
        let buf = '';
        let bufColor = fill;
        let ctm = [1, 0, 0, 1, 0, 0];
        const stack = [];

        const emit = () => {
            if (buf) { runs.push({ text: buf, color: bufColor }); buf = ''; }
        };
        const setColor = (color) => {
            emit();
            fill = color;
            bufColor = color;
        };
        const readText = (args) => {
            let txt = '';
            const arr = args ? args[0] : null;
            if (arr) {
                for (const g of arr) {
                    if (typeof g === 'string') txt += g;
                    else if (g && typeof g.unicode === 'string') txt += g.unicode;
                }
            }
            return txt;
        };

        const fns = opList.fnArray;
        const argsList = opList.argsArray;
        for (let i = 0; i < fns.length; i++) {
            const fn = fns[i];
            const args = argsList[i];
            if (fn === OPS.save) {
                stack.push(ctm.slice());
            } else if (fn === OPS.restore) {
                if (stack.length) ctm = stack.pop();
            } else if (fn === OPS.transform) {
                const [a, b, c, d, e, f] = args;
                const [p, q, r, s, u, v] = ctm;
                ctm = [
                    a * p + b * r, a * q + b * s,
                    c * p + d * r, c * q + d * s,
                    e * p + f * r + u, e * q + f * s + v
                ];
            } else if (fn === OPS.setFillRGBColor) {
                setColor(this.colorToHex(args, 3));
            } else if (fn === OPS.setFillGray) {
                setColor(this.colorToHex(args, 1));
            } else if (fn === OPS.setFillCMYKColor) {
                setColor(this.colorToHex(args, 4));
            } else if (fn === OPS.setFillColor || fn === OPS.setFillColorN) {
                if (args && args.length >= 1 && typeof args[0] === 'number') {
                    setColor(this.colorToHex(args, args.length));
                }
            } else if (fn === OPS.showText || fn === OPS.showSpacedText) {
                const txt = readText(args);
                if (txt) {
                    if (buf && bufColor !== fill) emit();
                    if (!buf) bufColor = fill;
                    buf += txt;
                }
            } else if (fn === OPS.paintInlineImageXObject) {
                emit();
                if (args && args[0]) {
                    const img = args[0];
                    images.push({ objId: null, matrix: ctm.slice(), inline: { width: img.width, height: img.height, data: img.data } });
                }
            } else if (fn === OPS.paintImageXObject) {
                emit();
                if (args) images.push({ objId: args[0], matrix: ctm.slice(), inline: null });
            }
        }
        emit();

        return { runs, images };
    }

    // pdf.js hands colors to us either as 0..1 floats or 0..255 bytes (and
    // sometimes as a small dict instead of an array); normalise both.
    colorToHex(args, length) {
        const vals = [];
        for (let i = 0; i < length; i++) vals.push(Number(args[i]) || 0);
        const isByte = vals.some(v => v > 1);
        const f = isByte ? (v => v / 255) : (v => v);
        let r, g, b;
        if (length === 1) {
            r = g = b = f(vals[0]);
        } else if (length === 3) {
            r = f(vals[0]); g = f(vals[1]); b = f(vals[2]);
        } else if (length === 4) {
            const c = f(vals[0]), m = f(vals[1]), y = f(vals[2]), k = f(vals[3]);
            r = (1 - c) * (1 - k);
            g = (1 - m) * (1 - k);
            b = (1 - y) * (1 - k);
        } else {
            return '#000000';
        }
        const hex = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
        return '#' + hex(r) + hex(g) + hex(b);
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

    extractPage(pageNumber, items, viewport, colorRuns) {
        const W = viewport.width;
        const H = viewport.height;

        const matcher = (colorRuns && colorRuns.length) ? new ColorRunMatcher(colorRuns) : null;

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
            const family = this.guessFontFamily(it.fontName);
            let bold = this.isBoldFont(it.fontName);
            const italic = this.isItalicFont(it.fontName);
            if (!bold) {
                // Standard fonts (Helvetica-Bold etc.) are renamed to generic
                // ids by pdf.js, so fall back to width: bold glyphs are wider.
                const mReg = this.measureText(it.str, fs, family, false, italic);
                if (it.width > mReg * 1.06) bold = true;
            }
            const parts = it.str.split(/(\s+)/).filter(Boolean);
            const partColors = matcher
                ? parts.map(p => matcher.consume(p))
                : parts.map(() => null);
            norm.push({
                str: it.str,
                x: t[4],
                top,
                fs,
                width: it.width || 0,
                fontName: it.fontName,
                family,
                bold,
                italic,
                parts,
                partColors
            });
        }

        norm.sort((a, b) => (a.top - b.top) || (a.x - b.x));

        // Body font size = most-used size weighted by characters. Anything
        // clearly larger than the body is treated as a heading.
        const sizeWeights = new Map();
        for (const item of norm) {
            const len = item.str.replace(/\s/g, '').length;
            if (len > 0) sizeWeights.set(item.fs, (sizeWeights.get(item.fs) || 0) + len);
        }
        let bodySize = 12;
        let best = -1;
        for (const [s, w] of sizeWeights) {
            if (w > best) { best = w; bodySize = s; }
        }

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
            const isHeading = bodySize > 0 && line.fs >= bodySize * 1.35 && line.fs > bodySize + 0.5;
            const words = [];
            for (const item of line.items) {
                const family = item.family;
                let measuredWhole = this.measureText(item.str, fs, family, item.bold, item.italic);
                if (!(measuredWhole > 0)) measuredWhole = item.str.length * fs * 0.5;
                const k = item.width > 0 ? item.width / measuredWhole : 1;
                let rx = item.x;
                for (let pi = 0; pi < item.parts.length; pi++) {
                    const part = item.parts[pi];
                    if (/^\s+$/.test(part)) {
                        rx += this.measureText(part, fs, family, item.bold, item.italic) * k;
                        continue;
                    }
                    const w = this.measureText(part, fs, family, item.bold, item.italic) * k;
                    words.push({
                        text: part,
                        x: rx,
                        width: w,
                        fs,
                        k,
                        family,
                        bold: item.bold,
                        italic: item.italic,
                        heading: isHeading,
                        color: item.partColors[pi] || null
                    });
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

        return { pageNumber, width: W, height: H, lines, text, bodySize, hasText: lines.some(line => line.words.length > 0) };
    }

    renderPdf(pdfData) {
        this.cancelPendingRenders();
        if (this._layoutRenderTimer) {
            clearTimeout(this._layoutRenderTimer);
            this._layoutRenderTimer = null;
        }
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

        // Toolbar with file info, per-view page count, layout settings, and
        // close button. It is built once and kept alive across re-renders so the
        // layout panel doesn't close while its sliders are being dragged.
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
        toolbar.appendChild(perView);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'pdf-close-btn';
        closeBtn.textContent = '✕ Close PDF';
        closeBtn.addEventListener('click', () => this.main.exitPdfMode());
        toolbar.appendChild(closeBtn);
        wrapper.appendChild(toolbar);

        this.buildLayoutSettingsPanel(toolbar);

        // Pages live in their own box; only this box is rebuilt on re-render.
        const pagesBox = document.createElement('div');
        pagesBox.className = 'pdf-pages';
        wrapper.appendChild(pagesBox);

        const renderPages = () => {
            this.renderedPages = 0;
            pagesBox.innerHTML = '';
            this.appendPageBatch(pagesBox, pdfData, targetW);
        };
        this._pdfRenderPages = renderPages;

        perView.addEventListener('change', () => {
            this.pageChunk = perView.value === 'all' ? Infinity : parseInt(perView.value, 10) || DEFAULT_PDF_PAGE_CHUNK;
            this.main.pdfPageSize = this.pageChunk;
            renderPages();
        });

        renderPages();
        output.appendChild(wrapper);
    }

    appendPageBatch(container, pdfData, targetW) {
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
                const s = this.layoutSettings;
                const fsScale = (typeof s.fontSize === 'number' ? s.fontSize : 100) / 100;
                const gapF = (typeof s.wordGap === 'number' ? s.wordGap : 110) / 100;
                const marginLeftPx = typeof s.marginLeft === 'number' ? s.marginLeft : 0;
                const marginRightPx = typeof s.marginRight === 'number' ? s.marginRight : 6;
                const marginTopPx = typeof s.marginTop === 'number' ? s.marginTop : 0;
                const marginBottomPx = typeof s.marginBottom === 'number' ? s.marginBottom : 0;

                // Unified font size: every word renders at the page's body
                // size × slider scale, regardless of the source font size.
                const unifiedFs = (typeof page.bodySize === 'number' && page.bodySize > 0)
                    ? page.bodySize : 12;

                const pageW = Math.round(page.width * scale);
                const pageHpx = Math.round(page.height * scale);
                const effectivePageH = Math.max(0, pageHpx - marginBottomPx);

                // The text is always clamped between these bounds so it can never
                // leave the page, whatever the user sets for size / spacing / margins.
                const boundLeft = Math.min(Math.max(marginLeftPx, 0), Math.max(0, pageW - 20));
                const boundRight = Math.min(Math.max(pageW - marginRightPx, 20), pageW);

                const glyphH = unifiedFs * scale * fsScale;

                // Vertical guard: a line must never start above the previous
                // line's glyph bottom (clamping a near-top line to y=0 can push
                // it into the next line). Track the bottom of each line's glyphs.
                let prevGlyphBottom = marginTopPx;
                for (const line of page.lines) {
                    const words = line.words;
                    if (!words.length) continue;

                    const rawTop = Math.max(0, line.y * scale) + marginTopPx;
                    const topPx = Math.min(
                        Math.max(Math.max(prevGlyphBottom, rawTop), 0),
                        Math.max(0, effectivePageH - glyphH)
                    );

                    // Re-flow each line from its PDF left edge: word widths scale
                    // with the font size and the gaps between words scale with the
                    // font size AND the word-spacing factor. Gap values are
                    // clamped to >= 0 so words can never overlap. The margin then
                    // shifts the whole line. Lines that would run past the right
                    // bound are squeezed (positions AND font size) so nothing
                    // overflows the page.
                    const lineStartPdf = words[0].x;
                    let lineStartPx = lineStartPdf * scale + marginLeftPx;
                    if (lineStartPx < boundLeft) lineStartPx = boundLeft;

                    const wordLayout = [];
                    let cursorPx = lineStartPx;
                    for (let wi = 0; wi < words.length; wi++) {
                        const w = words[wi];
                        const widthPx = this.measureText(w.text, unifiedFs * scale * fsScale, w.family, w.bold, w.italic);
                        wordLayout.push({ w, left: cursorPx, width: widthPx });
                        cursorPx += widthPx;
                        if (wi < words.length - 1) {
                            const rawGapPdf = Math.max(words[wi + 1].x - (w.x + w.width), unifiedFs * MIN_WORD_GAP);
                            cursorPx += rawGapPdf * scale * fsScale * gapF;
                        }
                    }
                    const lineEndPx = cursorPx;

                    const fitF = (lineEndPx > boundRight && lineEndPx > lineStartPx + 1)
                        ? Math.max((boundRight - lineStartPx) / (lineEndPx - lineStartPx), 0.15)
                        : 1;

                    prevGlyphBottom = topPx + glyphH;

                    for (const { w, left } of wordLayout) {
                        let leftPx = left;
                        if (fitF !== 1) {
                            leftPx = lineStartPx + (leftPx - lineStartPx) * fitF;
                        }
                        const span = document.createElement('span');
                        span.textContent = w.text;
                        span.className = 'pdf-word cursor-pointer';
                        span.style.position = 'absolute';
                        span.style.left = `${Math.round(leftPx * 10) / 10}px`;
                        span.style.top = `${Math.round(topPx * 10) / 10}px`;
                        span.style.fontSize = `${Math.round(unifiedFs * scale * fsScale * fitF * 10) / 10}px`;
                        span.style.fontFamily = w.family;
                        if (w.bold || w.heading) span.style.fontWeight = '700';
                        if (w.italic) span.style.fontStyle = 'italic';
                        if (w.color) span.style.color = w.color;
                        pageEl.appendChild(span);
                        wordCount++;
                    }
                }
            } else {
                // Scanned / image-only page: render it as an image.
                this.renderPageImage(page, pageEl, scale);
            }

            container.appendChild(pageEl);

            if (page.hasText) {
                // Images are decoded and drawn asynchronously behind the words.
                this.renderPageImages(page, pageEl, scale);
            }

            const label = document.createElement('div');
            label.className = 'pdf-page-label';
            if (wordCount === 0) {
                label.textContent = `Page ${page.pageNumber} — no selectable text (scanned image?)`;
            } else {
                label.textContent = `Page ${page.pageNumber}`;
            }
            container.appendChild(label);
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
                this.appendPageBatch(container, pdfData, targetW);
            });
            container.appendChild(loadMore);
        }

        // Keep the DOM bounded. Rendering every page of a 200+ page PDF at once
        // hangs the browser, so once we've shown `chunk` pages, drop the ones
        // that scrolled out as the user advances to the next batch. The toolbar,
        // page counter and load-more button stay put; pruned pages are re-rendered
        // if the user re-opens the PDF.
        this.prunePages(container, chunk);
    }

    prunePages(wrapper, chunk) {
        if (!Number.isFinite(chunk) || chunk <= 0) return;
        const pages = wrapper.querySelectorAll(':scope > .pdf-page');
        const overflow = pages.length - chunk;
        if (overflow <= 0) return;
        for (let i = 0; i < overflow; i++) {
            const pageEl = pages[i];
            const label = pageEl.nextElementSibling;
            if (label && label.classList.contains('pdf-page-label')) {
                label.remove();
            }
            pageEl.remove();
        }
    }

    async renderPageImages(pageData, pageEl, scale) {
        if (!this.pdfDoc || !this.pdfjsLib) return;
        let pdfPage;
        try {
            pdfPage = await this.pdfDoc.getPage(pageData.pageNumber);
        } catch (e) {
            return;
        }
        let opList;
        try {
            opList = await pdfPage.getOperatorList();
        } catch (e) {
            pdfPage.cleanup();
            return;
        }
        const { images } = this.analyzeOperators(opList);
        const H = pageData.height;
        for (const img of images) {
            let resolved = img.inline;
            if (!resolved && img.objId) {
                try {
                    resolved = pdfPage.objs.get(img.objId);
                } catch (e) {
                    /* image not available */
                }
            }
            if (!resolved || !resolved.width || !resolved.height || !resolved.data) continue;
            const rgba = this.rgbaFromImage(resolved);
            if (!rgba) continue;
            const rect = this.imageRectFromMatrix(
                img.matrix, pageData.width, H, scale);
            if (!(rect.w > 0) || !(rect.h > 0)) continue;

            const canvas = document.createElement('canvas');
            canvas.className = 'pdf-page-image-el';
            canvas.width = resolved.width;
            canvas.height = resolved.height;
            const ctx = canvas.getContext('2d');
            ctx.putImageData(new ImageData(rgba, resolved.width, resolved.height), 0, 0);
            canvas.style.position = 'absolute';
            canvas.style.left = `${Math.round(rect.x * 10) / 10}px`;
            canvas.style.top = `${Math.round(rect.y * 10) / 10}px`;
            canvas.style.width = `${Math.round(rect.w * 10) / 10}px`;
            canvas.style.height = `${Math.round(rect.h * 10) / 10}px`;
            if (pageEl.isConnected) {
                // prepend so the words (added first) stay on top.
                pageEl.prepend(canvas);
            }
        }
        pdfPage.cleanup();
    }

    // Converts pdf.js pixel data (RGB / RGBA / gray) into RGBA for a canvas.
    rgbaFromImage(img) {
        const w = img.width;
        const h = img.height;
        const n = w * h;
        if (!(n > 0) || !img.data) return null;
        const bpp = img.data.length / n;
        const out = new Uint8ClampedArray(n * 4);
        if (bpp === 4) {
            out.set(img.data);
        } else if (bpp === 3) {
            for (let i = 0, j = 0; i < n * 3; i += 3, j += 4) {
                out[j] = img.data[i];
                out[j + 1] = img.data[i + 1];
                out[j + 2] = img.data[i + 2];
                out[j + 3] = 255;
            }
        } else if (bpp === 1) {
            for (let i = 0, j = 0; i < n; i++, j += 4) {
                out[j] = img.data[i];
                out[j + 1] = img.data[i];
                out[j + 2] = img.data[i];
                out[j + 3] = 255;
            }
        } else {
            return null; // bit-packed masks etc.
        }
        return out;
    }

    // The image matrix maps the PDF image's unit square [0..1]x[0..1] into page
    // space (PDF y-up): pdf.js's renderer normalises every image to a unit
    // square before drawing, so the CTM's scale already IS the display size
    // (content streams place images with `w 0 0 h x y cm /Im Do`). Returns the
    // axis-aligned screen rect (y-down) in display px.
    imageRectFromMatrix(matrix, pageW, pageH, scale) {
        const m = matrix;
        const pts = [
            [m[4], m[5]],
            [m[4] + m[0], m[5] + m[1]],
            [m[4] + m[2], m[5] + m[3]],
            [m[4] + m[0] + m[2], m[5] + m[1] + m[3]]
        ];
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const [x, y] of pts) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
        return {
            x: minX * scale,
            y: (pageH - maxY) * scale,
            w: (maxX - minX) * scale,
            h: (maxY - minY) * scale
        };
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
