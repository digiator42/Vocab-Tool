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

        this.vocabInfoPanel = null;
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


        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupLanguageSelector();
        this.setupAddToFlashcardModal();
        this.setupSelectionSystem();
        this.setupActiveRecall();
        this.setupFocusMode();
        // this.setupManualSelection();
        // this.setupTooltipHover();
        this.setupFlashcardListSelection();
        this.createVocabInfoPanel();
        this.processBtn.click();
        this.loadVoices();
        window.vocabTool = this; // For debugging
        // this.forceShowVocabPanel();
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

    forceShowVocabPanel() {
        if (this.vocabInfoPanel) {
            this.vocabInfoPanel.style.display = 'block';
            this.vocabInfoPanel.style.visibility = 'visible';
            this.vocabInfoPanel.style.opacity = '1';
            this.vocabInfoPanel.style.zIndex = '9999';
            this.vocabInfoPanel.classList.remove('hidden');
            console.log('👁️ Panel forced to be visible');
        }
    }

    createVocabInfoPanel() {
        console.log('🏗️ Creating vocab info panel...');

        // Remove existing panel if any
        const existingPanel = document.getElementById('vocab-info-panel');
        if (existingPanel) {
            console.log('🗑️ Removing existing panel');
            existingPanel.remove();
        }

        // Create the panel with FIXED right positioning
        this.vocabInfoPanel = document.createElement('div');
        this.vocabInfoPanel.id = 'vocab-info-panel';
        this.vocabInfoPanel.className = 'fixed top-20 right-4 w-80 max-h-[80vh] bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden hidden';

        // Set initial content - ADD GERMAN ALTERNATIVES SECTION
        this.vocabInfoPanel.innerHTML = `
            <div class="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
                <div class="flex justify-between items-center">
                    <h3 class="text-lg font-bold">Vocabulary Details</h3>
                    <button id="close-vocab-panel" class="text-white hover:text-gray-200 text-xl">&times;</button>
                </div>
                <div id="vocab-main-word" class="text-xl font-bold mt-2">Click a word to see details</div>
                <div id="vocab-pos" class="text-sm opacity-90">Part of speech will appear here</div>
            </div>
            
            <div class="overflow-y-auto max-h-[calc(80vh-80px)]">
                <!-- Translation Section -->
                <div id="vocab-translation-section" class="p-4 border-b border-gray-100">
                    <h4 class="font-semibold text-gray-700 mb-2 flex items-center">
                        <span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                        Translation
                    </h4>
                    <div id="vocab-translation" class="text-lg font-medium text-gray-800">Translation will appear here</div>
                </div>
                
                <!-- German Alternatives Section -->
                <div id="vocab-german-alternatives-section" class="p-4 border-b border-gray-100 hidden">
                    <h4 class="font-semibold text-gray-700 mb-2 flex items-center">
                        <span class="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                        German Alternatives
                    </h4>
                    <div id="vocab-german-alternatives" class="flex flex-wrap gap-2">
                        <!-- German alternative words will appear here -->
                    </div>
                </div>
                
                <!-- Alternative Terms Section -->
                <div id="vocab-alternatives-section" class="p-4 border-b border-gray-100">
                    <h4 class="font-semibold text-gray-700 mb-2 flex items-center">
                        <span class="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                        English Alternatives
                    </h4>
                    <div id="vocab-alternatives" class="flex flex-wrap gap-2">
                        <span class="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">Click a word</span>
                    </div>
                </div>
                
                <!-- Examples Section -->
                <div id="vocab-examples-section" class="p-4 border-b border-gray-100">
                    <h4 class="font-semibold text-gray-700 mb-2 flex items-center">
                        <span class="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                        Example Sentences
                    </h4>
                    <div id="vocab-examples" class="space-y-3">
                        <div class="text-sm text-gray-500">Examples will appear here</div>
                    </div>
                </div>
                
                <!-- Extended Info Section -->
                <div id="vocab-extended-section" class="p-4">
                    <h4 class="font-semibold text-gray-700 mb-2 flex items-center">
                        <span class="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                        Extended Information
                    </h4>
                    <div id="vocab-extended-info" class="text-sm text-gray-600 space-y-1">
                        <div class="text-gray-400">Extended info will appear here</div>
                    </div>
                </div>
                
                <!-- Loading State -->
                <div id="vocab-loading" class="p-8 text-center hidden">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p class="text-gray-500 mt-2">Loading vocabulary data...</p>
                </div>
                
                <!-- Error State -->
                <div id="vocab-error" class="p-8 text-center hidden">
                    <p class="text-gray-500">No detailed vocabulary data available</p>
                </div>
            </div>
        `;

        document.body.appendChild(this.vocabInfoPanel);
        console.log('✅ Vocab panel created and added to DOM');

        // Verify the elements were created
        setTimeout(() => {
            this.verifyVocabPanelElements();
        }, 100);

        // Setup event listeners
        this.setupVocabPanelListeners();
    }

    // Add this simple method to update the panel directly
    updateVocabPanel(word, translationData) {
        if (!this.vocabInfoPanel) {
            this.createVocabInfoPanel();
        }

        if (translationData && translationData.dict) {
            this.populateVocabInfoPanel(word, translationData, null);
        }
    }

    setupVocabPanelListeners() {
        const closeBtn = document.getElementById('close-vocab-panel');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideVocabInfoPanel();
            });
        }

        // Close panel when clicking outside
        document.addEventListener('click', (e) => {
            if (this.vocabInfoPanel &&
                !this.vocabInfoPanel.contains(e.target) &&
                !e.target.closest('.cursor-pointer')) {
                this.hideVocabInfoPanel();
            }
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.vocabInfoPanel && !this.vocabInfoPanel.classList.contains('hidden')) {
                this.hideVocabInfoPanel();
            }
        });
    }

    async showVocabInfoForWord(word, spanElement) {
        console.log('🔄 showVocabInfoForWord called with:', word);

        if (!this.vocabInfoPanel) {
            console.log('📦 Creating vocab info panel...');
            this.createVocabInfoPanel();
        }

        // Show loading state
        this.showVocabLoading();
        console.log('⏳ Loading state shown');

        try {
            console.log('🌐 Fetching extended data for:', word);
            // Get extended translation data
            const extendedData = await this.translate(word, false, true);
            console.log('✅ Extended data received:', extendedData);

            if (extendedData && extendedData.dict) {
                console.log('📊 Data has dictionary entries');
                this.currentVocabData = extendedData;
                this.populateVocabInfoPanel(word, extendedData, spanElement);
            } else {
                console.log('❌ No dictionary data found');
                this.showVocabError();
            }
        } catch (error) {
            console.error('🚨 Error fetching vocabulary data:', error);
            this.showVocabError();
        }
    }

    populateVocabInfoPanel(word, data, spanElement) {
        // Hide loading/error states
        this.hideVocabLoading();
        this.hideVocabError();

        // ALWAYS position at the right side of screen - SIMPLE FIXED POSITION
        this.vocabInfoPanel.style.top = '100px';
        this.vocabInfoPanel.style.right = '2px';
        this.vocabInfoPanel.style.left = 'auto';

        // Populate main word and translation
        document.getElementById('vocab-main-word').textContent = word;

        const mainTranslation = data.sentences?.[0]?.trans || word;
        document.getElementById('vocab-translation').textContent = mainTranslation;

        // Populate part of speech and alternatives
        this.populateVocabDetails(data);

        // Show the panel
        this.vocabInfoPanel.classList.remove('hidden');
    }

    populateVocabDetails(data) {
        console.log('📊 populateVocabDetails called with:', data);

        const dictEntry = data.dict?.[0];

        // Part of Speech
        const posElement = document.getElementById('vocab-pos');
        if (posElement && dictEntry?.pos) {
            posElement.textContent = dictEntry.pos;
            console.log('🏷️ Part of speech set to:', dictEntry.pos);
        }

        // GERMAN ALTERNATIVES - Get from the highest scored English word
        const germanAlternativesSection = document.getElementById('vocab-german-alternatives-section');
        const germanAlternativesContainer = document.getElementById('vocab-german-alternatives');

        if (germanAlternativesSection && germanAlternativesContainer && dictEntry?.entry?.length > 0) {
            // Get the highest scored entry (first one is usually highest)
            const highestScoredEntry = dictEntry.entry[0];

            if (highestScoredEntry?.reverse_translation && highestScoredEntry.reverse_translation.length > 0) {
                console.log('🇩🇪 Populating German alternatives:', highestScoredEntry.reverse_translation);
                germanAlternativesContainer.innerHTML = '';

                highestScoredEntry.reverse_translation.forEach(germanWord => {
                    const badge = document.createElement('span');
                    badge.className = 'px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full border border-red-200';
                    badge.textContent = germanWord;
                    germanAlternativesContainer.appendChild(badge);
                });

                germanAlternativesSection.classList.remove('hidden');
                console.log('✅ German alternatives section shown');
            } else {
                germanAlternativesSection.classList.add('hidden');
                console.log('❌ No German reverse translations found');
            }
        } else {
            germanAlternativesSection.classList.add('hidden');
        }

        // ENGLISH ALTERNATIVE TERMS (existing code)
        const alternativesSection = document.getElementById('vocab-alternatives-section');
        const alternativesContainer = document.getElementById('vocab-alternatives');

        if (alternativesSection && alternativesContainer && dictEntry?.terms && dictEntry.terms.length > 1) {
            console.log('🔄 Populating English alternative terms:', dictEntry.terms);
            alternativesContainer.innerHTML = '';
            dictEntry.terms.forEach(term => {
                const badge = document.createElement('span');
                badge.className = 'px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full';
                badge.textContent = term;
                alternativesContainer.appendChild(badge);
            });
            alternativesSection.classList.remove('hidden');
        } else if (alternativesSection) {
            alternativesSection.classList.add('hidden');
        }

        // Example Sentences (existing code)
        const examplesSection = document.getElementById('vocab-examples-section');
        const examplesContainer = document.getElementById('vocab-examples');

        if (examplesSection && examplesContainer && data.examples?.example) {
            console.log('📝 Populating examples');
            examplesContainer.innerHTML = '';
            data.examples.example.slice(0, 5).forEach(example => {
                const exampleDiv = document.createElement('div');
                exampleDiv.className = 'text-sm text-gray-700 bg-gray-50 p-2 rounded';

                // Highlight the main word in the example
                const exampleText = example.text.replace(/<b>(.*?)<\/b>/g, '<strong class="text-blue-600">$1</strong>');
                exampleDiv.innerHTML = exampleText;

                examplesContainer.appendChild(exampleDiv);
            });
            examplesSection.classList.remove('hidden');
        } else if (examplesSection) {
            examplesSection.classList.add('hidden');
        }

        // Extended Information (existing code)
        const extendedSection = document.getElementById('vocab-extended-section');
        const extendedInfo = document.getElementById('vocab-extended-info');

        if (extendedSection && extendedInfo && dictEntry?.entry) {
            console.log('🔍 Populating extended info');
            extendedInfo.innerHTML = '';

            dictEntry.entry.slice(0, 3).forEach(entry => {
                const entryDiv = document.createElement('div');
                entryDiv.className = 'flex justify-between items-center';

                const wordSpan = document.createElement('span');
                wordSpan.className = 'font-medium';
                wordSpan.textContent = entry.word;

                const scoreSpan = document.createElement('span');
                scoreSpan.className = 'text-xs text-gray-500';
                scoreSpan.textContent = `score: ${entry.score?.toFixed(2) || '0.00'}`;

                entryDiv.appendChild(wordSpan);
                entryDiv.appendChild(scoreSpan);
                extendedInfo.appendChild(entryDiv);
            });

            extendedSection.classList.remove('hidden');
        } else if (extendedSection) {
            extendedSection.classList.add('hidden');
        }
    }

    verifyVocabPanelElements() {
        const elements = {
            'vocab-main-word': document.getElementById('vocab-main-word'),
            'vocab-pos': document.getElementById('vocab-pos'),
            'vocab-translation': document.getElementById('vocab-translation'),
            'vocab-german-alternatives-section': document.getElementById('vocab-german-alternatives-section'),
            'vocab-german-alternatives': document.getElementById('vocab-german-alternatives'),
            'vocab-alternatives-section': document.getElementById('vocab-alternatives-section'),
            'vocab-alternatives': document.getElementById('vocab-alternatives'),
            'vocab-examples-section': document.getElementById('vocab-examples-section'),
            'vocab-examples': document.getElementById('vocab-examples'),
            'vocab-extended-section': document.getElementById('vocab-extended-section'),
            'vocab-extended-info': document.getElementById('vocab-extended-info'),
            'vocab-loading': document.getElementById('vocab-loading'),
            'vocab-error': document.getElementById('vocab-error')
        };

        console.log('🔍 Verifying vocab panel elements:');
        Object.keys(elements).forEach(key => {
            console.log(`  ${key}:`, elements[key] ? '✅ Found' : '❌ Missing');
        });

        return Object.values(elements).every(el => el !== null);
    }

    showVocabLoading() {
        document.getElementById('vocab-loading').classList.remove('hidden');
        document.getElementById('vocab-translation-section').classList.add('hidden');
        document.getElementById('vocab-german-alternatives-section').classList.add('hidden');
        document.getElementById('vocab-alternatives-section').classList.add('hidden');
        document.getElementById('vocab-examples-section').classList.add('hidden');
        document.getElementById('vocab-extended-section').classList.add('hidden');
    }

    hideVocabLoading() {
        document.getElementById('vocab-loading').classList.add('hidden');
        document.getElementById('vocab-translation-section').classList.remove('hidden');
    }

    showVocabError() {
        document.getElementById('vocab-error').classList.remove('hidden');
        document.getElementById('vocab-loading').classList.add('hidden');
    }

    hideVocabError() {
        document.getElementById('vocab-error').classList.add('hidden');
    }

    hideVocabInfoPanel() {
        if (this.vocabInfoPanel) {
            this.vocabInfoPanel.classList.add('hidden');
        }
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

    async speak(text, lang = "de", slow = this.useSlowVoice) {
        console.log('Loading speech for:', text, 'in', lang);
        if (lang === null || text === '' || this.isStopSpeechRequested) return;
        this.setStatus("Loading audio...");

        try {
            // If offline mode is on
            if (this.useOfflineSpeak) {
                console.log('========Offline Speaking Mode=========', this)
                if (slow) {
                    this
                }
                const selectedVoiceName = this.voiceSelect.value;
                this.speakText(text, selectedVoiceName, this.rate);
                return;
            }
            const url = `/api/tts?text=${encodeURIComponent(text)}&lang=${lang}&slow=${slow}`;
            const audio = new Audio(url);
            audio.play();
            audio.onplaying = () => this.setStatus("Speaking...");
            audio.onended = () => this.setStatus("Ready");
            audio.onerror = () => this.setStatus("Speech error");
        } catch {
            this.setStatus("Speech error, System voice");
            const selectedVoiceName = this.voiceSelect.value;
            this.speakText(text, selectedVoiceName, this.rate);
        }
    }

    findGermanVoices() {
        const voices = this.speechSynth.getVoices();
        this.germanVoices = voices.filter(voice => voice.lang.startsWith('de-'));
        console.log('Available German voices:', this.germanVoices.map(v => v.name));
    }

    loadVoices() {
        console.log('Loading voices...');

        const voiceChangeHandler = () => {
            this.findGermanVoices();
            this.populateVoiceDropdown(); // Call after voices are found
        };

        window.speechSynthesis.onvoiceschanged = voiceChangeHandler;

        if (this.speechSynth.getVoices().length > 0) {
            voiceChangeHandler(); // Initial call
        }
    }

    getAvailableVoices() {
        return this.germanVoices;
    }

    speakText(text, voiceName, rate = 1) {
        if (!text.trim()) return;
        this.speechSynth.cancel();
        this.utterance = new SpeechSynthesisUtterance(text);
        this.utterance.lang = 'de-DE';
        this.utterance.rate = rate;

        console.log('Selected voice name:', voiceName);

        const selectedVoice = this.germanVoices.find(voice => voice.name === voiceName);
        if (selectedVoice) {
            this.utterance.voice = selectedVoice;
        } else {
            console.warn(`Voice "${voiceName}" not found. Falling back to default German voice.`);
        }

        this.utterance.onend = () => {
            this.isSpeaking = false;
            this.isPaused = false;
            this.utterance = null;
            if (this.playBtn) this.playBtn.textContent = 'Play';
            const focusModePlayBTN = document.getElementById("focus-play-btn");
            if (focusModePlayBTN) focusModePlayBTN.textContent = 'Play';
        };

        this.speechSynth.speak(this.utterance);
        this.isSpeaking = true;
        if (this.playBtn) this.playBtn.textContent = 'Pause';
        const focusModePlayBTN = document.getElementById("focus-play-btn");
        if (focusModePlayBTN) focusModePlayBTN.textContent = 'Pause';
    }

    populateVoiceDropdown() {
        if (!this.voiceSelect) return; // Exit if dropdown element isn't found

        // Check if voices are loaded before populating
        if (this.getAvailableVoices().length === 0) {
            console.warn('Voices not yet loaded. Cannot populate dropdown.');
            return;
        }

        this.voiceSelect.innerHTML = ''; // Clear previous options

        this.getAvailableVoices().forEach(voice => {
            const option = document.createElement('option');
            option.textContent = voice.name;
            option.value = voice.name; // <--- This is the key change
            if (voice.name.includes('Killian')) {
                option.selected = true; // Select Killian by default if available
            }
            this.voiceSelect.appendChild(option);
        });
    }


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

    stopSpeech() {
        this.isStopSpeechRequested = !this.isStopSpeechRequested;
        const focusModeStopBtn = document.getElementById("focus-stop-btn");

        const stopSpeecBtn = document.getElementById("stopSpeechBtn");
        if (this.isStopSpeechRequested) {
            stopSpeecBtn.innerHTML = 'Activate Speech';
            if (focusModeStopBtn) focusModeStopBtn.innerText = stopSpeecBtn.innerHTML;
            this.showNotification("Speech Stopped");
        }
        else {
            stopSpeecBtn.innerHTML = 'Stop Speech';
            if (focusModeStopBtn) focusModeStopBtn.innerText = stopSpeecBtn.innerHTML;
            this.showNotification("Speech Activated");
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
            <option value="en" selected>EN</option>
            <option value="ar">AR</option>
        `;
        this.stopSpeechBtn.parentNode.insertBefore(langSelector, this.stopSpeechBtn.nextSibling);

        langSelector.addEventListener('change', () => {
            this.selectedLang = langSelector.value;
        });
    }

    async getArticle(word) {
        try {
            const response = await fetch(`/api/article?word=${word}`);
            const data = await response.json();
            return data.article; // This will be a string like "der"
        } catch (error) {
            console.error('Error fetching article:', error);
            return null;
        }
    }

    async translate(text, article = false, extended = false) {
        try {
            let res = '';
            if (article) {
                // Get the German translation from English words
                res = await fetch(
                    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=de&dt=t&q=" +
                    encodeURIComponent(text)
                );
            } else if (extended) {
                // Get extended translation data with vocabulary info
                res = await fetch(
                    "https://translate.googleapis.com/translate_a/single?dt=t&dt=bd&dt=qc&dt=rm&dt=ex&client=gtx&hl=en&sl=de&tl=" +
                    encodeURIComponent(this.selectedLang) +
                    "&q=" + encodeURIComponent(text) + "&dj=1"
                );
            } else {
                res = await fetch(
                    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=de&tl=" +
                    encodeURIComponent(this.selectedLang) +
                    "&dt=t&q=" + encodeURIComponent(text)
                );
            }
            const data = await res.json();

            if (extended) {
                return data; // Return full extended data
            } else {
                return this.joinTranslationChunks(data);
            }
        } catch {
            return extended ? null : "(error)";
        }
    }

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

        this.speak(selectedText);

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
            this.speak(phrase);
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
        console.log('📦 Vocab panel exists:', !!this.vocabInfoPanel);

        // Don't handle if it's part of a group
        if (span.dataset.selectionGroup || span.dataset.groupId) {
            console.log('⏭️ Skipping - word is part of group');
            return;
        }

        const word = span.textContent.trim();
        console.log('🔍 Processing word:', word);

        // Show vocabulary info panel
        console.log('📤 Calling showVocabInfoForWord with word:', word);
        this.showVocabInfoForWord(word, span);

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
        this.speak(word);

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
        this.speak(word);

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

        this.stopSpeechBtn.addEventListener("click", () => this.stopSpeech());

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
    setupAddToFlashcardModal() {
        this.createAddToFlashcardButton();
        this.createModal();
    }

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

                const isNoun = await this.isLikelyNoun(selection.words[0]);
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
                        this.showArticleDetails(word, JSON.parse(btn.dataset.allArticles), btn);
                    } else {
                        this.handleGetArticle(word, index, btn);
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

    // Show detailed article information for multiple articles
    showArticleDetails(word, articles, button) {
        const baseWord = button.dataset.baseWord || word;
        const originalWord = button.dataset.originalWord || word;

        // ALSO open dictionary when showing details
        const currentArticle = articles[0]; // Use first article for dictionary
        window.open(`https://der-artikel.de/${currentArticle.toLowerCase()}/${baseWord.charAt(0).toUpperCase() + baseWord.slice(1)}.html`);

        // Create a modal or tooltip to show all possible articles
        const detailModal = document.createElement('div');
        detailModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        detailModal.id = 'article-detail-modal';
        detailModal.innerHTML = `
            <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3 class="text-lg font-bold mb-4">Word Information</h3>
                ${originalWord !== baseWord ? `
                    <div class="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
                        <p class="text-sm text-blue-800">
                            <strong>Note:</strong> "${originalWord}" is the plural form.<br>
                            The base (singular) form is "<strong>${baseWord}</strong>".
                        </p>
                    </div>
                ` : ''}
                <p class="mb-4">The word "<strong>${baseWord}</strong>" can have multiple articles:</p>
                <div class="space-y-2 mb-4">
                    ${articles.map(article => `
                        <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span class="font-medium text-black">${article} ${baseWord}</span>
                            <button class="use-article-btn px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                                    data-article="${article}">
                                Use This
                            </button>
                        </div>
                    `).join('')}
                </div>
                <p class="text-sm text-gray-600 mb-4">
                    Each article represents a different meaning or usage of the word.
                </p>
                <div class="flex justify-end">
                    <button class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600" id="close-article-modal">
                        Close
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(detailModal);

        // Add event listeners
        detailModal.querySelector('#close-article-modal').addEventListener('click', () => {
            detailModal.remove();
        });

        detailModal.querySelectorAll('.use-article-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const selectedArticle = e.target.dataset.article;
                this.updateWordWithArticle(baseWord, selectedArticle, button);

                // Remove the hint notification if it exists
                const notification = button.closest('.p-3').querySelector('.bg-yellow-100');
                if (notification) {
                    notification.remove();
                }

                detailModal.remove();
            });
        });

        // Close modal when clicking outside
        detailModal.addEventListener('click', (e) => {
            if (e.target === detailModal) {
                detailModal.remove();
            }
        });
    }

    // Update word with selected article
    updateWordWithArticle(baseWord, article, button) {
        const selectionIndex = parseInt(button.dataset.index);
        const selectionsList = document.getElementById('batch-selections-list');
        const selectionDiv = selectionsList.children[selectionIndex];
        const germanWordSpan = selectionDiv.querySelector('.german-word');

        const articleWord = `${article} ${baseWord.charAt(0).toUpperCase() + baseWord.slice(1)}`;
        germanWordSpan.textContent = articleWord;

        // FIXED: Update button classes individually
        button.textContent = '✓ Done';
        button.classList.remove('bg-orange-500', 'hover:bg-orange-600');
        button.classList.add('bg-green-500', 'hover:bg-green-600');
        button.disabled = true;
    }

    // Helper method to check if a word is likely a noun
    async isLikelyNoun(word) {
        // Simple heuristic: German nouns are capitalized
        // if (word.charAt(0) !== word.charAt(0).toUpperCase()) {
        //     return false;
        // }

        try {
            // Use the translation API to get part of speech info
            const extendedData = await this.translate(word, false, true);
            if (extendedData && extendedData.dict && extendedData.dict.length > 0) {
                const pos = extendedData.dict[0].pos;
                return pos === 'noun' || pos === 'substantiv';
            }
        } catch (error) {
            console.log('Could not determine part of speech for:', word);
        }

        // Fallback: assume capitalized German words are nouns
        return /^[A-ZÄÖÜ]/.test(word);
    }

    async handleGetArticle(word, selectionIndex, button) {
        // Show loading state
        const originalText = button.textContent;
        button.textContent = 'Loading...';
        button.disabled = true;

        console.log(`Getting article for "${word}" (selection index ${selectionIndex})`);

        const selectionsList = document.getElementById('batch-selections-list');
        const selectionDiv = selectionsList.children[selectionIndex];
        const germanWordSpan = selectionDiv.querySelector('.german-word');

        // Check if article already fetched
        const articles = ['Der', 'Die', 'Das'];
        const matchedArticle = articles.find(a => germanWordSpan.textContent.startsWith(a + ' '));

        if (matchedArticle) {
            console.log('Article already fetched, opening dictionary>>>> ');

            const originalWord = button.dataset.originalWord || word;
            const baseWord = button.dataset.baseWord || originalWord;

            window.open(`https://der-artikel.de/${matchedArticle.toLowerCase()}/${baseWord.charAt(0).toUpperCase() + baseWord.slice(1)}.html`);
            button.textContent = '✓ Make Sure';
            button.disabled = false;
            return;
        }

        try {
            // Use the new API to get article
            const response = await fetch(`https://german-genders.vercel.app/api/search/${encodeURIComponent(word.toLowerCase())}`);
            const data = await response.json();

            console.log('Article API response:', data);

            // FIX: Store the base word in the button's dataset instead of class property
            const baseWord = data.title;
            button.dataset.originalWord = word;  // Store original word
            button.dataset.baseWord = baseWord;  // Store base word

            if (data.responseType === 900) {
                // Single article case - handle lemmatization
                const article = this.getArticleFromGender(data.gender);
                const articleWord = `${article} ${baseWord.charAt(0).toUpperCase() + baseWord.slice(1)}`;

                // Update the German word display with the article and base form
                germanWordSpan.textContent = articleWord;

                // Store the original word for reference
                germanWordSpan.dataset.originalWord = word;
                germanWordSpan.dataset.baseWord = baseWord;

                if (word !== baseWord) {
                    germanWordSpan.title = `Base form of "${word}"`;
                    germanWordSpan.classList.add('cursor-help', 'border-b', 'border-dotted', 'border-gray-400');
                    germanWordSpan.textContent += ` / ${word}`;
                }

                // Update the button to show completion
                button.textContent = '✓ Make Sure';
                button.classList.remove('bg-blue-500', 'hover:bg-blue-600');
                button.classList.add('bg-green-500', 'hover:bg-green-600');
                button.disabled = false;

                console.log(`Updated "${word}" (base: ${baseWord}) -> "${articleWord}"`);

            } else if (data.responseType === 901) {
                // Multiple articles case (homonym)
                this.handleMultipleArticles(word, data, germanWordSpan, button, selectionIndex);
                germanWordSpan.textContent += ` / ${word}`;
            } else {
                throw new Error('No article data found');
            }

        } catch (error) {
            console.error('Error getting article:', error);
            button.textContent = 'Error';

            // Remove and add classes individually
            button.classList.remove('bg-blue-500', 'hover:bg-blue-600');
            button.classList.add('bg-red-500', 'hover:bg-red-600');

            setTimeout(() => {
                button.textContent = 'Get Article';
                button.classList.remove('bg-red-500', 'hover:bg-red-600');
                button.classList.add('bg-blue-500', 'hover:bg-blue-600');
                button.disabled = false;
            }, 1000);
        }
    }

    // Helper method to extract article from gender data
    getArticleFromGender(gender) {
        if (gender.der) return 'Der';
        if (gender.die) return 'Die';
        if (gender.das) return 'Das';
        return ''; // Fallback
    }

    // Handle multiple articles case
    handleMultipleArticles(word, data, germanWordSpan, button, selectionIndex) {
        const articles = [];
        if (data.gender.der) articles.push('Der');
        if (data.gender.die) articles.push('Die');
        if (data.gender.das) articles.push('Das');

        const baseWord = data.title;

        // FIX: Store words in button dataset
        button.dataset.originalWord = word;
        button.dataset.baseWord = baseWord;
        button.dataset.allArticles = JSON.stringify(articles); // Store articles here

        if (articles.length > 1) {
            // Notify user about multiple articles
            const message = `
                <strong>Multiple articles found for "${baseWord}":</strong> ${articles.join(', ')}. 
                <br>Using "${articles[0]}" by default. Click "Make Sure" for details.
            `;
            this.showNotification(message, 10000);
            // const notification = document.createElement('div');
            // notification.className = 'mt-2 p-2 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded text-sm';
            // notification.innerHTML = message;

            // germanWordSpan.parentNode.insertBefore(notification, germanWordSpan.nextSibling);

        }

        // FIX: Actually set the article in the German word span so matchedArticle check works
        const articleWord = `${articles[0]} ${baseWord.charAt(0).toUpperCase() + baseWord.slice(1)}`;
        germanWordSpan.textContent = articleWord;

        // Store the original and base words
        germanWordSpan.dataset.originalWord = word;
        germanWordSpan.dataset.baseWord = baseWord;

        // Update button for multiple articles case
        button.textContent = articles.length > 1 ? '⚠️ Make Sure' : '✓ Make Sure';
        button.classList.remove('bg-blue-500', 'hover:bg-blue-600');

        if (articles.length > 1) {
            button.classList.add('bg-orange-500', 'hover:bg-orange-600');
        } else {
            button.classList.add('bg-green-500', 'hover:bg-green-600');
        }

        button.disabled = false;

        console.log(`Multiple articles found for "${word}" (base: ${baseWord}): ${articles.join(', ')}. Using "${articles[0]}"`);
    }

    setupAddToFlashcardModal() {
        this.createAddToFlashcardButton();
        this.createModal();
        this.createBatchAddModal(); // Add this line
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
        this.refreshFlashcardLists();

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
        // Refresh the flashcard lists display
        this.refreshFlashcardLists();
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
        this.setupActiveRecallListeners();
    }

    setupActiveRecallListeners() {
        // Use event delegation for better mobile support
        document.addEventListener('click', (e) => {
            if (e.target.matches('#ar-start-btn')) {
                this.startActiveRecall();
            } else if (e.target.matches('#ar-next-btn')) {
                this.nextSentence();
            } else if (e.target.matches('#ar-back-btn')) {
                this.previousSentence();
            } else if (e.target.matches('#ar-repeat-btn')) {
                this.repeatAudio();
            } else if (e.target.matches('#ar-finish-btn')) {
                this.finishActiveRecall();
            } else if (e.target.matches('#mobile-enter-btn')) {
                this.checkAnswer();
            }
        });

        const userInput = document.getElementById('ar-user-input');
        // Input handling (unchanged)

        if (userInput) {
            userInput.addEventListener('input', (e) => {
                this.handleUserInput();
            });

            userInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.checkAnswer();
                    // this.updateProgress();
                }
            });

            if (this.isTouchDevice) {
                userInput.addEventListener('touchend', (e) => {
                    setTimeout(() => this.handleUserInput(), 100);
                });
            }
        }

        const fuzzyMatch = document.getElementById('ar-fuzzy-match');

        if (fuzzyMatch) {
            fuzzyMatch.addEventListener('change', (e) => {
                this.useFuzzyMatching = e.target.checked;
                console.log("Fuzzy matching set to:", this.useFuzzyMatching);
            });

            // Mobile touch support for checkbox
            if (this.isTouchDevice) {
                fuzzyMatch.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    fuzzyMatch.checked = !fuzzyMatch.checked;
                    fuzzyMatch.dispatchEvent(new Event('change'));
                });
            }
        }

        const slowVoice = document.getElementById('ar-slow-voice');
        console.log("Slow voice checkbox:", slowVoice);
        // check if slowVoice is checked
        if (slowVoice) {
            slowVoice.addEventListener('change', (e) => {
                this.useSlowVoice = e.target.checked;
                console.log("Slow voice set to:", this.useSlowVoice)
            });
        }
        if (slowVoice && this.isTouchDevice) {
            slowVoice.addEventListener('touchend', (e) => {
                e.preventDefault();
                slowVoice.checked = !slowVoice.checked;
                slowVoice.dispatchEvent(new Event('change'));
            });
        }

        const offlineSpeakRecall = document.getElementById('offline-speak-recall');

        offlineSpeakRecall.addEventListener('change', (e) => {
            this.useOfflineSpeak = e.target.checked;
            console.log("On Off set to:", !this.useOfflineSpeak ? "online" : "offline");
        });

        const rateSliderActiveRecall = document.getElementById('rateSliderActiveRecall');
        const rateSliderSpanActiveRecall = document.getElementById('rateSliderSpanActiveRecall');
        const activeRecallContainer = document.getElementById('active-recall-tool');

        rateSliderActiveRecall.addEventListener('change', (e) => {
            this.rate = e.target.value;
            rateSliderSpanActiveRecall.innerHTML = this.rate;
            console.log('rate value - ', this.rate);
        })

        document.addEventListener('keydown', (e) => {
            console.log('activated keydown active recall slider');

            let currentValue = Number(rateSliderActiveRecall.value);
            const step = Number(rateSliderActiveRecall.step) || 1;

            if (e.ctrlKey && e.shiftKey && e.key === 'ArrowRight') {
                currentValue = Math.min(Number(rateSliderActiveRecall.max), currentValue + step);
                rateSliderActiveRecall.value = currentValue;
                e.preventDefault();
            } else if (e.ctrlKey && e.shiftKey && e.key === 'ArrowLeft') {
                currentValue = Math.max(Number(rateSliderActiveRecall.min), currentValue - step);
                rateSliderActiveRecall.value = currentValue;
                e.preventDefault();
            } else if (e.ctrlKey && e.shiftKey && e.key === ' ') {
                slowVoice.checked = !slowVoice.checked;
                this.useSlowVoice = slowVoice.checked;
                e.preventDefault();
                console.log("Slow voice set to:", this.useSlowVoice)
            }
            // fuzzy match art+shift+f
            else if (e.altKey && e.shiftKey && e.key === 'F') {
                fuzzyMatch.checked = !fuzzyMatch.checked;
                this.useFuzzyMatching = fuzzyMatch.checked;
                e.preventDefault();
                console.log("Fuzzy matching set to:", this.useFuzzyMatching);
            }
            // Alt+Shift+F for repeat
            else if (e.altKey && e.shiftKey && e.key === 'R') {
                e.preventDefault();
                this.repeatAudio();
            }
            // // keyboard shortcut for focus mode
            // if (e.altKey && e.shiftKey && e.key === 'G') {
            //     e.preventDefault();
            //     this.toggleFocusMode();
            // }

            // // Escape to exit focus mode
            // if (this.isFocusMode && e.key === 'Escape') {
            //     e.preventDefault();
            //     this.toggleFocusMode();
            // }

            rateSliderSpanActiveRecall.textContent = rateSliderActiveRecall.value;
            this.rate = rateSliderActiveRecall.value;
        });

        this.addActiveRecallButton();
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

    createActiveRecallUI() {
        const activeRecallHTML = `
        <div id="active-recall-tool" class="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200 hidden">
            <h3 class="text-lg font-semibold mb-4">🎯 Active Recall Practice</h3>
            
            <!-- Custom Dropdown for Mode Selection -->
            <div class="mb-4 flex flex-wrap gap-4 items-center">
                <div class="flex items-center space-x-2">
                    <span class="text-sm font-medium">Mode:</span>
                    <div id="ative-recall-dropdown" class="relative">
                        <button id="ar-mode-dropdown-btn" class="w-48 p-2 border rounded text-sm bg-white text-left flex justify-between items-center">
                            <span id="ar-mode-display">Normal</span>
                            <span>▼</span>
                        </button>
                        <div id="ar-mode-dropdown-menu" class="absolute z-40 hidden w-48 mt-1 bg-white border rounded shadow-lg">
                            <button type="button" data-value="normal" class="w-full p-2 text-left hover:bg-gray-100 border-b">Normal</button>
                            <button type="button" data-value="beginner" class="w-full p-2 text-left hover:bg-gray-100">Beginner (with hints)</button>
                        </div>
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    <input type="checkbox" id="ar-fuzzy-match" class="rounded">
                    <label for="ar-fuzzy-match" class="text-sm font-medium">Fuzzy Word Matching</label>
                </div>
                <div class="flex items-center space-x-2">
                    <input type="checkbox" id="ar-slow-voice" class="rounded">
                    <label for="ar-slow-voice" class="text-sm font-medium">Slow Voice</label>
                </div>
                <div class="flex flex-row items-center space-x-1">
                    <input type="checkbox" id="offline-speak-recall" class="rounded">
                    <label for="offline-speak-recall" class="text-sm font-medium">Offline Mode</label>
                </div>
                <input type="range" id="rateSliderActiveRecall" min="0.5" max="1.5" step="0.1" value="0.8">
                <label for="rateSliderActiveRecall"></label>
                <span id="rateSliderSpanActiveRecall" class="text-sm text-gray-700">0.8</span>
            </div>
            
            ${this.getActiveRecallUIBody()}
        </div>
    `;

        this.output.insertAdjacentHTML('afterend', activeRecallHTML);
        this.setupCustomDropdown();
    }

    getActiveRecallUIBody() {
        return `
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
            <div class="text-xs text-gray-600 italic grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <div>ALT+SHIFT+R</div>
            <div class="text-green-600">Repeat Audio</div>

            <div>ALT+SHIFT+F</div>
            <div class="text-green-600">Toggle Fuzzy Mode</div>

            <div>CTRL+SHIFT+Space</div>
            <div class="text-green-600">Toggle Online Slow Voice</div>

            <div>CTRL+SHIFT+Left/Right</div>
            <div class="text-green-600">Arrows Change Offline Range</div>
            </div>
            <textarea id="ar-user-input" 
                placeholder="Type what you hear..." 
                class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-20 resize-none mt-4"></textarea>
            <div class="flex justify-between mt-2 text-sm text-gray-600">
                <span>Press Enter to submit</span>
                <span id="ar-timer">Time: 0s</span>
            </div>
            <button id="mobile-enter-btn" class="w-full mt-2 bg-blue-600 text-white py-3 rounded-lg font-semibold hidden">↵ Enter</button>
        </div>

        <div id="ar-controls" class="flex flex-wrap gap-2">
            <button id="ar-start-btn" class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">
                🎧 Start Practice
            </button>
            <button id="ar-next-btn" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors hidden">
                ➡️ Next
            </button>
            <button id="ar-back-btn" class="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors hidden">
                ⬅️ Previous
            </button>
            <button id="ar-repeat-btn" class="bg-yellow-600 text-white px-6 py-2 rounded-lg hover:bg-yellow-700 transition-colors hidden">
                🔄 Repeat
            </button>
            <button id="ar-finish-btn" class="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors hidden">
                ✅ Finish
            </button>
        </div>

        <div id="ar-results" class="mt-6 hidden">
            <h4 class="text-lg font-semibold mb-3">📊 Practice Results</h4>
            <div id="ar-summary" class="mb-4 p-4 bg-white rounded-lg border"></div>
            <div id="ar-detailed-results" class="space-y-4"></div>
        </div>
    `;
    }

    setupCustomDropdown() {
        const dropdownBtn = document.getElementById('ar-mode-dropdown-btn');
        const dropdownMenu = document.getElementById('ar-mode-dropdown-menu');
        const modeDisplay = document.getElementById('ar-mode-display');

        if (!dropdownBtn || !dropdownMenu) return;

        // Toggle dropdown menu
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = dropdownMenu.classList.contains('hidden');

            // Close all other dropdowns
            this.closeAllDropdowns();

            if (isHidden) {
                dropdownMenu.classList.remove('hidden');
                dropdownBtn.classList.add('border-blue-500', 'ring-2', 'ring-blue-200');
            } else {
                this.closeDropdown();
            }
        });

        // Handle option selection
        dropdownMenu.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' && e.target.dataset.value) {
                const value = e.target.dataset.value;
                const text = e.target.textContent;

                this.activeRecallMode = value;
                modeDisplay.textContent = text;

                // Update UI based on mode
                this.handleModeChange();

                // Close dropdown
                this.closeDropdown();
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            this.closeDropdown();
        });

        // Prevent dropdown from closing when clicking inside it
        dropdownMenu.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Mobile-specific touch events
        if (this.isTouchDevice) {
            dropdownBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropdownBtn.click();
            });

            // Add touch support for dropdown items
            const dropdownItems = dropdownMenu.querySelectorAll('button');
            dropdownItems.forEach(item => {
                item.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    item.click();
                });
            });
        }
    }

    closeDropdown() {
        const dropdownBtn = document.getElementById('ar-mode-dropdown-btn');
        const dropdownMenu = document.getElementById('ar-mode-dropdown-menu');

        if (dropdownMenu) {
            dropdownMenu.classList.add('hidden');
        }
        if (dropdownBtn) {
            dropdownBtn.classList.remove('border-blue-500', 'ring-2', 'ring-blue-200');
        }
    }

    closeAllDropdowns() {
        // Close any other open dropdowns if you have multiple
        const allDropdowns = document.querySelectorAll('[id*="dropdown-menu"]');
        allDropdowns.forEach(menu => {
            menu.classList.add('hidden');
        });

        const allDropdownBtns = document.querySelectorAll('[id*="dropdown-btn"]');
        allDropdownBtns.forEach(btn => {
            btn.classList.remove('border-blue-500', 'ring-2', 'ring-blue-200');
        });
    }

    addMobileEnterButton() {
        const inputArea = document.getElementById('ar-input-area');
        if (!inputArea) return;

        // Check if mobile Enter button already exists
        if (document.getElementById('mobile-enter-btn')) return;

        const enterButton = document.createElement('button');
        enterButton.id = 'mobile-enter-btn';
        enterButton.innerHTML = '↵ Enter';
        enterButton.className = 'w-full mt-2 bg-blue-600 text-white py-3 rounded-lg font-semibold hidden';
        enterButton.addEventListener('click', () => {
            this.checkAnswer();
        });

        inputArea.appendChild(enterButton);

        // Show/hide based on input content
        this.setupMobileEnterButtonVisibility();
    }

    setupMobileEnterButtonVisibility() {
        const userInput = document.getElementById('ar-user-input');
        const mobileEnterBtn = document.getElementById('mobile-enter-btn');

        if (!userInput || !mobileEnterBtn) return;

        userInput.addEventListener('input', () => {
            if (userInput.value.trim().length > 0) {
                mobileEnterBtn.classList.remove('hidden');
            } else {
                mobileEnterBtn.classList.add('hidden');
            }
        });

        // Also show/hide based on focus
        userInput.addEventListener('focus', () => {
            if (userInput.value.trim().length > 0) {
                mobileEnterBtn.classList.remove('hidden');
            }
        });

        userInput.addEventListener('blur', () => {
            mobileEnterBtn.classList.add('hidden');
        });
    }

    // Add helper method for touch device detection
    // isTouchDevice {
    //     return 'ontouchstart' in window ||
    //         navigator.maxTouchPoints > 0 ||
    //         navigator.msMaxTouchPoints > 0;
    // }

    // Unified input handler
    handleUserInput() {
        if (this.activeRecallMode === 'beginner') {
            this.updateHintDisplay();
        }
    }

    // Unified mode change handler
    handleModeChange() {
        console.log("Active Recall mode changed to:", this.activeRecallMode);
        const modeSelect = document.getElementById('ar-mode-select');
        if (modeSelect) {
            console.log("Updating mode select dropdown to:", modeSelect);
            this.activeRecallMode = modeSelect.value;

            // Force UI update for mobile
            if (this.sentences && this.currentSentenceIndex >= 0) {
                this.updateHintDisplay();

                // Additional mobile fix: trigger a resize event to force rendering
                setTimeout(() => {
                    window.dispatchEvent(new Event('resize'));
                }, 100);
            }
        }
        // Show/hide hint display based on mode
        const hintDisplay = document.getElementById('ar-hint-display');
        if (hintDisplay) {
            console.log('hint is here')
            if (this.activeRecallMode === 'beginner') {
                hintDisplay.classList.remove('hidden');
                hintDisplay.style.display = 'block';
                console.log('Hint display shown for beginner mode');
            } else {
                hintDisplay.classList.add('hidden');
                hintDisplay.style.display = 'none';
                console.log('Hint display hidden for normal mode');
            }
        }
    }

    // Beginner mode hints
    // Update the updateHintDisplay method to be more robust
    updateHintDisplay() {
        const hintDisplay = document.getElementById('ar-hint-display');
        const hintText = document.getElementById('ar-hint-text');

        // Always check if elements exist
        if (!hintDisplay || !hintText) {
            console.warn('Hint elements not found');
            return;
        }

        if (this.activeRecallMode === 'beginner' && this.currentSentenceIndex >= 0) {
            // removes all Unicode punctuation
            const sentence = this.sentences[this.currentSentenceIndex].replace(/[\p{P}]/gu, '').trim();
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
                    // Use visible dashes that work on mobile
                    hintHTML += `<span class="text-blue-400 font-mono">${'–'.repeat(Math.max(2, word.length))}</span> `;
                }
            });

            hintText.innerHTML = hintHTML;

            // Force display and trigger reflow for mobile browsers
            hintDisplay.classList.remove('hidden');
            hintDisplay.style.display = 'block';

            // Mobile-specific fixes
            this.fixMobileHintDisplay();

        } else {
            if (hintDisplay) {
                hintDisplay.classList.add('hidden');
                hintDisplay.style.display = 'none';
            }
        }
    }

    // Add mobile-specific fixes
    fixMobileHintDisplay() {
        const hintDisplay = document.getElementById('ar-hint-display');
        if (!hintDisplay) return;

        // Force mobile browser to render the hint
        hintDisplay.style.opacity = '0.99'; // Force GPU rendering
        setTimeout(() => {
            hintDisplay.style.opacity = '1';
        }, 50);

        // Ensure proper touch handling
        hintDisplay.style.touchAction = 'manipulation';
        hintDisplay.style.webkitUserSelect = 'none';
        hintDisplay.style.userSelect = 'none';
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
        this.activeRecallBtn = document.createElement('button');
        this.activeRecallBtn.id = 'active-recall-btn';
        this.activeRecallBtn.className = 'px-4 py-4 bg-purple-600 text-white rounded-lg shadow hover:bg-purple-700 w-1/2';
        this.activeRecallBtn.innerHTML = '🎯 Active Recall';
        this.activeRecallBtn.addEventListener('click', () => this.toggleActiveRecall());

        const extraToolsContainer = document.getElementById('extra-tools-container');
        if (extraToolsContainer) {
            // insert in extraToolsContainer

            extraToolsContainer.insertAdjacentElement('beforeend', this.activeRecallBtn);
            return;
        }

        // Insert after the Add to Flashcards button
        const addToFlashBtn = document.getElementById('addToFlashBtn');
        // this.output.insertAdjacentElement('beforeend', this.activeRecallBtn);
    }

    toggleActiveRecall() {
        const activeRecallTool = document.getElementById('active-recall-tool');
        const isVisible = !activeRecallTool.classList.contains('hidden');

        // Store the original value in a class property
        if (!this.originalText) {
            this.originalText = this.input.value;
        }

        // Hide all elements in vocab-tool except output, selectionTooltip, and essential controls
        const vocabTool = document.getElementById('vocab-tool');
        const vocabToolContainer = document.getElementById('vocab-tool-div');

        console.log('Flashcard load requested:--> ', this.isFlashCardLoadRequested);
        const addToFlashBtn = document.getElementById('addToFlashBtn');

        if (!isVisible) {
            this.prepareActiveRecall();
            activeRecallTool.classList.remove('hidden');
            this.input.disabled = true;
            this.storySelect.disabled = true;
            this.input.value = '';
            activeRecallTool.scrollIntoView({ behavior: 'smooth' });
            if (!this.isFlashCardLoadRequested) {
                console.log('Processing text for Active Recall');
                this.processBtn.click();
            }
            this.output.innerHTML = '';
            const elementsToHide = Array.from(vocabTool.children).filter(
                child => !['active-recall-tool', 'active-recall-btn', 'extra-tools-container'].includes(child.id)
            );

            elementsToHide.forEach(element => {
                element.dataset.originalDisplay = element.style.display || '';
                element.style.display = 'none';
            });
            console.log('----------->>> ', elementsToHide);
            addToFlashBtn.style.display = 'none';

            if (vocabToolContainer) {
                vocabToolContainer.dataset.originalDisplay = vocabToolContainer.style.display || '';
                vocabToolContainer.style.display = 'none';
            }
            this.activeRecallBtn.innerHTML = '❌ Exit Active Recall';
            console.log('Active Recall mode activated', this.activeRecallBtn.innerHTML);
        } else {
            console.log('Active Recall mode activated', this.activeRecallBtn.innerHTML);
            activeRecallTool.classList.add('hidden');
            this.resetActiveRecall();
            this.input.disabled = false;
            this.storySelect.disabled = false;
            this.input.value = this.originalText;

            // Show all hidden elements
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
            this.activeRecallBtn.innerHTML = '🎯 Active Recall';
            if (!this.isFlashCardLoadRequested) {
                console.log('Re-processing text after exiting Active Recall');
                this.processBtn.click();
            }
            this.isFlashCardLoadRequested = !this.isFlashCardLoadRequested;
            addToFlashBtn.style.display = 'inline-block';
        }
    }


    // Update the prepareActiveRecall method
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

        // Initialize mode selector for mobile
        const modeSelect = document.getElementById('ar-mode-select');
        if (modeSelect) {
            this.activeRecallMode = modeSelect.value;

            // Force hint display update if in beginner mode
            if (this.activeRecallMode === 'beginner') {
                const hintDisplay = document.getElementById('ar-hint-display');
                if (hintDisplay) {
                    hintDisplay.classList.remove('hidden');
                    hintDisplay.style.display = 'block';
                }
            }
        }

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
        const hintDisplay = document.getElementById('ar-hint-display');

        // console.log(`Showing sentence ${this.currentSentenceIndex + 1}: ${sentence}`);
        // Mobile: Ensure hint display is properly initialized
        // if (this.activeRecallMode === 'beginner') {
        //     hintDisplay.classList.remove('hidden');
        //     hintDisplay.style.display = 'block';
        // }
        // else {
        //     hintDisplay.classList.add('hidden');
        //     hintDisplay.style.display = 'none';
        // }

        // Show loading state with mobile-optimized text
        displayArea.innerHTML = '<span class="text-gray-500">Loading audio...</span>';

        // Hide input area initially
        inputArea.classList.add('hidden');

        // Update controls with mobile-friendly classes
        document.getElementById('ar-start-btn').classList.add('hidden');
        document.getElementById('ar-next-btn').classList.remove('hidden');
        document.getElementById('ar-back-btn').classList.remove('hidden');
        document.getElementById('ar-repeat-btn').classList.remove('hidden');
        document.getElementById('ar-finish-btn').classList.remove('hidden');

        // Mobile: Make buttons more touch-friendly
        if (this.isTouchDevice) {
            ['ar-next-btn', 'ar-back-btn', 'ar-repeat-btn', 'ar-finish-btn'].forEach(id => {
                const btn = document.getElementById(id);
                if (btn) {
                    btn.classList.add('py-3'); // Larger touch targets
                    btn.style.minHeight = '44px'; // Apple's recommended minimum touch target
                }
            });
        }

        // Disable back button on first sentence
        document.getElementById('ar-back-btn').disabled = this.currentSentenceIndex === 0;

        // Start timer
        this.startTimes[this.currentSentenceIndex] = Date.now();
        this.updateTimer();
        this.timerInterval = setInterval(() => this.updateTimer(), 1000);

        // Play audio with mobile compatibility
        this.speak(sentence).then(() => {
            displayArea.textContent = '🎧 Listen carefully...';

            // Mobile: Force a layout update
            if (this.isTouchDevice) {
                setTimeout(() => {
                    document.body.style.overflow = 'hidden';
                    setTimeout(() => {
                        document.body.style.overflow = 'auto';
                    }, 50);
                }, 10);
            }

            // Show input area after audio finishes
            setTimeout(() => {
                inputArea.classList.remove('hidden');
                userInput.value = '';

                // Mobile: Focus input with delay for better UX
                if (this.isTouchDevice) {
                    setTimeout(() => {
                        userInput.focus();
                        // Mobile browsers need this to show keyboard properly
                        // Ensure mobile Enter button is properly set up
                        this.addMobileEnterButton();
                        const mobileEnterBtn = document.getElementById('mobile-enter-btn');
                        if (mobileEnterBtn) {
                            mobileEnterBtn.classList.add('hidden'); // Start hidden
                        }
                    }, 100);
                } else {
                    userInput.focus();
                }

                displayArea.innerHTML = `
                <div class="text-center">
                    <div class="text-lg mb-2">✍️ Write what you heard:</div>
                    <div class="text-sm text-gray-500">Sentence ${this.currentSentenceIndex + 1} of ${this.sentences.length}</div>
                </div>
            `;

                // Update hints for beginner mode
                if (this.activeRecallMode === 'beginner') {
                    this.updateHintDisplay();
                }
                else {
                    hintDisplay.classList.add('hidden');
                    hintDisplay.style.display = 'none';
                }
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
        console.log('---> ', this.currentSentenceIndex);
        const progress = this.currentSentenceIndex >= 0 ? this.currentSentenceIndex : 0;
        const percentage = (progress / this.sentences.length) * 100;
        console.log(`Progress: ${progress} | ${percentage}`);

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
        // removes all Unicode punctuation
        const correctSentence = this.sentences[this.currentSentenceIndex].replace(/[\p{P}]/gu, '').trim();
        console.log('--->>> ', `{${correctSentence}}`);

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
                // this for updating last sentence progress
                this.currentSentenceIndex++;
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
            console.log(`Moving to next sentence: ${this.currentSentenceIndex}`);
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
        const repeatBtn = document.getElementById('ar-repeat-btn');
        if (repeatBtn) {
            // Add multiple effects
            repeatBtn.classList.add('glow-scale');

            // Add temporary icon change
            const originalText = repeatBtn.textContent;
            repeatBtn.textContent = '🔊 Playing...';

            setTimeout(() => {
                repeatBtn.classList.remove('glow-scale');
                repeatBtn.textContent = originalText;
            }, 800);
        }

        const sentence = this.sentences[this.currentSentenceIndex].trim();
        this.speak(sentence);
    }

    finishActiveRecall() {
        clearInterval(this.timerInterval);
        this.showFinalResults();
        this.updateProgress();
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
                    displayHTML += `<span id="missing" class="text-red-600 px-1 rounded" title="Missing word">${wordObj.correct}</span> `;
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

    // Add this method to your VocabularyTool class
    setupFlashcardListSelection() {
        this.createFlashcardListSelector();
    }

    createFlashcardListSelector() {
        // Create the container for flashcard list selection
        const selectorContainer = document.createElement('div');
        selectorContainer.id = 'flashcard-list-selector';
        selectorContainer.className = 'mt-4 p-4 bg-white rounded-lg border border-gray-200';

        selectorContainer.innerHTML = `
        <h3 class="text-lg font-semibold mb-3">📚 Practice with Flashcards</h3>
        <div class="flex flex-col gap-3">
            <label class="text-sm font-medium text-gray-700">Choose a flashcard list:</label>
            <div id="flashcard-lists-container" class="flex flex-wrap gap-2 mb-3">
                <!-- Lists will be populated here -->
            </div>
            <div id="selected-list-info" class="hidden p-3 bg-blue-50 rounded-lg">
                <div class="flex justify-between items-center">
                    <span id="selected-list-name" class="font-medium"></span>
                    <span id="selected-list-count" class="text-sm text-gray-600"></span>
                </div>
                <button id="load-flashcards-btn" class="mt-2 w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors">
                    🎯 Load for Active Recall
                </button>
            </div>
            <div id="no-lists-message" class="hidden p-4 text-center text-gray-500 bg-gray-50 rounded-lg">
                No flashcard lists found. Create some lists first!
            </div>
        </div>
        `;

        // Insert before the Active Recall button
        const activeRecallBtn = document.getElementById('active-recall-btn');
        if (activeRecallBtn) {
            // activeRecallBtn.parentNode.insertBefore(selectorContainer, activeRecallBtn);
            this.output.insertAdjacentElement('afterend', selectorContainer);
        } else {
            // Fallback: insert after the output
            this.output.insertAdjacentElement('afterend', selectorContainer);
        }

        this.populateFlashcardLists();
        this.setupFlashcardListListeners();
    }

    populateFlashcardLists() {
        const listsContainer = document.getElementById('flashcard-lists-container');
        const noListsMessage = document.getElementById('no-lists-message');

        if (!listsContainer) return;

        // Get flashcard lists from localStorage
        const customLists = JSON.parse(localStorage.getItem('customGermanLists')) || {};
        const listNames = Object.keys(customLists);

        listsContainer.innerHTML = '';

        if (listNames.length === 0) {
            noListsMessage.classList.remove('hidden');
            return;
        }

        noListsMessage.classList.add('hidden');

        listNames.forEach(listName => {
            const list = customLists[listName];
            const button = document.createElement('button');
            button.className = 'px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium';
            button.textContent = `${listName} (${list.length})`;
            button.dataset.listName = listName;

            listsContainer.appendChild(button);
        });
    }

    setupFlashcardListListeners() {
        const listsContainer = document.getElementById('flashcard-lists-container');
        const selectedListInfo = document.getElementById('selected-list-info');
        const selectedListName = document.getElementById('selected-list-name');
        const selectedListCount = document.getElementById('selected-list-count');
        const loadFlashcardsBtn = document.getElementById('load-flashcards-btn');

        if (!listsContainer) return;

        // Handle list selection
        listsContainer.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' && e.target.dataset.listName) {
                // Remove active class from all buttons
                document.querySelectorAll('#flashcard-lists-container button').forEach(btn => {
                    btn.classList.remove('bg-blue-600', 'text-white');
                    btn.classList.add('bg-blue-100', 'text-blue-700');
                });

                // Add active class to selected button
                e.target.classList.remove('bg-blue-100', 'text-blue-700');
                e.target.classList.add('bg-blue-600', 'text-white');

                const listName = e.target.dataset.listName;
                this.selectFlashcardList(listName);
            }
        });

        // Handle load flashcards button
        if (loadFlashcardsBtn) {
            loadFlashcardsBtn.addEventListener('click', () => {
                this.isFlashCardLoadRequested = true;
                this.loadFlashcardsIntoActiveRecall();
            });
        }
    }

    selectFlashcardList(listName) {
        const selectedListInfo = document.getElementById('selected-list-info');
        const selectedListName = document.getElementById('selected-list-name');
        const selectedListCount = document.getElementById('selected-list-count');

        const customLists = JSON.parse(localStorage.getItem('customGermanLists')) || {};
        const list = customLists[listName];

        if (!list) return;

        selectedListName.textContent = listName;
        selectedListCount.textContent = `${list.length} flashcards`;
        selectedListInfo.classList.remove('hidden');

        // Store the selected list name
        this.selectedFlashcardList = listName;
    }

    loadFlashcardsIntoActiveRecall() {
        if (!this.selectedFlashcardList) {
            alert('Please select a flashcard list first!');
            return;
        }

        const customLists = JSON.parse(localStorage.getItem('customGermanLists')) || {};
        const list = customLists[this.selectedFlashcardList];

        if (!list || list.length === 0) {
            alert('Selected list is empty!');
            return;
        }

        // Combine German words and sentences
        const textContent = list.map(card => {
            let content = card.german;
            if (card.sentence) {
                content += `, ${card.sentence}`;
            }
            return content;
        }).join('. ');

        // console.log(textContent);
        // Set the text in the input area
        this.input.value = textContent;

        // Process the text
        // this.processBtn.click();

        // Show success message
        this.showNotification(`Loaded ${list.length} flashcards from "${this.selectedFlashcardList}"`);

        // Scroll to the top to see the processed text
        this.input.scrollIntoView({ behavior: 'smooth' });

        // Optional: Auto-open Active Recall tool
        setTimeout(() => {
            const activeRecallBtn = document.getElementById('active-recall-btn');
            if (activeRecallBtn && activeRecallBtn.textContent.includes('Active Recall')) {
                activeRecallBtn.click();
            }
        }, 100);
    }

    // Also add this method to handle list updates
    refreshFlashcardLists() {
        this.populateFlashcardLists();

        // Clear selection if the selected list no longer exists
        if (this.selectedFlashcardList) {
            const customLists = JSON.parse(localStorage.getItem('customGermanLists')) || {};
            if (!customLists[this.selectedFlashcardList]) {
                this.selectedFlashcardList = null;
                document.getElementById('selected-list-info').classList.add('hidden');
            }
        }
    }
}