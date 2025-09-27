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
        this.isStopSpeechRequested = false;
        this.activeRecallMode = 'normal'; // 'normal' or 'beginner'
        this.useFuzzyMatching = true;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupLanguageSelector();
        this.setupAddToFlashcardModal();
        this.setupTouchMultiSelect();
        this.setupActiveRecall();
        this.processBtn.click();
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
        if (lang === null || text === '' || this.isStopSpeechRequested) return;
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
        this.isStopSpeechRequested = !this.isStopSpeechRequested;
        console.log(this.isStopSpeechRequested ? 'Stopping speech' : 'Speech activated');
        const stopSpeecBtn = document.getElementById("stopSpeechBtn");
        if (this.isStopSpeechRequested) {
            stopSpeecBtn.innerHTML = 'Activate Speech';
            this.setStatus("Speech Stopped");
        }
        else {
            stopSpeecBtn.innerHTML = 'Stop Speech';
            this.setStatus("Speech Activated");
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
                tip.style.zIndex = "31";
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
                tooltip.style.zIndex = "32";
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
        this.selectionTooltip.style.zIndex = "30";
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

    setupActiveRecall() {
        this.createActiveRecallUI();
        setTimeout(() => {
            this.setupActiveRecallListeners();
        }, 100);
        // this.setupActiveRecallListeners();
    }

    createActiveRecallUI() {
        const activeRecallHTML = `
        <div id="active-recall-tool" class="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200 hidden">
            <h3 class="text-lg font-semibold mb-4">🎯 Active Recall Practice</h3>
            
            <!-- Mode Toggle -->
            <div class="mb-4 flex flex-wrap gap-4 items-center">
                <div class="flex items-center space-x-2">
                    <span class="text-sm font-medium">Mode:</span>
                    <select id="ar-mode-select" class="p-2 border rounded text-sm">
                        <option value="normal">Normal</option>
                        <option value="beginner">Beginner (with hints)</option>
                    </select>
                </div>
                <div class="flex items-center space-x-2">
                    <input type="checkbox" id="ar-fuzzy-match" checked class="rounded">
                    <label for="ar-fuzzy-match" class="text-sm font-medium">Fuzzy Word Matching</label>
                </div>
            </div>
            
            <div id="ar-progress" class="mb-4">
                <div class="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Progress: <span id="ar-current">0</span>/<span id="ar-total">0</span></span>
                    <span id="ar-status">Ready to start</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div id="ar-progress-bar" class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                </div>
            </div>

            <!-- Beginner Mode Display -->
            <div id="ar-hint-display" class="mb-4 p-4 bg-blue-50 rounded border border-blue-200 hidden">
                <div class="text-sm text-blue-800 font-medium mb-2">Sentence Hint:</div>
                <div id="ar-hint-text" class="text-lg font-mono text-blue-900"></div>
            </div>

            <div id="ar-current-sentence" class="mb-4 p-4 bg-white rounded border-2 border-blue-200 min-h-20 flex items-center justify-center">
                <span class="text-gray-500">Sentence will appear here...</span>
            </div>

            <div id="ar-input-area" class="mb-4 hidden">
                <textarea id="ar-user-input" 
                    placeholder="Type what you hear..." 
                    class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-20 resize-none"></textarea>
                <div class="flex justify-between mt-2 text-sm text-gray-600">
                    <span>Press Enter to submit</span>
                    <span id="ar-timer">Time: 0s</span>
                </div>
            </div>

            <div id="ar-controls" class="flex flex-wrap gap-2">
                <button id="ar-start-btn" class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">
                    🎧 Start Practice
                </button>
                <button id="ar-next-btn" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors hidden">
                    ➡️ Next Sentence
                </button>
                <button id="ar-back-btn" class="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors hidden">
                    ⬅️ Previous
                </button>
                <button id="ar-repeat-btn" class="bg-yellow-600 text-white px-6 py-2 rounded-lg hover:bg-yellow-700 transition-colors hidden">
                    🔄 Repeat Audio
                </button>
                <button id="ar-finish-btn" class="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors hidden">
                    ✅ Finish Practice
                </button>
            </div>

            <div id="ar-results" class="mt-6 hidden">
                <h4 class="text-lg font-semibold mb-3">📊 Practice Results</h4>
                <div id="ar-summary" class="mb-4 p-4 bg-white rounded-lg border"></div>
                <div id="ar-detailed-results" class="space-y-4"></div>
            </div>
        </div>
    `;
        // Insert after the output area
        this.output.insertAdjacentHTML('afterend', activeRecallHTML);
    }

    setupActiveRecallListeners() {
        // Active Recall event listeners
        document.getElementById('ar-start-btn').addEventListener('click', () => this.startActiveRecall());
        document.getElementById('ar-next-btn').addEventListener('click', () => this.nextSentence());
        document.getElementById('ar-back-btn').addEventListener('click', () => this.previousSentence());
        document.getElementById('ar-repeat-btn').addEventListener('click', () => this.repeatAudio());
        document.getElementById('ar-finish-btn').addEventListener('click', () => this.finishActiveRecall());

        // Enter key to submit
        document.getElementById('ar-user-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.checkAnswer();
            }
            if (this.activeRecallMode === 'beginner') {
                this.updateHintDisplay();
            }
        });

        // Add new listeners for mode toggles
        document.getElementById('ar-mode-select').addEventListener('change', (e) => {
            this.activeRecallMode = e.target.value;
            if (this.sentences && this.currentSentenceIndex >= 0) {
                this.updateHintDisplay();
            }
        });

        document.getElementById('ar-fuzzy-match').addEventListener('change', (e) => {
            this.useFuzzyMatching = e.target.checked;
        });

        // Add Active Recall button to main controls
        this.addActiveRecallButton();
    }

    // Beginner mode hints
    updateHintDisplay() {
        const hintDisplay = document.getElementById('ar-hint-display');
        const hintText = document.getElementById('ar-hint-text');

        if (this.activeRecallMode === 'beginner' && this.currentSentenceIndex >= 0) {
            const sentence = this.sentences[this.currentSentenceIndex].trim();
            const words = sentence.split(/\s+/);

            // Create dashed version, but reveal words that user has already typed correctly
            let hintHTML = '';
            const userInput = document.getElementById('ar-user-input').value.toLowerCase();
            const userWords = userInput.split(/\s+/).filter(w => w.trim());

            words.forEach(word => {
                const cleanWord = word.toLowerCase().replace(/[.,!?;]/g, '');
                const isRevealed = userWords.some(userWord =>
                    this.wordsMatch(userWord, cleanWord)
                );

                if (isRevealed) {
                    hintHTML += `<span class="text-green-600 font-bold">${word}</span> `;
                } else {
                    hintHTML += `<span class="text-blue-400">${'─'.repeat(word.length)}</span> `;
                }
            });

            hintText.innerHTML = hintHTML;
            hintDisplay.classList.remove('hidden');
        } else {
            hintDisplay.classList.add('hidden');
        }
    }

    // Enhanced word matching with fuzzy logic
    wordsMatch(userWord, correctWord, threshold = 0.7) {
        if (!this.useFuzzyMatching) {
            return userWord === correctWord;
        }

        // Exact match
        if (userWord === correctWord) return true;

        // Case insensitive match
        if (userWord.toLowerCase() === correctWord.toLowerCase()) return true;

        // Levenshtein distance for similar words
        const distance = this.levenshteinDistance(userWord.toLowerCase(), correctWord.toLowerCase());
        const maxLength = Math.max(userWord.length, correctWord.length);
        const similarity = 1 - (distance / maxLength);

        return similarity >= threshold;
    }

    // Levenshtein distance algorithm for fuzzy matching
    levenshteinDistance(a, b) {
        const matrix = [];

        // Increment along the first column of each row
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        // Increment each column in the first row
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        // Fill in the rest of the matrix
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }

        return matrix[b.length][a.length];
    }

    addActiveRecallButton() {
        const activeRecallBtn = document.createElement('button');
        activeRecallBtn.id = 'active-recall-btn';
        activeRecallBtn.className = 'mt-5 px-4 py-2 bg-purple-600 text-white rounded-lg shadow hover:bg-purple-700';
        activeRecallBtn.innerHTML = '🎯 Active Recall';
        activeRecallBtn.addEventListener('click', () => this.toggleActiveRecall());

        // Insert after the Add to Flashcards button
        const addToFlashBtn = document.getElementById('addToFlashBtn');
        this.output.insertAdjacentElement('afterend', activeRecallBtn);
    }

    toggleActiveRecall() {
        const activeRecallTool = document.getElementById('active-recall-tool');
        const isVisible = !activeRecallTool.classList.contains('hidden');

        if (!isVisible) {
            this.prepareActiveRecall();
            activeRecallTool.classList.remove('hidden');
        } else {
            activeRecallTool.classList.add('hidden');
            this.resetActiveRecall();
        }
    }

    prepareActiveRecall() {
        // Extract sentences from the processed text
        const text = this.input.value;
        if (!text.trim()) {
            alert('Please process some text first!');
            return;
        }

        // Simple sentence segmentation
        this.sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);

        if (this.sentences.length === 0) {
            alert('No sentences found in the text!');
            return;
        }

        this.currentSentenceIndex = -1;
        this.userAnswers = [];
        this.startTimes = [];
        this.results = [];

        document.getElementById('ar-total').textContent = this.sentences.length;
        this.updateProgress();
    }

    startActiveRecall() {
        this.currentSentenceIndex = 0;
        this.showCurrentSentence();
    }

    showCurrentSentence() {
        const sentence = this.sentences[this.currentSentenceIndex].trim();
        const displayArea = document.getElementById('ar-current-sentence');
        const inputArea = document.getElementById('ar-input-area');
        const userInput = document.getElementById('ar-user-input');

        // Show loading state
        displayArea.innerHTML = '<span class="text-gray-500">Loading audio...</span>';

        // Hide input area initially
        inputArea.classList.add('hidden');

        // Update controls
        document.getElementById('ar-start-btn').classList.add('hidden');
        document.getElementById('ar-next-btn').classList.remove('hidden');
        document.getElementById('ar-back-btn').classList.remove('hidden');
        document.getElementById('ar-repeat-btn').classList.remove('hidden');
        document.getElementById('ar-finish-btn').classList.remove('hidden');

        // Disable back button on first sentence
        document.getElementById('ar-back-btn').disabled = this.currentSentenceIndex === 0;

        // Start timer
        this.startTimes[this.currentSentenceIndex] = Date.now();
        this.updateTimer();
        this.timerInterval = setInterval(() => this.updateTimer(), 1000);

        // Play audio
        this.speak(sentence).then(() => {
            displayArea.textContent = '🎧 Listen carefully...';

            // Show input area after audio finishes
            setTimeout(() => {
                inputArea.classList.remove('hidden');
                userInput.value = '';
                userInput.focus();
                displayArea.innerHTML = `
                <div class="text-center">
                    <div class="text-lg mb-2">✍️ Write what you heard:</div>
                    <div class="text-sm text-gray-500">Sentence ${this.currentSentenceIndex + 1} of ${this.sentences.length}</div>
                </div>
            `;
            }, 1000);
        });
    }

    updateTimer() {
        if (this.startTimes[this.currentSentenceIndex]) {
            const elapsed = Math.floor((Date.now() - this.startTimes[this.currentSentenceIndex]) / 1000);
            document.getElementById('ar-timer').textContent = `Time: ${elapsed}s`;
        }
    }

    updateProgress() {
        const progress = this.currentSentenceIndex >= 0 ? this.currentSentenceIndex : 0;
        const percentage = (progress / this.sentences.length) * 100;

        document.getElementById('ar-current').textContent = progress;
        document.getElementById('ar-progress-bar').style.width = `${percentage}%`;

        const status = document.getElementById('ar-status');
        if (this.currentSentenceIndex < 0) {
            status.textContent = 'Ready to start';
        } else if (this.currentSentenceIndex < this.sentences.length) {
            status.textContent = `Sentence ${this.currentSentenceIndex + 1} of ${this.sentences.length}`;
        } else {
            status.textContent = 'Practice completed!';
        }
    }

    checkAnswer() {
        const userInput = document.getElementById('ar-user-input').value.trim();
        const correctSentence = this.sentences[this.currentSentenceIndex].trim();

        if (!userInput) {
            alert('Please type what you heard!');
            return;
        }

        // Store the result
        this.userAnswers[this.currentSentenceIndex] = userInput;
        this.results[this.currentSentenceIndex] = this.compareSentences(userInput, correctSentence);

        // Show immediate feedback
        this.showSentenceFeedback(this.currentSentenceIndex);

        // Auto-advance after 3 seconds or wait for next click
        setTimeout(() => {
            if (this.currentSentenceIndex < this.sentences.length - 1) {
                this.nextSentence();
            } else {
                this.finishActiveRecall();
            }
        }, 3000);
    }

    compareSentences(userSentence, correctSentence) {
        const userWords = userSentence.toLowerCase().split(/\s+/).filter(w => w.trim());
        const correctWords = correctSentence.toLowerCase().split(/\s+/).filter(w => w.trim());

        const result = {
            userSentence,
            correctSentence,
            words: [],
            correctCount: 0,
            totalWords: correctWords.length,
            matchedWords: new Set(),
            extraWords: []
        };

        // Match user words to correct words (not sequential)
        const userWordMatches = new Array(userWords.length).fill(null);
        const correctWordMatches = new Array(correctWords.length).fill(false);

        // First pass: exact matches
        userWords.forEach((userWord, userIndex) => {
            const correctIndex = correctWords.findIndex((correctWord, idx) =>
                !correctWordMatches[idx] && this.wordsMatch(userWord, correctWord)
            );

            if (correctIndex !== -1) {
                userWordMatches[userIndex] = correctIndex;
                correctWordMatches[correctIndex] = true;
                result.correctCount++;
            }
        });

        // Second pass: fuzzy matches for unmatched words
        userWords.forEach((userWord, userIndex) => {
            if (userWordMatches[userIndex] === null) {
                const correctIndex = correctWords.findIndex((correctWord, idx) =>
                    !correctWordMatches[idx] && this.wordsMatch(userWord, correctWord, 0.6) // Lower threshold for fuzzy
                );

                if (correctIndex !== -1) {
                    userWordMatches[userIndex] = correctIndex;
                    correctWordMatches[correctIndex] = true;
                    result.correctCount++;
                }
            }
        });

        // Build the result with proper matching
        userWords.forEach((userWord, userIndex) => {
            const correctIndex = userWordMatches[userIndex];
            const correctWord = correctIndex !== null ? correctWords[correctIndex] : '';

            result.words.push({
                user: userWord,
                correct: correctWord,
                isCorrect: correctIndex !== null,
                isFuzzyMatch: correctIndex !== null && userWord !== correctWord
            });

            if (correctIndex !== null) {
                result.matchedWords.add(correctIndex);
            }
        });

        // Find missing words (words in correct sentence but not in user sentence)
        correctWords.forEach((correctWord, correctIndex) => {
            if (!correctWordMatches[correctIndex]) {
                result.words.push({
                    user: '',
                    correct: correctWord,
                    isCorrect: false,
                    isMissing: true
                });
            }
        });

        // Find extra words (words in user sentence but not in correct sentence)
        userWords.forEach((userWord, userIndex) => {
            if (userWordMatches[userIndex] === null) {
                result.extraWords.push(userWord);
            }
        });

        result.accuracy = Math.round((result.correctCount / result.totalWords) * 100);
        return result;
    }

    showSentenceFeedback(sentenceIndex) {
        const result = this.results[sentenceIndex];
        const displayArea = document.getElementById('ar-current-sentence');

        let feedbackHTML = `<div class="text-left w-full">`;
        feedbackHTML += `<div class="font-semibold mb-2">Your input vs Correct sentence:</div>`;
        feedbackHTML += `<div class="mb-3 p-3 bg-gray-100 rounded">`;

        // Group words by type for better display
        const correctWords = result.words.filter(w => w.isCorrect && !w.isFuzzyMatch);
        const fuzzyWords = result.words.filter(w => w.isFuzzyMatch);
        const missingWords = result.words.filter(w => w.isMissing);
        const wrongWords = result.words.filter(w => !w.isCorrect && !w.isMissing && w.user);

        if (correctWords.length > 0) {
            feedbackHTML += `<div class="mb-2"><span class="text-green-600 font-semibold">✓ Correct:</span> `;
            feedbackHTML += correctWords.map(w => w.user).join(' ') + `</div>`;
        }

        if (fuzzyWords.length > 0) {
            feedbackHTML += `<div class="mb-2"><span class="text-yellow-600 font-semibold">≈ Close:</span> `;
            feedbackHTML += fuzzyWords.map(w => `${w.user} (→ ${w.correct})`).join(' ') + `</div>`;
        }

        if (missingWords.length > 0) {
            feedbackHTML += `<div class="mb-2"><span class="text-red-600 font-semibold">✗ Missing:</span> `;
            feedbackHTML += missingWords.map(w => w.correct).join(' ') + `</div>`;
        }

        if (wrongWords.length > 0) {
            feedbackHTML += `<div class="mb-2"><span class="text-red-600 font-semibold">✗ Extra:</span> `;
            feedbackHTML += wrongWords.map(w => w.user).join(' ') + `</div>`;
        }

        feedbackHTML += `</div>`;
        feedbackHTML += `<div class="text-sm text-gray-600">Accuracy: ${result.accuracy}% (${result.correctCount}/${result.totalWords} words matched)</div>`;
        feedbackHTML += `</div>`;

        displayArea.innerHTML = feedbackHTML;
        document.getElementById('ar-input-area').classList.add('hidden');
    }

    nextSentence() {
        if (this.currentSentenceIndex < this.sentences.length - 1) {
            this.currentSentenceIndex++;
            this.showCurrentSentence();
            this.updateProgress();
        }
    }

    previousSentence() {
        if (this.currentSentenceIndex > 0) {
            this.currentSentenceIndex--;
            this.showCurrentSentence();
            this.updateProgress();

            // Show previous answer if available
            if (this.results[this.currentSentenceIndex]) {
                this.showSentenceFeedback(this.currentSentenceIndex);
            }
        }
    }

    repeatAudio() {
        const sentence = this.sentences[this.currentSentenceIndex].trim();
        this.speak(sentence);
    }

    finishActiveRecall() {
        clearInterval(this.timerInterval);
        this.showFinalResults();
    }

    showFinalResults() {
        clearInterval(this.timerInterval);

        const totalAccuracy = Math.round(
            this.results.reduce((sum, result) => sum + result.accuracy, 0) / this.results.length
        );

        const totalCorrect = this.results.reduce((sum, result) => sum + result.correctCount, 0);
        const totalWords = this.results.reduce((sum, result) => sum + result.totalWords, 0);

        // Summary (unchanged)
        document.getElementById('ar-summary').innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div class="p-3 bg-blue-50 rounded-lg">
                <div class="text-2xl font-bold text-blue-600">${this.sentences.length}</div>
                <div class="text-sm text-blue-800">Sentences</div>
            </div>
            <div class="p-3 bg-green-50 rounded-lg">
                <div class="text-2xl font-bold text-green-600">${totalAccuracy}%</div>
                <div class="text-sm text-green-800">Overall Accuracy</div>
            </div>
            <div class="p-3 bg-purple-50 rounded-lg">
                <div class="text-2xl font-bold text-purple-600">${totalCorrect}/${totalWords}</div>
                <div class="text-sm text-purple-800">Words Correct</div>
            </div>
            <div class="p-3 bg-yellow-50 rounded-lg">
                <div class="text-2xl font-bold text-yellow-600">${Math.round(totalWords / this.sentences.length)}</div>
                <div class="text-sm text-yellow-800">Avg. Words/Sentence</div>
            </div>
        </div>
    `;

        // Enhanced detailed results with proper sequence
        const detailedResults = document.getElementById('ar-detailed-results');
        detailedResults.innerHTML = this.results.map((result, index) => {

            // Reconstruct the sentence in correct sequence with missing words
            const correctWords = result.correctSentence.split(/\s+/);
            const sequenceDisplay = this.getSequenceDisplay(result, correctWords);

            return `
        <div class="p-4 bg-white rounded-lg border border-gray-200">
            <div class="flex justify-between items-center mb-3">
                <span class="font-semibold">Sentence ${index + 1}</span>
                <span class="px-3 py-1 rounded-full text-sm font-medium ${result.accuracy >= 90 ? 'bg-green-100 text-green-800' :
                    result.accuracy >= 70 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                }">
                    ${result.accuracy}% accuracy
                </span>
            </div>
            
            <div class="mb-2">
                <strong>Correct:</strong> <span class="text-gray-700">${result.correctSentence}</span>
            </div>
            
            <div class="mb-2">
                <strong>Your input:</strong> <span class="text-gray-700">${result.userSentence || "(no input)"}</span>
            </div>
            
            <div class="mb-3">
                <strong>Sequence comparison:</strong> 
                <div class="sentence-comparison mt-2 p-3 bg-gray-50 rounded-lg font-mono text-lg">
                    ${sequenceDisplay}
                </div>
            </div>
            
            <div class="text-sm text-gray-600 grid grid-cols-2 gap-2 mt-3">
                <div>Words matched: ${result.correctCount}/${result.totalWords}</div>
                <div>Fuzzy matches: ${result.words.filter(w => w.isFuzzyMatch).length}</div>
                <div>Missing words: ${result.words.filter(w => w.isMissing).length}</div>
                <div>Extra words: ${result.extraWords.length}</div>
            </div>
        </div>
        `;
        }).join('');

        document.getElementById('ar-results').classList.remove('hidden');
    }

    // New method to reconstruct the sequence with missing words
    getSequenceDisplay(result, correctWords) {
        let displayHTML = '';

        // Create a map of correct word positions to user words
        const wordMap = new Map();

        // Map user words to their correct positions
        result.words.forEach(wordObj => {
            if (wordObj.isCorrect && wordObj.correct) {
                const correctIndex = correctWords.findIndex(w =>
                    w.toLowerCase() === wordObj.correct.toLowerCase()
                );
                if (correctIndex !== -1) {
                    wordMap.set(correctIndex, wordObj);
                }
            }
        });

        // Also include missing words in their correct positions
        result.words.forEach(wordObj => {
            if (wordObj.isMissing && wordObj.correct) {
                const correctIndex = correctWords.findIndex(w =>
                    w.toLowerCase() === wordObj.correct.toLowerCase()
                );
                if (correctIndex !== -1) {
                    wordMap.set(correctIndex, wordObj);
                }
            }
        });

        // Build the display in correct sequence
        correctWords.forEach((correctWord, index) => {
            const wordObj = wordMap.get(index);

            if (wordObj) {
                if (wordObj.isMissing) {
                    // Missing word - show in brackets
                    displayHTML += `<span class="text-red-600 bg-red-100 px-1 rounded" title="Missing word">[${wordObj.correct}]</span> `;
                } else if (wordObj.isFuzzyMatch) {
                    // Fuzzy match - show with correction hint
                    displayHTML += `<span class="text-yellow-600 px-1 rounded relative group" title="Close match: ${wordObj.user} → ${wordObj.correct}">
                    ${wordObj.user}
                    <span class="absolute bottom-full left-0 bg-yellow-100 text-yellow-800 text-xs p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    ${wordObj.correct}
                    </span>
                </span> `;
                } else if (wordObj.isCorrect) {
                    // Correct match
                    displayHTML += `<span class="text-green-600 font-semibold">${wordObj.user}</span> `;
                }
            } else {
                // Word not matched at all (shouldn't happen, but safety)
                displayHTML += `<span class="text-gray-400">${correctWord}</span> `;
            }
        });

        return displayHTML;
    }

    resetActiveRecall() {
        clearInterval(this.timerInterval);
        document.getElementById('ar-results').classList.add('hidden');
        document.getElementById('ar-input-area').classList.add('hidden');

        // Reset controls
        document.getElementById('ar-start-btn').classList.remove('hidden');
        document.getElementById('ar-next-btn').classList.add('hidden');
        document.getElementById('ar-back-btn').classList.add('hidden');
        document.getElementById('ar-repeat-btn').classList.add('hidden');
        document.getElementById('ar-finish-btn').classList.add('hidden');
    }
}