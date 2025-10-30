// JS/vocab-panel.js
export class VocabPanelManager {
    constructor(main) {
        this.main = main;
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
        if (this.main.vocabInfoPanel) {
            this.main.vocabInfoPanel.classList.add('hidden');
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
        this.main.vocabInfoPanel = document.createElement('div');
        this.main.vocabInfoPanel.id = 'vocab-info-panel';
        this.main.vocabInfoPanel.className = 'fixed top-20 right-4 w-80 max-h-[80vh] bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden hidden';

        // Set initial content - ADD GERMAN ALTERNATIVES SECTION
        this.main.vocabInfoPanel.innerHTML = `
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

        document.body.appendChild(this.main.vocabInfoPanel);
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
            if (this.main.vocabInfoPanel &&
                !this.main.vocabInfoPanel.contains(e.target) &&
                !e.target.closest('.cursor-pointer')) {
                this.hideVocabInfoPanel();
            }
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.main.vocabInfoPanel && !this.main.vocabInfoPanel.classList.contains('hidden')) {
                this.hideVocabInfoPanel();
            }
        });
    }
}


