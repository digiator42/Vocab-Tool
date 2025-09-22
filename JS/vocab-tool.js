// Vocabulary Tool Module
export class VocabularyTool {
    constructor() {
        this.input = document.getElementById("input");
        this.output = document.getElementById("output");
        this.processBtn = document.getElementById("processBtn");
        this.stopSpeechBtn = document.getElementById("stopSpeechBtn");
        this.selectionTooltip = document.getElementById("selectionTooltip");
        this.statusEl = document.getElementById("status");

        this.currentUtterance = null;
        this.speechSynth = window.speechSynthesis;
        this.selectionHighlight = null;
        this.selectedLang = "en";

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupLanguageSelector();
        this.setupAddToFlashcardModal();
        this.setupTouchMultiSelect(); // Add this line
        this.processBtn.click(); // auto-init
    }

    setStatus(message) {
        this.statusEl.textContent = message;
    }

    tokenize(text) {
        return text.split(/(\s+|[^A-Za-zÄÖÜäöüß]+)/).filter(Boolean);
    }

    async speak(text, lang = "de") {
        console.log('Loading speech for:', text, 'in', lang);
        console.log('----------------');
        this.setStatus("Loading audio...");
        if (lang === null || text === '') return;
        try {
            const url = `/api/tts?text=${encodeURIComponent(text)}&lang=${lang}`;
            const audio = new Audio(url);
            audio.play();
            audio.onplaying = () => this.setStatus("Speaking...");
            audio.onended = () => this.setStatus("Ready");
            audio.onerror = () => this.setStatus("Speech error");
        } catch {
            this.setStatus("Speech error");
        }
    }

    stopSpeech() {
        if (this.speechSynth.speaking) {
            this.speechSynth.cancel();
            this.setStatus("Speech stopped");
            document.querySelectorAll('.speaking').forEach(el => el.classList.remove('speaking'));
        }
    }

    joinTranslationChunks(data) {
        if (!Array.isArray(data?.[0])) return "(error)";
        return data[0].map(chunk => chunk[0].replace(/\n/g, " ")).join(" ");
    }

    setupLanguageSelector() {
        const langSelector = document.createElement('select');
        langSelector.id = "langSelector";
        langSelector.className = "ml-2 px-2 py-1 border rounded text-sm";
        langSelector.innerHTML = `
            <option value="en" selected>English</option>
            <option value="ar">Arabic</option>
        `;
        this.processBtn.parentNode.insertBefore(langSelector, this.processBtn.nextSibling);

        langSelector.addEventListener('change', () => {
            this.selectedLang = langSelector.value;
        });
    }

    async translate(text) {
        try {
            const res = await fetch(
                "https://translate.googleapis.com/translate_a/single?client=gtx&sl=de&tl=" +
                encodeURIComponent(this.selectedLang) +
                "&dt=t&q=" + encodeURIComponent(text)
            );
            const data = await res.json();
            return this.joinTranslationChunks(data);
        } catch {
            return "(error)";
        }
    }

    async onWordClick(word, span) {
        console.log(`onWordClick -> Clicked on word: ${word}`);
        if (span.classList.contains("highlighted")) {
            console.log('.....Removing highlight');
            span.classList.remove("highlighted");
            span.querySelector(".tooltip")?.remove();
            return;
        }

        span.classList.add('loading');
        this.speak(word);
        const translated = await this.translate(word);
        console.log(`Translated "${word}" to "${translated}"`);
        span.classList.remove('loading');
        span.classList.add("highlighted");

        const tip = document.createElement("div");
        tip.className = "tooltip";
        tip.textContent = translated;
        tip.style.whiteSpace = "nowrap";
        tip.style.textOverflow = "ellipsis";
        tip.style.overflow = "hidden";
        span.appendChild(tip);
    }

    async onTouchWordClick(word, span) {
        console.log(`Clicked on word: ${word}`);
        if (span.classList.contains("highlighted")) {
            console.log('.....Removing highlight');
            span.classList.remove("highlighted");
            span.querySelector(".tooltip")?.remove();
            return;
        }

        span.classList.add('loading');
        this.speak(word);
        const translated = await this.translate(word);
        console.log(`Translated "${word}" to "${translated}"`);
        span.classList.remove('loading');
        span.classList.add("highlighted");

        const tip = document.createElement("div");
        tip.className = "tooltip";
        tip.textContent = translated;
        tip.style.whiteSpace = "nowrap";
        tip.style.textOverflow = "ellipsis";
        tip.style.overflow = "hidden";
        span.appendChild(tip);
    }

    getSelectedWords() {
        const selection = window.getSelection();
        if (!selection.rangeCount || selection.toString().trim().length < 2) return null;
        const range = selection.getRangeAt(0);
        if (!this.output.contains(range.startContainer) && !this.output.contains(range.endContainer)) return null;
        return { text: selection.toString().trim(), range };
    }
    setupTouchMultiSelect() {
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        console.log("setupTouchMultiSelect: isTouchDevice =", isTouchDevice);
        if (!isTouchDevice) return;

        let touchSelecting = false;
        let touchedSpans = new Set();
        let ignoreClickUntil = 0;
        const outputEl = this.output;

        // Group tracking
        let groupIdCounter = 0;
        let groups = new Map(); // groupId -> Set of spans

        // Make sure the tooltip doesn't block elementFromPoint
        this.selectionTooltip.style.pointerEvents = 'none';

        // Make the output area easier to capture touches
        outputEl.style.touchAction = 'none';
        outputEl.style.webkitUserSelect = 'none';
        outputEl.style.userSelect = 'none';

        const spanFromPoint = (clientX, clientY) => {
            let el = document.elementFromPoint(clientX, clientY);
            if (!el) return null;
            return el.closest && el.closest('#output span');
        };

        const addSpanToTouched = (span) => {
            if (!span || !outputEl.contains(span)) return false;
            if (!touchedSpans.has(span)) {
                touchedSpans.add(span);
                span.classList.add('highlighted');
                span.classList.add('multi-highlighted');
                return true;
            }
            return false;
        };

        const orderSpansByDOM = (spansArray) => {
            return spansArray.sort((a, b) => {
                if (a === b) return 0;
                const pos = a.compareDocumentPosition(b);
                if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
                if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
                return 0;
            });
        };

        const clearTouchSelection = () => {
            touchedSpans.forEach(s => {
                s.classList.remove('multi-highlighted');
            });
            touchedSpans.clear();
            this.selectionTooltip.style.display = 'none';
        };

        const isWordSpan = (element) => {
            return element && element.classList.contains('cursor-pointer') &&
                element.textContent && element.textContent.trim().length > 0;
        };

        outputEl.addEventListener('touchstart', (ev) => {
            if (ev.touches.length > 1) return;

            const t = ev.touches[0];
            const span = spanFromPoint(t.clientX, t.clientY);

            if (span && isWordSpan(span)) {
                touchSelecting = true;

                // Toggle off single highlighted words
                if (span.classList.contains("highlighted") && !span.dataset.groupId) {
                    span.classList.remove("highlighted");
                    span.querySelector(".tooltip")?.remove();
                    touchSelecting = false;
                    return;
                }

                // Toggle off group if tapped again
                const group = groups.get(span.dataset.groupId);
                if (group) {
                    group.spans.forEach(s => {
                        s.classList.remove("multi-highlighted");
                        s.classList.remove("highlighted");
                        delete s.dataset.groupId;
                    });
                    group.tooltip.remove();
                    groups.delete(span.dataset.groupId);
                    touchSelecting = false;
                    return;
                }

                // Start new selection
                touchedSpans.forEach(s => s.classList.remove('multi-highlighted'));
                touchedSpans.clear();
                addSpanToTouched(span);
            } else {
                touchSelecting = false;
            }
        }, { passive: true });

        outputEl.addEventListener('touchmove', (ev) => {
            if (!touchSelecting) return;
            const t = ev.touches[0];
            const span = spanFromPoint(t.clientX, t.clientY);
            if (span && isWordSpan(span)) {
                addSpanToTouched(span);
            }
            ev.preventDefault();
        }, { passive: false });

        outputEl.addEventListener('touchcancel', () => {
            touchSelecting = false;
        });

        let lastTouchTime = 0;
        document.addEventListener("touchend", () => {
            lastTouchTime = Date.now();
        }, true);

        outputEl.addEventListener('touchend', async () => {
            if (!touchSelecting) return;
            touchSelecting = false;

            const spansArr = orderSpansByDOM(Array.from(touchedSpans));
            if (spansArr.length === 0) return;

            // Remove any existing individual tooltips
            spansArr.forEach(span => span.querySelector('.tooltip')?.remove());

            const words = spansArr.map(s => (s.childNodes[0]?.textContent || s.textContent).trim()).filter(Boolean);
            const phrase = words.join(" ");
            if (!phrase) return;

            console.log("📌 Selected phrase:", phrase);

            try {
                this.speak(phrase);
            } catch (e) {
                console.warn("speak failed:", e);
            }

            if (spansArr.length === 1) {
                // Single word tooltip
                const singleSpan = spansArr[0];
                const translated = await this.translate(phrase);
                const tip = document.createElement("div");
                tip.className = "tooltip";
                tip.textContent = translated;
                tip.style.whiteSpace = "nowrap";
                tip.style.textOverflow = "ellipsis";
                tip.style.overflow = "hidden";
                tip.style.zIndex = "60";
                singleSpan.appendChild(tip);
            } else {
                // Multi-word tooltip
                groupIdCounter++;
                const groupId = "g" + groupIdCounter;

                spansArr.forEach(s => {
                    s.dataset.groupId = groupId;
                });

                // Create tooltip for this group
                const tooltip = document.createElement("div");
                tooltip.className = "group-tooltip";
                tooltip.textContent = "Translating...";
                tooltip.style.position = "absolute";
                tooltip.style.background = "#333";
                tooltip.style.color = "#fff";
                tooltip.style.padding = "4px 8px";
                tooltip.style.borderRadius = "6px";
                tooltip.style.fontSize = "14px";
                tooltip.style.zIndex = "60";
                tooltip.style.whiteSpace = "nowrap";

                // Position above first word
                const firstRect = spansArr[0].getBoundingClientRect();
                tooltip.style.left = (firstRect.left + window.scrollX) + "px";
                tooltip.style.top = (firstRect.top + window.scrollY - 10) + "px";

                document.body.appendChild(tooltip);

                // Store group with tooltip
                groups.set(groupId, { spans: new Set(spansArr), tooltip });

                // Translate
                let translation = "";
                try {
                    translation = await this.translate(phrase);
                } catch (err) {
                    console.error("translate() failed:", err);
                    translation = "(translation error)";
                }

                // Update tooltip text and adjust position
                tooltip.textContent = translation;
                tooltip.style.top = (firstRect.top + window.scrollY - tooltip.offsetHeight - 10) + "px";
            }

            ignoreClickUntil = Date.now() + 500;
        });

        // Prevent ghost clicks
        document.addEventListener('click', (ev) => {
            if (Date.now() < ignoreClickUntil) {
                ev.stopPropagation();
                ev.preventDefault();
                return;
            }
        }, true);
    }

    async handleSelection() {
        const selection = this.getSelectedWords();
        if (!selection) {
            if (window.getSelection) window.getSelection().removeAllRanges();
            return;
        }

        const rect = selection.range.getBoundingClientRect();
        if (!this.selectionHighlight) {
            this.selectionHighlight = document.createElement('div');
            this.selectionHighlight.className = 'selection-highlight';
            document.body.appendChild(this.selectionHighlight);
        }

        this.selectionHighlight.style.width = rect.width + 'px';
        this.selectionHighlight.style.height = rect.height + 'px';
        this.selectionHighlight.style.left = (rect.left + window.scrollX) + 'px';
        this.selectionHighlight.style.top = (rect.top + window.scrollY) + 'px';

        try {
            const sel = window.getSelection();
            if (sel && sel.rangeCount) {
                const spans = this.output.querySelectorAll("span");
                spans.forEach(span => {
                    if (sel.containsNode(span, true)) {
                        span.classList.add("multi-highlighted");
                        span.onclick = () => {
                            const highlightedSpans = this.output.querySelectorAll("span.multi-highlighted");
                            if (highlightedSpans.length > 0) {
                                console.log('.....Removing highlight from all');
                                highlightedSpans.forEach(s => s.classList.remove("multi-highlighted"));
                                this.selectionHighlight?.remove();
                                this.selectionHighlight = null;
                                this.selectionTooltip.style.display = "none";
                                this.selectionTooltip.textContent = "";
                                if (window.getSelection) window.getSelection().removeAllRanges();
                            }
                        };
                    }
                });
            }
        } catch (err) {
            console.warn("Could not apply span highlights:", err);
        }

        if (window.getSelection) window.getSelection().removeAllRanges();
        this.speak(selection.text);
        this.selectionTooltip.textContent = "Translating...";
        this.selectionTooltip.style.left = (rect.left + window.scrollX) + "px";
        this.selectionTooltip.style.top = (rect.top + window.scrollY - 10) + "px";
        this.selectionTooltip.style.display = "block";

        const translated = await this.translate(selection.text);
        this.selectionTooltip.textContent = translated;
        this.selectionTooltip.style.top = (rect.top + window.scrollY - this.selectionTooltip.offsetHeight - 10) + "px";
        this.selectionTooltip.style.zIndex = "50";
    }

    setupEventListeners() {
        this.processBtn.addEventListener("click", () => {
            this.output.innerHTML = "";
            this.tokenize(this.input.value).forEach((tok) => {
                if (/^[A-Za-zÄÖÜäöüß]+$/.test(tok)) {
                    const span = document.createElement("span");
                    span.textContent = tok;
                    span.className = "relative cursor-pointer hover:bg-yellow-100 rounded px-1 mx-0.5";
                    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
                    if (!isTouchDevice) { // Ignore clicks on touch devices (handled in touch logic)
                        span.addEventListener("click", () => this.onWordClick(tok, span));
                    }
                    this.output.appendChild(span);
                } else {
                    this.output.appendChild(document.createTextNode(tok));
                }
            });
            this.setStatus("Text processed");
        });

        this.stopSpeechBtn.addEventListener("click", () => this.stopSpeech());
        this.output.addEventListener("click", () => setTimeout(() => this.handleSelection(), 1000));
    }

    // Add to Flashcard functionality
    setupAddToFlashcardModal() {
        this.createAddToFlashcardButton();
        this.createModal();
    }

    createAddToFlashcardButton() {
        const addToFlashBtn = document.createElement('button');
        addToFlashBtn.id = "addToFlashBtn";
        addToFlashBtn.className = "px-4 py-2 bg-yellow-500 text-white rounded-lg shadow";
        addToFlashBtn.textContent = "Add";
        this.stopSpeechBtn.parentNode.insertBefore(addToFlashBtn, this.stopSpeechBtn);
        addToFlashBtn.addEventListener('click', () => this.handleAddToFlashcard());
    }

    createModal() {
        const modal = document.createElement('div');
        modal.id = "add-to-flash-modal";
        modal.className = "fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 hidden";
        modal.innerHTML = `
            <div class="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative">
                <button id="close-add-to-flash-modal" class="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl">&times;</button>
                <h3 class="text-lg font-bold text-indigo-700 mb-2">Add to Flashcards</h3>
                <div id="selected-word-preview" class="mb-4 text-center text-lg font-semibold text-gray-800"></div>
                <div class="mb-2">
                    <label class="block text-sm font-medium mb-1">Choose a list:</label>
                    <div id="flashcard-lists" class="flex flex-col gap-2"></div>
                </div>
                <div class="my-2 text-center text-gray-500">or</div>
                <div class="mb-2">
                    <input id="new-list-name" type="text" class="w-full p-2 border rounded mb-1" placeholder="New list name">
                    <button id="create-new-list-btn" class="px-3 py-1 bg-green-600 text-white rounded">Create & Add</button>
                </div>
                <div id="add-flashcard-status" class="mt-2 text-sm text-center"></div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('close-add-to-flash-modal').onclick = () => {
            modal.classList.add('hidden');
        };
    }

    async getCurrentHighlightedWords() {
        const spans = this.output.querySelectorAll('.highlighted, .multi-highlighted');
        console.log("Found spans:", spans.length, spans);

        if (spans.length == 1) {
            const results = Array.from(spans).map(span => {
                const word = span.childNodes[0]?.textContent || span.textContent;
                const tip = span.querySelector('.tooltip');
                const translation = tip ? tip.textContent : '';
                return { word, translation };
            });
            console.log("Current highlighted words:", results);
            return results[0];
        } else {
            let translated = document.getElementById('selectionTooltip').textContent || '';
            const words = Array.from(spans).map(span => span.childNodes[0]?.textContent || span.textContent);
            console.log("Extracted words:", words);

            if (words.length > 5) alert('Max 5 words');

            if (translated.split(' ').length < 2) translated = await this.translate(words.join(' '));
            if (words.length <= 5 && translated) {
                return { word: words.join(' '), translation: translated };
            }
        }
        return null;
    }

    async handleAddToFlashcard() {
        const addToFlashBtn = document.getElementById('addToFlashBtn');
        addToFlashBtn.disabled = true;
        addToFlashBtn.innerHTML = `
            <svg class="animate-spin h-5 w-5 text-white mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
        `;

        const selected = await this.getCurrentHighlightedWords();
        addToFlashBtn.disabled = false;
        addToFlashBtn.textContent = "Add";

        console.log("Selected words for flashcard:", selected);
        if (!selected || !selected.word || !selected.translation) {
            this.setStatus("Highlight a word first!");
            return;
        }

        this.showAddToFlashModal(selected.word, selected.translation);
    }

    showAddToFlashModal(word, translation) {
        const modal = document.getElementById('add-to-flash-modal');
        modal.classList.remove('hidden');
        document.getElementById('selected-word-preview').textContent = `"${word}" → "${translation}"`;

        const listsDiv = document.getElementById('flashcard-lists');
        const customLists = JSON.parse(localStorage.getItem('customGermanLists')) || {};
        listsDiv.innerHTML = '';

        Object.keys(customLists).forEach(listName => {
            const btn = document.createElement('button');
            btn.className = "px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-left";
            btn.textContent = listName;
            btn.onclick = () => this.addWordToList(listName, word, translation);
            listsDiv.appendChild(btn);
        });

        document.getElementById('add-flashcard-status').textContent = '';
        document.getElementById('new-list-name').value = '';

        document.getElementById('create-new-list-btn').onclick = () => {
            this.createNewList(word, translation);
        };
    }

    addWordToList(listName, german, english) {
        let customLists = JSON.parse(localStorage.getItem('customGermanLists')) || {};
        if (!customLists[listName]) customLists[listName] = [];

        const exists = customLists[listName].some(card => card.german === german && card.english === english);
        if (exists) {
            document.getElementById('add-flashcard-status').textContent = "Already exists in this list.";
            document.getElementById('add-flashcard-status').className = "mt-2 text-sm text-center text-yellow-600";
            return;
        }

        customLists[listName].push({ german, english, mastered: false });
        localStorage.setItem('customGermanLists', JSON.stringify(customLists));
        document.getElementById('add-flashcard-status').textContent = `Added to "${listName}"!`;
        document.getElementById('add-flashcard-status').className = "mt-2 text-sm text-center text-green-600";

        setTimeout(() => {
            document.getElementById('add-to-flash-modal').classList.add('hidden');
        }, 1200);
    }

    createNewList(word, translation) {
        const listName = document.getElementById('new-list-name').value.trim();
        if (!listName) {
            document.getElementById('add-flashcard-status').textContent = "Enter a list name.";
            document.getElementById('add-flashcard-status').className = "mt-2 text-sm text-center text-red-600";
            return;
        }

        let customLists = JSON.parse(localStorage.getItem('customGermanLists')) || {};
        if (customLists[listName]) {
            document.getElementById('add-flashcard-status').textContent = "List already exists. Choose it above.";
            document.getElementById('add-flashcard-status').className = "mt-2 text-sm text-center text-yellow-600";
            return;
        }

        customLists[listName] = [{ german: word, english: translation, mastered: false }];
        localStorage.setItem('customGermanLists', JSON.stringify(customLists));
        document.getElementById('add-flashcard-status').textContent = `Created "${listName}" and added!`;
        document.getElementById('add-flashcard-status').className = "mt-2 text-sm text-center text-green-600";

        setTimeout(() => {
            document.getElementById('add-to-flash-modal').classList.add('hidden');
        }, 1200);
    }
}