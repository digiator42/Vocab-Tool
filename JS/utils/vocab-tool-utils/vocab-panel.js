// JS/vocab-panel.js
export class VocabPanelManager {
    constructor(main) {
        this.main = main;
        this.vocabInfoPanel = null;
    }

    // Testing
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

    showVocabLoading() {
        document.getElementById('vocab-loading')?.classList.remove('hidden');
        document.getElementById('vocab-translation-section')?.classList.add('hidden');
        document.getElementById('vocab-german-alternatives-section')?.classList.add('hidden');
        document.getElementById('vocab-alternatives-section')?.classList.add('hidden');
        document.getElementById('vocab-examples-section')?.classList.add('hidden');
        document.getElementById('vocab-extended-section')?.classList.add('hidden');
    }

    hideVocabLoading() {
        document.getElementById('vocab-loading')?.classList.add('hidden');
        document.getElementById('vocab-translation-section')?.classList.remove('hidden');
    }

    showVocabError() {
        document.getElementById('vocab-error')?.classList.remove('hidden');
        document.getElementById('vocab-loading')?.classList.add('hidden');
    }

    hideVocabError() {
        document.getElementById('vocab-error')?.classList.add('hidden');
    }

    hideVocabInfoPanel() {
        if (this.vocabInfoPanel) {
            this.vocabInfoPanel.classList.add('hidden');
        }
    }

    verifyVocabPanelElements() {
        // This remains a pass-through placeholder for now if needed later
        return !!document.getElementById('vocab-translation');
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
                <div id="vocab-pos" class="text-sm opacity-90">No info</div>
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

    // Add this simple method to update the panel directly
    updateVocabPanel(word, translationData) {
        if (!this.vocabInfoPanel) {
            this.createVocabInfoPanel();
        }

        if (translationData && translationData.dict) {
            this.populateVocabInfoPanel(word, translationData, null);
        }
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
            const extendedData = await this.main.translate(word, false, true);
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

        // Google sends array of dict objcs, liberetrans sends just normal array
        const dictEntry = data.dict?.[0] || data.dict;

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

}


