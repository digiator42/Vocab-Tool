// HTML File Reader for the vocab tool.
//
// Loads a local HTML file, preserves its original styling, and renders it
// inside #output with every word wrapped in a selection span.  Large files
// are paginated (top-level body elements grouped into pages) so the browser
// never has to lay out thousands of nodes at once.  Because the word spans
// live inside #output the existing click / drag / touch selection +
// translation + flashcard pipeline works on the HTML text without changes.

const DEFAULT_HTML_PAGE_SIZE = 10;
const HTML_PAGE_SIZE_KEY = 'vtHtmlPageSize';
const HTML_MAX_CHARS = 200000;

// Yield to the browser main thread every N DOM mutations so the UI never
// freezes.  Keeping this low (200) feels responsive; raising it speeds up
// total render time at the cost of jank.
const YIELD_EVERY = 200;

// Tags to ignore when collecting body children for pagination.
const IGNORE_TAGS = new Set([
    'SCRIPT', 'NOSCRIPT', 'STYLE', 'LINK', 'META', 'TEMPLATE'
]);

/** Yield control to the browser so it can paint / handle input. */
function yieldToMain() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

export class HtmlReader {
    constructor(main) {
        this.main = main;
        this.renderedPages = 0;
        this.pageChunk = this.loadPageSize();
        this.pages = [];
        this.styles = [];
        this.originalTitle = '';
        this._renderPages = null;
        this._cancelled = false;
    }

    loadPageSize() {
        try {
            const raw = localStorage.getItem(HTML_PAGE_SIZE_KEY);
            if (raw) {
                const n = parseInt(raw, 10);
                if (n > 0 || raw === 'all') return raw === 'all' ? Infinity : n;
            }
        } catch (e) { /* ignore */ }
        return DEFAULT_HTML_PAGE_SIZE;
    }

    savePageSize() {
        try {
            localStorage.setItem(HTML_PAGE_SIZE_KEY,
                this.pageChunk === Infinity ? 'all' : String(this.pageChunk));
        } catch (e) { /* ignore */ }
    }

    // ── Progress overlay ────────────────────────────────────────────────

    showProgress(message, percent) {
        let overlay = document.getElementById('html-progress-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'html-progress-overlay';
            overlay.innerHTML = `
                <div class="html-progress-box">
                    <div class="html-progress-text"></div>
                    <div class="html-progress-bar-track">
                        <div class="html-progress-bar-fill"></div>
                    </div>
                    <div class="html-progress-detail"></div>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        overlay.classList.remove('hidden');
        overlay.querySelector('.html-progress-text').textContent = message || 'Loading…';
        const fill = overlay.querySelector('.html-progress-bar-fill');
        fill.style.width = (percent != null ? Math.min(percent, 100) : 0) + '%';
        const detail = overlay.querySelector('.html-progress-detail');
        detail.textContent = '';
        return overlay;
    }

    updateProgress(message, percent, detail) {
        const overlay = document.getElementById('html-progress-overlay');
        if (!overlay) return;
        if (message) overlay.querySelector('.html-progress-text').textContent = message;
        if (percent != null) {
            overlay.querySelector('.html-progress-bar-fill').style.width =
                Math.min(percent, 100) + '%';
        }
        if (detail) overlay.querySelector('.html-progress-detail').textContent = detail;
    }

    hideProgress() {
        const overlay = document.getElementById('html-progress-overlay');
        if (overlay) overlay.classList.add('hidden');
    }

    // ── File loading ────────────────────────────────────────────────────

    async loadHtmlFile(file) {
        this._cancelled = false;

        try {
            // Phase 1 — Read & parse
            this.showProgress('Reading file…', 5);
            await yieldToMain();
            if (this._cancelled) return;

            const html = await file.text();
            this.updateProgress('Parsing HTML…', 10);
            await yieldToMain();
            if (this._cancelled) return;

            const doc = new DOMParser().parseFromString(html, 'text/html');

            // Title
            this.originalTitle = doc.querySelector('title')?.textContent?.trim() || file.name;

            // Extract <style> blocks (cloned so we own them)
            this.styles = [];
            doc.querySelectorAll('style').forEach(s => {
                this.styles.push(s.cloneNode(true));
            });

            // pdf2htmlEX exports (PDF→HTML) wrap each PDF page in a `.pf` frame
            // inside `#page-container`. When present, paginate on those frames so
            // "N elements per page" means N PDF pages, and drop the absolutely-
            // positioned `#sidebar` / `#page-container` wrappers that would
            // otherwise overlay the whole site.
            const pageContainer = doc.getElementById('page-container');
            const pfFrames = pageContainer
                ? Array.from(pageContainer.children).filter(el => {
                    return el.classList && el.classList.contains('pf');
                })
                : [];
            const pdf2html = pfFrames.length > 0;

            const bodyChildren = pdf2html
                ? pfFrames
                : Array.from(doc.body.children).filter(el => {
                    return !IGNORE_TAGS.has(el.tagName);
                });

            this.updateProgress('Paginating content…', 20, `${bodyChildren.length} elements`);
            await yieldToMain();
            if (this._cancelled) return;

            // Paginate
            this.pages = this.paginateElements(bodyChildren);

            // Extract plain text for the textarea
            this.updateProgress('Extracting text…', 25);
            await yieldToMain();
            if (this._cancelled) return;

            const text = this.textOf(doc.body);
            const truncated = text.length > HTML_MAX_CHARS
                ? text.slice(0, HTML_MAX_CHARS) + '…'
                : text;

            // Hand data to the main vocab tool
            this.main.htmlMode = true;
            this.main.htmlData = {
                name: file.name,
                title: this.originalTitle,
                pages: this.pages,
                styles: this.styles,
                text: truncated
            };
            // Clean up any active PDF / website mode before switching to HTML
            if (this.main.pdfMode && typeof this.main.exitPdfMode === 'function') {
                this.main.exitPdfMode();
            }
            if (this.main.webMode && typeof this.main.exitWebMode === 'function') {
                this.main.exitWebMode();
            }
            this.main.webMode = false;
            this.main.webData = null;
            this.main.pdfMode = false;
            this.main.pdfData = null;
            this.main.input.value = truncated;
            this.main.isProcessed = true;
            this.main.processBtn.innerText = 'Reset';
            const focusGoBtn = document.getElementById('focus-go-btn');
            if (focusGoBtn) focusGoBtn.innerText = 'Reset';

            // Phase 2 — Render (async, with progress)
            await this.main.renderHtmlPages();
        } finally {
            this.hideProgress();
        }
    }

    // ── Pagination ──────────────────────────────────────────────────────

    paginateElements(elements) {
        const chunk = this.pageChunk === Infinity
            ? elements.length
            : this.pageChunk;
        const pages = [];
        for (let i = 0; i < elements.length; i += chunk) {
            pages.push({
                elements: elements.slice(i, i + chunk),
                pageNumber: pages.length + 1
            });
        }
        // If no elements, create one empty page so the viewer still works
        if (pages.length === 0) {
            pages.push({ elements: [], pageNumber: 1 });
        }
        return pages;
    }

    // ── Rendering ───────────────────────────────────────────────────────

    async renderHtml(htmlData) {
        this._cancelled = false;
        const output = this.main.output;
        output.innerHTML = '';
        output.style.whiteSpace = 'normal';
        output.style.textAlign = 'left';
        output.style.lineHeight = '';
        // Don't reset padding - preserve text layout settings from vocab tool
        // output.style.padding = '';

        this.renderedPages = 0;

        const wrapper = document.createElement('div');
        wrapper.className = 'html-container';

        // ── Toolbar ─────────────────────────────────────────────────────
        const toolbar = document.createElement('div');
        toolbar.className = 'html-toolbar';

        const totalElements = htmlData.pages.reduce((n, p) => n + p.elements.length, 0);
        const info = document.createElement('span');
        info.className = 'html-toolbar-info';
        info.textContent = `📄 ${htmlData.title} — ${totalElements} elements · ${htmlData.pages.length} page${htmlData.pages.length === 1 ? '' : 's'}`;
        toolbar.appendChild(info);

        // Per-view selector
        const perView = document.createElement('select');
        perView.className = 'html-per-view';
        perView.title = 'Elements to show at a time';
        [
            { value: '10', label: '10 elements' },
            { value: '25', label: '25 elements' },
            { value: '50', label: '50 elements' },
            { value: 'all', label: 'All elements' }
        ].forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = opt.label;
            perView.appendChild(o);
        });
        perView.value = this.pageChunk === Infinity ? 'all' : String(this.pageChunk);
        toolbar.appendChild(perView);

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'html-close-btn';
        closeBtn.textContent = '✕ Close HTML';
        closeBtn.addEventListener('click', () => {
            this._cancelled = true;
            this.hideProgress();
            this.main.exitHtmlMode();
        });
        toolbar.appendChild(closeBtn);

        wrapper.appendChild(toolbar);

        // ── Inject original styles (scoped to wrapper) ──────────────────
        if (htmlData.styles && htmlData.styles.length) {
            const styleContainer = document.createElement('div');
            styleContainer.className = 'html-style-scope';
            styleContainer.style.display = 'contents'; // no visual impact
            htmlData.styles.forEach(s => styleContainer.appendChild(s.cloneNode(true)));
            wrapper.appendChild(styleContainer);
        }

        // ── Pages box ───────────────────────────────────────────────────
        const pagesBox = document.createElement('div');
        pagesBox.className = 'html-pages';
        wrapper.appendChild(pagesBox);

        output.appendChild(wrapper);

        const renderPages = async () => {
            this.renderedPages = 0;
            pagesBox.innerHTML = '';
            await this.appendPageBatchAsync(pagesBox, htmlData);
        };
        this._renderPages = renderPages;

        perView.addEventListener('change', () => {
            this.pageChunk = perView.value === 'all'
                ? Infinity
                : parseInt(perView.value, 10) || DEFAULT_HTML_PAGE_SIZE;
            this.savePageSize();
            this.rePaginate(htmlData);
            renderPages();
        });

        await renderPages();
    }

    rePaginate(htmlData) {
        // Re-paginate from the original elements stored in existing pages
        const allElements = [];
        for (const page of htmlData.pages) {
            allElements.push(...page.elements);
        }
        htmlData.pages = this.paginateElements(allElements);
        // Update info text
        const info = this.main.output.querySelector('.html-toolbar-info');
        if (info) {
            const totalElements = allElements.length;
            info.textContent = `📄 ${htmlData.title} — ${totalElements} elements · ${htmlData.pages.length} page${htmlData.pages.length === 1 ? '' : 's'}`;
        }
    }

    // ── Async page rendering with progress ──────────────────────────────

    async appendPageBatchAsync(container, htmlData) {
        const pages = htmlData.pages;
        const totalPages = pages.length;

        // Render exactly ONE page per batch.  A page already holds `pageChunk`
        // elements, so "10 elements" renders 10 elements (10 PDF pages for a
        // pdf2htmlEX file) instead of chunk×chunk=100.
        const end = Math.min(this.renderedPages + 1, pages.length);
        const start = this.renderedPages;

        // Overwrite the previously rendered page(s) so the browser never has to
        // hold several batches of elements at once.  DOM stays bounded to one
        // batch (pageChunk elements).
        container.querySelectorAll(':scope > .html-page, :scope > .html-page-label')
            .forEach(el => el.remove());

        // Group tooltips live on document.body and would otherwise linger after
        // the pages they annotated are gone.
        if (this.main && typeof this.main.clearAllSelections === 'function') {
            this.main.clearAllSelections();
        }

        // Show progress bar for multi-page renders
        const showProg = totalPages > 3;

        if (showProg) {
            this.showProgress('Rendering pages…', 30);
        }

        try {
            for (let i = start; i < end; i++) {
                if (this._cancelled) return;

                const page = pages[i];

                const pageEl = document.createElement('div');
                pageEl.className = 'html-page';
                pageEl.dataset.page = page.pageNumber;

                if (page.elements.length === 0) {
                    const empty = document.createElement('p');
                    empty.textContent = '(empty page)';
                    empty.style.color = '#9ca3af';
                    empty.style.fontStyle = 'italic';
                    pageEl.appendChild(empty);
                } else {
                    for (const el of page.elements) {
                        const clone = el.cloneNode(true);
                        pageEl.appendChild(clone);
                    }
                    // Wrap every word in selection spans (async to avoid jank)
                    await this.wrapWordsInSpansAsync(pageEl);
                }

                container.appendChild(pageEl);

                // Scale pdf2htmlEX frames (fixed ~918px wide) to fit the card
                this.fitPdfFrames(pageEl);

                // Page label
                const label = document.createElement('div');
                label.className = 'html-page-label';
                const wordCount = this.countWords(pageEl);
                label.textContent = `Page ${page.pageNumber} — ${wordCount} words`;
                container.appendChild(label);

                // Update progress
                if (showProg) {
                    const done = i - start + 1;
                    const total = end - start;
                    const pct = 30 + Math.round((done / total) * 65);
                    this.updateProgress(
                        `Rendering page ${page.pageNumber}…`,
                        pct,
                        `${done} of ${total} pages in this batch`
                    );
                }

                // Yield to browser after each page so it can paint & handle input
                await yieldToMain();
            }
        } finally {
            this.renderedPages = end;

            if (showProg) {
                this.updateProgress('Finalizing…', 97);
                await yieldToMain();
            }

            // "Load more" button
            if (this.renderedPages < pages.length) {
                const loadMore = document.createElement('button');
                loadMore.type = 'button';
                loadMore.className = 'html-load-more-btn';
                const nextPageNum = this.renderedPages + 1;
                loadMore.textContent = `Load next page ${nextPageNum} of ${totalPages} (overwrites current)`;
                loadMore.addEventListener('click', () => {
                    loadMore.remove();
                    this.appendPageBatchAsync(container, htmlData).then(() => {
                        container.scrollIntoView({ block: 'start' });
                    });
                });
                container.appendChild(loadMore);
            }

            this.hideProgress();
        }
    }

    // Scale pdf2htmlEX `.pf` frames (fixed natural width, e.g. 918px) down to
    // fit the `.html-page` content box so the pages never overflow right.
    fitPdfFrames(pageEl) {
        if (!pageEl) return;
        const frames = pageEl.querySelectorAll(':scope > .pf');
        if (!frames.length) return;
        const cs = getComputedStyle(pageEl);
        const padL = parseFloat(cs.paddingLeft) || 0;
        const padR = parseFloat(cs.paddingRight) || 0;
        const avail = pageEl.clientWidth - padL - padR;
        if (!(avail > 0)) return;
        frames.forEach(pf => {
            const natW = pf.offsetWidth;
            if (!natW || natW <= avail) return;
            const s = avail / natW;
            const natH = pf.offsetHeight;
            const pc = pf.querySelector(':scope > .pc');
            if (pc) {
                const t = `scale(${s})`;
                pc.style.transform = t;
                pc.style.msTransform = t;
                pc.style.webkitTransform = t;
                pc.style.transformOrigin = '0 0';
                pc.style.msTransformOrigin = '0 0';
                pc.style.webkitTransformOrigin = '0 0';
            }
            pf.style.width = `${avail}px`;
            pf.style.height = `${natH * s}px`;
        });
    }

    prunePages(wrapper, chunk) {
        if (!Number.isFinite(chunk) || chunk <= 0) return;
        const pageEls = wrapper.querySelectorAll(':scope > .html-page');
        const overflow = pageEls.length - chunk;
        if (overflow <= 0) return;
        for (let i = 0; i < overflow; i++) {
            const pageEl = pageEls[i];
            const label = pageEl.nextElementSibling;
            if (label && label.classList.contains('html-page-label')) {
                label.remove();
            }
            pageEl.remove();
        }
    }

    // ── Async word wrapping ─────────────────────────────────────────────

    async wrapWordsInSpansAsync(container) {
        let mutations = 0;
        const yieldIfNeeded = async () => {
            mutations++;
            if (mutations % YIELD_EVERY === 0) {
                await yieldToMain();
            }
        };

        // Get font size from main vocab tool's text layout settings
        const fontSize = this.main?.textLayout?.fontSize || 100;

        const walk = async (node) => {
            if (this._cancelled) return;

            if (node.nodeType === 3) { // TEXT_NODE
                const text = node.textContent;
                if (!text.trim()) return;
                const parts = text.split(/(\s+)/);
                const frag = document.createDocumentFragment();
                for (const part of parts) {
                    if (!part) continue;
                    if (/^\s+$/.test(part)) {
                        frag.appendChild(document.createTextNode(part));
                        continue;
                    }
                    const span = document.createElement('span');
                    span.textContent = part;
                    span.className = 'inline-block relative cursor-pointer hover:bg-yellow-100 rounded mx-0 max-w-full';
                    span.style.wordWrap = 'break-word';
                    span.style.overflowWrap = 'break-word';
                    // Apply font size directly to span to override parent inline styles
                    span.style.fontSize = `${fontSize}%`;
                    frag.appendChild(span);
                    await yieldIfNeeded();
                }
                if (frag.childNodes.length) {
                    node.parentNode.replaceChild(frag, node);
                }
                return;
            }
            if (node.nodeType !== 1) return;
            // Don't wrap inside <pre> or <code> blocks
            const tag = node.tagName;
            if (tag === 'PRE' || tag === 'CODE') return;
            // Don't wrap inside our own spans or buttons
            if (tag === 'SPAN' && node.classList.contains('cursor-pointer')) return;
            if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT') return;
            for (const child of [...node.childNodes]) {
                await walk(child);
                if (this._cancelled) return;
            }
        };

        await walk(container);
    }

    // ── Text extraction ─────────────────────────────────────────────────

    textOf(root) {
        const BLOCK = new Set([
            'P', 'DIV', 'SECTION', 'ARTICLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
            'LI', 'TR', 'UL', 'OL', 'BLOCKQUOTE', 'TABLE', 'PRE',
            'FIGCAPTION', 'DETAILS', 'SUMMARY', 'DT', 'DD', 'DL'
        ]);
        let out = '';
        const walk = (node) => {
            if (node.nodeType === 3) {
                out += node.textContent;
                return;
            }
            if (node.nodeType !== 1) return;
            const tag = node.tagName;
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return;
            if (tag === 'BR') { out += '\n'; return; }
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

    countWords(el) {
        const text = el.textContent || '';
        return text.split(/\s+/).filter(Boolean).length;
    }

    // ── Cleanup ─────────────────────────────────────────────────────────

    destroy() {
        this._cancelled = true;
        this.hideProgress();
        this.pages = [];
        this.styles = [];
        this.renderedPages = 0;
        this._renderPages = null;
    }
}
