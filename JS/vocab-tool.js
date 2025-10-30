import { SpeechService } from './speech.js';
import { TranslationService } from './translation.js';
import { VocabPanelManager } from './vocab-panel.js';
import { ActiveRecallModule } from './active-recall.js';
import { ArticleService } from './article-service.js';
import { FlashcardListService } from './flashcard-list.js';

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

        this.OriginalWord = null;
        this.currentVocabData = null;
        this.germanVoices = [];
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
        this.useFuzzyMatching = true;
        this.originalText = '';
        this.useSlowVoice = false;
        this.isSelecting = false;
        this.selectionStartSpan = null;
        this.currentGroupId = null;
        this.selectionGroups = new Map()
        this.groupTooltips = new Map(); // Map of groupId -> tooltip element
        this.isFocusMode = false;
        this.originalState = null;
        this.selectedFlashcardList = null;
        this.isFlashCardLoadRequested = false;


        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;


        this.speech = new SpeechService(this);
        this.translation = new TranslationService(this);
        this.vocabPanel = new VocabPanelManager(this);
        this.AR = new ActiveRecallModule(this);
        this.article = new ArticleService(this);
        this.flashcardLists = new FlashcardListService(this);
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupLanguageSelector();
        this.setupAddToFlashcardModal();
        this.setupSelectionSystem();
        this.AR.setupActiveRecall();
        this.setupFocusMode();
        this.flashcardLists.setupFlashcardListSelection();
        // this.setupManualSelection();
        // this.setupTooltipHover();
        this.processBtn.click();
        this.speech.loadVoices();
        window.vocabTool = this; // For debugging
        if (!this.isTouchDevice) {
            this.vocabSection.style.marginRight = 'calc(50% - 425px)';
        }
    }

    showNotification(message, time = 3500) {
        // check if focus mode is on
        if (document.getElementById('focus-controls')) return;
        const notif = document.createElement('div');
        notif.innerHTML = message;
        notif.className = "fixed top-6 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded shadow z-50";
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), time);
    }

    decodeSanitizedInput(input) {
        return input.replace(/(&amp;)?#x2F;/g, ',');
    }

    setupSelectionSystem() {
        if (this.isTouchDevice) {
            console.log("Detected touch device", this.isTouchDevice);
            this.setupMobileSelection();
        } else {
            this.setupDesktopSelection();
        }

        // Common click handlers for both
        this.setupCommonClickHandlers();
    }

    setStatus(message) {
        this.statusEl.textContent = message;
    }

    tokenize(text) {
        return text.split(/(\s+|[^A-Za-zÄÖÜäöüß]+)/).filter(Boolean);
    }


    loadVoices() { return this.speech.loadVoices(); }

    speakText(text, voiceName, rate = 1) { return this.speech.speakText(text, voiceName, rate); }

    populateVoiceDropdown() { return this.speech.populateVoiceDropdown(); }


    // speakText(text, rate = 1) {
    //     console.log('rate ---> ', rate);
    //     if (!text.trim()) return;
    //     this.speechSynth.cancel(); // Clear any previous utterance
    //     this.utterance = new SpeechSynthesisUtterance(text);
    //     this.utterance.lang = 'de-DE';
    //     this.utterance.rate = rate;

    //     this.utterance.onend = () => {
    //         this.isSpeaking = false;
    //         this.isPaused = false;
    //         this.utterance = null;
    //         this.playBtn.textContent = 'Play';
    //     };

    //     this.speechSynth.speak(this.utterance);
    //     this.isSpeaking = true;
    //     this.playBtn.textContent = 'Pause';
    // }

    setupLanguageSelector() {
        const langSelector = document.createElement('select');
        langSelector.id = "langSelector";
        langSelector.className = "ml-2 px-2 py-1 border rounded text-sm";
        langSelector.innerHTML = `
            <option value="en" selected>EN</option>
            <option value="ar">AR</option>
        `;
        this.stopSpeechBtn.parentNode.insertBefore(langSelector, this.stopSpeechBtn.nextSibling);

        langSelector.addEventListener('change', () => {
            this.selectedLang = langSelector.value;
        });
    }

    async translate(text, article = false, extended = false) { return this.translation.translate(text, article, extended); }

    setupDesktopSelection() {
        console.log("Setting up desktop selection system");

        // Mouse events for desktop
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

        // Desktop-specific variables
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

        // Mobile-specific variables
        this.mobile = {
            touchSelecting: false,
            touchedSpans: new Set(),
            ignoreClickUntil: 0,
            groupIdCounter: 0,
            groups: new Map(),
            lastTouchTime: 0,
            touchStartTime: 0,
            touchStartSpan: null // ADD THIS
        };

        // Make sure the tooltip doesn't block elementFromPoint
        this.selectionTooltip.style.pointerEvents = 'none';

        // Make the output area easier to capture touches
        this.output.style.touchAction = 'none';
        this.output.style.webkitUserSelect = 'none';
        this.output.style.userSelect = 'none';

        // Mobile touch event handlers
        this.output.addEventListener('touchstart', (ev) => this.handleTouchStart(ev));
        this.output.addEventListener('touchmove', (ev) => this.handleTouchMove(ev));
        this.output.addEventListener('touchend', (ev) => this.handleTouchEnd(ev));
        this.output.addEventListener('touchcancel', () => this.handleTouchCancel());

        // Prevent ghost clicks
        document.addEventListener('click', (ev) => this.preventGhostClick(ev), true);
    }

    setupCommonClickHandlers() {
        document.addEventListener('click', (e) => {
            // Don't clear during active selections
            if (this.desktop?.isSelecting || this.mobile?.touchSelecting) {
                return;
            }

            // Only clear if clicking on blank areas of the page
            const isOutput = this.output.contains(e.target);
            const isUIControl = this.isUIControl(e.target);
            const isTooltip = e.target.closest('.tooltip') || e.target.closest('.group-tooltip');

            // if (!isOutput && !isUIControl && !isTooltip) {
            //     console.log("🗑️ Click on blank area - clearing selections");
            //     this.clearAllSelections();
            // }
        });
    }

    // ========== DESKTOP EVENT HANDLERS ==========
    handleDesktopSelectionStart(target, event) {
        this.desktop.dragStartTime = Date.now();
        this.desktop.isDragging = false;
        this.desktop.potentialStartSpan = target;

        // Check if clicking on existing group - remove it
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
                // Check if this was a click on an existing group (already handled in touchstart)
                const existingGroupId = this.desktop.potentialStartSpan.dataset.selectionGroup || this.desktop.potentialStartSpan.dataset.groupId;
                if (!existingGroupId) {
                    console.log('👆 Quick tap on individual word');
                    // Only handle individual word click if not part of a group
                    this.handleIndividualWordClick(this.desktop.potentialStartSpan);
                } else {
                    console.log('👆 Quick tap on existing group');
                }
            } else if (this.desktop.isSelecting) {
                // Drag selection - finish it
                console.log('🖱️ Finishing drag selection');
                this.finishDesktopSelection();
            }

            this.desktop.potentialStartSpan = null;
            this.desktop.isDragging = false;
            this.desktop.isSelecting = false;
        }
    }

    // Add this temporary method for testing
    setupDirectWordClicks() {
        console.log('🔧 Setting up direct word clicks for testing');

        this.output.addEventListener('click', (e) => {
            if (e.target.tagName === 'SPAN' && e.target.classList.contains('cursor-pointer')) {
                console.log('🎯 DIRECT CLICK on word:', e.target.textContent);
                console.log('🔍 Is part of group?', !!e.target.dataset.selectionGroup || !!e.target.dataset.groupId);

                // Don't handle if it's part of a group
                if (!e.target.dataset.selectionGroup && !e.target.dataset.groupId) {
                    console.log('🚀 Calling handleIndividualWordClick directly');
                    this.handleIndividualWordClick(e.target);
                    e.stopPropagation(); // Prevent other handlers
                }
            }
        });
    }

    startDesktopSelection(startSpan) {
        // Don't start selection if this is an individually highlighted word or part of existing group
        if (startSpan.classList.contains('highlighted') || startSpan.dataset.selectionGroup || startSpan.dataset.groupId) {
            return;
        }

        this.desktop.isSelecting = true;
        this.desktop.selectionStartSpan = startSpan;
        this.desktop.currentGroupId = 'desktop_group_' + Date.now();

        // Highlight the start span with group ID
        startSpan.classList.add('multi-highlighted');
        startSpan.dataset.selectionGroup = this.desktop.currentGroupId;
    }

    updateDesktopSelection(currentSpan) {
        if (!this.desktop.isSelecting || !this.desktop.selectionStartSpan) return;

        // Clear only the current group being selected (not others)
        this.clearCurrentDesktopGroupSelection();

        // Get all spans
        const allSpans = Array.from(this.output.querySelectorAll('span'));
        const startIndex = allSpans.indexOf(this.desktop.selectionStartSpan);
        const currentIndex = allSpans.indexOf(currentSpan);

        if (startIndex === -1 || currentIndex === -1) return;

        // Highlight all spans between start and current for current group
        const start = Math.min(startIndex, currentIndex);
        const end = Math.max(startIndex, currentIndex);

        for (let i = start; i <= end; i++) {
            // Only highlight if not already part of another group
            if (!allSpans[i].dataset.selectionGroup && !allSpans[i].dataset.groupId) {
                allSpans[i].classList.add('multi-highlighted');
                allSpans[i].dataset.selectionGroup = this.desktop.currentGroupId;
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

        // Get selected text
        const selectedText = selectedSpans.map(span => span.textContent).join(' ').trim();

        if (!selectedText) {
            this.clearCurrentDesktopGroupSelection();
            return;
        }

        this.speech.speak(selectedText);

        // Translate first, then store
        let translation = "";
        try {
            translation = await this.translate(selectedText);
        } catch (error) {
            console.error("Translation error:", error);
            translation = "(translation failed)";
        }

        // Store this selection group with proper translation
        this.storeSelectionGroup(selectedSpans, selectedText, translation, this.desktop.currentGroupId);

        // Show tooltip for this group
        const firstSpan = selectedSpans[0];
        const rect = firstSpan.getBoundingClientRect();
        this.showSelectionTooltip(selectedText, rect, this.desktop.currentGroupId, translation);

        this.desktop.selectionStartSpan = null;
        this.desktop.currentGroupId = null;
    }

    // ========== MOBILE EVENT HANDLERS ==========
    handleTouchStart(ev) {
        if (ev.touches.length > 1) return;

        const t = ev.touches[0];
        const span = this.spanFromPoint(t.clientX, t.clientY);

        if (span && this.isWordSpan(span)) {
            this.mobile.touchSelecting = true;
            this.mobile.touchStartTime = Date.now();
            this.mobile.touchStartSpan = span; // Store the starting span

            // Check if clicking on existing GROUP - remove it immediately
            const existingGroupId = span.dataset.groupId || span.dataset.selectionGroup;
            if (existingGroupId) {
                console.log("🗑️ Tapped on existing group - removing it");
                this.clearSelectionGroup(existingGroupId);
                this.mobile.touchSelecting = false;
                return;
            }

            // Clear previous selection and start new one
            this.mobile.touchedSpans.forEach(s => {
                s.classList.remove('touch-feedback');
                s.classList.remove('multi-highlighted');
            });
            this.mobile.touchedSpans.clear();

            // Start with just the first span
            this.mobile.touchedSpans.add(span);
            // This is seems to be confusing 
            // span.classList.add('touch-feedback');
            // span.classList.add('multi-highlighted');
            span.style.zIndex = '30';

        } else {
            this.mobile.touchSelecting = false;
        }
    }

    // Add this helper method to get all spans between two spans
    getSpansBetween(startSpan, endSpan) {
        const allSpans = Array.from(this.output.querySelectorAll('span'));
        const startIndex = allSpans.indexOf(startSpan);
        const endIndex = allSpans.indexOf(endSpan);

        if (startIndex === -1 || endIndex === -1) return [];

        const start = Math.min(startIndex, endIndex);
        const end = Math.max(startIndex, endIndex);

        return allSpans.slice(start, end + 1);
    }

    // Update handleTouchMove to select ranges


    handleTouchMove(ev) {
        if (!this.mobile.touchSelecting || !this.mobile.touchStartSpan) return;

        const t = ev.touches[0];
        const currentSpan = this.spanFromPoint(t.clientX, t.clientY);

        if (currentSpan && this.isWordSpan(currentSpan)) {
            // Get all spans between start and current position
            const spansBetween = this.getSpansBetween(this.mobile.touchStartSpan, currentSpan);

            // Clear previous selection
            this.mobile.touchedSpans.forEach(span => {
                if (!spansBetween.includes(span)) {
                    span.classList.remove('touch-feedback');
                    span.classList.remove('multi-highlighted');
                }
            });
            this.mobile.touchedSpans.clear();

            // Add all spans in between to selection
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

        // Remove temporary visual feedback
        this.mobile.touchedSpans.forEach(span => {
            span.classList.remove('touch-feedback');
        });

        // Handle single word toggle (only if it's truly a single word tap)
        if (isQuickTap && spansArr.length === 1) {
            const singleSpan = spansArr[0];
            const isAlreadyHighlighted = singleSpan.classList.contains("highlighted");
            const hasGroup = singleSpan.dataset.groupId || singleSpan.dataset.selectionGroup;

            if (!hasGroup && isAlreadyHighlighted) {
                console.log("❌ Quick tap on highlighted word - removing highlight");
                singleSpan.classList.remove("highlighted");
                singleSpan.classList.remove("multi-highlighted");
                singleSpan.querySelector(".tooltip")?.remove();

                // Clean up from selectionGroups
                const individualGroups = Array.from(this.selectionGroups.entries())
                    .filter(([id, group]) => group.spans.length === 1 && group.spans[0] === singleSpan);
                individualGroups.forEach(([id, group]) => this.selectionGroups.delete(id));

                this.mobile.touchedSpans.clear();
                return;
            }
        }

        // If no spans, exit early
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

        // Remove existing tooltip and multi-highlight
        span.querySelector('.tooltip')?.remove();
        span.classList.remove('multi-highlighted'); // Add this line

        try {
            const translated = await this.translate(phrase);
            console.log("✅ Translation:", translated);

            // Create and add tooltip
            const tip = document.createElement("div");
            tip.className = "tooltip";
            tip.textContent = translated;
            tip.style.whiteSpace = "nowrap";
            tip.style.textOverflow = "ellipsis";
            tip.style.overflow = "hidden";
            tip.style.zIndex = "1000";

            span.appendChild(tip);

            // Store in selection groups
            const groupId = "individual_" + Date.now();
            this.storeSelectionGroup([span], phrase, translated, groupId);

            // Set proper highlighting - only 'highlighted' class for single words
            span.classList.add('highlighted');
            // Don't add multi-highlighted for single words

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

        // Set group IDs on all spans
        spansArr.forEach(s => {
            s.dataset.groupId = groupId;
        });

        // Calculate dynamic font size based on word count
        const wordCount = spansArr.length;
        let fontSize, padding, fontWeight;

        if (wordCount >= 8) {
            // Small text for many words
            fontSize = '14px';
            padding = '4px 8px';
            fontWeight = '500';
        } else if (wordCount >= 5) {
            // Medium text for moderate words
            fontSize = '14px';
            padding = '6px 10px';
            fontWeight = '500';
        } else if (wordCount >= 3) {
            // Large text for few words
            fontSize = '16px';
            padding = '8px 12px';
            fontWeight = '500';
        } else {
            // Very large text for 2 words
            fontSize = '12px';
            padding = '10px 14px';
            fontWeight = '600';
        }

        console.log(`📏 Dynamic sizing: ${wordCount} words -> ${fontSize} font`);

        // Create group tooltip with dynamic sizing
        const tooltip = document.createElement("div");
        tooltip.className = "group-tooltip";
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
        max-width: 80vw; /* Prevent too wide on mobile */
        text-align: center;
        border-left: 3px solid #3b82f6;

    `;

        // Position above first word
        const firstRect = spansArr[0].getBoundingClientRect();
        tooltip.style.left = (firstRect.left + window.scrollX) + "px";
        tooltip.style.top = (firstRect.top + window.scrollY - 10) + "px";

        document.body.appendChild(tooltip);

        // Translate
        let translation = "";
        try {
            translation = await this.translate(phrase);
        } catch (err) {
            console.error("translate() failed:", err);
            translation = "(translation error)";
        }

        // Update tooltip text
        tooltip.textContent = translation;

        // Adjust position based on the actual tooltip size
        tooltip.style.top = (firstRect.top + window.scrollY - tooltip.offsetHeight - 1) + "px";

        // Center the tooltip over the selection if it's a long phrase
        if (wordCount > 3) {
            const lastRect = spansArr[spansArr.length - 1].getBoundingClientRect();
            const selectionCenter = (firstRect.left + lastRect.right) / 2;
            tooltip.style.left = (selectionCenter - (tooltip.offsetWidth / 2) + window.scrollX) + "px";
        }

        // Store in main selectionGroups
        this.storeSelectionGroup(spansArr, phrase, translation, groupId);

        // Also store tooltip reference
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
            // Use a temporary visual class instead of 'highlighted'
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
        console.log('📍 Span element:', span);
        console.log('🔍 Span classes:', span.className);
        console.log('📦 Vocab panel exists:', !!this.vocabPanel.vocabInfoPanel);

        // Don't handle if it's part of a group
        if (span.dataset.selectionGroup || span.dataset.groupId) {
            console.log('⏭️ Skipping - word is part of group');
            return;
        }

        const word = span.textContent.trim();
        console.log('🔍 Processing word:', word);

        // Show vocabulary info panel
        console.log('📤 Calling showVocabInfoForWord with word:', word);
        this.vocabPanel.showVocabInfoForWord(word, span);

        // KEEP YOUR ORIGINAL TOGGLE BEHAVIOR - DON'T CHANGE THIS
        if (span.classList.contains('highlighted')) {
            console.log('🗑️ Removing highlight');
            // Remove highlight and tooltip
            span.classList.remove('highlighted');
            span.querySelector('.tooltip')?.remove();
        } else {
            console.log('✨ Adding highlight');
            // Add highlight and translation
            this.highlightAndTranslateIndividualWord(span);
        }
    }

    async highlightAndTranslateIndividualWord(span) {
        const word = span.textContent.trim();
        if (!word) return;

        console.log('Translating individual word:', word);

        span.classList.add('highlighted');
        span.classList.add('loading');

        // Speak the word
        this.speech.speak(word);

        // Translate the word
        try {
            const translated = await this.translate(word);
            span.classList.remove('loading');

            // Remove existing tooltip if any
            span.querySelector('.tooltip')?.remove();

            // Add new tooltip
            const tip = document.createElement("div");
            tip.className = "tooltip";
            tip.textContent = translated;
            tip.style.whiteSpace = "nowrap";
            tip.style.textOverflow = "ellipsis";
            tip.style.overflow = "hidden";
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

        // Remove from groups map if it exists
        if (this.selectionGroups.has(this.desktop.currentGroupId)) {
            this.selectionGroups.delete(this.desktop.currentGroupId);
        }

        // Remove the tooltip for this group
        this.removeGroupTooltip(this.desktop.currentGroupId);
    }

    findSpanGroupId(span) {
        return span.dataset.selectionGroup || span.dataset.groupId || null;
    }

    clearSelectionGroup(groupId) {
        // Remove highlights from all spans in this group
        const groupSpans = this.output.querySelectorAll(`[data-selection-group="${groupId}"], [data-group-id="${groupId}"], [data-groupId="${groupId}"]`);
        groupSpans.forEach(span => {
            span.classList.remove('multi-highlighted');
            span.classList.remove('highlighted');
            delete span.dataset.selectionGroup;
            delete span.dataset.groupId;
            span.querySelector('.tooltip')?.remove();
        });

        // Remove from selection groups
        this.selectionGroups.delete(groupId);

        // Remove tooltip
        this.removeGroupTooltip(groupId);

        console.log(`Cleared selection group ${groupId}`);
    }

    clearAllSelections() {
        const highlightedSpans = this.output.querySelectorAll("span.multi-highlighted, span.highlighted");
        const selectionGroups = this.output.querySelectorAll(".group-tooltip");
        console.log('---> ', selectionGroups);

        highlightedSpans.forEach(span => {
            span.classList.remove("multi-highlighted");
            span.classList.remove("highlighted");
            delete span.dataset.selectionGroup;
            delete span.dataset.groupId;
            span.querySelector('.tooltip')?.remove();
        });

        this.selectionGroups.clear();
        if (this.mobile) {
            this.mobile.groups.clear();
            this.mobile.touchedSpans.clear();
        }

        // Remove all group tooltips
        this.groupTooltips.forEach((tooltip, groupId) => {
            if (tooltip && tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
        });
        this.groupTooltips.clear();

        if (this.selectionHighlight) {
            this.selectionHighlight.remove();
            this.selectionHighlight = null;
        }

        // Hide the main selection tooltip
        this.selectionTooltip.style.display = "none";
        this.selectionTooltip.textContent = "";

        // Reset desktop state
        if (this.desktop) {
            this.desktop.potentialStartSpan = null;
            this.desktop.isDragging = false;
            this.desktop.isSelecting = false;
            this.desktop.currentGroupId = null;
        }
        console.log("Cleared all selections");
    }

    storeSelectionGroup(spans, text, translation, groupId) {
        // Ensure we're storing the actual word text, not word + translation
        const actualText = spans.map(span => span.textContent.trim()).join(' ');

        const group = {
            spans: [...spans],
            text: actualText, // The actual selected text from spans
            translation: translation, // The translation
            timestamp: Date.now()
        };

        // Make sure groupId is provided and valid
        if (!groupId) {
            groupId = 'group_' + Date.now();
        }

        this.selectionGroups.set(groupId, group);
        console.log(`Stored selection group ${groupId}: "${actualText}" -> "${translation}"`);
    }

    showSelectionTooltip(text, rect, groupId, translation = '') {
        // Remove any existing tooltip for this specific group
        this.removeGroupTooltip(groupId);

        // Create a new tooltip for this group
        const tooltip = document.createElement('div');
        tooltip.className = 'group-tooltip';
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
            left: ${rect.left + window.scrollX}px;
            top: ${rect.top + window.scrollY - 40}px;
            display: block;
        `;

        if (translation) {
            tooltip.textContent = translation;
        } else {
            tooltip.textContent = "Translating...";
        }

        document.body.appendChild(tooltip);
        this.groupTooltips.set(groupId, tooltip);

        // Translate if not provided
        if (!translation) {
            this.translate(text).then(translated => {
                // Store translation in the group
                if (this.selectionGroups.has(groupId)) {
                    this.selectionGroups.get(groupId).translation = translated;
                }

                // Update the tooltip
                if (this.groupTooltips.has(groupId)) {
                    const tooltip = this.groupTooltips.get(groupId);
                    tooltip.textContent = translated;
                    tooltip.style.top = (rect.top + window.scrollY - tooltip.offsetHeight - 10) + 'px';
                }
            });
        }
    }

    removeGroupTooltip(groupId) {
        if (this.groupTooltips.has(groupId)) {
            const tooltip = this.groupTooltips.get(groupId);
            if (tooltip && tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
            this.groupTooltips.delete(groupId);
        }

        // Also remove any tooltips with data attributes
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

    // // ========== API METHODS (you'll need to implement these) ==========
    // speak(text) {
    //     // Your speech implementation
    //     console.log("Speaking:", text);
    // }

    // async translate(text) {
    //     // Your translation implementation
    //     console.log("Translating:", text);
    //     return text;
    // }

    // This method should also be in your class
    async highlightAndTranslateIndividualWord(span) {
        const word = span.textContent.trim();
        if (!word) return;

        console.log('Translating individual word:', word);

        span.classList.add('highlighted');
        span.classList.add('loading');

        // Speak the word
        this.speech.speak(word);

        // Translate the word
        try {
            const translated = await this.translate(word);
            span.classList.remove('loading');

            // Remove existing tooltip if any
            span.querySelector('.tooltip')?.remove();

            // Add new tooltip
            const tip = document.createElement("div");
            tip.className = "tooltip";
            tip.textContent = translated;
            tip.style.whiteSpace = "nowrap";
            tip.style.textOverflow = "ellipsis";
            tip.style.overflow = "hidden";
            span.appendChild(tip);

            console.log('Individual word translation:', translated);
        } catch (error) {
            span.classList.remove('loading');
            console.error('Translation error:', error);
        }
    }

    // Updated clearCurrentGroupSelection method
    clearCurrentGroupSelection() {
        if (!this.currentGroupId) return;

        const currentGroupSpans = this.getCurrentGroupSpans();
        currentGroupSpans.forEach(span => {
            span.classList.remove('multi-highlighted');
            delete span.dataset.selectionGroup;
        });

        // Remove from groups map if it exists
        if (this.selectionGroups.has(this.currentGroupId)) {
            this.selectionGroups.delete(this.currentGroupId);
        }

        // Remove the tooltip for this group
        this.removeGroupTooltip(this.currentGroupId);
    }
    // setupTooltipHover() {
    //     this.output.addEventListener('mouseover', (e) => {
    //         if (e.target.tagName === 'SPAN' && !this.isSelecting) {
    //             const groupId = this.findSpanGroupId(e.target);
    //             if (groupId && this.selectionGroups.has(groupId)) {
    //                 this.showTooltipForGroup(groupId);
    //             }
    //         }
    //     });

    //     this.output.addEventListener('mouseout', (e) => {
    //         if (e.target.tagName === 'SPAN') {
    //             const groupId = this.findSpanGroupId(e.target);
    //             if (groupId && this.selectionGroups.has(groupId)) {
    //                 // Don't hide immediately - give user time to read
    //                 setTimeout(() => {
    //                     if (!this.output.matches(':hover')) {
    //                         this.selectionTooltip.style.display = "none";
    //                     }
    //                 }, 1000);
    //             }
    //         }
    //     });
    // }

    setupEventListeners() {
        this.processBtn.addEventListener("click", () => {
            this.output.innerHTML = "";
            this.isProcessed = !this.isProcessed;
            this.processBtn.innerText = this.isProcessed ? "Reset" : "Process";
            const focusModeGoBTN = document.getElementById("focus-go-btn");
            if (focusModeGoBTN) {
                focusModeGoBTN.innerText = this.processBtn.innerText;
            }
            // In your processBtn click handler:
            this.tokenize(this.input.value).forEach((tok) => {
                if (/^[A-Za-zÄÖÜäöüß]+$/.test(tok)) {
                    const span = document.createElement("span");
                    span.textContent = tok;
                    span.className = "relative cursor-pointer hover:bg-yellow-100 rounded mx-0.5";

                    this.output.appendChild(span);
                } else {
                    this.output.appendChild(document.createTextNode(tok));
                }
            });
            this.setStatus("Text processed");
            this.clearAllSelections();
        });

        this.stopSpeechBtn.addEventListener("click", () => this.speech.stopSpeech());

        this.playBtn.addEventListener('click', () => {
            const text = this.input.value;
            const focusModePlayBTN = document.getElementById("focus-play-btn");

            if (!this.isSpeaking) {
                const selectedVoiceName = this.voiceSelect.value;
                this.speakText(text, selectedVoiceName, this.rate);
            } else if (!this.isPaused) {
                this.speechSynth.pause();
                this.isPaused = true;
                playBtn.textContent = 'Resume';
            } else {
                this.speechSynth.resume();
                this.isPaused = false;
                playBtn.textContent = 'Pause';
            }
            if (focusModePlayBTN) {
                focusModePlayBTN.textContent = playBtn.textContent;
            }
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

    // Add to Flashcard functionality


    createAddToFlashcardButton() {
        const addToFlashBtn = document.createElement('button');
        addToFlashBtn.id = "addToFlashBtn";
        addToFlashBtn.className = "px-4 py-2 bg-yellow-500 text-white rounded-lg shadow w-1/2 hover:bg-yellow-600";
        addToFlashBtn.textContent = "Add to Flashcards";
        const extraToolsContainer = document.getElementById('extra-tools-container');
        if (extraToolsContainer) {
            // extraToolsContainer.insertAdjacentElement('beforeend', addToFlashBtn);
            extraToolsContainer.insertBefore(addToFlashBtn, extraToolsContainer.firstChild);
        }
        // this.processBtn.parentNode.insertBefore(addToFlashBtn, this.processBtn.nextSibling);
        addToFlashBtn.addEventListener('click', () => this.handleAddToFlashcard());
    }

    createModal() {
        const modal = document.createElement('div');
        modal.id = "add-to-flash-modal";
        modal.className = "fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-45 hidden";
        modal.innerHTML = `
            <div id="single-add-model" class="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative">
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

    groupSpansBySelection(spans) {
        const groups = [];
        let currentGroup = [];

        // Convert NodeList to Array and sort by DOM position
        const spansArray = Array.from(spans).sort((a, b) => {
            return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });

        for (let i = 0; i < spansArray.length; i++) {
            const span = spansArray[i];

            if (span.classList.contains('multi-highlighted')) {
                // Add to current group if it's multi-highlighted
                currentGroup.push(span);
            } else {
                // If we have a current group, save it and start new
                if (currentGroup.length > 0) {
                    groups.push([...currentGroup]);
                    currentGroup = [];
                }
                // Single highlighted word gets its own group
                groups.push([span]);
            }
        }

        // Don't forget the last group
        if (currentGroup.length > 0) {
            groups.push(currentGroup);
        }

        return groups;
    }

    async getCurrentHighlightedWords() {
        // Get all highlighted spans (both individual and multi-highlighted)
        const spans = this.output.querySelectorAll('.highlighted, .multi-highlighted');
        console.log("Found highlighted spans:", spans.length);

        if (spans.length === 0) {
            return null;
        }

        // Group spans by selection groups (multi-highlighted spans that are adjacent)
        const selectionGroups = this.groupSpansBySelection(spans);

        const results = [];

        for (const group of selectionGroups) {
            if (group.length === 1) {
                // Single word selection
                const span = group[0];
                const word = span.childNodes[0]?.textContent || span.textContent;
                const tip = span.querySelector('.tooltip');
                const translation = tip ? tip.textContent : '';

                if (word && translation) {
                    results.push({
                        words: [word],
                        translation: translation,
                        type: 'single',
                        isGroup: false
                    });
                }
            } else {
                // Multi-word selection
                const words = group.map(span => span.childNodes[0]?.textContent || span.textContent).filter(Boolean);
                const phrase = words.join(' ');

                if (phrase) {
                    let translation = '';

                    // Try to get translation from selection tooltip first
                    const selectionTooltip = document.getElementById('selectionTooltip');
                    if (selectionTooltip && selectionTooltip.style.display !== 'none') {
                        translation = selectionTooltip.textContent;
                    }

                    // If no group translation available, translate the phrase
                    if (!translation || translation === "Translating..." || translation === "(translation error)") {
                        translation = await this.translate(phrase);
                    }

                    if (translation && translation !== "(error)") {
                        results.push({
                            words: words,
                            translation: translation,
                            type: 'group',
                            isGroup: true
                        });
                    }
                }
            }
        }

        console.log("Processed selections:", results);
        return results.length > 0 ? results : null;
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
        await new Promise(resolve => setTimeout(resolve, 100));

        if (allSelections.length === 1) {
            // Single selection - show normal modal
            const selection = allSelections[0];
            this.showAddToFlashModal(selection.text, selection.translation);
        } else {
            // Multiple selections - show batch modal (now async)
            await this.showBatchAddToFlashModal(allSelections);
        }

        // Reset button state
        addToFlashBtn.disabled = false;
        addToFlashBtn.style.opacity = '1';
        addToFlashBtn.textContent = originalText;
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
            const word = this.getSpanTextContent(span);
            const tooltip = span.querySelector('.tooltip');
            const translation = tooltip ? tooltip.textContent : '';

            console.log(`Individual span ${index}:`, {
                text: word,
                hasSelectionGroup,
                hasGroupId,
                translation,
                dataset: { ...span.dataset }
            });

            // Skip if it's part of a group
            if (hasSelectionGroup || hasGroupId) {
                console.log(`Skipping - part of group: ${word}`);
                return;
            }

            if (word && translation) {
                selections.push({
                    words: [word],
                    text: word,
                    translation: translation,
                    type: 'individual',
                    isGroup: false,
                    wordCount: 1
                });
                console.log(`Added individual: "${word}" -> "${translation}"`);
            }
        });

        // 2. Debug selectionGroups
        console.log("SelectionGroups map size:", this.selectionGroups.size);
        console.log("SelectionGroups content:", Array.from(this.selectionGroups.entries()));

        // Get all grouped words from the main selectionGroups map
        this.selectionGroups.forEach((group, groupId) => {
            console.log(`Processing group ${groupId}:`, {
                text: group.text,
                translation: group.translation,
                spanCount: group.spans ? group.spans.length : 0,
                spans: group.spans ? group.spans.map(s => s.textContent.trim()) : []
            });

            // Safe checks
            if (!groupId || !group.text || !group.translation) {
                console.log(`Skipping group ${groupId} - missing data`);
                return;
            }

            // Check if this is a real group (more than 1 word) or mobile/desktop group
            const isRealGroup = group.spans && group.spans.length > 1;
            const isMobileGroup = groupId.includes('mobile_g');
            const isDesktopGroup = groupId.includes('desktop_group_');

            console.log(`Group ${groupId} checks:`, {
                isRealGroup,
                isMobileGroup,
                isDesktopGroup,
                spanCount: group.spans ? group.spans.length : 0
            });

            if (isRealGroup || isMobileGroup || isDesktopGroup) {
                const words = group.spans ? group.spans.map(span => span.textContent.trim()) : [];
                selections.push({
                    words: words,
                    text: group.text,
                    translation: group.translation,
                    type: 'group',
                    isGroup: true,
                    wordCount: words.length,
                    groupId: groupId
                });
                console.log(`Added group: "${group.text}" -> "${group.translation}"`);
            } else {
                console.log(`Skipping - not a real group: ${groupId}`);
            }
        });

        console.log(`=== FINAL: ${selections.length} total selections ===`);
        selections.forEach((sel, index) => {
            console.log(`Selection ${index}:`, {
                text: sel.text,
                translation: sel.translation,
                type: sel.type,
                wordCount: sel.wordCount,
                isGroup: sel.isGroup
            });
        });

        return selections;
    }

    createBatchAddModal() {
        const modal = document.createElement('div');
        modal.id = "batch-add-to-flash-modal";
        modal.className = "fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-40 hidden";
        modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <button id="close-batch-add-modal" class="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl">&times;</button>
            <h3 class="text-lg font-bold text-indigo-700 mb-4">Add Multiple Words to Flashcards</h3>
            
            <div class="mb-4 flex-1 overflow-y-auto">
                <div id="batch-selections-list" class="space-y-3"></div>
            </div>
            
            <div class="mt-4">
                <label class="block text-sm font-medium mb-2">Add to list:</label>
                <div class="flex gap-2">
                    <select id="batch-list-select" class="flex-1 p-2 border rounded max-w-[50%]">
                        <option value="">Select a list...</option>
                    </select>
                    <input id="batch-new-list-name" type="text" class="flex-1 p-2 border rounded max-w-md" placeholder="Or create new list">
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

        // Event listeners for batch modal
        document.getElementById('close-batch-add-modal').addEventListener('click', () => {
            modal.classList.add('hidden');
        });

        document.getElementById('batch-cancel-btn').addEventListener('click', () => {
            modal.classList.add('hidden');
        });

        document.getElementById('batch-add-all-btn').addEventListener('click', () => {
            this.handleBatchAdd();
        });

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
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

            selectionDiv.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex-1">
                    <div class="font-semibold text-gray-800 german-word">${selection.words.join(' ')}</div>
                    <div class="text-sm text-gray-600">${selection.translation}</div>
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
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const word = btn.dataset.word;
                    const index = parseInt(btn.dataset.index);

                    // Check if this is a "Make Sure" click for multiple articles
                    if (btn.textContent.includes('⚠️ Make Sure') && btn.dataset.allArticles) {
                        this.article.showArticleDetails(word, JSON.parse(btn.dataset.allArticles), btn);
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

    setupAddToFlashcardModal() {
        this.createAddToFlashcardButton();
        this.createModal();
        this.createBatchAddModal();
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
            // We need to store the selections data or reconstruct it
            const selectionDiv = checkbox.closest('.p-3');
            const germanText = selectionDiv.querySelector('.font-semibold').textContent;
            const englishText = selectionDiv.querySelector('.text-sm').textContent;
            selections.push({ german: germanText, english: englishText });
        });

        let customLists = JSON.parse(localStorage.getItem('customGermanLists')) || {};

        // Create new list if it doesn't exist
        if (!customLists[selectedListName]) {
            customLists[selectedListName] = [];
        }

        let addedCount = 0;
        let skippedCount = 0;

        selections.forEach(selection => {
            const exists = customLists[selectedListName].some(card =>
                card.german === selection.german && card.english === selection.english
            );

            if (!exists) {
                customLists[selectedListName].push({
                    german: selection.german,
                    english: selection.english,
                    mastered: false
                });
                addedCount++;
            } else {
                skippedCount++;
            }
        });

        localStorage.setItem('customGermanLists', JSON.stringify(customLists));
        // Refresh flashcard lists
        this.flashcardLists.refreshFlashcardLists();

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

    showAddToFlashModal(word, translation) {
        const modal = document.getElementById('add-to-flash-modal');
        if (!modal) {
            this.createModal();
        }

        modal.classList.remove('hidden');
        document.getElementById('selected-word-preview').textContent = `"${word}" → "${translation}"`;

        // Mobile-specific modal positioning
        if (this.isTouchDevice) {
            modal.style.position = 'fixed';
            modal.style.top = '50%';
            modal.style.left = '50%';
            modal.style.transform = 'translate(-50%, -50%)';
            modal.style.width = '90%';
            modal.style.maxWidth = '400px';
        }

        const listsDiv = document.getElementById('flashcard-lists');
        const customLists = JSON.parse(localStorage.getItem('customGermanLists')) || {};
        listsDiv.innerHTML = ''; // Clear previous content

        const select = document.createElement('select');
        select.className = "px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm w-full";
        select.style.minHeight = '44px'; // Mobile touch target

        // Optional default option
        const defaultOption = document.createElement('option');
        defaultOption.textContent = 'Choose a list';
        defaultOption.disabled = true;
        defaultOption.selected = true;
        select.appendChild(defaultOption);

        // Add each list as an option
        Object.keys(customLists).forEach(listName => {
            const option = document.createElement('option');
            option.value = listName;
            option.textContent = listName;
            select.appendChild(option);
        });

        // Handle selection
        select.onchange = () => {
            const selectedList = select.value;
            this.flashcardLists.addWordToList(selectedList, word, translation);
        };

        listsDiv.appendChild(select);

        document.getElementById('add-flashcard-status').textContent = '';
        document.getElementById('new-list-name').value = '';

        // Mobile: focus on new list input
        setTimeout(() => {
            document.getElementById('new-list-name').focus();
        }, 300);
    }

    // Enhanced focus mode with mobile support
    setupFocusMode() {
        const vocabTool = document.getElementById('vocab-tool');

        document.addEventListener('keydown', (e) => {
            // check if output div is not hidde
            if (this.output.style.display === 'none' || vocabTool.classList.contains('hidden')) return;
            // Check for Alt+Shift+G
            if (e.altKey && e.shiftKey && e.key === 'G') {
                e.preventDefault();
                this.toggleFocusMode();
            }

            // Escape to exit focus mode
            if (this.isFocusMode && e.key === 'Escape') {
                e.preventDefault();
                this.toggleFocusMode();
            }
        });

        // Mobile: Add touch gesture for focus mode (optional)
        this.setupMobileFocusModeGesture();
    }

    // Toggle focus mode
    toggleFocusMode() {
        if (this.isFocusMode) {
            this.exitFocusMode();
        } else {
            this.enterFocusMode();
        }
    }

    // Optional: Mobile gesture for focus mode
    setupMobileFocusModeGesture() {
        let touchStartY = 0;
        let touchCount = 0;
        let lastTouchTime = 0;

        document.addEventListener('touchstart', (e) => {
            if (e.touches.length === 3) { // Three-finger touch
                touchStartY = e.touches[0].clientY;
                touchCount = e.touches.length;
                lastTouchTime = Date.now();
            }
        });

        document.addEventListener('touchend', (e) => {
            if (touchCount === 3 && Date.now() - lastTouchTime < 1000) {
                // Three-finger tap to toggle focus mode
                this.toggleFocusMode();
            }
            touchCount = 0;
        });
    }

    // Enhanced enter focus mode
    enterFocusMode() {
        if (this.isFocusMode) return;

        console.log('Entering focus mode');
        this.isFocusMode = true;

        // Reset tool tips
        this.processBtn.click()

        // Store original state
        this.originalState = {
            bodyOverflow: document.body.style.overflow,
            bodyBg: document.body.style.backgroundColor,
            outputClasses: this.output.className,
            outputStyle: this.output.getAttribute('style') || ''
        };

        // Hide all elements in vocab-tool except output, selectionTooltip, and essential controls
        const vocabTool = document.getElementById('vocab-tool');
        const elementsToHide = Array.from(vocabTool.children).filter(
            child => !['output', 'selectionTooltip'].includes(child.id)
        );

        elementsToHide.forEach(element => {
            element.dataset.originalDisplay = element.style.display || '';
            element.style.display = 'none';
        });

        const vocabToolContainer = document.getElementById('vocab-tool-div');
        if (vocabToolContainer) {
            vocabToolContainer.dataset.originalDisplay = vocabToolContainer.style.display || '';
            vocabToolContainer.style.display = 'none';
        }

        // Create and show focus mode controls
        this.createFocusControls();

        // Apply focus mode styling
        this.applyFocusModeStyles();

        // Add focus mode indicator
        this.addFocusModeIndicator();

        // Setup observer to handle dynamically created tooltips
        this.setupTooltipObserver();
    }

    // Setup MutationObserver to watch for dynamically created tooltips
    setupTooltipObserver() {
        // Create observer to watch for new tooltips
        this.tooltipObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        // Check if this is the group-tooltip or contains it
                        if (node.id === 'group-tooltip' || node.querySelector && node.querySelector('#group-tooltip')) {
                            this.styleTooltipForFocusMode();
                        }
                    }
                });
            });
        });

        // Start observing
        this.tooltipObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Also check if group-tooltip already exists
        this.styleTooltipForFocusMode();
    }

    // Create focus mode controls
    createFocusControls() {
        // Remove existing focus controls if any
        const existingControls = document.getElementById('focus-controls');
        if (existingControls) {
            existingControls.remove();
        }

        // Get references to original controls
        const originalProcessBtn = document.getElementById('processBtn');
        const originalPlayBtn = document.getElementById('playBtn');
        const originalStopBtn = document.getElementById('stopSpeechBtn');
        const originalRateSlider = document.getElementById('rateSlider');
        const originalRateSpan = document.getElementById('rateSliderSpan');
        const originalOfflineCheckbox = document.getElementById('offline-speak');
        const originalAddToFlashBtn = document.getElementById('addToFlashBtn');

        // Create focus controls container using innerHTML
        const focusControls = document.createElement('div');
        focusControls.id = 'focus-controls';
        focusControls.className = 'fixed top-10 left-1/2 transform -translate-x-1/2 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl p-4 shadow-lg flex gap-3 items-center min-w-[320px] justify-center z-50';

        focusControls.innerHTML = `
        <button id="focus-go-btn" class="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors">
            ${originalProcessBtn.innerText}
        </button>
        
        <button id="focus-play-btn" class="px-4 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition-colors">
            ${originalPlayBtn.innerText}
        </button>
        
        <button id="focus-stop-btn" class="px-3 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors">
            Stop Speech
        </button>
        
        <button id="focus-add-flash-btn" class="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors">
            ${originalAddToFlashBtn ? originalAddToFlashBtn.innerText : 'Add Flash'}
        </button>
        
        <div class="flex items-center gap-2">
            <span id="focus-rate-span" class="text-sm text-gray-700">${originalRateSpan.textContent}</span>
            <input id="focus-rate-slider" type="range" min="${originalRateSlider.min}" max="${originalRateSlider.max}" step="${originalRateSlider.step}" value="${originalRateSlider.value}" class="w-20">
        </div>
        
        <div class="flex items-center gap-2">
            <input id="focus-offline-checkbox" type="checkbox" ${originalOfflineCheckbox.checked ? 'checked' : ''} class="rounded">
            <label for="focus-offline-checkbox" class="text-sm font-medium text-gray-700">Offline</label>
        </div>
        
        <button id="focus-exit-btn" class="px-3 py-2 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600 transition-colors">
            ❌ Exit
        </button>
    `;

        // Add event listeners
        const focusGoBtn = focusControls.querySelector('#focus-go-btn');
        const focusPlayBtn = focusControls.querySelector('#focus-play-btn');
        const focusStopBtn = focusControls.querySelector('#focus-stop-btn');
        const focusAddFlashBtn = focusControls.querySelector('#focus-add-flash-btn');
        const focusRateSlider = focusControls.querySelector('#focus-rate-slider');
        const focusRateSpan = focusControls.querySelector('#focus-rate-span');
        const focusOfflineCheckbox = focusControls.querySelector('#focus-offline-checkbox');
        const focusExitBtn = focusControls.querySelector('#focus-exit-btn');

        focusGoBtn.onclick = () => originalProcessBtn.click();
        focusPlayBtn.onclick = () => originalPlayBtn.click();
        focusStopBtn.onclick = () => originalStopBtn.click();

        // Add to Flash button event listener
        if (originalAddToFlashBtn) {
            focusAddFlashBtn.onclick = () => originalAddToFlashBtn.click();
        } else {
            // If the original button doesn't exist, disable this one
            focusAddFlashBtn.disabled = true;
            focusAddFlashBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }

        focusExitBtn.onclick = () => this.exitFocusMode();

        focusRateSlider.oninput = (e) => {
            const newRate = parseFloat(e.target.value);

            // Update UI
            originalRateSlider.value = newRate;
            focusRateSpan.textContent = newRate;
            originalRateSpan.textContent = newRate;

            // Update the current rate
            this.rate = newRate;

            // If currently speaking, update the utterance rate
            if (this.isSpeaking && this.utterance) {
                this.utterance.rate = newRate;
            }

            // Dispatch event for other listeners
            originalRateSlider.dispatchEvent(new Event('input'));
        };

        focusOfflineCheckbox.onchange = (e) => {
            originalOfflineCheckbox.checked = e.target.checked;
            originalOfflineCheckbox.dispatchEvent(new Event('change'));
        };

        document.body.appendChild(focusControls);
    }

    // Enhanced exit focus mode
    exitFocusMode() {
        if (!this.isFocusMode) return;

        console.log('Exiting focus mode');
        this.isFocusMode = false;

        // Reset tool tips
        this.processBtn.click()

        // Remove focus controls
        const focusControls = document.getElementById('focus-controls');
        if (focusControls) {
            focusControls.remove();
        }

        // Stop observing for tooltips
        if (this.tooltipObserver) {
            this.tooltipObserver.disconnect();
            this.tooltipObserver = null;
        }

        // Show all hidden elements
        const vocabTool = document.getElementById('vocab-tool');
        const elementsToShow = Array.from(vocabTool.children).filter(
            child => child.hasAttribute('data-original-display')
        );

        elementsToShow.forEach(element => {
            const originalDisplay = element.dataset.originalDisplay;
            element.style.display = originalDisplay || '';
            delete element.dataset.originalDisplay;
        });

        const vocabToolContainer = document.getElementById('vocab-tool-div');
        if (vocabToolContainer && vocabToolContainer.hasAttribute('data-original-display')) {
            const originalDisplay = vocabToolContainer.dataset.originalDisplay;
            vocabToolContainer.style.display = originalDisplay || '';
            delete vocabToolContainer.dataset.originalDisplay;
        }

        // Restore tooltip z-index if it exists
        const groupTooltip = document.getElementById('group-tooltip');
        if (groupTooltip && groupTooltip.dataset.focusModeStyled) {
            groupTooltip.style.zIndex = ''; // Reset to original
            delete groupTooltip.dataset.focusModeStyled;
        }

        // Restore original styling
        this.restoreOriginalStyles();

        // Remove focus mode indicator
        this.removeFocusModeIndicator();
    }

    // Remove focus mode indicator
    removeFocusModeIndicator() {
        const indicator = document.getElementById('focus-mode-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    // Style existing or new tooltips for focus mode
    styleTooltipForFocusMode() {
        const groupTooltip = document.getElementById('group-tooltip');
        if (groupTooltip) {
            groupTooltip.style.zIndex = '10001';
            groupTooltip.dataset.focusModeStyled = 'true';
        }
    }

    // Apply focus mode styles
    applyFocusModeStyles() {
        // Get computed styles from the original output element
        const outputStyles = getComputedStyle(this.output);

        // Apply Tailwind classes - use absolute positioning and let content flow naturally
        this.output.className = 'focus-mode-output absolute top-28 mt-12 mx-10 left-4 right-4 z-30 bg-inherit text-inherit font-inherit p-8 text-[1.5rem] leading-loose min-h-screen';

        // Clear any inline styles
        this.output.style.cssText = '';

        // Style the selection tooltip with Tailwind
        if (this.selectionTooltip) {
            this.selectionTooltip.classList.add('z-[10001]');
        }

        // Style any existing group-tooltip
        this.styleTooltipForFocusMode();

        // Allow normal browser scroll - this is key!
        document.body.classList.remove('overflow-hidden');
        document.body.classList.add('overflow-auto');
    }

    // Update focus mode indicator to show controls hint
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

    // Restore original styles
    restoreOriginalStyles() {
        // Restore output
        if (this.originalState) {
            this.output.className = this.originalState.outputClasses;
            this.output.setAttribute('style', this.originalState.outputStyle);
        } else {
            this.output.removeAttribute('style');
        }

        // Restore selection tooltip
        if (this.selectionTooltip) {
            this.selectionTooltip.style.zIndex = '12';
        }

        // Restore body
        if (this.originalState) {
            document.body.style.overflow = this.originalState.bodyOverflow;
            document.body.style.backgroundColor = this.originalState.bodyBg;
        } else {
            document.body.style.overflow = '';
            document.body.style.backgroundColor = '';
        }
    }

}