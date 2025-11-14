import { SpeechService } from '../utils/vocab-tool-utils/speech.js';
import { TranslationService } from '../utils/vocab-tool-utils/translation.js';
import { VocabPanelManager } from '../utils/vocab-tool-utils/vocab-panel.js';
import { ActiveRecallModule } from '../utils/vocab-tool-utils/active-recall.js';
import { ArticleService } from '../utils/vocab-tool-utils/article-service.js';
import { FlashcardListService } from '../utils/vocab-tool-utils/flashcard-list.js';

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
        this.groupTooltips = new Map();
        this.isFocusMode = false;
        this.originalState = null;

        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        this.speech = new SpeechService(this);
        this.translation = new TranslationService(this);
        this.vocabPanel = new VocabPanelManager(this);
        this.AR = new ActiveRecallModule(this);
        this.article = new ArticleService(this);
        this.FCL = new FlashcardListService(this);
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
        this.speech.loadVoices();
        window.vocabTool = this;
        if (!this.isTouchDevice) {
            this.vocabSection.style.marginRight = 'calc(50% - 425px)';
        }
        this.processBtn.click();
    }

    showNotification(message, time = 3500) {
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

        const allSpans = Array.from(this.output.querySelectorAll('span'));
        const startIndex = allSpans.indexOf(this.desktop.selectionStartSpan);
        const currentIndex = allSpans.indexOf(currentSpan);

        if (startIndex === -1 || currentIndex === -1) return;

        const start = Math.min(startIndex, currentIndex);
        const end = Math.max(startIndex, currentIndex);

        for (let i = start; i <= end; i++) {
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

        const selectedText = selectedSpans.map(span => span.textContent).join(' ').trim();

        if (!selectedText) {
            this.clearCurrentDesktopGroupSelection();
            return;
        }

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
        const allSpans = Array.from(this.output.querySelectorAll('span'));
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
            tip.style.whiteSpace = "nowrap";
            tip.style.textOverflow = "ellipsis";
            tip.style.overflow = "hidden";
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
            this.vocabPanel.showVocabInfoForWord(word, span);
        }
    }

    async highlightAndTranslateIndividualWord(span) {
        const word = span.textContent.trim();
        if (!word) return;

        console.log('Translating individual word:', word);

        span.classList.add('highlighted');
        span.classList.add('loading');

        this.speech.speak(word);

        try {
            const translated = await this.translate(word);
            span.classList.remove('loading');

            span.querySelector('.tooltip')?.remove();

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
            span.querySelector('.tooltip')?.remove();
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

        if (!translation) {
            this.translate(text).then(translated => {
                if (this.selectionGroups.has(groupId)) {
                    this.selectionGroups.get(groupId).translation = translated;
                }

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

    setupEventListeners() {
        this.processBtn.addEventListener("click", () => {
            this.output.innerHTML = "";
            this.isProcessed = !this.isProcessed;
            this.processBtn.innerText = this.isProcessed ? "Reset" : "Process";
            const focusModeGoBTN = document.getElementById("focus-go-btn");
            if (focusModeGoBTN) {
                focusModeGoBTN.innerText = this.processBtn.innerText;
            }

            // Preserve newlines and natural text flow
            const lines = this.input.value.split('\n');

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
                        span.className = "inline-block relative cursor-pointer hover:bg-yellow-100 rounded mx-0.5 max-w-full";
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
        });

        this.stopSpeechBtn.addEventListener("click", () => this.speech.stopSpeech());

        this.playBtn.addEventListener('click', () => {
            const text = this.input.value;
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
                this.startWordHighlighting();
                this.isPaused = false;
                playBtn.textContent = 'Pause';
            }
            if (focusModePlayBTN) {
                focusModePlayBTN.textContent = this.playBtn.textContent;
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

        document.getElementById('batch-add-all-btn').addEventListener('click', () => {
            this.handleBatchAdd();
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

        selections.forEach(selection => {
            const exists = customLists[selectedListName].some(card =>
                card.german === selection.german && card.english === selection.english
            );

            if (!exists) {
                customLists[selectedListName].push({
                    german: selection.german,
                    sentence: selection.sentence,
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
            this.addWordToList(selectedList, word, translation);
        };

        listsDiv.appendChild(select);

        document.getElementById('add-flashcard-status').textContent = '';
        document.getElementById('new-list-name').value = '';

        // Mobile: focus on new list input
        setTimeout(() => {
            document.getElementById('new-list-name').focus();
        }, 300);
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

    setupAddToFlashcardModal() {
        this.createAddToFlashcardButton();
        this.createModal();
        this.createBatchAddModal();
    }

    // Focus Mode functionality
    setupFocusMode() {
        const vocabTool = document.getElementById('vocab-tool');

        document.addEventListener('keydown', (e) => {
            if (this.output.style.display === 'none' || vocabTool.classList.contains('hidden')) return;
            if (e.altKey && e.shiftKey && e.key === 'G') {
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
            if (touchCount === 3 && Date.now() - lastTouchTime < 1000) {
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
            outputStyle: this.output.getAttribute('style') || ''
        };

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

        this.createFocusControls();
        this.applyFocusModeStyles();
        this.addFocusModeIndicator();
        this.setupTooltipObserver();
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

        if (originalAddToFlashBtn) {
            focusAddFlashBtn.onclick = () => originalAddToFlashBtn.click();
        } else {
            focusAddFlashBtn.disabled = true;
            focusAddFlashBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }

        focusExitBtn.onclick = () => this.exitFocusMode();

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
    }

    exitFocusMode() {
        if (!this.isFocusMode) return;

        console.log('Exiting focus mode');
        this.isFocusMode = false;

        this.processBtn.click()

        const focusControls = document.getElementById('focus-controls');
        if (focusControls) {
            focusControls.remove();
        }

        if (this.tooltipObserver) {
            this.tooltipObserver.disconnect();
            this.tooltipObserver = null;
        }

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

        const groupTooltip = document.getElementById('group-tooltip');
        if (groupTooltip && groupTooltip.dataset.focusModeStyled) {
            groupTooltip.style.zIndex = '';
            delete groupTooltip.dataset.focusModeStyled;
        }

        this.restoreOriginalStyles();
        this.removeFocusModeIndicator();
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
        this.output.className = 'focus-mode-output absolute top-28 mt-12 mx-10 left-4 right-4 z-30 bg-inherit text-inherit font-inherit p-8 text-[1.5rem] leading-loose min-h-screen';
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