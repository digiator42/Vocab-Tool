import { SpeechService } from '../utils/vocab-tool-utils/speech.js';
import { TranslationService } from '../utils/vocab-tool-utils/translation.js';
import { VocabPanelManager } from '../utils/vocab-tool-utils/vocab-panel.js';
import { ActiveRecallModule } from '../utils/vocab-tool-utils/active-recall.js';
import { ArticleService } from '../utils/vocab-tool-utils/article-service.js';
import { FlashcardListService } from '../utils/vocab-tool-utils/flashcard-list.js';
import { PassiveLearningService } from '../utils/vocab-tool-utils/passive-learning.js';
import { PdfReader } from './pdf-reader.js';
import { WebReader } from './web-reader.js';
import { HtmlReader } from './html-reader.js';

// Vocabulary Tool Module
export class VocabularyTool {
    constructor() {
        this.input = document.getElementById("input");
        this.output = document.getElementById("output");
        this.processBtn = document.getElementById("processBtn");
        this.playBtn = document.getElementById("playBtn");
        this.stopSpeechBtn = document.getElementById("stopSpeechBtn");
        this.selectionTooltip = document.getElementById("selectionTooltip");
        this.statusEl = document.getElementById("status");
        this.offlineSpeak = document.getElementById("offline-speak");
        this.storySelect = document.getElementById("storySelect");
        this.voiceSelect = document.getElementById("voiceSelect");
        this.vocabSection = document.getElementById("vocab-tool");
        this.analyzeCasesBtn = document.getElementById("analyzeCasesBtn");

        this.OriginalWord = null;
        this.currentVocabData = null;
        this.rate = 1;
        this.useOfflineSpeak = false;
        this.killianVoice = null;
        this.activeRecallBtn = null;
        this.isSpeaking = false;
        this.isPaused = false;
        this.isProcessed = false;
        this.utterance = null;
        this.currentUtterance = null;
        this.speechSynth = window.speechSynthesis;
        this.selectionHighlight = null;
        this.selectedLang = "en";
        this.isStopSpeechRequested = false;
        this.activeRecallMode = 'normal';
        this.originalText = '';
        this.useSlowVoice = false;
        this.isSelecting = false;
        this.selectionStartSpan = null;
        this.currentGroupId = null;
        this.selectionGroups = new Map()
        this.groupTooltips = new Map();
        this.isFocusMode = false;
        this.originalState = null;
        this.hideFocusPanel = false;

        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        this.lastSpokenText = '';
        this.lastSpokenSpans = [];
        this.sequenceMode = false;
        this.sequenceSelection = [];
        this.sequenceGroupId = null;

        this.speech = new SpeechService(this);
        this.translation = new TranslationService(this);
        this.vocabPanel = new VocabPanelManager(this);
        this.AR = new ActiveRecallModule(this);
        this.article = new ArticleService(this);
        this.FCL = new FlashcardListService(this);
        this.passiveLearning = new PassiveLearningService(this);
        this.pdfReader = new PdfReader(this);
        this.webReader = new WebReader(this);
        this.htmlReader = new HtmlReader(this);
        this.pdfMode = false;
        this.pdfData = null;
        this.webMode = false;
        this.webData = null;
        this.webModal = null;
        this.webUrlInput = null;
        this.htmlMode = false;
        this.htmlData = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupLanguageSelector();
        this.setupAddToFlashcardModal();
        this.setupSelectionSystem();
        this.AR.setupActiveRecall();
        this.FCL.setupFlashcardListSelection();
        this.setupFocusMode();
        this.setupPdfUpload();
        this.setupWebLoad();
        this.setupHtmlUpload();
        this.setupRichPaste();
        this.setupHtmlCheckbox();
        this.speech.loadVoices();
        this.createRepeatButton();
        this.createFloatingToolbar();
        window.vocabTool = this;
        if (!this.isTouchDevice) {
            this.vocabSection.style.marginRight = 'calc(50% - 425px)';
        }
        if (this.isTouchDevice) {
            document.querySelector('.fc-hint').textContent = '💡 Touch with 3 fingers for focus mode';
        }
        this.processBtn.click();
    }

    showNotification(message, time = 3500) {
        if (document.getElementById('focus-controls')) return;
        const notif = document.createElement('div');
        notif.innerHTML = this.decodeOutput(message);
        notif.className = "fixed top-6 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded shadow z-50";
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), time);
    }

    decodeSanitizedInput(input) {
        return input.replace(/(&amp;)?#x2F;/g, ',');
    }

    decodeOutput(output) {
        // Handle double-encoded entities (like &amp;#x2F;)
        let decoded = output.replace(/&amp;(#x2F;)/g, '&$1');

        // Now decode normally
        const substitutions = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#x27;': "'",
            '&#x2F;': '/'
        };

        decoded = decoded.replace(/&(amp|lt|gt|quot|#x27|#x2F);/g, (match) => substitutions[match] || match);

        return decoded;
    }

    setupSelectionSystem() {
        if (this.isTouchDevice) {
            console.log("Detected touch device", this.isTouchDevice);
            this.setupMobileSelection();
        } else {
            this.setupDesktopSelection();
        }

        this.setupCommonClickHandlers();
    }

    setStatus(message) {
        this.statusEl.textContent = message;
    }

    tokenize(text) {
        return text.split(/\s+/).filter(Boolean);
    }


    setupLanguageSelector() {
        const langSelector = document.createElement('select');
        langSelector.id = "langSelector";
        langSelector.className = "ml-2 px-2 py-1 border rounded text-sm";
        langSelector.innerHTML = `
            <option value="en" selected>EN</option>
            <option value="ar">AR</option>
        `;
        this.stopSpeechBtn.parentNode.insertBefore(langSelector, this.stopSpeechBtn.nextSibling);

        // Add Passive Learning Button
        const passiveBtn = document.createElement('button');
        passiveBtn.textContent = '🎧 Passive Learning';
        passiveBtn.id = 'passive-learning-btn';
        passiveBtn.className = 'px-4 py-4 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 w-1/2';
        passiveBtn.onclick = () => {
            const text = this.input.value;
            this.passiveLearning.startPassiveLearning(text);
        };
        // this.stopSpeechBtn.parentNode.insertBefore(passiveBtn, langSelector.nextSibling);
        const extraToolsContainer = document.getElementById('extra-tools-container');
        extraToolsContainer.appendChild(passiveBtn);

        langSelector.addEventListener('change', () => {
            this.selectedLang = langSelector.value;
        });
    }

    async translate(text, article = false, extended = false) {
        return this.translation.translate(text, article, extended);
    }

    setupDesktopSelection() {
        console.log("Setting up desktop selection system");

        this.output.addEventListener('mousedown', (e) => {
            console.log('🖱️ Mouse down on:', e.target);

            if (e.target.tagName === 'SPAN') {
                this.handleDesktopSelectionStart(e.target, e);
            }
        });

        this.output.addEventListener('mousemove', (e) => {
            this.handleDesktopSelectionMove(e.target, e);
        });

        document.addEventListener('mouseup', (e) => {
            this.handleDesktopSelectionEnd(e);
        });

        this.desktop = {
            isDragging: false,
            dragStartTime: 0,
            potentialStartSpan: null,
            isSelecting: false,
            selectionStartSpan: null,
            currentGroupId: null
        };
    }

    setupMobileSelection() {
        console.log("Setting up mobile selection system");

        this.mobile = {
            touchSelecting: false,
            touchedSpans: new Set(),
            ignoreClickUntil: 0,
            groupIdCounter: 0,
            groups: new Map(),
            lastTouchTime: 0,
            touchStartTime: 0,
            touchStartSpan: null
        };

        this.selectionTooltip.style.pointerEvents = 'none';
        this.output.style.touchAction = 'none';
        this.output.style.webkitUserSelect = 'none';
        this.output.style.userSelect = 'none';

        this.output.addEventListener('touchstart', (ev) => this.handleTouchStart(ev));
        this.output.addEventListener('touchmove', (ev) => this.handleTouchMove(ev));
        this.output.addEventListener('touchend', (ev) => this.handleTouchEnd(ev));
        this.output.addEventListener('touchcancel', () => this.handleTouchCancel());

        document.addEventListener('click', (ev) => this.preventGhostClick(ev), true);
    }

    setupCommonClickHandlers() {
        document.addEventListener('click', (e) => {
            if (this.desktop?.isSelecting || this.mobile?.touchSelecting) {
                return;
            }

            const isOutput = this.output.contains(e.target);
            const isUIControl = this.isUIControl(e.target);
            const isTooltip = e.target.closest('.tooltip') || e.target.closest('.group-tooltip');
        });
    }

    // ========== DESKTOP EVENT HANDLERS ==========
    handleDesktopSelectionStart(target, event) {
        this.desktop.dragStartTime = Date.now();
        this.desktop.isDragging = false;
        this.desktop.potentialStartSpan = target;

        const existingGroupId = target.dataset.selectionGroup || target.dataset.groupId;
        if (existingGroupId && !this.desktop.isDragging) {
            console.log("Desktop: Clicked on existing group, removing it");
            this.clearSelectionGroup(existingGroupId);
            this.desktop.potentialStartSpan = null;
            return;
        }
    }

    handleDesktopSelectionMove(target, event) {
        if (this.desktop.potentialStartSpan && Date.now() - this.desktop.dragStartTime > 100) {
            this.desktop.isDragging = true;
            if (!this.desktop.isSelecting) {
                this.startDesktopSelection(this.desktop.potentialStartSpan);
            }
        }

        if (this.desktop.isSelecting && target && target.tagName === 'SPAN') {
            this.updateDesktopSelection(target);
        }
    }

    handleDesktopSelectionEnd(event) {
        console.log('🖱️ Desktop selection end');

        if (this.desktop.potentialStartSpan) {
            const clickDuration = Date.now() - this.desktop.dragStartTime;
            const isQuickTap = clickDuration < 200 && !this.desktop.isDragging;

            console.log('⏱️ Click duration:', clickDuration, 'isQuickTap:', isQuickTap, 'isDragging:', this.desktop.isDragging);

            if (isQuickTap) {
                const existingGroupId = this.desktop.potentialStartSpan.dataset.selectionGroup || this.desktop.potentialStartSpan.dataset.groupId;
                if (!existingGroupId) {
                    console.log('👆 Quick tap on individual word');
                    this.handleIndividualWordClick(this.desktop.potentialStartSpan);
                } else {
                    console.log('👆 Quick tap on existing group');
                }
            } else if (this.desktop.isSelecting) {
                console.log('🖱️ Finishing drag selection');
                this.finishDesktopSelection();
            }

            this.desktop.potentialStartSpan = null;
            this.desktop.isDragging = false;
            this.desktop.isSelecting = false;
        }
    }

    startDesktopSelection(startSpan) {
        if (startSpan.classList.contains('highlighted') || startSpan.dataset.selectionGroup || startSpan.dataset.groupId) {
            return;
        }

        this.desktop.isSelecting = true;
        this.desktop.selectionStartSpan = startSpan;
        this.desktop.currentGroupId = 'desktop_group_' + Date.now();

        startSpan.classList.add('multi-highlighted');
        startSpan.dataset.selectionGroup = this.desktop.currentGroupId;
    }

    updateDesktopSelection(currentSpan) {
        if (!this.desktop.isSelecting || !this.desktop.selectionStartSpan) return;

        this.clearCurrentDesktopGroupSelection();

        // Only word spans participate in selection. pdf2htmlEX adds structural
        // wrapper spans (e.g. .ls11) that enclose many words; highlighting them
        // would light up their whole subtree (unrelated words).
        const allWordSpans = Array.from(this.output.querySelectorAll('span'))
            .filter(s => this.isWordSpan(s));

        const startIndex = allWordSpans.indexOf(this.desktop.selectionStartSpan);
        let currentIndex = allWordSpans.indexOf(currentSpan);
        if (currentIndex === -1 && currentSpan) {
            const wordAncestor = currentSpan.closest
                ? currentSpan.closest('.cursor-pointer')
                : null;
            if (wordAncestor) {
                currentIndex = allWordSpans.indexOf(wordAncestor);
            }
        }

        if (startIndex === -1 || currentIndex === -1) return;

        const start = Math.min(startIndex, currentIndex);
        const end = Math.max(startIndex, currentIndex);

        for (let i = start; i <= end; i++) {
            const span = allWordSpans[i];
            if (!span.dataset.selectionGroup && !span.dataset.groupId) {
                span.classList.add('multi-highlighted');
                span.dataset.selectionGroup = this.desktop.currentGroupId;
            }
        }
    }

    async finishDesktopSelection() {
        this.desktop.isSelecting = false;

        const selectedSpans = this.getCurrentDesktopGroupSpans();
        if (selectedSpans.length === 0) {
            this.desktop.selectionStartSpan = null;
            this.desktop.currentGroupId = null;
            return;
        }

        const selectedText = selectedSpans.map(span => span.textContent).join(' ').trim();

        if (!selectedText) {
            this.clearCurrentDesktopGroupSelection();
            return;
        }

        this.lastSpokenText = selectedText;
        this.lastSpokenSpans = selectedSpans;
        this.speech.speak(selectedText);

        let translation = "";
        try {
            translation = await this.translate(selectedText);
        } catch (error) {
            console.error("Translation error:", error);
            translation = "(translation failed)";
        }

        this.storeSelectionGroup(selectedSpans, selectedText, translation, this.desktop.currentGroupId);

        const firstSpan = selectedSpans[0];
        this.showSelectionTooltip(selectedText, this.getWordBounds(firstSpan), this.desktop.currentGroupId, translation);

        this.desktop.selectionStartSpan = null;
        this.desktop.currentGroupId = null;
    }

    // Tight bounding box of the actual text glyphs. pdf2htmlEX word spans sit
    // inside tall line boxes, so getBoundingClientRect()'s top can be well above
    // the visible letters; a Range over the text gives the true glyph bounds.
    getWordBounds(span) {
        try {
            const range = document.createRange();
            range.selectNodeContents(span);
            const rect = range.getBoundingClientRect();
            if (rect && rect.width > 0 && rect.height > 0) return rect;
        } catch (e) { /* fall through */ }
        return span.getBoundingClientRect();
    }

    // ========== MOBILE EVENT HANDLERS ==========
    handleTouchStart(ev) {
        if (ev.touches.length > 1) return;

        const t = ev.touches[0];
        const span = this.spanFromPoint(t.clientX, t.clientY);

        if (span && this.isWordSpan(span)) {
            this.mobile.touchSelecting = true;
            this.mobile.touchStartTime = Date.now();
            this.mobile.touchStartSpan = span;

            const existingGroupId = span.dataset.groupId || span.dataset.selectionGroup;
            if (existingGroupId) {
                console.log("🗑️ Tapped on existing group - removing it");
                this.clearSelectionGroup(existingGroupId);
                this.mobile.touchSelecting = false;
                return;
            }

            this.mobile.touchedSpans.forEach(s => {
                s.classList.remove('touch-feedback');
                s.classList.remove('multi-highlighted');
            });
            this.mobile.touchedSpans.clear();

            this.mobile.touchedSpans.add(span);
            span.style.zIndex = '30';
        } else {
            this.mobile.touchSelecting = false;
        }
    }

    getSpansBetween(startSpan, endSpan) {
        // Only word spans participate in selection (see updateDesktopSelection).
        const allSpans = Array.from(this.output.querySelectorAll('span'))
            .filter(s => this.isWordSpan(s));
        const startIndex = allSpans.indexOf(startSpan);
        const endIndex = allSpans.indexOf(endSpan);

        if (startIndex === -1 || endIndex === -1) return [];

        const start = Math.min(startIndex, endIndex);
        const end = Math.max(startIndex, endIndex);

        return allSpans.slice(start, end + 1);
    }

    handleTouchMove(ev) {
        if (!this.mobile.touchSelecting || !this.mobile.touchStartSpan) return;

        const t = ev.touches[0];
        const currentSpan = this.spanFromPoint(t.clientX, t.clientY);

        if (currentSpan && this.isWordSpan(currentSpan)) {
            const spansBetween = this.getSpansBetween(this.mobile.touchStartSpan, currentSpan);

            this.mobile.touchedSpans.forEach(span => {
                if (!spansBetween.includes(span)) {
                    span.classList.remove('touch-feedback');
                    span.classList.remove('multi-highlighted');
                }
            });
            this.mobile.touchedSpans.clear();

            spansBetween.forEach(span => {
                if (this.isWordSpan(span)) {
                    this.mobile.touchedSpans.add(span);
                    span.classList.add('touch-feedback');
                    span.classList.add('multi-highlighted');
                    span.style.zIndex = '30';
                }
            });
        }

        ev.preventDefault();
    }

    handleTouchCancel() {
        this.mobile.touchSelecting = false;
    }

    async handleTouchEnd(ev) {
        if (!this.mobile.touchSelecting || !this.mobile.touchStartSpan) return;

        const touchDuration = Date.now() - this.mobile.touchStartTime;
        const isQuickTap = touchDuration < 300;
        const spansArr = this.orderSpansByDOM(Array.from(this.mobile.touchedSpans));

        this.mobile.touchSelecting = false;

        this.mobile.touchedSpans.forEach(span => {
            span.classList.remove('touch-feedback');
        });

        if (isQuickTap && spansArr.length === 1) {
            const singleSpan = spansArr[0];
            const isAlreadyHighlighted = singleSpan.classList.contains("highlighted");
            const hasGroup = singleSpan.dataset.groupId || singleSpan.dataset.selectionGroup;

            if (!hasGroup && isAlreadyHighlighted) {
                console.log("❌ Quick tap on highlighted word - removing highlight");
                singleSpan.classList.remove("highlighted");
                singleSpan.classList.remove("multi-highlighted");
                singleSpan.querySelector(".tooltip")?.remove();

                const individualGroups = Array.from(this.selectionGroups.entries())
                    .filter(([id, group]) => group.spans.length === 1 && group.spans[0] === singleSpan);
                individualGroups.forEach(([id, group]) => this.selectionGroups.delete(id));

                this.mobile.touchedSpans.clear();
                return;
            }
        }

        if (spansArr.length === 0) {
            console.log("⚠️ No spans to process");
            return;
        }

        console.log("✅ Processing selection with", spansArr.length, "words");

        const words = spansArr.map(s => (s.childNodes[0]?.textContent || s.textContent).trim()).filter(Boolean);
        const phrase = words.join(" ");

        if (!phrase) {
            console.log("⚠️ No phrase to translate");
            return;
        }

        console.log("🎯 Translating:", phrase);

        this.lastSpokenText = phrase;
        this.lastSpokenSpans = spansArr;

        try {
            this.speech.speak(phrase);
        } catch (e) {
            console.warn("speak failed:", e);
        }

        if (spansArr.length === 1) {
            await this.processSingleWord(spansArr[0], phrase);
        } else {
            await this.processMultiWord(spansArr, phrase);
        }

        this.mobile.touchedSpans.clear();
        this.mobile.ignoreClickUntil = Date.now() + 500;
    }

    // Helper method for single word processing
    async processSingleWord(span, phrase) {
        console.log("🔤 Processing single word:", phrase);

        span.querySelector('.tooltip')?.remove();
        span.classList.remove('multi-highlighted');

        try {
            const translated = await this.translate(phrase);
            console.log("✅ Translation:", translated);

            const tip = document.createElement("div");
            tip.className = "tooltip";
            tip.textContent = translated;
            tip.style.zIndex = "1000";

            span.appendChild(tip);

            const groupId = "individual_" + Date.now();
            this.storeSelectionGroup([span], phrase, translated, groupId);

            span.classList.add('highlighted');

            console.log("✅ Single word completed");

        } catch (error) {
            console.error("❌ Translation error:", error);
        }
    }

    // Helper method for multi-word processing  
    async processMultiWord(spansArr, phrase) {
        console.log("👥 Processing multi-word:", phrase);

        this.mobile.groupIdCounter++;
        const groupId = "mobile_g" + this.mobile.groupIdCounter;

        spansArr.forEach(s => {
            s.dataset.groupId = groupId;
        });

        const wordCount = spansArr.length;
        let fontSize, padding, fontWeight;

        if (wordCount >= 8) {
            fontSize = '14px';
            padding = '4px 8px';
            fontWeight = '500';
        } else if (wordCount >= 5) {
            fontSize = '14px';
            padding = '6px 10px';
            fontWeight = '500';
        } else if (wordCount >= 3) {
            fontSize = '16px';
            padding = '8px 12px';
            fontWeight = '500';
        } else {
            fontSize = '12px';
            padding = '10px 14px';
            fontWeight = '600';
        }

        console.log(`📏 Dynamic sizing: ${wordCount} words -> ${fontSize} font`);

        const tooltip = document.createElement("div");
        tooltip.className = "group-tooltip";
        if (this.htmlMode) tooltip.classList.add("html-reader-group-tooltip");
        tooltip.style.cssText = `
        position: absolute;
        background: #333;
        color: #fff;
        padding: ${padding};
        border-radius: 6px;
        font-size: ${fontSize};
        font-weight: ${fontWeight};
        z-index: 32;
        white-space: nowrap;
        line-height: 1.4;
        max-width: 80vw;
        text-align: center;
        border-left: 3px solid #3b82f6;
    `;

        const firstRect = spansArr[0].getBoundingClientRect();
        tooltip.style.left = (firstRect.left + window.scrollX) + "px";
        tooltip.style.top = (firstRect.top + window.scrollY - 10) + "px";

        document.body.appendChild(tooltip);

        let translation = "";
        try {
            translation = await this.translate(phrase);
        } catch (err) {
            console.error("translate() failed:", err);
            translation = "(translation error)";
        }

        tooltip.textContent = translation;
        tooltip.style.top = (firstRect.top + window.scrollY - tooltip.offsetHeight - 1) + "px";

        if (wordCount > 3) {
            const lastRect = spansArr[spansArr.length - 1].getBoundingClientRect();
            const selectionCenter = (firstRect.left + lastRect.right) / 2;
            tooltip.style.left = (selectionCenter - (tooltip.offsetWidth / 2) + window.scrollX) + "px";
        }

        this.storeSelectionGroup(spansArr, phrase, translation, groupId);
        this.groupTooltips.set(groupId, tooltip);
    }

    preventGhostClick(ev) {
        if (Date.now() < this.mobile.ignoreClickUntil) {
            ev.stopPropagation();
            ev.preventDefault();
            return;
        }
    }

    // ========== COMMON METHODS ==========
    spanFromPoint(clientX, clientY) {
        let el = document.elementFromPoint(clientX, clientY);
        if (!el) return null;
        return el.closest && el.closest('#output span');
    }

    addSpanToTouched(span) {
        console.log('Touching span:', span ? span.textContent : null);
        if (!span || !this.output.contains(span)) return false;
        if (!this.mobile.touchedSpans.has(span)) {
            this.mobile.touchedSpans.add(span);
            span.classList.add('touch-feedback');
            span.classList.add('multi-highlighted');
            span.style.zIndex = '30';
            return true;
        }
        return false;
    }

    orderSpansByDOM(spansArray) {
        return spansArray.sort((a, b) => {
            if (a === b) return 0;
            const pos = a.compareDocumentPosition(b);
            if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
            if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
            return 0;
        });
    }

    isWordSpan(element) {
        return element && element.classList.contains('cursor-pointer') &&
            element.textContent && element.textContent.trim().length > 0;
    }

    handleIndividualWordClick(span) {
        console.log('🎯 handleIndividualWordClick called for:', span.textContent);

        if (span.dataset.selectionGroup || span.dataset.groupId) {
            console.log('⏭️ Skipping - word is part of group');
            return;
        }

        const word = span.textContent.trim();
        console.log('🔍 Processing word:', word);


        if (span.classList.contains('highlighted')) {
            console.log('🗑️ Removing highlight');
            span.classList.remove('highlighted');
            span.querySelector('.tooltip')?.remove();
        } else {
            console.log('✨ Adding highlight');
            this.highlightAndTranslateIndividualWord(span);
            // Calling vocab tool on highlighting only
            if (this.isFocusMode && this.hideFocusPanel) {
                return;
            }
            this.vocabPanel.showVocabInfoForWord(word, span);
        }
    }

    async highlightAndTranslateIndividualWord(span) {
        const word = span.textContent.trim();
        if (!word) return;

        console.log('Translating individual word:', word);

        span.classList.add('highlighted');
        span.classList.add('loading');

        this.lastSpokenText = word;
        this.lastSpokenSpans = [span];
        this.speech.speak(word);

        try {
            const translated = await this.translate(word);
            span.classList.remove('loading');

            span.querySelector('.tooltip')?.remove();

            const tip = document.createElement("div");
            tip.className = "tooltip";
            tip.textContent = translated;
            span.appendChild(tip);

            console.log('Individual word translation:', translated);
        } catch (error) {
            span.classList.remove('loading');
            console.error('Translation error:', error);
        }
    }

    // ========== SELECTION MANAGEMENT ==========
    getCurrentDesktopGroupSpans() {
        if (!this.desktop.currentGroupId) return [];
        return Array.from(this.output.querySelectorAll(`span[data-selection-group="${this.desktop.currentGroupId}"]`));
    }

    clearCurrentDesktopGroupSelection() {
        if (!this.desktop.currentGroupId) return;

        const currentGroupSpans = this.getCurrentDesktopGroupSpans();
        currentGroupSpans.forEach(span => {
            span.classList.remove('multi-highlighted');
            delete span.dataset.selectionGroup;
        });

        if (this.selectionGroups.has(this.desktop.currentGroupId)) {
            this.selectionGroups.delete(this.desktop.currentGroupId);
        }

        this.removeGroupTooltip(this.desktop.currentGroupId);
    }

    findSpanGroupId(span) {
        return span.dataset.selectionGroup || span.dataset.groupId || null;
    }

    clearSelectionGroup(groupId) {
        const groupSpans = this.output.querySelectorAll(`[data-selection-group="${groupId}"], [data-group-id="${groupId}"], [data-groupId="${groupId}"]`);
        groupSpans.forEach(span => {
            span.classList.remove('multi-highlighted');
            span.classList.remove('highlighted');
            delete span.dataset.selectionGroup;
            delete span.dataset.groupId;
            span.querySelector('.tooltip')?.remove();
        });

        this.selectionGroups.delete(groupId);
        this.removeGroupTooltip(groupId);

        console.log(`Cleared selection group ${groupId}`);
    }

    clearAllSelections() {
        const highlightedSpans = this.output.querySelectorAll("span.multi-highlighted, span.highlighted");
        const selectionGroups = this.output.querySelectorAll(".group-tooltip");

        highlightedSpans.forEach(span => {
            span.classList.remove("multi-highlighted");
            span.classList.remove("highlighted");
            delete span.dataset.selectionGroup;
            delete span.dataset.groupId;
            delete span.dataset.sequenceGroup;
            delete span.dataset.sequenceOrder;
            span.querySelector('.tooltip')?.remove();
            span.querySelector('.sequence-badge')?.remove();
        });

        this.selectionGroups.clear();
        if (this.mobile) {
            this.mobile.groups.clear();
            this.mobile.touchedSpans.clear();
        }

        this.groupTooltips.forEach((tooltip, groupId) => {
            if (tooltip && tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
        });
        this.groupTooltips.clear();

        // Clean up sequence connector
        const connector = document.getElementById('sequence-connector');
        if (connector) connector.remove();

        if (this.selectionHighlight) {
            this.selectionHighlight.remove();
            this.selectionHighlight = null;
        }

        this.selectionTooltip.style.display = "none";
        this.selectionTooltip.textContent = "";

        if (this.desktop) {
            this.desktop.potentialStartSpan = null;
            this.desktop.isDragging = false;
            this.desktop.isSelecting = false;
            this.desktop.currentGroupId = null;
        }
        console.log("Cleared all selections");
    }

    storeSelectionGroup(spans, text, translation, groupId) {
        const actualText = spans.map(span => span.textContent.trim()).join(' ');

        const group = {
            spans: [...spans],
            text: actualText,
            translation: translation,
            timestamp: Date.now()
        };

        if (!groupId) {
            groupId = 'group_' + Date.now();
        }

        this.selectionGroups.set(groupId, group);
        console.log(`Stored selection group ${groupId}: "${actualText}" -> "${translation}"`);
    }

    showSelectionTooltip(text, rect, groupId, translation = '') {
        this.removeGroupTooltip(groupId);

        const tooltip = document.createElement('div');
        tooltip.className = 'group-tooltip';
        if (this.htmlMode) tooltip.classList.add('html-reader-group-tooltip');
        tooltip.dataset.groupId = groupId;
        tooltip.style.cssText = `
            position: absolute;
            background: #333;
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 14px;
            z-index: 30;
            white-space: nowrap;
            display: block;
        `;

        if (translation) {
            tooltip.textContent = translation;
        } else {
            tooltip.textContent = "Translating...";
        }

        document.body.appendChild(tooltip);
        this.positionGroupTooltip(tooltip, rect);
        this.groupTooltips.set(groupId, tooltip);

        if (!translation) {
            this.translate(text).then(translated => {
                if (this.selectionGroups.has(groupId)) {
                    this.selectionGroups.get(groupId).translation = translated;
                }

                if (this.groupTooltips.has(groupId)) {
                    const tooltip = this.groupTooltips.get(groupId);
                    tooltip.textContent = translated;
                    this.positionGroupTooltip(tooltip, rect);
                }
            });
        }
    }

    // Place the tooltip just above the first selected word, hugging it.
    positionGroupTooltip(tooltip, rect) {
        tooltip.style.left = (rect.left + window.scrollX) + 'px';
        tooltip.style.top = (rect.top + window.scrollY - tooltip.offsetHeight - 2) + 'px';
    }

    removeGroupTooltip(groupId) {
        if (this.groupTooltips.has(groupId)) {
            const tooltip = this.groupTooltips.get(groupId);
            if (tooltip && tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
            this.groupTooltips.delete(groupId);
        }

        // Clean up sequence connector
        const connector = document.getElementById('sequence-connector');
        if (connector) connector.remove();

        const attrTooltips = document.querySelectorAll(`[data-group-id="${groupId}"], [data-groupId="${groupId}"]`);
        attrTooltips.forEach(tooltip => {
            if (tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
        });

        if (this.selectionTooltip.dataset.groupId === groupId) {
            this.selectionTooltip.style.display = "none";
            this.selectionTooltip.textContent = "";
        }
    }

    isUIControl(element) {
        if (element.closest('#addToFlashBtn')) return true;
        if (element.closest('#batch-add-to-flash-modal')) return true;
        if (element.closest('#add-to-flash-modal')) return true;
        if (element.closest('#active-recall-tool')) return true;
        if (element.tagName === 'BUTTON') return true;
        if (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') return true;
        return false;
    }

    setupPdfUpload() {
        const container = document.getElementById('file-tools-container');
        if (!container) return;

        const btn = document.createElement('button');
        btn.id = 'upload-pdf-btn';
        btn.textContent = '📄 Upload PDF';
        btn.className = 'px-4 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700';

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/pdf';
        input.className = 'hidden';
        input.id = 'pdf-file-input';

        btn.addEventListener('click', () => input.click());
        input.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) {
                this.loadPdfFile(file);
            }
            input.value = '';
        });

        container.appendChild(btn);
        container.appendChild(input);
    }

    async loadPdfFile(file) {
        this.setStatus("Extracting text from PDF…");
        try {
            await this.pdfReader.loadPdf(file);
            this.setStatus(`Loaded PDF: ${file.name} (${this.pdfData.pages.length} pages)`);
        } catch (err) {
            console.error('PDF load failed:', err);
            this.setStatus('PDF load failed: ' + (err && err.message ? err.message : err));
        }
    }

    renderPdfPages() {
        if (!this.pdfMode || !this.pdfData) return;
        this.pdfReader.renderPdf(this.pdfData);
        this.clearAllSelections();
    }

    setupWebLoad() {
        const container = document.getElementById('file-tools-container');
        if (!container) return;

        const btn = document.createElement('button');
        btn.id = 'load-web-btn';
        btn.textContent = '🌐 Load Website';
        btn.className = 'px-4 py-2 bg-teal-600 text-white rounded-lg shadow hover:bg-teal-700';
        btn.addEventListener('click', () => this.showWebModal());
        container.appendChild(btn);
    }

    showWebModal() {
        if (!this.webModal) this.buildWebModal();
        this.webModal.classList.remove('hidden');
        if (this.webUrlInput) {
            this.webUrlInput.value = '';
            setTimeout(() => this.webUrlInput.focus(), 50);
        }
    }

    hideWebModal() {
        if (this.webModal) this.webModal.classList.add('hidden');
    }

    buildWebModal() {
        const modal = document.createElement('div');
        modal.id = 'web-url-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden z-[60]';
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.hideWebModal();
        });

        const box = document.createElement('div');
        box.className = 'bg-white rounded-lg p-6 w-full max-w-lg mx-4';

        const title = document.createElement('h3');
        title.className = 'text-xl font-bold mb-2';
        title.textContent = '🌐 Load German Website';

        const input = document.createElement('input');
        input.type = 'url';
        input.id = 'web-url-input';
        input.className = 'w-full p-2 border rounded mb-2';
        input.placeholder = 'https://www.example.com/artikel/...';
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handleWebLoad();
        });

        const hint = document.createElement('p');
        hint.className = 'text-xs text-gray-500 mb-4';
        hint.textContent = 'The page text is loaded into the output, so every word can be translated, highlighted and added to flashcards.';

        const row = document.createElement('div');
        row.className = 'flex justify-end gap-2';

        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.textContent = 'Cancel';
        cancel.className = 'px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300';
        cancel.addEventListener('click', () => this.hideWebModal());

        const load = document.createElement('button');
        load.type = 'button';
        load.id = 'web-url-load';
        load.textContent = 'Load';
        load.className = 'px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700';
        load.addEventListener('click', () => this.handleWebLoad());

        row.appendChild(cancel);
        row.appendChild(load);
        box.appendChild(title);
        box.appendChild(input);
        box.appendChild(hint);
        box.appendChild(row);
        modal.appendChild(box);
        document.body.appendChild(modal);

        this.webModal = modal;
        this.webUrlInput = input;
    }

    async handleWebLoad() {
        const raw = this.webUrlInput ? this.webUrlInput.value.trim() : '';
        if (!raw) return;
        this.hideWebModal();
        const url = this.webReader.normalizeUrl(raw);
        this.setStatus(`Loading ${url}…`);
        try {
            const page = await this.webReader.loadPage(url);
            const finalUrl = page.url || url;
            this.applyRichContent(page, finalUrl, 'website');
            const wordCount = page.text.split(/\s+/).filter(Boolean).length.toLocaleString();
            this.setStatus(`Loaded ${finalUrl} — ${wordCount} words`);
            if (this.webUrlInput) this.webUrlInput.value = '';
        } catch (err) {
            console.error('Website load failed:', err);
            this.setStatus('Website load failed: ' + (err && err.message ? err.message : err));
        }
    }

    // Shared by "Load Website" and rich-text paste: puts the sanitized page into
    // the textarea (plain text) and renders the formatted HTML body in #output.
    applyRichContent(page, label, source) {
        this.webData = {
            url: label,
            html: page.html,
            text: page.text,
            source: source || (label && /^https?:\/\//i.test(label) ? 'website' : 'paste')
        };
        if (source !== 'html') {
            // Website loads and rich pastes take over the formatted view, so the
            // HTML checkbox must not silently keep its mode on.
            this.htmlMode = false;
            const htmlChk = document.getElementById('html-mode-chk');
            if (htmlChk) htmlChk.checked = false;
            // The textarea holds the extracted plain text (for editing / TTS).
            this.input.value = page.text;
        }
        // In HTML mode the raw markup stays in the textarea, so unchecking the
        // box returns to the raw HTML and re-checking re-renders it.
        this.isProcessed = true;
        this.processBtn.innerText = 'Reset';
        const focusModeGoBTN = document.getElementById('focus-go-btn');
        if (focusModeGoBTN) {
            focusModeGoBTN.innerText = 'Reset';
        }
        if (this.pdfMode) {
            this.exitPdfMode();
        }
        if (this.htmlMode) {
            this.exitHtmlMode();
        }
        this.webMode = true;
        this.renderWebContent();
    }

    // When the clipboard carries formatted HTML (copying text from a website,
    // Word, etc.) render it with its formatting preserved instead of as plain
    // text. Pure text-only pastes keep the normal behaviour.
    setupRichPaste() {
        this.input.addEventListener('paste', (e) => {
            const cd = e.clipboardData || window.clipboardData;
            if (!cd) return;
            const html = cd.getData('text/html');
            if (!html || html.trim().length < 30) return;
            let page;
            try {
                page = this.webReader.sanitize(html);
            } catch (err) {
                return; // fall back to plain text paste
            }
            if (!page.text || page.text.trim().length < 15) return; // just a link etc.
            e.preventDefault();
            this.applyRichContent(page, 'Pasted formatted text', 'paste');
            const wordCount = page.text.split(/\s+/).filter(Boolean).length.toLocaleString();
            this.setStatus(`Pasted formatted text — ${wordCount} words`);
        });
    }

    // "HTML" checkbox: when checked, the textarea content is treated as raw HTML
    // and rendered formatted (for pasting HTML source that the browser did not
    // hand over as rich text).
    setupHtmlCheckbox() {
        const container = document.getElementById('vocab-down-controls');
        if (!container) return;

        const chk = document.getElementById('html-mode-chk');
        chk.addEventListener('change', () => {
            this.htmlMode = chk.checked;
            if (chk.checked) {
                if (this.input.value.trim()) {
                    this.processHtmlInput();
                } else {
                    this.setStatus('HTML mode on — paste HTML and click Process');
                }
            } else if (this.webMode && this.webData && this.webData.source === 'html') {
                this.exitWebMode();
            } else if (this.htmlData) {
                this.exitHtmlMode();
            }
        });
    }

    processHtmlInput() {
        const html = this.input.value;
        if (!html.trim()) {
            this.setStatus('No HTML to render');
            return;
        }
        try {
            const page = this.webReader.sanitize(html);
            if (!page.text || !page.text.trim()) {
                this.setStatus('No readable text found in HTML');
                return;
            }
            this.applyRichContent(page, 'HTML input', 'html');
            const wordCount = page.text.split(/\s+/).filter(Boolean).length.toLocaleString();
            this.setStatus(`Rendered HTML — ${wordCount} words`);
        } catch (err) {
            console.error('HTML render failed:', err);
            this.setStatus('HTML render failed: ' + (err && err.message ? err.message : err));
        }
    }

    // Renders the imported website as a formatted HTML body (headings, lists,
    // paragraphs, links, images...) while still wrapping every word in the same
    // selection span the rest of the tool uses.
    renderWebContent() {
        if (!this.webMode || !this.webData) return;
        this.output.innerHTML = '';
        this.output.style.whiteSpace = 'normal';
        this.output.style.textAlign = '';
        this.output.style.lineHeight = '';
        this.output.style.padding = '';

        const tpl = document.createElement('template');
        tpl.innerHTML = this.webData.html;

        const wrapper = document.createElement('div');
        wrapper.className = 'web-content';
        wrapper.appendChild(tpl.content.cloneNode(true));
        this.wrapWordsInSpans(wrapper);
        // Never let a click inside a link navigate away from the tool.
        wrapper.addEventListener('click', (e) => {
            if (e.target && e.target.closest('a')) e.preventDefault();
        });

        const closeRow = document.createElement('div');
        closeRow.className = 'flex justify-end mb-3';
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = this.webData.source === 'website' ? '✕ Close Website' : '✕ Close formatted text';
        closeBtn.className = 'px-3 py-1 text-sm bg-teal-600 text-white rounded shadow hover:bg-teal-700';
        closeBtn.addEventListener('click', () => this.exitWebMode());
        closeRow.appendChild(closeBtn);

        this.output.appendChild(closeRow);
        this.output.appendChild(wrapper);
        this.setStatus(this.webData.source === 'website'
            ? `Website loaded: ${this.webData.url}`
            : 'Formatted text loaded');
        this.clearAllSelections();
    }

    wrapWordsInSpans(container) {
        const walk = (node) => {
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
                    frag.appendChild(span);
                }
                if (frag.childNodes.length) {
                    node.parentNode.replaceChild(frag, node);
                }
                return;
            }
            if (node.nodeType !== 1) return;
            if (node.tagName === 'PRE') return; // keep code blocks untouched
            for (const child of [...node.childNodes]) walk(child);
        };
        walk(container);
    }

    exitWebMode() {
        this.webMode = false;
        this.webData = null;
        this.htmlMode = false;
        this.htmlData = null;
        const htmlChk = document.getElementById('html-mode-chk');
        if (htmlChk) htmlChk.checked = false;
        // this.isProcessed = true;
        // this.processBtn.innerText = 'Reset';
        // this.renderTextToOutput();
    }

    // ── HTML File Reader ────────────────────────────────────────────────

    setupHtmlUpload() {
        const container = document.getElementById('file-tools-container');
        if (!container) return;

        const btn = document.createElement('button');
        btn.id = 'upload-html-btn';
        btn.textContent = '📝 Upload HTML';
        btn.className = 'px-4 py-2 bg-orange-600 text-white rounded-lg shadow hover:bg-orange-700';

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'text/html,.html,.htm';
        input.className = 'hidden';
        input.id = 'html-file-input';

        btn.addEventListener('click', () => input.click());
        input.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) {
                this.loadHtmlFile(file);
            }
            input.value = '';
        });

        container.appendChild(btn);
        container.appendChild(input);
    }

    async loadHtmlFile(file) {
        this.setStatus('Loading HTML file…');
        try {
            await this.htmlReader.loadHtmlFile(file);
            this.setStatus(`Loaded HTML: ${file.name}`);
        } catch (err) {
            console.error('HTML load failed:', err);
            this.setStatus('HTML load failed: ' + (err && err.message ? err.message : err));
        }
    }

    async renderHtmlPages() {
        if (!this.htmlMode || !this.htmlData) return;
        await this.htmlReader.renderHtml(this.htmlData);
        this.clearAllSelections();
    }

    exitHtmlMode() {
        this.htmlMode = false;
        this.htmlData = null;
        if (this.htmlReader) this.htmlReader.destroy();
        document.getElementById('html-progress-overlay')?.remove();
        this.renderTextToOutput();
    }

    renderTextToOutput() {
        this.output.innerHTML = "";
        this.output.style.whiteSpace = '';
        this.output.style.textAlign = '';
        this.output.style.lineHeight = '';
        this.output.style.padding = '';

        // Preserve newlines and natural text flow
        const lines = this.input.value.split('\n');

        // check if lines more than 500, if so, only render the first 500 lines and show a message
        if (lines.length > 500) {
            lines.length = 500; // Limit to first 500 lines
            const warning = document.createElement('p');
            warning.textContent = 'Warning: Only the first 500 lines were rendered.';
            warning.style.color = 'red';
            this.output.appendChild(warning);
        }

        lines.forEach((line, lineIndex) => {
            if (line.trim() === '') {
                // Add empty line (paragraph break)
                this.output.appendChild(document.createElement('br'));
            } else {
                // Process each line separately to preserve line breaks
                const words = line.split(/\s+/).filter(Boolean);

                words.forEach((word, wordIndex) => {
                    const span = document.createElement("span");
                    span.textContent = word;
                    // Make spans flexible for highlighting - they'll wrap naturally
                    span.className = "inline-block relative cursor-pointer hover:bg-yellow-100 rounded mx-0 max-w-full";
                    span.style.wordWrap = "break-word";
                    span.style.overflowWrap = "break-word";
                    this.output.appendChild(span);

                    // Add space between words (except last word in line)
                    if (wordIndex < words.length - 1) {
                        this.output.appendChild(document.createTextNode(' '));
                    }
                });

                // Add line break after each line (except last line)
                if (lineIndex < lines.length - 1) {
                    this.output.appendChild(document.createElement('br'));
                }
            }
        });

        this.setStatus("Text processed");
        this.clearAllSelections();
    }

    exitPdfMode() {
        this.pdfMode = false;
        this.pdfData = null;
        this.webMode = false;
        this.webData = null;
        this.htmlMode = false;
        this.htmlData = null;
        this.pdfReader.destroy();
        // this.isProcessed = true;
        // this.processBtn.innerText = "Reset";
        this.renderTextToOutput();
    }

    setupEventListeners() {
        this.processBtn.addEventListener("click", () => {
            if (this.htmlMode && this.htmlData) {
                this.isProcessed = true;
                this.processBtn.innerText = "Reset";
                const focusModeGoBTN = document.getElementById("focus-go-btn");
                if (focusModeGoBTN) {
                    focusModeGoBTN.innerText = "Reset";
                }
                this.renderHtmlPages();
                this.setStatus("HTML loaded");
                return;
            }

            if (this.htmlMode) {
                this.processHtmlInput();
                return;
            }

            if (this.webMode && this.webData) {
                this.isProcessed = true;
                this.processBtn.innerText = "Reset";
                const focusModeGoBTN = document.getElementById("focus-go-btn");
                if (focusModeGoBTN) {
                    focusModeGoBTN.innerText = "Reset";
                }
                this.renderWebContent();
                this.setStatus("Website loaded");
                return;
            }

            if (this.pdfMode && this.pdfData) {
                this.isProcessed = true;
                this.processBtn.innerText = "Reset";
                const focusModeGoBTN = document.getElementById("focus-go-btn");
                if (focusModeGoBTN) {
                    focusModeGoBTN.innerText = "Reset";
                }
                this.renderPdfPages();
                this.setStatus("PDF loaded");
                return;
            }

            this.output.innerHTML = "";
            this.isProcessed = !this.isProcessed;
            this.processBtn.innerText = this.isProcessed ? "Reset" : "Process";
            const focusModeGoBTN = document.getElementById("focus-go-btn");
            if (focusModeGoBTN) {
                focusModeGoBTN.innerText = this.processBtn.innerText;
            }

            this.renderTextToOutput();
        });

        this.stopSpeechBtn.addEventListener("click", () => this.speech.stopSpeech());

        this.playBtn.addEventListener('click', () => {
            // In a formatted view the textarea may hold raw HTML, so speak the
            // extracted plain text instead.
            const text = (this.htmlMode && this.htmlData && this.htmlData.text)
                ? this.htmlData.text
                : (this.webMode && this.webData && this.webData.text)
                ? this.webData.text
                : this.input.value;
            const focusModePlayBTN = document.getElementById("focus-play-btn");

            if (!this.isSpeaking) {
                const selectedVoiceName = this.voiceSelect.value;
                console.log('======== speak text called ============');
                this.speech.speakText(text, selectedVoiceName, this.rate, true);
            } else if (!this.isPaused) {
                this.speechSynth.pause();
                this.stopWordHighlighting();
                this.isPaused = true;
                playBtn.textContent = 'Resume';
            } else {
                this.speechSynth.resume();
                this.isPaused = false;
                playBtn.textContent = 'Pause';
            }
            if (focusModePlayBTN) {
                focusModePlayBTN.textContent = this.playBtn.textContent;
            }
        });

        this.analyzeCasesBtn.addEventListener("click", () => {
            this.analyzeCases();
        });

        const rateSlider = document.getElementById('rateSlider');
        const rateSliderSpan = document.getElementById('rateSliderSpan');

        rateSlider.addEventListener('change', (e) => {

            this.rate = e.target.value;
            rateSliderSpan.innerHTML = this.rate;
            console.log('rate value - ', this.rate);
        })

        this.offlineSpeak.addEventListener('change', (e) => {
            this.useOfflineSpeak = e.target.checked;
            console.log("On Off set to:", !this.useOfflineSpeak ? "online" : "offline");
        });
    }

    repeatSpeech() {
        if (!this.lastSpokenText) {
            this.showNotification("No previous selection to repeat");
            return;
        }
        console.log("🔁 Repeating:", this.lastSpokenText);
        this.speech.speak(this.lastSpokenText);
    }

    toggleSequenceMode() {
        this.sequenceMode = !this.sequenceMode;
        const sequenceBtn = document.getElementById('toolbar-sequence-btn');
        if (sequenceBtn) {
            if (this.sequenceMode) {
                sequenceBtn.classList.add('bg-blue-800', 'ring-2', 'ring-blue-400');
                sequenceBtn.title = 'Sequence mode ON - Click words in order (Ctrl+Q to disable)';
                this.showNotification('🔗 Sequence mode ON - Click words in order to build phrase');
                this.sequenceSelection = [];
                this.sequenceGroupId = null; // Reset group ID for new session
                this.highlightSequenceWords();
            } else {
                sequenceBtn.classList.remove('bg-blue-800', 'ring-2', 'ring-blue-400');
                sequenceBtn.title = 'Sequence selection mode - pick words in order (Ctrl+Q)';
                this.showNotification('Sequence mode OFF');
                this.clearSequenceHighlights();
                this.sequenceSelection = [];
                this.sequenceGroupId = null;
            }
        }
    }

    highlightSequenceWords() {
        // Add click handlers to all word spans for sequence selection
        const spans = this.output.querySelectorAll('span.cursor-pointer');
        spans.forEach(span => {
            if (!span.dataset.sequenceHandler) {
                span.dataset.sequenceHandler = 'true';
                span.style.cursor = 'crosshair';
                span.addEventListener('click', this.handleSequenceClick.bind(this));
            }
        });
    }

    handleSequenceClick(e) {
        if (!this.sequenceMode) return;
        e.preventDefault();
        e.stopPropagation();

        const span = e.target.closest('span.cursor-pointer');
        if (!span) return;

        const word = span.textContent.trim();
        if (!word) return;

        // Check if this span is already in the sequence
        const alreadySelected = this.sequenceSelection.some(s => s.span === span);
        if (alreadySelected) {
            this.showNotification(`"${word}" already in sequence`);
            return;
        }

        // Add to sequence
        this.sequenceSelection.push({
            word: word,
            span: span,
            index: this.sequenceSelection.length
        });

        // Visual feedback
        span.classList.add('sequence-selected');
        span.style.backgroundColor = `hsl(${this.sequenceSelection.length * 40 % 360}, 70%, 85%)`;
        span.style.borderRadius = '4px';
        span.style.boxShadow = '0 0 0 2px currentColor';

        // Show sequence number
        const badge = document.createElement('span');
        badge.className = 'sequence-badge';
        badge.textContent = this.sequenceSelection.length;
        badge.style.cssText = `
            position: absolute;
            top: -10px;
            right: -10px;
            background: #3b82f6;
            color: white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            font-size: 11px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            z-index: 100;
        `;
        span.style.position = 'relative';
        span.appendChild(badge);

        this.showNotification(`Added "${word}" (#${this.sequenceSelection.length})`);

        // Auto-process when we have 2+ words (but keep sequence mode active for more words)
        if (this.sequenceSelection.length >= 2) {
            this.processSequenceSelection();
        }
    }

    clearSequenceHighlights() {
        const spans = this.output.querySelectorAll('span.sequence-selected');
        spans.forEach(span => {
            span.classList.remove('sequence-selected');
            span.style.backgroundColor = '';
            span.style.borderRadius = '';
            span.style.boxShadow = '';
            span.style.cursor = 'pointer'; // Restore original pointer cursor
            const badge = span.querySelector('.sequence-badge');
            if (badge) badge.remove();
            delete span.dataset.sequenceHandler;
            span.removeEventListener('click', this.handleSequenceClick.bind(this));
        });
    }

    processSequenceSelection() {
        // Require at least 2 words for translation
        if (this.sequenceSelection.length < 2) {
            return;
        }

        // Build phrase in order of selection
        const phrase = this.sequenceSelection.map(s => s.word).join(' ');
        console.log('🔗 Sequence phrase:', phrase);

        this.lastSpokenText = phrase;
        this.lastSpokenSpans = this.sequenceSelection.map(s => s.span);
        this.speech.speak(phrase);

        // Use fixed groupId for sequence mode to reuse tooltip
        if (!this.sequenceGroupId) {
            this.sequenceGroupId = 'sequence_group';
        }
        const groupId = this.sequenceGroupId;

        // Translate as a single sentence
        this.translate(phrase).then(translation => {
            this.showNotification(`🔗 "${phrase}" → "${translation}"`);

            // Store as a selection group
            const spans = this.sequenceSelection.map(s => s.span);
            spans.forEach((span, i) => {
                span.dataset.sequenceGroup = groupId;
                span.dataset.sequenceOrder = i;
            });
            this.storeSelectionGroup(spans, phrase, translation, groupId);

            // Update or create GROUPED tooltip spanning all selected words
            this.updateSequenceTooltip(spans, phrase, groupId, translation);
        });

        // DON'T clear sequenceSelection - keep mode active for adding more words
    }

    updateSequenceTooltip(spans, text, groupId, translation) {
        let tooltip = this.groupTooltips.get(groupId);

        if (!tooltip) {
            // Create new tooltip only if it doesn't exist
            tooltip = document.createElement('div');
            tooltip.className = 'group-tooltip sequence-tooltip';
            if (this.htmlMode) tooltip.classList.add('html-reader-group-tooltip');
            tooltip.dataset.groupId = groupId;
            tooltip.style.cssText = `
                position: absolute;
                background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%);
                color: white;
                padding: 10px 16px;
                border-radius: 8px;
                font-size: 15px;
                font-weight: 500;
                z-index: 50;
                white-space: nowrap;
                display: block;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                border: 2px solid #3b82f6;
                max-width: 90vw;
                transition: all 0.2s ease;
            `;

            tooltip.innerHTML = `
                <div class="sequence-original" style="color: #93c5fd; font-size: 13px; margin-bottom: 4px; font-family: monospace;">${text}</div>
                <div class="sequence-translation" style="color: #fff; font-size: 15px;">${translation}</div>
            `;

            document.body.appendChild(tooltip);
            this.groupTooltips.set(groupId, tooltip);
        } else {
            // Update existing tooltip content
            tooltip.innerHTML = `
                <div class="sequence-original" style="color: #93c5fd; font-size: 13px; margin-bottom: 4px; font-family: monospace;">${text}</div>
                <div class="sequence-translation" style="color: #fff; font-size: 15px;">${translation}</div>
            `;
        }

        this.positionSequenceTooltip(tooltip, spans);
    }

    positionSequenceTooltip(tooltip, spans) {
        if (spans.length === 0) return;

        // Calculate bounding box covering all selected spans
        let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity;

        spans.forEach(span => {
            const rect = span.getBoundingClientRect();
            minLeft = Math.min(minLeft, rect.left);
            minTop = Math.min(minTop, rect.top);
            maxRight = Math.max(maxRight, rect.right);
            maxBottom = Math.max(maxBottom, rect.bottom);
        });

        const centerX = (minLeft + maxRight) / 2 + window.scrollX;
        const topY = minTop + window.scrollY - tooltip.offsetHeight - 8;

        tooltip.style.left = (centerX - tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = topY + 'px';

        // Add connector line from tooltip to selection area
        this.addSequenceConnector(spans, centerX, minTop + window.scrollY);
    }

    addSequenceConnector(spans, tooltipCenterX, selectionTop) {
        // Remove existing connector
        const existing = document.getElementById('sequence-connector');
        if (existing) existing.remove();

        const connector = document.createElement('div');
        connector.id = 'sequence-connector';
        connector.style.cssText = `
            position: absolute;
            left: ${tooltipCenterX}px;
            top: ${selectionTop}px;
            width: 2px;
            height: 8px;
            background: #3b82f6;
            z-index: 49;
            pointer-events: none;
        `;
        document.body.appendChild(connector);
    }

    createRepeatButton() {
        const repeatBtn = document.createElement('button');
        repeatBtn.id = "repeatBtn";
        repeatBtn.className = "px-4 py-2 bg-orange-600 text-white rounded-lg shadow hover:bg-orange-700";
        repeatBtn.textContent = "🔁 Repeat";
        repeatBtn.title = "Repeat last selection";
        const extraToolsContainer = document.getElementById('extra-tools-container');
        if (extraToolsContainer) {
            extraToolsContainer.insertBefore(repeatBtn, extraToolsContainer.firstChild);
        }
        repeatBtn.addEventListener('click', () => this.repeatSpeech());
    }

    createFloatingToolbar() {
        if (document.getElementById('floating-toolbar')) return;

        const toolbar = document.createElement('div');
        toolbar.id = 'floating-toolbar';
        toolbar.className = `
            fixed right-4 top-1/2 -translate-y-1/2
            bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-xl
            flex flex-col gap-2 p-3 z-[60]
            transition-all duration-300 ease-in-out
            min-w-[56px]
        `;
        toolbar.style.cursor = 'grab';
        toolbar.innerHTML = `
            <div class="toolbar-handle flex items-center justify-center mb-1 opacity-50 hover:opacity-100 cursor-grab" title="Drag to move">
                <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16M4 12h16"/>
                </svg>
            </div>
            <button id="toolbar-repeat-btn" class="toolbar-btn p-2 bg-orange-600 text-white rounded-lg shadow hover:bg-orange-700 transition-colors" title="Repeat last selection (Ctrl+R)">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
            </button>
            <button id="toolbar-sequence-btn" class="toolbar-btn p-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors" title="Sequence selection mode - pick words in order (Q)">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                </svg>
            </button>
            <button id="toolbar-speak-btn" class="toolbar-btn p-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition-colors" title="Speak selected text (Ctrl+S)">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/>
                </svg>
            </button>
            <button id="toolbar-add-flash-btn" class="toolbar-btn p-2 bg-purple-600 text-white rounded-lg shadow hover:bg-purple-700 transition-colors" title="Add selection to flashcards (Ctrl+A)">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
            </button>
            <button id="toolbar-clear-btn" class="toolbar-btn p-2 bg-red-500 text-white rounded-lg shadow hover:bg-red-600 transition-colors" title="Clear all selections (Ctrl+C)">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
            <button id="toolbar-toggle-btn" class="toolbar-btn p-2 bg-gray-500 text-white rounded-lg shadow hover:bg-gray-600 transition-colors mt-1" title="Collapse/Expand">
                <svg id="toolbar-toggle-icon" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/>
                </svg>
            </button>
        `;

        document.body.appendChild(toolbar);

        this.makeDraggable(toolbar);
        this.setupFloatingToolbarEvents(toolbar);
    }

    makeDraggable(element) {
        const handle = element.querySelector('.toolbar-handle');
        let isDragging = false;
        let startX, startY, initialX, initialY;

        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = element.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            element.style.cursor = 'grabbing';
            element.style.transition = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            let newX = initialX + dx;
            let newY = initialY + dy;

            const maxX = window.innerWidth - element.offsetWidth;
            const maxY = window.innerHeight - element.offsetHeight;
            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));

            element.style.left = `${newX}px`;
            element.style.top = `${newY}px`;
            element.style.right = 'auto';
            element.style.transform = 'none';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                element.style.cursor = 'grab';
                element.style.transition = 'all 0.3s ease-in-out';
            }
        });

        // Touch support
        handle.addEventListener('touchstart', (e) => {
            isDragging = true;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            const rect = element.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            element.style.transition = 'none';
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            const dx = e.touches[0].clientX - startX;
            const dy = e.touches[0].clientY - startY;
            let newX = initialX + dx;
            let newY = initialY + dy;

            const maxX = window.innerWidth - element.offsetWidth;
            const maxY = window.innerHeight - element.offsetHeight;
            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));

            element.style.left = `${newX}px`;
            element.style.top = `${newY}px`;
            element.style.right = 'auto';
            element.style.transform = 'none';
        }, { passive: false });

        document.addEventListener('touchend', () => {
            if (isDragging) {
                isDragging = false;
                element.style.transition = 'all 0.3s ease-in-out';
            }
        });
    }

    setupFloatingToolbarEvents(toolbar) {
        const repeatBtn = toolbar.querySelector('#toolbar-repeat-btn');
        const sequenceBtn = toolbar.querySelector('#toolbar-sequence-btn');
        const speakBtn = toolbar.querySelector('#toolbar-speak-btn');
        const addFlashBtn = toolbar.querySelector('#toolbar-add-flash-btn');
        const clearBtn = toolbar.querySelector('#toolbar-clear-btn');
        const toggleBtn = toolbar.querySelector('#toolbar-toggle-btn');
        const toggleIcon = toolbar.querySelector('#toolbar-toggle-icon');
        const toolButtons = toolbar.querySelectorAll('.toolbar-btn:not(#toolbar-toggle-btn)');

        let isCollapsed = false;

        repeatBtn.onclick = () => this.repeatSpeech();

        sequenceBtn.onclick = () => this.toggleSequenceMode();

        speakBtn.onclick = () => {
            const selection = window.getSelection();
            if (selection.toString().trim()) {
                this.speech.speak(selection.toString().trim());
            } else if (this.lastSpokenText) {
                this.repeatSpeech();
            }
        };

        addFlashBtn.onclick = () => {
            const addToFlashBtn = document.getElementById('addToFlashBtn');
            if (addToFlashBtn) addToFlashBtn.click();
        };

        clearBtn.onclick = () => this.clearAllSelections();

        toggleBtn.onclick = () => {
            isCollapsed = !isCollapsed;
            toolButtons.forEach(btn => {
                btn.style.display = isCollapsed ? 'none' : 'flex';
            });
            toggleIcon.style.transform = isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
            toolbar.style.minWidth = isCollapsed ? '48px' : '56px';
        };

        // Keyboard shortcuts
        const handleKeydown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            switch(e.key.toLowerCase()) {
                case 'r': if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.repeatSpeech(); } break;
                case 'q': if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.toggleSequenceMode(); } break;
                case 's': if (e.ctrlKey || e.metaKey) { e.preventDefault(); speakBtn.click(); } break;
                case 'a': if (e.ctrlKey || e.metaKey) { e.preventDefault(); addFlashBtn.click(); } break;
                case 'c': if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.clearAllSelections(); } break;
            }
        };
        document.addEventListener('keydown', handleKeydown);
        toolbar.dataset.keydownHandler = 'true';
    }

    // Add to Flashcard functionality
    createAddToFlashcardButton() {
        const addToFlashBtn = document.createElement('button');
        addToFlashBtn.id = "addToFlashBtn";
        addToFlashBtn.className = "px-4 py-2 bg-yellow-500 text-white rounded-lg shadow w-1/2 hover:bg-yellow-600";
        addToFlashBtn.textContent = "Add to Flashcards";
        const extraToolsContainer = document.getElementById('extra-tools-container');
        if (extraToolsContainer) {
            extraToolsContainer.insertBefore(addToFlashBtn, extraToolsContainer.firstChild);
        }
        addToFlashBtn.addEventListener('click', () => this.handleAddToFlashcard());
    }

    async handleAddToFlashcard() {
        const addToFlashBtn = document.getElementById('addToFlashBtn');

        // Visual feedback for mobile
        addToFlashBtn.disabled = true;
        addToFlashBtn.style.opacity = '0.7';

        // Mobile-friendly loading indicator
        const originalText = addToFlashBtn.textContent;
        addToFlashBtn.textContent = 'Loading...';

        // Get all selections: individual words + grouped words
        const allSelections = this.getAllSelections();

        if (allSelections.length === 0) {
            this.showNotification("Select words first! Tap individual words or drag to create groups.");
            addToFlashBtn.disabled = false;
            addToFlashBtn.style.opacity = '1';
            addToFlashBtn.textContent = originalText;
            return;
        }

        console.log("All selections for flashcards:", allSelections);

        // Small delay for better mobile UX
        // await new Promise(resolve => setTimeout(resolve, 100));

        // if (allSelections.length === 1) {
        //     // Single selection - show normal modal
        //     const selection = allSelections[0];
        //     this.showAddToFlashModal(selection.text, selection.translation);
        // } else {
        // Multiple selections - show batch modal (now async)
        await this.showBatchAddToFlashModal(allSelections);
        // }

        // Reset button state
        addToFlashBtn.disabled = false;
        addToFlashBtn.style.opacity = '1';
        addToFlashBtn.textContent = originalText;
    }

    // Get all selections: individual words + grouped words
    // Get all selections: individual words + grouped words
    getAllSelections() {
        const selections = [];

        console.log("=== DEBUG getAllSelections ===");

        // 1. Get individual words
        const individualSpans = this.output.querySelectorAll('span.highlighted');
        console.log("Individual spans found:", individualSpans.length);

        individualSpans.forEach((span, index) => {
            const hasSelectionGroup = !!span.dataset.selectionGroup;
            const hasGroupId = !!span.dataset.groupId;
            const word = this.getSpanTextContent(span).replace(/[\p{P}]/gu, '').trim();
            const tooltip = span.querySelector('.tooltip');
            const translation = tooltip ? tooltip.textContent : '';

            console.log(`🔍 Processing individual span ${index}: "${word}"`, {
                hasSelectionGroup,
                hasGroupId,
                hasTooltip: !!tooltip,
                translation
            });

            // Skip if it's part of a group
            if (hasSelectionGroup || hasGroupId) {
                console.log(`⏭️ Skipping - part of group: "${word}"`);
                return;
            }

            if (word && translation) {
                // Find sentence containing this word
                console.log(`📝 Finding sentence for individual word: "${word}"`);
                const sentence = this.findSentenceContainingWord(word);

                selections.push({
                    words: [word],
                    text: word,
                    translation: translation.replace(/[\p{P}]/gu, '').trim(),
                    sentence: sentence,
                    type: 'individual',
                    isGroup: false,
                    wordCount: 1
                });
                console.log(`✅ Added individual: "${word}" -> "${translation}"`,
                    sentence ? `📄 Sentence: ${sentence}` : '❌ No sentence found');
            } else {
                console.log(`❌ Skipping individual - missing word or translation:`, { word, translation });
            }
        });

        // 2. Debug selectionGroups
        console.log("🔄 Processing selectionGroups...");
        console.log("SelectionGroups map size:", this.selectionGroups.size);

        const groupEntries = Array.from(this.selectionGroups.entries());
        console.log("SelectionGroups content:", groupEntries);

        // Get all grouped words from the main selectionGroups map
        this.selectionGroups.forEach((group, groupId) => {
            console.log(`\n🔍 Processing group ${groupId}:`, {
                text: group.text,
                translation: group.translation,
                spanCount: group.spans ? group.spans.length : 0,
                spans: group.spans ? group.spans.map(s => s.textContent.trim()) : [],
                rawGroupData: group // Log the entire group object
            });

            // Safe checks
            if (!groupId || !group.text || !group.translation) {
                console.log(`❌ Skipping group ${groupId} - missing data`);
                return;
            }

            // Check if this is a real group (more than 1 word) or mobile/desktop group
            const isRealGroup = group.spans && group.spans.length > 1;
            const isMobileGroup = groupId.includes('mobile_g');
            const isDesktopGroup = groupId.includes('desktop_group_');

            console.log(`📊 Group ${groupId} checks:`, {
                isRealGroup,
                isMobileGroup,
                isDesktopGroup,
                spanCount: group.spans ? group.spans.length : 0
            });

            if (isRealGroup || isMobileGroup || isDesktopGroup) {
                const words = group.spans ? group.spans.map(span => span.textContent.trim()) : [];

                console.log(`📝 Finding sentence for group: "${group.text}"`);
                console.log(`🔤 Group words:`, words);

                // For groups, use the entire group text to find a sentence
                const sentence = this.findSentenceContainingWord(group.text);

                // Also try with the first word as fallback
                if (!sentence && words.length > 0) {
                    console.log(`🔄 Trying fallback with first word: "${words[0]}"`);
                    const fallbackSentence = this.findSentenceContainingWord(words[0]);
                    console.log(`🔄 Fallback result:`, fallbackSentence);
                }

                selections.push({
                    words: words,
                    text: group.text,
                    translation: group.translation,
                    sentence: sentence,
                    type: 'group',
                    isGroup: true,
                    wordCount: words.length,
                    groupId: groupId
                });
                console.log(`✅ Added group: "${group.text}" -> "${group.translation}"`,
                    sentence ? `📄 Sentence: ${sentence}` : '❌ No sentence found');
            } else {
                console.log(`⏭️ Skipping - not a real group: ${groupId}`);
            }
        });

        // 3. Final summary with detailed logging
        console.log(`\n=== FINAL RESULTS: ${selections.length} total selections ===`);
        selections.forEach((sel, index) => {
            console.log(`\n📋 Selection ${index}:`, {
                text: sel.text,
                translation: sel.translation,
                type: sel.type,
                wordCount: sel.wordCount,
                isGroup: sel.isGroup,
                sentence: sel.sentence || '❌ NO SENTENCE',
                sentenceLength: sel.sentence ? sel.sentence.length : 0
            });

            if (!sel.sentence) {
                console.log(`❌ PROBLEM: Selection "${sel.text}" has no sentence!`);
            }
        });

        // 4. Check what's in the input text
        console.log(`\n📄 INPUT TEXT SAMPLE:`, this.input.value.substring(0, 500) + '...');

        return selections;
    }

    // Also update findSentenceContainingWord with better debugging
    findSentenceContainingWord(word) {
        console.log(`\n🔍 [findSentenceContainingWord] START - Searching for: "${word}"`);

        const fullText = this.input.value;
        const sentences = fullText.split(/[.!?]+/).filter(s => s.trim().length > 0);

        console.log(`📊 Text stats:`, {
            totalLength: fullText.length,
            sentenceCount: sentences.length,
            firstFewSentences: sentences.slice(0, 3)
        });

        const phrase = Array.isArray(word) ? word.join(' ') : word;
        const cleanPhrase = phrase.replace(/[.,!?;:]/g, '').toLowerCase();

        console.log(`🔧 Processing:`, {
            original: word,
            phrase: phrase,
            cleanPhrase: cleanPhrase
        });

        let matchingSentence = null;

        // Search through each sentence
        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i];
            const cleanSentence = sentence.replace(/[.,!?;:]/g, '').toLowerCase();

            const hasMatch = cleanSentence.includes(cleanPhrase);

            console.log(`  📝 Sentence ${i}: "${sentence}"`);
            console.log(`  🔍 Clean: "${cleanSentence}"`);
            console.log(`  ✅ Contains "${cleanPhrase}"?`, hasMatch);

            if (hasMatch) {
                matchingSentence = sentence;
                console.log(`🎉 FOUND MATCH in sentence ${i}!`);
                break;
            }
        }

        const result = matchingSentence ? matchingSentence.trim() + '.' : '';
        console.log(`🔍 [findSentenceContainingWord] END - Result:`, result);

        return result;
    }

    getSpanTextContent(span) {
        // Get only the text content, excluding tooltip content
        for (let node of span.childNodes) {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                return node.textContent.trim();
            }
        }
        return span.textContent.trim(); // fallback
    }

    createModal() {
        const modal = document.createElement('div');
        modal.id = "add-to-flash-modal";
        modal.className = "fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 hidden";
        modal.innerHTML = `
            <div id="single-add-model" class="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative">
                <button id="close-add-to-flash-modal" class="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl">&times;</button>
                <h3 class="text-lg font-bold text-indigo-700 mb-2">Add to Flashcards</h3>
                <div id="selected-word-preview" class="mb-4 text-center text-lg font-semibold text-gray-800"></div>
                <div class="mb-2">
                    <span class="block text-sm font-medium mb-1">Choose a list:</span>
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

    async showBatchAddToFlashModal(selections) {
        const modal = document.getElementById('batch-add-to-flash-modal');
        if (!modal) {
            this.createBatchAddModal();
        }

        const selectionsList = document.getElementById('batch-selections-list');
        selectionsList.innerHTML = '';

        // First, determine which selections are nouns
        const nounChecks = await Promise.all(
            selections.map(async (selection, index) => {
                const isSingleWord = !selection.isGroup && selection.words.length === 1;
                if (!isSingleWord) return { index, isNoun: false };

                const isNoun = await this.article.isLikelyNoun(selection.words[0]);
                return { index, isNoun };
            })
        );

        // Create a map for quick lookup
        const nounMap = new Map();
        nounChecks.forEach(check => {
            nounMap.set(check.index, check.isNoun);
        });

        // Populate selections list
        selections.forEach((selection, index) => {
            const selectionDiv = document.createElement('div');
            selectionDiv.className = 'p-3 border rounded-lg bg-gray-50';

            const isSingleWord = !selection.isGroup && selection.words.length === 1;
            const isNoun = nounMap.get(index);
            const showArticleButton = isSingleWord && isNoun;

            const articleButton = showArticleButton ? `
            <div class="ml-4 flex flex-col items-center space-y-2">
                <input type="checkbox" class="batch-selection-checkbox" data-index="${index}" checked>
                <button class="get-article-btn px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors whitespace-nowrap"
                        data-word="${selection.words[0]}" 
                        data-index="${index}">
                    Get Article
                </button>
            </div>
        ` : `
            <div class="ml-4">
                <input type="checkbox" class="batch-selection-checkbox" data-index="${index}" checked>
            </div>
        `;

            // Add sentence display if available
            const sentenceDisplay = selection.sentence ? `
                <div class="german-sentence-batch-modal text-xs bg-gray-200 text-blue-600 my-2 italic leading-tight max-w-full overflow-hidden">
                    <span class="inline-block align-top">📝</span>
                    <span class="inline-block align-top whitespace-normal max-w-[90%]">
                        ${this.highlightWordsInSentence(selection.sentence, selection.words)}
                    </span>
                </div>
            ` : '';

            selectionDiv.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex-1">
                    <div class="font-semibold text-gray-800 german-word">${selection.words.join(' ').replace(/[\p{P}]/gu, '')}</div>
                    <div class="text-sm text-gray-600">${selection.translation}</div>
                    ${sentenceDisplay}
                    <div class="text-xs text-gray-500 mt-1">
                        ${selection.isGroup ? '📚 Word Group' : '🔤 Single Word'} • ${selection.words.length} word(s)
                        ${isSingleWord && !showArticleButton ? '• (Not a noun)' : ''}
                    </div>
                </div>
                ${articleButton}
            </div>
        `;
            selectionsList.appendChild(selectionDiv);
        });

        // Add event listeners for article buttons
        setTimeout(() => {
            document.querySelectorAll('.get-article-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const word = btn.dataset.word;
                    const index = parseInt(btn.dataset.index);

                    // Check if this is a "Make Sure" click for multiple articles
                    if (btn.textContent.includes('⚠️ Make Sure') && btn.dataset.allArticles) {
                        await this.article.showArticleDetails(word, JSON.parse(btn.dataset.allArticles), btn);
                    } else {
                        this.article.handleGetArticle(word, index, btn);
                    }
                });
            });
        }, 100);

        // Populate lists dropdown
        this.populateBatchListsDropdown();

        document.getElementById('batch-add-status').textContent = '';
        document.getElementById('batch-new-list-name').value = '';

        modal.classList.remove('hidden');
    }


    findSentenceContainingWord(word) {
        const fullText = this.input.value;
        const sentences = fullText.split(/[.!?]+/).filter(s => s.trim().length > 0);

        const phrase = Array.isArray(word) ? word.join(' ') : word;
        const cleanPhrase = phrase.replace(/[.,!?;:]/g, '').toLowerCase();

        // Find ALL matching sentences first
        const matchingSentences = sentences.filter(sentence => {
            const cleanSentence = sentence.replace(/[.,!?;:]/g, ' ').toLowerCase(); // Replace punctuation with spaces

            // For single words, use word boundaries (spaces)
            if (cleanPhrase.split(' ').length === 1) {
                return cleanSentence.includes(` ${cleanPhrase} `) ||
                    cleanSentence.startsWith(`${cleanPhrase} `) ||
                    cleanSentence.endsWith(` ${cleanPhrase}`);
            } else {
                // For phrases, just check inclusion
                return cleanSentence.includes(cleanPhrase);
            }
        });

        // If no matches, return empty
        if (matchingSentences.length === 0) return '';

        // If only one match, return it
        if (matchingSentences.length === 1) {
            return matchingSentences[0].trim() + '.';
        }

        // If multiple matches, use some simple heuristics:
        // 1. Prefer sentences that contain the exact phrase (not just parts)
        const exactMatches = matchingSentences.filter(sentence =>
            sentence.toLowerCase().includes(phrase.toLowerCase())
        );
        if (exactMatches.length > 0) {
            return exactMatches[0].trim() + '.';
        }

        // 2. Prefer longer sentences (more context)
        const sortedByLength = matchingSentences.sort((a, b) => b.length - a.length);
        return sortedByLength[0].trim() + '.';
    }

    highlightWordsInSentence(sentence, words) {
        console.log('🎨 HIGHLIGHT START ====================');
        console.log('Input sentence:', sentence);
        console.log('Input words:', words);
        console.log('Type of words:', typeof words);

        if (!Array.isArray(words)) {
            console.log('❌ Words is not an array, returning original sentence');
            console.log('🎨 HIGHLIGHT END ====================');
            return sentence;
        }

        let highlightedSentence = sentence;

        // Highlight each word individually if the phrase doesn't exist
        const phrase = words.join(' ');
        const cleanPhrase = phrase.replace(/[.,!?;:]$/g, '');

        console.log('Joined phrase:', phrase);
        console.log('Clean phrase:', cleanPhrase);

        const lowerSentence = highlightedSentence.toLowerCase();
        const lowerPhrase = cleanPhrase.toLowerCase();

        console.log('Lowercase sentence:', lowerSentence);
        console.log('Lowercase phrase:', lowerPhrase);

        // Try to highlight the exact phrase first
        console.log('🎯 STEP 1: Checking for exact phrase match in sentence...');
        const phraseIndex = lowerSentence.indexOf(lowerPhrase);
        console.log('Phrase found at index:', phraseIndex);

        if (phraseIndex !== -1) {
            console.log('✅ Exact phrase found, highlighting phrase...');
            const actualMatch = highlightedSentence.substring(phraseIndex, phraseIndex + cleanPhrase.length);
            console.log('Actual match text:', actualMatch);

            highlightedSentence =
                highlightedSentence.substring(0, phraseIndex) +
                `<b>${actualMatch}</b>` +
                highlightedSentence.substring(phraseIndex + cleanPhrase.length);

            console.log('After phrase highlighting:', highlightedSentence);
        } else {
            console.log('❌ Exact phrase not found, highlighting individual words...');
            // If exact phrase not found, highlight individual words
            words.forEach((word, index) => {
                console.log(`🔍 Processing word ${index + 1}/${words.length}:`, word);
                const cleanWord = word.replace(/[.,!?;:]$/g, '');
                const lowerWord = cleanWord.toLowerCase();

                console.log('Clean word:', cleanWord);
                console.log('Lower word:', lowerWord);

                let startIndex = 0;
                let matchCount = 0;

                while ((startIndex = lowerSentence.indexOf(lowerWord, startIndex)) !== -1) {
                    const actualMatch = highlightedSentence.substring(startIndex, startIndex + cleanWord.length);
                    console.log(`  Found "${cleanWord}" at index ${startIndex}, actual text: "${actualMatch}"`);

                    highlightedSentence =
                        highlightedSentence.substring(0, startIndex) +
                        `<b>${actualMatch}</b>` +
                        highlightedSentence.substring(startIndex + cleanWord.length);

                    startIndex += `<b>${actualMatch}</b>`.length;
                    matchCount++;

                    console.log(`  After replacement:`, highlightedSentence);
                }

                console.log(`  Total matches for "${cleanWord}": ${matchCount}`);
            });
        }

        console.log('🎨 HIGHLIGHT END ====================');
        console.log('Final highlighted sentence:', highlightedSentence);
        return highlightedSentence;
    }

    createBatchAddModal() {
        const modal = document.createElement('div');
        modal.id = "batch-add-to-flash-modal";
        modal.className = "fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[52] hidden";
        modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <button id="close-batch-add-modal" class="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl">&times;</button>
            <h3 class="text-lg font-bold text-indigo-700 mb-4">Add Multiple Words to Flashcards</h3>
            
            <div class="mb-4 flex-1 overflow-y-auto">
                <div id="batch-selections-list" class="space-y-3"></div>
            </div>
            
            <div class="mt-4">
                <span class="block text-sm font-medium mb-2">Add to list:</span>
                <div class="flex gap-2">
                    <select id="batch-list-select" class="flex-1 p-2 border rounded max-w-[50%]">
                        <option value="">Select a list...</option>
                    </select>
                    <input id="batch-new-list-name" type="text" class="flex-1 p-2 border rounded max-w-[50%]" placeholder="Or create new list">
                </div>
            </div>
            
            <div class="mt-4 flex gap-2">
                <button id="batch-add-all-btn" class="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                    Add All Selected
                </button>
                <button id="batch-cancel-btn" class="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                    Cancel
                </button>
            </div>
            
            <div id="batch-add-status" class="mt-3 text-sm text-center"></div>
        </div>
    `;
        document.body.appendChild(modal);

        document.getElementById('close-batch-add-modal').addEventListener('click', () => {
            modal.classList.add('hidden');
        });

        document.getElementById('batch-cancel-btn').addEventListener('click', () => {
            modal.classList.add('hidden');
        });

        document.getElementById('batch-add-all-btn').addEventListener('click', async () => {
            await this.handleBatchAdd();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    }

    async handleBatchAdd() {
        const listSelect = document.getElementById('batch-list-select');
        const newListInput = document.getElementById('batch-new-list-name');
        const statusDiv = document.getElementById('batch-add-status');

        const selectedListName = listSelect.value || newListInput.value.trim();

        if (!selectedListName) {
            statusDiv.textContent = "Please select or create a list name.";
            statusDiv.className = "text-red-600";
            return;
        }

        // Get selected checkboxes
        const checkboxes = document.querySelectorAll('.batch-selection-checkbox:checked');
        if (checkboxes.length === 0) {
            statusDiv.textContent = "Please select at least one word to add.";
            statusDiv.className = "text-yellow-600";
            return;
        }

        const selections = [];
        checkboxes.forEach(checkbox => {
            const index = parseInt(checkbox.dataset.index);
            const selectionDiv = checkbox.closest('.p-3');
            const germanText = selectionDiv.querySelector('.font-semibold').textContent;
            const englishText = selectionDiv.querySelector('.text-sm').textContent;
            const sentenceElement = selectionDiv.querySelector('.text-blue-600');
            const sentence = sentenceElement ? sentenceElement.textContent.replace('📝 ', '') : '';

            selections.push({
                german: germanText.replace(/[\p{P}]/gu, '').trim(),
                english: englishText,
                sentence: sentence.replace(/[\p{P}]/gu, '').trim()
            });
        });

        let customLists = JSON.parse(localStorage.getItem('customGermanLists')) || {};

        // Create new list if it doesn't exist
        if (!customLists[selectedListName]) {
            customLists[selectedListName] = [];
        }

        let addedCount = 0;
        let skippedCount = 0;

        await Promise.all(selections.map(async (selection) => {
            const exists = customLists[selectedListName].some(card =>
                card.german === selection.german && card.english === selection.english
            );

            if (!exists) {
                customLists[selectedListName].push({
                    german: selection.german,
                    sentence: selection.sentence,
                    english: selection.english,
                    sentenceTranslation: await this.translate(selection.sentence),
                    mastered: false
                });
                addedCount++;
            } else {
                skippedCount++;
            }
        }));

        localStorage.setItem('customGermanLists', JSON.stringify(customLists));
        // Refresh flashcard lists
        this.FCL.refreshFlashcardLists();

        if (addedCount > 0) {
            statusDiv.textContent = `Successfully added ${addedCount} words to "${selectedListName}"${skippedCount > 0 ? ` (${skippedCount} duplicates skipped)` : ''}!`;
            statusDiv.className = "text-green-600";

            setTimeout(() => {
                document.getElementById('batch-add-to-flash-modal').classList.add('hidden');
            }, 2000);
        } else {
            statusDiv.textContent = "All selected words already exist in the list.";
            statusDiv.className = "text-yellow-600";
        }
    }

    setupAddToFlashcardModal() {
        this.createAddToFlashcardButton();
        this.createModal();
        this.createBatchAddModal();
    }

    analyzeCases() {
        console.log("🔍 Analyzing cases...");
        this.statusEl.innerHTML = "<span class='text-red-600'>Red (Dative), </span><span class='text-blue-600'>Blue (Accusative)</span>";
        const spans = Array.from(this.output.querySelectorAll('span'));

        // Clear previous case highlights
        spans.forEach(span => {
            span.classList.remove('text-red-600', 'text-blue-600', 'font-bold');
            span.title = '';
        });

        // Define prepositions
        const dativePreps = new Set(['aus', 'außer', 'bei', 'mit', 'nach', 'seit', 'von', 'zu', 'gegenüber']);
        const accusativePreps = new Set(['bis', 'durch', 'für', 'gegen', 'ohne', 'um', 'entlang']);
        const twoWayPreps = new Set(['an', 'auf', 'hinter', 'in', 'neben', 'über', 'unter', 'vor', 'zwischen']);

        // Contractions
        const dativeContractions = new Set(['im', 'am', 'beim', 'vom', 'zum', 'zur']);
        const accusativeContractions = new Set(['ins', 'ans']);

        // Pronouns that can be objects (excluding 'sich' to avoid false positives with reflexive verbs/infinitive clauses)
        const validPronouns = new Set(['mich', 'dich', 'ihn', 'sie', 'es', 'uns', 'euch', 'ihnen', 'mir', 'dir', 'ihm', 'ihr', 'Sie']);

        // Helper to check if a word is an article
        const isArticle = (word) => /^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines)$/i.test(word);

        // Helper to check if a word is a preposition
        const isPreposition = (word) => {
            const lower = word.toLowerCase();
            return dativePreps.has(lower) || accusativePreps.has(lower) || twoWayPreps.has(lower) ||
                dativeContractions.has(lower) || accusativeContractions.has(lower);
        };

        for (let i = 0; i < spans.length; i++) {
            const span = spans[i];
            const word = span.textContent.trim().replace(/[.,!?;:]/g, ''); // Remove punctuation
            const lowerWord = word.toLowerCase();

            let caseType = null;
            let highlightLength = 0;

            if (dativePreps.has(lowerWord) || dativeContractions.has(lowerWord)) {
                caseType = 'dative';
            } else if (accusativePreps.has(lowerWord) || accusativeContractions.has(lowerWord)) {
                caseType = 'accusative';
            } else if (twoWayPreps.has(lowerWord)) {
                // Check next word for article to determine case
                if (i + 1 < spans.length) {
                    const nextSpan = spans[i + 1];
                    const nextWord = nextSpan.textContent.trim().replace(/[.,!?;:]/g, '').toLowerCase();

                    if (isArticle(nextWord)) {
                        if (['dem', 'der'].includes(nextWord)) {
                            caseType = 'dative';
                        } else if (['die', 'das'].includes(nextWord)) {
                            caseType = 'accusative';
                        } else if (nextWord === 'den') {
                            caseType = 'accusative'; // Heuristic
                        }
                    }
                }
            }

            if (caseType) {
                highlightLength = 1; // Include preposition

                // Extend highlight to include article, adjectives, and noun
                let j = i + 1;
                let validObjectFound = false;

                while (j < spans.length) {
                    const currentSpan = spans[j];
                    const currentWord = currentSpan.textContent.trim().replace(/[.,!?;:]/g, '');
                    const originalWord = currentSpan.textContent.trim();

                    // Stop if we hit another preposition
                    if (isPreposition(currentWord)) break;

                    highlightLength++;

                    // Check for sentence end OR comma (often ends a phrase)
                    const hasPunctuationEnd = /[.,!?;:]$/.test(originalWord);

                    // Check if it's a noun (Capitalized) or a valid pronoun
                    // Exclude articles from "Capitalized" check (e.g. "Die" at start of sentence, though here we are mid-sentence)
                    if ((/^[A-ZÄÖÜ]/.test(currentWord) && !isArticle(currentWord)) || validPronouns.has(currentWord)) {
                        validObjectFound = true;
                        break;
                    }

                    if (hasPunctuationEnd) break;
                    j++;
                }

                // Only apply highlight if we found a valid object (Noun or Pronoun)
                if (validObjectFound) {
                    const colorClass = caseType === 'dative' ? 'text-red-600' : 'text-blue-600';

                    for (let k = 0; k < highlightLength; k++) {
                        if (i + k < spans.length) {
                            const s = spans[i + k];
                            s.classList.add(colorClass, 'font-bold');
                            // s.title = caseType.charAt(0).toUpperCase() + caseType.slice(1) + ' Case';
                        }
                    }

                    // Skip the processed words
                    i += highlightLength - 1;
                }
            }
        }

        this.showNotification("Cases analyzed! Red = Dative, Blue = Accusative");
    }

    populateBatchListsDropdown() {
        const select = document.getElementById('batch-list-select');
        const customLists = JSON.parse(localStorage.getItem('customGermanLists')) || {};

        select.innerHTML = '<option value="">Select a list...</option>';
        Object.keys(customLists).forEach(listName => {
            const option = document.createElement('option');
            option.value = listName;
            option.textContent = listName;
            select.appendChild(option);
        });
    }

    // Focus Mode functionality
    setupFocusMode() {
        const vocabTool = document.getElementById('vocab-tool');

        document.addEventListener('keydown', (e) => {
            if (this.output.style.display === 'none' || vocabTool.classList.contains('hidden')) return;
            if (e.altKey && e.shiftKey && e.key === 'G') {
                console.log('---->> FC');
                e.preventDefault();
                this.toggleFocusMode();
            }

            if (this.isFocusMode && e.key === 'Escape') {
                e.preventDefault();
                this.toggleFocusMode();
            }
        });

        this.setupMobileFocusModeGesture();
    }

    toggleFocusMode() {
        if (this.isFocusMode) {
            this.exitFocusMode();
        } else {
            this.enterFocusMode();
        }
    }

    setupMobileFocusModeGesture() {
        let touchStartY = 0;
        let touchCount = 0;
        let lastTouchTime = 0;

        document.addEventListener('touchstart', (e) => {
            if (e.touches.length === 3) {
                touchStartY = e.touches[0].clientY;
                touchCount = e.touches.length;
                lastTouchTime = Date.now();
            }
        });

        document.addEventListener('touchend', (e) => {
            console.log('------->>> >>> ');
            if (touchCount === 3 && Date.now() - lastTouchTime < 1000) {
                console.log('------->>> >>> ');
                this.toggleFocusMode();
            }
            touchCount = 0;
        });
    }

    enterFocusMode() {
        if (this.isFocusMode) return;

        console.log('Entering focus mode');
        this.isFocusMode = true;

        this.processBtn.click()

        this.originalState = {
            bodyOverflow: document.body.style.overflow,
            bodyBg: document.body.style.backgroundColor,
            outputClasses: this.output.className,
            outputStyle: this.output.getAttribute('style') || '',
            // Store original states
            sidebarOriginalClasses: {},
            hamburgerOriginalClasses: {},
            overlayOriginalClasses: {}
        };

        // Handle sidebar elements - in focus mode, always use mobile behavior
        const vocabSidebar = document.getElementById('vocab-stories-sidebar');
        const vocabHamburger = document.getElementById('vocab-hamburger-menu');
        const vocabOverlay = document.getElementById('vocab-sidebar-overlay');

        if (vocabSidebar) {
            // Store original classes
            this.originalState.sidebarOriginalClasses = vocabSidebar.className;

            // In focus mode, force sidebar to mobile behavior with Tailwind
            // Remove any hidden or responsive classes that hide it on large screens
            vocabSidebar.className = `
            w-80 p-4 border-r border-gray-300 bg-white rounded-lg shadow-lg 
            flex flex-col overflow-y-auto fixed left-[-320px] top-0 h-screen z-40 
            transition-[left] duration-300 ease-in-out shadow-2xl max-h-[1220px]
        `;
            vocabSidebar.dataset.focusMode = 'true';
        }

        if (vocabHamburger) {
            // Store original state
            this.originalState.hamburgerOriginalClasses = vocabHamburger.className;
            this.originalState.hamburgerOriginalStyle = vocabHamburger.getAttribute('style') || '';

            // COMPLETELY reset and set focus mode styles
            vocabHamburger.className = 'hamburger'; // Keep only base hamburger class
            vocabHamburger.removeAttribute('style'); // Clear all inline styles

            // Apply focus mode styles
            vocabHamburger.style.display = 'flex'; // Force display

            vocabHamburger.dataset.focusMode = 'true';

            // Add focus mode click handler
            vocabHamburger.addEventListener('click', this.handleFocusModeSidebarToggle.bind(this));
        }

        if (vocabOverlay) {
            // Store original classes
            this.originalState.overlayOriginalClasses = vocabOverlay.className;

            // Set up overlay for focus mode with Tailwind
            vocabOverlay.className = `
            sidebar-overlay fixed inset-0 bg-black bg-opacity-50 z-30 hidden
        `;
            vocabOverlay.dataset.focusMode = 'true';

            // Add click handler to close sidebar
            vocabOverlay.addEventListener('click', this.handleFocusModeSidebarClose.bind(this));
        }

        // Hide everything in main-vocab-view EXCEPT output and selectionTooltip
        const mainVocabView = document.getElementById('main-vocab-view');
        if (mainVocabView) {
            const mainChildren = Array.from(mainVocabView.children);
            mainChildren.forEach(child => {
                if (!['output', 'selectionTooltip'].includes(child.id)) {
                    child.dataset.originalDisplay = child.style.display || '';
                    child.style.display = 'none';
                }
            });

            // Make sure output takes full width with Tailwind
            const output = document.getElementById('output');
            if (output) {
                output.dataset.originalClasses = output.className;
                output.className = `
                ${output.className} w-full max-w-full
            `;
            }
        }

        const vocabToolContainer = document.getElementById('vocab-tool-div');
        if (vocabToolContainer) {
            vocabToolContainer.dataset.originalDisplay = vocabToolContainer.style.display || '';
            vocabToolContainer.style.display = 'none';
        }

        this.createFocusControls();
        this.applyFocusModeStyles();
        this.setupTooltipObserver();

        // Add keyboard shortcut to toggle sidebar in focus mode (Alt+S)
        document.addEventListener('keydown', this.handleFocusModeSidebarShortcut.bind(this));
    }

    // Add these methods to your class:
    handleFocusModeSidebarToggle() {
        const vocabSidebar = document.getElementById('vocab-stories-sidebar');
        const vocabOverlay = document.getElementById('vocab-sidebar-overlay');
        const vocabHamburger = document.getElementById('vocab-hamburger-menu');

        if (vocabSidebar && vocabSidebar.dataset.focusMode === 'true') {
            // Check if sidebar has left-0 class (is open)
            const isOpen = vocabSidebar.classList.contains('left-0');

            if (isOpen) {
                // Close sidebar
                vocabSidebar.classList.remove('left-0');
                vocabSidebar.classList.add('left-[-320px]');
                vocabOverlay.classList.add('hidden');
                vocabHamburger.classList.remove('active');
            } else {
                // Open sidebar
                vocabSidebar.classList.remove('left-[-320px]');
                vocabSidebar.classList.add('left-0');
                vocabOverlay.classList.remove('hidden');
                vocabHamburger.classList.add('active');
            }
        }
    }

    handleFocusModeSidebarClose() {
        const vocabSidebar = document.getElementById('vocab-stories-sidebar');
        const vocabOverlay = document.getElementById('vocab-sidebar-overlay');
        const vocabHamburger = document.getElementById('vocab-hamburger-menu');

        if (vocabSidebar) {
            vocabSidebar.classList.remove('left-0');
            vocabSidebar.classList.add('left-[-320px]');
            vocabOverlay.classList.add('hidden');
            vocabHamburger.classList.remove('active');
        }
    }

    handleFocusModeSidebarShortcut(e) {
        // Alt+S toggles sidebar in focus mode
        if (e.altKey && e.key === 's') {
            e.preventDefault();
            this.handleFocusModeSidebarToggle();
        }
    }

    exitFocusMode() {
        if (!this.isFocusMode) return;

        console.log('Exiting focus mode');
        this.isFocusMode = false;

        this.processBtn.click()

        // Remove focus controls
        const focusControls = document.getElementById('focus-controls');
        if (focusControls) {
            focusControls.remove();
        }

        // Disconnect tooltip observer
        if (this.tooltipObserver) {
            this.tooltipObserver.disconnect();
            this.tooltipObserver = null;
        }

        // Restore sidebar elements to original state
        const vocabSidebar = document.getElementById('vocab-stories-sidebar');
        const vocabHamburger = document.getElementById('vocab-hamburger-menu');
        const vocabOverlay = document.getElementById('vocab-sidebar-overlay');

        if (vocabSidebar && vocabSidebar.dataset.focusMode === 'true') {
            // Restore original classes
            vocabSidebar.className = this.originalState.sidebarOriginalClasses;
            delete vocabSidebar.dataset.focusMode;
        }

        if (vocabHamburger && vocabHamburger.dataset.focusMode === 'true') {
            // Restore original classes
            vocabHamburger.className = this.originalState.hamburgerOriginalClasses;

            // Remove focus mode click handler
            vocabHamburger.removeEventListener('click', this.handleFocusModeSidebarToggle.bind(this));

            // Remove active class
            vocabHamburger.classList.remove('active');

            delete vocabHamburger.dataset.focusMode;
        }

        if (vocabOverlay && vocabOverlay.dataset.focusMode === 'true') {
            // Restore original classes
            vocabOverlay.className = this.originalState.overlayOriginalClasses;

            // Remove focus mode click handler
            vocabOverlay.removeEventListener('click', this.handleFocusModeSidebarClose.bind(this));

            delete vocabOverlay.dataset.focusMode;
        }

        // Restore elements in main-vocab-view
        const mainVocabView = document.getElementById('main-vocab-view');
        if (mainVocabView) {
            const mainChildren = Array.from(mainVocabView.children).filter(
                child => child.hasAttribute('data-original-display')
            );

            mainChildren.forEach(child => {
                const originalDisplay = child.dataset.originalDisplay;
                child.style.display = originalDisplay || '';
                delete child.dataset.originalDisplay;
            });

            // Restore output original classes
            const output = document.getElementById('output');
            if (output && output.dataset.originalClasses) {
                output.className = output.dataset.originalClasses;
                delete output.dataset.originalClasses;
            }
        }

        // Restore vocab tool container
        const vocabToolContainer = document.getElementById('vocab-tool-div');
        if (vocabToolContainer && vocabToolContainer.hasAttribute('data-original-display')) {
            const originalDisplay = vocabToolContainer.dataset.originalDisplay;
            vocabToolContainer.style.display = originalDisplay || '';
            delete vocabToolContainer.dataset.originalDisplay;
        }

        // Restore group tooltip styles
        const groupTooltip = document.getElementById('group-tooltip');
        if (groupTooltip && groupTooltip.dataset.focusModeStyled) {
            groupTooltip.style.zIndex = '';
            delete groupTooltip.dataset.focusModeStyled;
        }

        // Remove keyboard shortcut listener
        document.removeEventListener('keydown', this.handleFocusModeSidebarShortcut.bind(this));

        this.restoreOriginalStyles();
    }

    setupTooltipObserver() {
        this.tooltipObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        if (node.id === 'group-tooltip' || node.querySelector && node.querySelector('#group-tooltip')) {
                            this.styleTooltipForFocusMode();
                        }
                    }
                });
            });
        });

        this.tooltipObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        this.styleTooltipForFocusMode();
    }

    createFocusControls() {
        const existingControls = document.getElementById('focus-controls');
        if (existingControls) {
            existingControls.remove();
        }

        const originalProcessBtn = document.getElementById('processBtn');
        const originalPlayBtn = document.getElementById('playBtn');
        const originalStopBtn = document.getElementById('stopSpeechBtn');
        const originalRateSlider = document.getElementById('rateSlider');
        const originalRateSpan = document.getElementById('rateSliderSpan');
        const originalOfflineCheckbox = document.getElementById('offline-speak');
        const originalAddToFlashBtn = document.getElementById('addToFlashBtn');
        const originalLangSelector = document.getElementById('langSelector');


        const focusControls = document.createElement('div');
        focusControls.id = 'focus-controls';
        focusControls.className = `
        fixed top-5 left-1/2 -translate-x-1/2
        bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl p-4 shadow-lg 
        flex flex-wrap mb-30 lg:flex-nowrap gap-3 justify-center w-fit z-[51]
        transition-all duration-300 ease-in-out
    `;
        focusControls.innerHTML = `
        <div class="flex flex-row gap-3 justify-center">
            <button id="focus-go-btn" class="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors">
            ${originalProcessBtn.innerText}
            </button>
            <button id="focus-play-btn" class="px-4 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition-colors">
            ${originalPlayBtn.innerText}
            </button>
            <button id="focus-repeat-btn" class="px-3 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 transition-colors" title="Repeat last selection">
                🔁 Repeat
            </button>
            <button id="focus-stop-btn" class="px-3 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors">
            Stop Speech
            </button>
        </div>

        <div class="flex flex-row gap-3 justify-center">
            <button id="focus-add-flash-btn" class="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors">
            ${originalAddToFlashBtn ? originalAddToFlashBtn.innerText : 'Add Flash'}
            </button>
            <button id="focus-hide-btn" class="px-3 py-2 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600 transition-colors">
                Hide CTRs
            </button>
            <button id="focus-panel-btn" class="px-3 py-2 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600 transition-colors">
                Hide Panel
            </button>
            <button id="focus-exit-btn" class="px-3 py-2 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600 transition-colors">
                ❌ Exit
            </button>
        </div>

        <!-- Keep your select, sliders, and checkbox below -->
        <select id="focus-lang-selector" class="px-3 py-2 bg-gray-100 rounded-lg text-sm">
            ${Array.from(originalLangSelector.options).map(option =>
            `<option value="${option.value}" ${option.selected ? 'selected' : ''}>${option.text}</option>`
        ).join('')}
        </select>
        
        <div class="flex items-center gap-2">
            <span id="focus-rate-span" class="text-sm text-gray-700">${originalRateSpan.textContent}</span>
            <input id="focus-rate-slider" type="range" min="${originalRateSlider.min}" max="${originalRateSlider.max}" step="${originalRateSlider.step}" value="${originalRateSlider.value}" class="w-20">
        </div>
        
        <div class="flex items-center gap-2">
            <input id="focus-offline-checkbox" type="checkbox" ${originalOfflineCheckbox.checked ? 'checked' : ''} class="switch-input mx-auto">
            <label for="focus-offline-checkbox" class="text-sm font-medium text-gray-700"></label>
            <span>Offline</span>
        </div>
        `;


        const focusGoBtn = focusControls.querySelector('#focus-go-btn');
        const focusPlayBtn = focusControls.querySelector('#focus-play-btn');
        const focusRepeatBtn = focusControls.querySelector('#focus-repeat-btn');
        const focusStopBtn = focusControls.querySelector('#focus-stop-btn');
        const focusAddFlashBtn = focusControls.querySelector('#focus-add-flash-btn');
        const focusRateSlider = focusControls.querySelector('#focus-rate-slider');
        const focusRateSpan = focusControls.querySelector('#focus-rate-span');
        const focusOfflineCheckbox = focusControls.querySelector('#focus-offline-checkbox');
        const focusHideBtn = focusControls.querySelector('#focus-hide-btn');
        const focusExitBtn = focusControls.querySelector('#focus-exit-btn');
        const focusLangSelector = focusControls.querySelector('#focus-lang-selector');
        const focusPanelBtn = focusControls.querySelector('#focus-panel-btn');

        focusPanelBtn.onclick = () => {
            this.hideFocusPanel = !this.hideFocusPanel;
            if (this.hideFocusPanel) {
                focusPanelBtn.textContent = 'Show Panel';
            } else {
                focusPanelBtn.textContent = 'Hide Panel';
            }
        }

        // Initialize hide state
        this.isFocusControlsHidden = false;

        focusHideBtn.onclick = () => {
            this.isFocusControlsHidden = !this.isFocusControlsHidden;

            if (this.isFocusControlsHidden) {
                // Hide controls with animation
                focusControls.style.transform = 'translate(-50%, -100%)';
                focusControls.style.opacity = '0';
                focusControls.style.pointerEvents = 'none';
                focusHideBtn.textContent = 'Show CTRs';

                // Add a small toggle button to show controls again
                this.createFocusToggleButton(focusControls);
            } else {
                // Show controls with animation
                focusControls.style.transform = 'translate(-50%, 0)';
                focusControls.style.opacity = '1';
                focusControls.style.pointerEvents = 'auto';
                focusHideBtn.textContent = 'Hide CTRs';

                // Remove toggle button if it exists
                this.removeFocusToggleButton();
            }
        };

        focusGoBtn.onclick = () => originalProcessBtn.click();
        focusPlayBtn.onclick = () => originalPlayBtn.click();
        focusRepeatBtn.onclick = () => this.repeatSpeech();
        focusStopBtn.onclick = () => originalStopBtn.click();

        if (originalAddToFlashBtn) {
            focusAddFlashBtn.onclick = () => originalAddToFlashBtn.click();
        } else {
            focusAddFlashBtn.disabled = true;
            focusAddFlashBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }

        focusExitBtn.onclick = () => this.exitFocusMode();

        focusLangSelector.onchange = (e) => {
            originalLangSelector.value = e.target.value;
            this.selectedLang = e.target.value;
        };

        focusRateSlider.oninput = (e) => {
            const newRate = parseFloat(e.target.value);
            originalRateSlider.value = newRate;
            focusRateSpan.textContent = newRate;
            originalRateSpan.textContent = newRate;
            this.rate = newRate;

            if (this.isSpeaking && this.utterance) {
                this.utterance.rate = newRate;
            }

            originalRateSlider.dispatchEvent(new Event('input'));
        };

        focusOfflineCheckbox.onchange = (e) => {
            originalOfflineCheckbox.checked = e.target.checked;
            originalOfflineCheckbox.dispatchEvent(new Event('change'));
        };

        document.body.appendChild(focusControls);

        // Add keyboard shortcut to toggle controls (Alt+H)
        document.addEventListener('keydown', this.handleFocusControlsKeydown.bind(this));
    }

    createFocusToggleButton(focusControls) {
        // Remove existing toggle button if it exists
        this.removeFocusToggleButton();

        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'focus-toggle-btn';
        toggleBtn.className = `
        fixed top-5 right-5 
        px-3 py-2 bg-blue-600 text-white rounded-lg text-sm 
        hover:bg-blue-700 transition-colors z-[52]
        shadow-lg
    `;
        toggleBtn.textContent = '👁️ Show Controls';

        toggleBtn.onclick = () => {
            // Show controls
            focusControls.style.transform = 'translate(-50%, 0)';
            focusControls.style.opacity = '1';
            focusControls.style.pointerEvents = 'auto';

            // Update hide button text
            const focusHideBtn = document.getElementById('focus-hide-btn');
            if (focusHideBtn) {
                focusHideBtn.textContent = 'Hide CTRs';
            }

            this.isFocusControlsHidden = false;
            this.removeFocusToggleButton();
        };

        document.body.appendChild(toggleBtn);
        this.focusToggleButton = toggleBtn;
    }

    removeFocusToggleButton() {
        if (this.focusToggleButton) {
            this.focusToggleButton.remove();
            this.focusToggleButton = null;
        }
    }

    handleFocusControlsKeydown(e) {
        // Alt+H toggles focus controls visibility
        if (e.altKey && e.key === 'h') {
            e.preventDefault();
            const focusHideBtn = document.getElementById('focus-hide-btn');
            if (focusHideBtn) {
                focusHideBtn.click();
            }
        }
    }

    removeFocusControls() {
        const focusControls = document.getElementById('focus-controls');
        if (focusControls) {
            focusControls.remove();
        }

        this.removeFocusToggleButton();

        // Remove keyboard event listener
        document.removeEventListener('keydown', this.handleFocusControlsKeydown.bind(this));
    }

    removeFocusModeIndicator() {
        const indicator = document.getElementById('focus-mode-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    styleTooltipForFocusMode() {
        const groupTooltip = document.getElementById('group-tooltip');
        if (groupTooltip) {
            groupTooltip.style.zIndex = '10001';
            groupTooltip.dataset.focusModeStyled = 'true';
        }
    }

    applyFocusModeStyles() {
        this.output.className = `focus-mode-output absolute top-28 ${this.isTouchDevice ? 'mt-48' : 'mt-16'} max-w-7xl mx-auto left-4 right-4 z-30 bg-inherit text-inherit font-inherit p-8 text-[1.5rem] leading-loose min-h-screen`;
        this.output.style.cssText = '';

        if (this.selectionTooltip) {
            this.selectionTooltip.classList.add('z-[10001]');
        }

        this.styleTooltipForFocusMode();

        document.body.classList.remove('overflow-hidden');
        document.body.classList.add('overflow-auto');
    }

    addFocusModeIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'focus-mode-indicator';
        indicator.innerHTML = `
        <div style="
            position: fixed;
            top: 10px;
            right: 10px;
            background: #10b981;
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10003;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        ">
            🎯 Focus Mode
        </div>
    `;
        document.body.appendChild(indicator);
    }

    restoreOriginalStyles() {
        if (this.originalState) {
            this.output.className = this.originalState.outputClasses;
            this.output.setAttribute('style', this.originalState.outputStyle);
        } else {
            this.output.removeAttribute('style');
        }

        if (this.selectionTooltip) {
            this.selectionTooltip.style.zIndex = '12';
        }

        if (this.originalState) {
            document.body.style.overflow = this.originalState.bodyOverflow;
            document.body.style.backgroundColor = this.originalState.bodyBg;
        } else {
            document.body.style.overflow = '';
            document.body.style.backgroundColor = '';
        }
    }

    debugOutputSpans() {
        const allSpans = Array.from(this.output.querySelectorAll('span'));
        console.log('=== OUTPUT SPANS DEBUG ===');
        console.log('Total spans:', allSpans.length);
        allSpans.forEach((span, index) => {
            console.log(`Span ${index}:`, {
                text: span.textContent,
                trimmed: span.textContent.trim(),
                classes: span.className,
                html: span.outerHTML
            });
        });
        console.log('=== END DEBUG ===');
    }

    testHighlighting() {
        const testSpans = Array.from(this.output.querySelectorAll('span')).slice(0, 5);
        if (testSpans.length > 0) {
            console.log('🧪 Testing highlighting on first 5 spans');
            this.highlightWhileSpeaking(
                testSpans.map(s => s.textContent).join(' '),
                testSpans
            );
        }
    }

    // Add this method to verify CSS application
    checkCSSApplied() {
        const highlightedSpans = this.output.querySelectorAll('.speaking-current');
        console.log('🎨 CSS Check - Highlighted spans:', highlightedSpans.length);

        highlightedSpans.forEach((span, index) => {
            const styles = window.getComputedStyle(span);
            console.log(`Span ${index} (${span.textContent}):`, {
                backgroundColor: styles.backgroundColor,
                color: styles.color,
                border: styles.border,
                transform: styles.transform
            });
        });
    }

    // Add this to monitor the highlighting process
    debugHighlighting() {
        console.log('=== HIGHLIGHTING DEBUG ===');
        console.log('Current highlight object:', this.currentHighlight);

        if (this.currentHighlight && this.currentHighlight.spans) {
            console.log('Spans in current highlight:', this.currentHighlight.spans.length);
            this.currentHighlight.spans.forEach((span, index) => {
                const styles = window.getComputedStyle(span);
                console.log(`Span ${index} (${span.textContent}):`, {
                    backgroundColor: styles.backgroundColor,
                    hasHighlightClass: span.classList.contains('speaking-current')
                });
            });
        }
        console.log('=== END DEBUG ===');
    }

    clearSpeakingHighlights() {
        console.log('🧹 Clearing speaking highlights');

        // Remove speaking highlight classes from all spans
        const allSpans = document.querySelectorAll('#output span');
        allSpans.forEach(span => {
            span.classList.remove('speaking-current');

            // Also remove any inline styles that might have been left over
            span.style.backgroundColor = '';
            span.style.color = '';
            span.style.border = '';
            span.style.borderRadius = '';
            span.style.padding = '';
            span.style.margin = '';
            span.style.fontWeight = '';
            span.style.zIndex = '';
            span.style.position = '';
            span.style.transform = '';
            span.style.transition = '';
            span.style.boxShadow = '';
        });

        if (this.currentHighlight && this.currentHighlight.currentSpan) {
            this.currentHighlight.currentSpan = null;
        }
    }

    // Add this method to your class
    clearPreviousWordHighlight() {
        if (this.currentHighlight && this.currentHighlight.currentSpan) {
            const previousSpan = this.currentHighlight.currentSpan;
            previousSpan.classList.remove('speaking-current');
        }
    }

    // Quick inline style test
    testInlineHighlighting() {
        const firstSpan = this.output.querySelector('span');
        if (firstSpan) {
            firstSpan.style.backgroundColor = '#ff0000';
            firstSpan.style.color = '#ffffff';
            firstSpan.style.fontWeight = 'bold';
            firstSpan.style.padding = '2px 4px';
            console.log('🔴 Applied inline styles to first span');
        }
    }

    // Calculate timing based on word count and speech rate
    calculateWordTiming(words) {
        // Slow it down for debugging - 1000ms per word
        const baseSpeed = 1000; // 1 second per word for testing
        const rateFactor = 1 / this.rate;
        const timing = baseSpeed * rateFactor;
        console.log('⏱️ Word timing:', timing, 'ms for', words.length, 'words');
        return timing;
    }

    // Add this method to check if spans are found
    getSpansForText(text) {
        const allSpans = Array.from(this.main.output.querySelectorAll('span'));
        const words = text.split(/\s+/);
        const matchingSpans = [];

        console.log('🔍 Looking for spans for text:', text);
        console.log('Total spans in output:', allSpans.length);
        console.log('Words to find:', words);

        words.forEach(word => {
            const matchingSpan = allSpans.find(span => {
                const spanText = span.textContent.trim();
                const isMatch = spanText.toLowerCase() === word.toLowerCase();
                if (isMatch) {
                    console.log('✅ Found match:', word, 'in span:', spanText);
                }
                return isMatch;
            });
            if (matchingSpan) {
                matchingSpans.push(matchingSpan);
            } else {
                console.log('❌ No span found for word:', word);
            }
        });

        console.log('📦 Final matching spans:', matchingSpans.length);
        return matchingSpans;
    }

    // Make sure this clears ALL highlights immediately
    clearAllSpeakingHighlights() {
        const allSpans = this.output.querySelectorAll('span');
        allSpans.forEach(span => {
            span.classList.remove('speaking-highlight', 'speaking-current');
        });

        if (this.currentHighlight) {
            this.currentHighlight.currentSpan = null;
        }
    }

    highlightCurrentWordByIndex(charIndex, wordLength) {
        this.clearAllSpeakingHighlights();

        const allSpans = Array.from(this.output.querySelectorAll('span'));
        let currentCharCount = 0;
        let targetSpan = null;

        console.log('🔍 Looking for char index:', charIndex, 'word length:', wordLength);

        // Find the span that contains the character at charIndex
        for (const span of allSpans) {
            const spanText = span.textContent;
            const spanLength = spanText.length;

            console.log(`🔍 Span: "${spanText}" (${spanLength} chars), current count: ${currentCharCount}`);

            // Check if this span contains the target character
            if (currentCharCount <= charIndex && charIndex < currentCharCount + spanLength) {
                targetSpan = span;
                console.log('✅ Found target span:', spanText);
                break;
            }

            // Move to next span - add span length PLUS 1 for the space
            currentCharCount += spanLength + 1; // +1 for the space between words

            console.log(`➡️ Moving to next span. New char count: ${currentCharCount}`);
        }

        if (targetSpan) {
            console.log('🎯 Highlighting span:', targetSpan.textContent);

            // Use CSS classes
            targetSpan.classList.add('speaking-current');

            // Store reference
            if (this.currentHighlight) {
                this.currentHighlight.currentSpan = targetSpan;
            }

            // Scroll into view if needed
            targetSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            console.log('❌ Could not find span for char index:', charIndex);
            console.log('📊 Final char count:', currentCharCount, 'Total spans:', allSpans.length);

            // Debug: Show all spans and their calculated positions
            this.debugSpanPositions(charIndex);
        }
    }

    // Add this debug method
    debugSpanPositions(targetIndex) {
        const allSpans = Array.from(this.output.querySelectorAll('span'));
        let currentCharCount = 0;

        console.log('=== SPAN POSITION DEBUG ===');
        console.log('Target char index:', targetIndex);

        allSpans.forEach((span, index) => {
            const spanText = span.textContent;
            const spanLength = spanText.length;
            const spanStart = currentCharCount;
            const spanEnd = currentCharCount + spanLength - 1;

            console.log(`Span ${index}: "${spanText}" [${spanStart}-${spanEnd}]`);

            currentCharCount += spanLength + 1; // +1 for space
        });

        console.log('=== END DEBUG ===');
    }

    // Stop word highlighting
    stopWordHighlighting() {
        if (this.currentHighlight && this.currentHighlight.interval) {
            clearInterval(this.currentHighlight.interval);
            this.currentHighlight.interval = null;
        }
        this.clearAllSpeakingHighlights();
    }
}