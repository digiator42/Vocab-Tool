// JS/active-recall.js
export class ActiveRecallModule {
    constructor(main) {
        this.main = main;
        this.activeRecallBtn = null;
        this.extraToolsContainer = document.getElementById('extra-tools-container');
        this.useFuzzyMatching = false;
        this.selectedFlashcardList = null;
    }

    setupActiveRecall() {
        this.addMobileEnterButton();
        this.setupActiveRecallListeners();
        this.setupCustomDropdown();
        this.addActiveRecallButton();
    }

    wireControls() {
        const fuzzyMatch = document.getElementById('ar-fuzzy-match');
        if (fuzzyMatch) {
            fuzzyMatch.addEventListener('change', (e) => {
                this.useFuzzyMatching = e.target.checked;
                console.log("Fuzzy matching set to:", this.useFuzzyMatching);
            });
            if (this.main.isTouchDevice) {
                fuzzyMatch.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    fuzzyMatch.checked = !fuzzyMatch.checked;
                    fuzzyMatch.dispatchEvent(new Event('change'));
                });
            }
        }

        const slowVoice = document.getElementById('ar-slow-voice');
        if (slowVoice) {
            slowVoice.addEventListener('change', (e) => {
                this.main.useSlowVoice = e.target.checked;
                console.log("Slow voice set to:-> ", this.main.useSlowVoice)
            });
            if (this.main.isTouchDevice) {
                slowVoice.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    slowVoice.checked = !slowVoice.checked;
                    slowVoice.dispatchEvent(new Event('change'));
                });
            }
        }

        const offlineSpeakRecall = document.getElementById('offline-speak-recall');
        if (offlineSpeakRecall) {
            offlineSpeakRecall.addEventListener('change', (e) => {
                this.main.useOfflineSpeak = e.target.checked;
                console.log("On Off set to:", !this.main.useOfflineSpeak ? "online" : "offline");
            });
        }

        const rateSliderActiveRecall = document.getElementById('rateSliderActiveRecall');
        const rateSliderSpanActiveRecall = document.getElementById('rateSliderSpanActiveRecall');
        if (rateSliderActiveRecall && rateSliderSpanActiveRecall) {
            rateSliderActiveRecall.addEventListener('change', (e) => {
                this.main.rate = e.target.value;
                rateSliderSpanActiveRecall.innerHTML = this.main.rate;
                console.log('rate value - ', this.main.rate);
            });
        }

        document.addEventListener('keydown', (e) => {
            const input = document.getElementById('ar-user-input');
            if (document.activeElement !== input) return;

            let currentValue = Number(rateSliderActiveRecall?.value ?? 0.8);
            const step = Number(rateSliderActiveRecall?.step ?? 0.1) || 0.1;

            if (e.altKey && e.shiftKey && e.key === 'ArrowRight') {
                if (rateSliderActiveRecall) {
                    currentValue = Math.min(Number(rateSliderActiveRecall.max), currentValue + step);
                    rateSliderActiveRecall.value = currentValue;
                    rateSliderSpanActiveRecall && (rateSliderSpanActiveRecall.textContent = String(currentValue));
                    this.main.rate = currentValue;
                }
                e.preventDefault();
            } else if (e.altKey && e.shiftKey && e.key === 'ArrowLeft') {
                if (rateSliderActiveRecall) {
                    currentValue = Math.max(Number(rateSliderActiveRecall.min), currentValue - step);
                    rateSliderActiveRecall.value = currentValue;
                    rateSliderSpanActiveRecall && (rateSliderSpanActiveRecall.textContent = String(currentValue));
                    this.main.rate = currentValue;
                }
                e.preventDefault();
            } else if (e.ctrlKey && e.shiftKey && e.key === ' ') {
                if (slowVoice) {
                    slowVoice.checked = !slowVoice.checked;
                    slowVoice.dispatchEvent(new Event('change'));
                }
                e.preventDefault();
            } else if (e.altKey && e.shiftKey && e.key === 'R') {
                // console.log('----> >> >>> >>');
                e.preventDefault();
                document.getElementById('ar-repeat-btn').click();
                // this.main.repeatAudio();
            } else if (e.altKey && e.shiftKey && e.key === 'F') {
                if (fuzzyMatch) {
                    fuzzyMatch.checked = !fuzzyMatch.checked;
                    fuzzyMatch.dispatchEvent(new Event('change'));
                } else {
                    this.useFuzzyMatching = !this.useFuzzyMatching;
                }
                e.preventDefault();
            }
        });
    }

    addMobileEnterButton() {
        const inputArea = document.getElementById('ar-input-area');
        if (!inputArea) return;
        if (document.getElementById('mobile-enter-btn')) return;
        const enterButton = document.createElement('button');
        enterButton.id = 'mobile-enter-btn';
        enterButton.innerHTML = '↵ Enter';
        enterButton.className = 'w-full mt-2 bg-blue-600 text-white py-3 rounded-lg font-semibold hidden';
        enterButton.addEventListener('click', () => {
            this.main.checkAnswer?.();
        });
        inputArea.appendChild(enterButton);
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
        userInput.addEventListener('focus', () => {
            if (userInput.value.trim().length > 0) {
                mobileEnterBtn.classList.remove('hidden');
            }
        });
        userInput.addEventListener('blur', () => {
            mobileEnterBtn.classList.add('hidden');
        });
    }

    setupCustomDropdown() {
        const dropdownBtn = document.getElementById('ar-mode-dropdown-btn');
        const dropdownMenu = document.getElementById('ar-mode-dropdown-menu');
        const modeDisplay = document.getElementById('ar-mode-display');
        if (!dropdownBtn || !dropdownMenu) return;
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = dropdownMenu.classList.contains('hidden');
            this.closeAllDropdowns();
            if (isHidden) {
                dropdownMenu.classList.remove('hidden');
                dropdownBtn.classList.add('border-blue-500', 'ring-2', 'ring-blue-200');
            } else {
                this.closeDropdown();
            }
        });
        dropdownMenu.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' && e.target.dataset.value) {
                const value = e.target.dataset.value;
                const text = e.target.textContent;
                this.main.activeRecallMode = value;
                if (modeDisplay) modeDisplay.textContent = text;
                this.handleModeChange();
                this.closeDropdown();
            }
        });
        document.addEventListener('click', () => {
            this.closeDropdown();
        });
        dropdownMenu.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        if (this.main.isTouchDevice) {
            dropdownBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropdownBtn.click();
            });
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
        if (dropdownMenu) dropdownMenu.classList.add('hidden');
        if (dropdownBtn) dropdownBtn.classList.remove('border-blue-500', 'ring-2', 'ring-blue-200');
    }

    closeAllDropdowns() {
        const allDropdowns = document.querySelectorAll('[id*="dropdown-menu"]');
        allDropdowns.forEach(menu => menu.classList.add('hidden'));
        const allDropdownBtns = document.querySelectorAll('[id*="dropdown-btn"]');
        allDropdownBtns.forEach(btn => btn.classList.remove('border-blue-500', 'ring-2', 'ring-blue-200'));
    }

    handleUserInput() {
        if (this.main.activeRecallMode === 'beginner') {
            this.updateHintDisplay();
        }
    }

    handleModeChange() {
        const modeSelect = document.getElementById('ar-mode-select');
        if (modeSelect) {
            this.main.activeRecallMode = modeSelect.value;
            if (this.main.sentences && this.main.currentSentenceIndex >= 0) {
                this.updateHintDisplay();
                setTimeout(() => {
                    window.dispatchEvent(new Event('resize'));
                }, 100);
            }
        }
        const hintDisplay = document.getElementById('ar-hint-display');
        const fuzzyMatch = document.getElementById('ar-fuzzy-match');
        if (hintDisplay) {
            if (this.main.activeRecallMode === 'beginner') {
                hintDisplay.classList.remove('hidden');
                hintDisplay.style.display = 'block';
                fuzzyMatch.click();
            } else {
                hintDisplay.classList.add('hidden');
                hintDisplay.style.display = 'none';
                fuzzyMatch.click();
            }
        }
    }

    resetHintDisplay() {
        const hintDisplay = document.getElementById('ar-hint-display');
        const hintText = document.getElementById('ar-hint-text');
        // ar-translation
        const translation = document.getElementById('ar-translation');
        if (!hintDisplay || !hintText || !translation) return;
        // hintDisplay.classList.add('hidden');
        // hintDisplay.style.display = 'none';
        hintText.textContent = '';
        translation.textContent = '';
    }

    updateHintDisplay() {
        const hintDisplay = document.getElementById('ar-hint-display');
        const hintText = document.getElementById('ar-hint-text');
        if (!hintDisplay || !hintText) return;
        if (this.main.activeRecallMode === 'beginner' && this.main.currentSentenceIndex >= 0) {
            const sentence = this.main.sentences[this.main.currentSentenceIndex].replace(/[\p{P}]/gu, '').trim();
            const words = sentence.split(/\s+/);
            let hintHTML = '';
            const userInput = document.getElementById('ar-user-input').value.toLowerCase();
            const userWords = userInput.split(/\s+/).filter(w => w.trim());
            words.forEach(word => {
                const cleanWord = word.toLowerCase().replace(/[.,!?;]/g, '');
                const isRevealed = userWords.some(userWord => this.wordsMatch(userWord, cleanWord));
                if (isRevealed) {
                    hintHTML += `<span class="text-green-600 font-bold">${word}</span> `;
                } else {
                    hintHTML += `<span class="text-blue-400 font-mono">${'–'.repeat(Math.max(2, word.length))}</span> `;
                }
            });
            hintText.innerHTML = hintHTML;
            hintDisplay.classList.remove('hidden');
            hintDisplay.style.display = 'block';
            this.fixMobileHintDisplay();
        } else {
            hintDisplay.classList.add('hidden');
            hintDisplay.style.display = 'none';
        }
    }

    fixMobileHintDisplay() {
        const hintDisplay = document.getElementById('ar-hint-display');
        if (!hintDisplay) return;
        hintDisplay.style.opacity = '0.99';
        setTimeout(() => { hintDisplay.style.opacity = '1'; }, 50);
        hintDisplay.style.touchAction = 'manipulation';
        hintDisplay.style.webkitUserSelect = 'none';
        hintDisplay.style.userSelect = 'none';
    }

    wordsMatch(userWord, correctWord, threshold = 0.7) {
        if (!this.useFuzzyMatching) return userWord === correctWord;
        if (userWord === correctWord) return true;
        if (userWord.toLowerCase() === correctWord.toLowerCase()) return true;
        const distance = this.levenshteinDistance(userWord.toLowerCase(), correctWord.toLowerCase());
        const maxLength = Math.max(userWord.length, correctWord.length);
        const similarity = 1 - (distance / maxLength);
        return similarity >= threshold;
    }

    levenshteinDistance(a, b) {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
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

        if (this.extraToolsContainer) {
            // insert in this.extraToolsContainer

            this.extraToolsContainer.insertAdjacentElement('beforeend', this.activeRecallBtn);
            return;
        }

        // Insert after the Add to Flashcards button
        const addToFlashBtn = document.getElementById('addToFlashBtn');
        // this.main.output.insertAdjacentElement('beforeend', this.activeRecallBtn);
    }

    toggleActiveRecall() {
        const activeRecallTool = document.getElementById('active-recall-tool');
        const isVisible = !activeRecallTool.classList.contains('hidden');

        if (!this.originalText) {
            this.originalText = this.main.input.value;
        }

        const vocabToolContainer = document.getElementById('vocab-tool-div');
        const addToFlashBtn = document.getElementById('addToFlashBtn');
        const output = document.getElementById('output');
        const selectionTooltip = document.getElementById('selectionTooltip');
        const extraToolsContainer = document.getElementById('extra-tools-container');

        if (!isVisible) {
            // Enter Active Recall mode
            this.prepareActiveRecall();
            activeRecallTool.classList.remove('hidden');

            // Hide the sidebar elements
            const vocabSidebar = document.getElementById('vocab-stories-sidebar');
            const vocabHamburger = document.getElementById('vocab-hamburger-menu');
            const vocabOverlay = document.getElementById('vocab-sidebar-overlay');

            if (vocabSidebar) {
                vocabSidebar.dataset.originalDisplay = vocabSidebar.style.display || '';
                vocabSidebar.style.display = 'none';
            }
            if (vocabHamburger) {
                vocabHamburger.dataset.originalDisplay = vocabHamburger.style.display || '';
                vocabHamburger.style.display = 'none';
            }
            if (vocabOverlay) {
                vocabOverlay.dataset.originalDisplay = vocabOverlay.style.display || '';
                vocabOverlay.style.display = 'none';
            }

            this.main.vocabSection.style.marginRight = '10%';
            // center in middle of screen
            this.main.vocabSection.style.marginLeft = '10%';

            // Hide everything in main-vocab-view EXCEPT:
            // - active-recall-tool (AR interface)
            // - output (display area)
            // - selectionTooltip (tooltips)
            // - extra-tools-container (contains the exit button!)
            const mainVocabView = document.getElementById('main-vocab-view');
            if (mainVocabView) {
                Array.from(mainVocabView.children).forEach(child => {
                    if (!['active-recall-tool', 'output', 'selectionTooltip', 'extra-tools-container'].includes(child.id)) {
                        child.dataset.originalDisplay = child.style.display || '';
                        child.style.display = 'none';
                    }
                });
            }

            output.style.display = 'none';
            selectionTooltip.style.display = 'none';


            // Make sure extra-tools-container is visible (contains exit button)
            if (extraToolsContainer) {
                extraToolsContainer.style.display = 'flex';
                extraToolsContainer.classList.remove('border-2', 'border-gray-300');
            }

            // Hide the top toolbar
            if (vocabToolContainer) {
                vocabToolContainer.dataset.originalDisplay = vocabToolContainer.style.display || '';
                vocabToolContainer.style.display = 'none';
            }

            // Hide passive learning button if it exists
            const passiveLearningBtn = document.getElementById('passive-learning-btn');
            if (passiveLearningBtn) {
                passiveLearningBtn.classList.add('hidden');
            }

            // Hide add to flash button
            if (addToFlashBtn) {
                addToFlashBtn.style.display = 'none';
            }

            this.activeRecallBtn.innerHTML = '❌ Exit Active Recall';
            console.log('Active Recall mode activated');

        } else {
            // Exit Active Recall mode
            activeRecallTool.classList.add('hidden');
            this.resetActiveRecall();

            // Restore sidebar elements
            const vocabSidebar = document.getElementById('vocab-stories-sidebar');
            const vocabHamburger = document.getElementById('vocab-hamburger-menu');
            const vocabOverlay = document.getElementById('vocab-sidebar-overlay');

            if (vocabSidebar && vocabSidebar.hasAttribute('data-original-display')) {
                const originalDisplay = vocabSidebar.dataset.originalDisplay;
                vocabSidebar.style.display = originalDisplay || '';
                delete vocabSidebar.dataset.originalDisplay;
            }
            if (vocabHamburger && vocabHamburger.hasAttribute('data-original-display')) {
                const originalDisplay = vocabHamburger.dataset.originalDisplay;
                vocabHamburger.style.display = originalDisplay || '';
                delete vocabHamburger.dataset.originalDisplay;
            }
            if (vocabOverlay && vocabOverlay.hasAttribute('data-original-display')) {
                const originalDisplay = vocabOverlay.dataset.originalDisplay;
                vocabOverlay.style.display = originalDisplay || '';
                delete vocabOverlay.dataset.originalDisplay;
            }
            this.main.vocabSection.style.marginRight = '0';
            this.main.vocabSection.style.marginLeft = '0';
            this.main.vocabSection.style.marginRight = 'calc(50% - 425px)';

            output.style.display = 'block';
            selectionTooltip.style.display = 'block';

            // Restore main-vocab-view children
            const mainVocabView = document.getElementById('main-vocab-view');
            if (mainVocabView) {
                Array.from(mainVocabView.children).forEach(child => {
                    if (child.hasAttribute('data-original-display')) {
                        const originalDisplay = child.dataset.originalDisplay;
                        child.style.display = originalDisplay || '';
                        delete child.dataset.originalDisplay;
                    }
                });
            }

            // Make sure extra-tools-container has border again
            if (extraToolsContainer) {
                extraToolsContainer.classList.add('border-2', 'border-gray-300');
            }

            // Restore top toolbar
            if (vocabToolContainer && vocabToolContainer.hasAttribute('data-original-display')) {
                const originalDisplay = vocabToolContainer.dataset.originalDisplay;
                vocabToolContainer.style.display = originalDisplay || '';
                delete vocabToolContainer.dataset.originalDisplay;
            }

            // Show passive learning button
            const passiveLearningBtn = document.getElementById('passive-learning-btn');
            if (passiveLearningBtn) {
                passiveLearningBtn.classList.remove('hidden');
            }

            // Show add to flash button
            if (addToFlashBtn) {
                addToFlashBtn.style.display = 'inline-block';
            }

            this.activeRecallBtn.innerHTML = '🎯 Active Recall';
            if (!this.isFlashCardLoadRequested) {
                console.log('Re-processing text after exiting Active Recall');
                this.main.processBtn.click();
            }
            this.isFlashCardLoadRequested = !this.isFlashCardLoadRequested;
        }
    }

    createActiveRecallUI() {
        const activeRecallHTML = `
            <div id="active-recall-tool" class="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200 hidden">
                <h3 class="text-lg font-semibold mb-4">🎯 Active Recall Practice</h3>
                
                <!-- Custom Dropdown for Mode Selection -->
                <div class="mb-4 flex flex-wrap gap-4 justify-between">
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
                        <div class="flex flex-col">
                            <input type="checkbox" id="ar-fuzzy-match" class="switch-input">
                            <label for="ar-fuzzy-match" class="mx-auto switch-label text-sm font-medium"></label>
                            <span class="mx-auto">Fuzzy Word Matching</span>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <div class="flex flex-col">
                            <input type="checkbox" id="ar-slow-voice" class="switch-input">
                            <label for="ar-slow-voice" class="mx-auto switch-label text-sm font-medium"></label>
                            <span class="mx-auto">Slow Voice</span>
                        </div>
                    </div>
                    <div class="flex flex-row items-center space-x-1">
                        <div class="flex flex-col">
                            <input type="checkbox" id="offline-speak-recall" class="switch-input">
                            <label for="offline-speak-recall" class="mx-auto switch-label text-sm font-medium"></label>
                            <span class="mx-auto">Offline Mode</span>
                        </div>
                    </div>
                    <div class="flex flex-row items-center space-x-1">
                        <input type="range" id="rateSliderActiveRecall" min="0.5" max="1.5" step="0.1" value="0.8">
                        <span id="rateSliderSpanActiveRecall" class="text-sm text-gray-700 my-auto">0.8</span>
                    </div>
                </div>
                
                ${this.getActiveRecallUIBody()}
            </div>
        `;
        this.main.output.insertAdjacentHTML('afterend', activeRecallHTML);
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

            <!-- wrapper for text + translation -->
            <div class="relative inline-block group">
                <div id="ar-hint-text" class="text-lg font-mono text-blue-900"></div>
                <div id="ar-translation" 
                    class="absolute -top-8 w-full left-1/2 -translate-x-1/2 bg-blue-100 text-blue-800 text-xs italic px-2 py-1 border border-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                </div>
            </div>
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

            <div>ALT+SHIFT+Left/Right</div>
            <div class="text-green-600">Arrows Change Offline Range</div>

            <div>CTRL+SHIFT+Space</div>
            <div class="text-green-600">Toggle Online Slow Voice</div>

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
                ➡️ Skip
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
    setupActiveRecall() {
        this.createActiveRecallUI();
        this.setupActiveRecallListeners();
    }

    async updateTranslation() {
        const sentence = this.main.sentences[this.main.currentSentenceIndex].replace(/\p{P}/gu, '').trim();
        console.log('==> ', sentence);
        const translation = await this.main.translate(sentence);
        return translation;
    }



    async setupActiveRecallListeners() {
        console.log('-----> ', 'setupActiveRecallListeners');
        // Use event delegation for better mobile support
        document.addEventListener('click', async (e) => {
            if (e.target.matches('#ar-start-btn')) {
                await this.startActiveRecall();
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

        // Wire checkboxes, sliders, and keyboard shortcuts
        this.wireControls();

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
                this.main.useSlowVoice = e.target.checked;
                console.log("Slow voice set to:", this.main.useSlowVoice)
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
            this.main.useOfflineSpeak = e.target.checked;
            console.log("On Off set to:", !this.useOfflineSpeak ? "online" : "offline");
        });

        const rateSliderActiveRecall = document.getElementById('rateSliderActiveRecall');
        const rateSliderSpanActiveRecall = document.getElementById('rateSliderSpanActiveRecall');
        const activeRecallContainer = document.getElementById('active-recall-tool');

        rateSliderActiveRecall.addEventListener('change', (e) => {
            this.main.rate = e.target.value;
            rateSliderSpanActiveRecall.innerHTML = this.main.rate;
            console.log('rate value - ', this.main.rate);
        })

        // document.addEventListener('keydown', (e) => {
        //     console.log('activated keydown active recall slider');

        //     let currentValue = Number(rateSliderActiveRecall.value);
        //     const step = Number(rateSliderActiveRecall.step) || 1;

        //     // Only process keys if body is focused
        //     if (document.activeElement !== document.getElementById('ar-user-input')) {
        //         return;
        //     }

        //     if (e.altKey && e.shiftKey && e.key === 'ArrowRight') {
        //         currentValue = Math.min(Number(rateSliderActiveRecall.max), currentValue + step);
        //         rateSliderActiveRecall.value = currentValue;
        //         e.preventDefault();
        //     } else if (e.altKey && e.shiftKey && e.key === 'ArrowLeft') {
        //         currentValue = Math.max(Number(rateSliderActiveRecall.min), currentValue - step);
        //         rateSliderActiveRecall.value = currentValue;
        //         e.preventDefault();
        //     } else if (e.ctrlKey && e.shiftKey && e.key === ' ') {
        //         slowVoice.checked = !slowVoice.checked;
        //         this.main.useSlowVoice = slowVoice.checked;
        //         e.preventDefault();
        //         console.log("Slow voice set to:", this.main.useSlowVoice)
        //     }
        //     // fuzzy match art+shift+f
        //     else if (e.altKey && e.shiftKey && e.key === 'F') {
        //         fuzzyMatch.checked = !fuzzyMatch.checked;
        //         this.useFuzzyMatching = fuzzyMatch.checked;
        //         e.preventDefault();
        //         console.log("Fuzzy matching set to:", this.useFuzzyMatching);
        //     }
        //     // Alt+Shift+F for repeat
        //     else if (e.altKey && e.shiftKey && e.key === 'R') {
        //         e.preventDefault();
        //         this.repeatAudio();
        //     }
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

        //     rateSliderSpanActiveRecall.textContent = rateSliderActiveRecall.value;
        //     this.main.rate = rateSliderActiveRecall.value;
        // });

        this.addActiveRecallButton();
    }

    // ====== UPDATED LOGIC ======
    prepareActiveRecall() {
        const text = this.main.input.value;
        this.originalAllSentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
        this.selectedFlashcardList = JSON.parse(localStorage.getItem('lastARList'));

        if (!text.trim()) {
            alert('Please process some text first!');
            return;
        }

        // Instead of processing directly, delegate to prepareActiveRecallParts
        this.prepareActiveRecallParts();
    }

    // ====== KEEP THE EXISTING prepareActiveRecallParts FUNCTION AS IS ======
    prepareActiveRecallParts() {
        const text = this.main.input.value;
        if (!text.trim()) {
            alert('Please process some text first!');
            return;
        }

        const allSentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
        if (allSentences.length === 0) {
            alert('No sentences found in the text!');
            return;
        }

        this.originalAllSentences = allSentences;

        const maxSentencesPerPart = 50;
        if (allSentences.length <= maxSentencesPerPart) {
            // If total sentences are within the limit, proceed with normal active recall
            this.main.sentences = allSentences;
            this.currentPartIndex = 0; // Single part = part 0
            localStorage.setItem(`lastSelectedPart_${this.selectedFlashcardList}`, 0);
            this.initializeActiveRecallState();
            this.setupActiveRecallUI();
            return;
        }

        const parts = [];
        for (let i = 0; i < allSentences.length; i += maxSentencesPerPart) {
            parts.push(allSentences.slice(i, i + maxSentencesPerPart));
        }

        this.showPartSelectionModal(parts);
    }

    showPartSelectionModal(parts) {
        // Remove existing modal if any
        let existingModal = document.getElementById('ar-part-selection-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal container
        const modal = document.createElement('div');
        modal.id = 'ar-part-selection-modal';
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70';

        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col';

        // Add modal header
        const modalHeader = document.createElement('div');
        modalHeader.className = 'p-6 border-b border-gray-200';
        modalHeader.innerHTML = `
        <h2 class="text-2xl font-bold text-gray-800">Select Parts for Active Recall</h2>
        <p class="text-gray-600 mt-2">
            Your text has ${this.main.input.value.split(/[.!?]+/).filter(s => s.trim().length > 5).length} sentences.
            Click on parts to select/deselect them.
        </p>
    `;

        // Create parts container
        const partsContainer = document.createElement('div');
        partsContainer.id = 'ar-parts-list';
        partsContainer.className = 'flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-3';

        // Add select all button
        const selectAllContainer = document.createElement('div');
        selectAllContainer.className = 'px-4 pt-2 border-b border-gray-200 pb-3';
        const selectAllButton = document.createElement('button');
        selectAllButton.id = 'ar-select-all-btn';
        selectAllButton.className = 'px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg font-medium transition-colors duration-200';
        selectAllButton.textContent = 'Select All';
        selectAllContainer.appendChild(selectAllButton);

        // Create modal footer
        const modalFooter = document.createElement('div');
        modalFooter.className = 'p-6 border-t border-gray-200 flex justify-between items-center';
        modalFooter.innerHTML = `
        <button id="ar-cancel-recall-btn" class="px-6 py-3 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-lg font-medium transition-colors duration-200">
            Cancel
        </button>
        <div class="flex items-center space-x-4">
            <span id="ar-selected-count" class="text-gray-600">
                Selected: 0/${parts.length} parts
            </span>
            <button id="ar-start-recall-btn" class="px-6 py-3 bg-green-500 text-white hover:bg-green-600 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                Start Active Recall
            </button>
        </div>
    `;

        // Assemble modal
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(selectAllContainer);
        modalContent.appendChild(partsContainer);
        modalContent.appendChild(modalFooter);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        const totalSentences = this.main.input.value.split(/[.!?]+/).filter(s => s.trim().length > 5).length;
        const selectedParts = new Set(); // Track selected parts by index

        // Function to update UI state
        const updateUIState = () => {
            const selectedCount = selectedParts.size;
            const totalCount = parts.length;

            // Update selected count text
            document.getElementById('ar-selected-count').textContent =
                `Selected: ${selectedCount}/${totalCount} parts`;

            // Update start button state
            const startButton = document.getElementById('ar-start-recall-btn');
            startButton.disabled = selectedCount === 0;
            startButton.className = selectedCount === 0
                ? 'px-6 py-3 bg-green-500 text-white rounded-lg font-medium opacity-50 cursor-not-allowed'
                : 'px-6 py-3 bg-green-500 text-white hover:bg-green-600 rounded-lg font-medium transition-colors duration-200';

            // Update select all button text
            const selectAllBtn = document.getElementById('ar-select-all-btn');
            selectAllBtn.textContent = selectedCount === totalCount
                ? 'Deselect All'
                : 'Select All';
        };

        // Replace the entire parts.forEach loop with this:
        parts.forEach((part, index) => {
            // Check if this part is already completed
            const completionKey = `completedParts_${this.selectedFlashcardList}`;
            const completedParts = JSON.parse(localStorage.getItem(completionKey) || '[]');
            const isCompleted = completedParts.includes(index);

            const start = index * 50 + 1;
            const end = Math.min((index + 1) * 50, totalSentences);
            const sentenceCount = part.length;

            const partDiv = document.createElement('div');

            // Create the part div with the structure that matches your click handler
            partDiv.className = `p-4 rounded-lg border-2 ${isCompleted ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50'} cursor-pointer transition-all duration-200 hover:shadow-md`;
            partDiv.dataset.index = index;

            // Use your original HTML structure
            partDiv.innerHTML = `
        <div class="flex items-start">
            <div class="flex-shrink-0 w-8 h-8 rounded-full ${isCompleted ? 'bg-green-500' : 'bg-blue-500'} text-white flex items-center justify-center font-bold mr-3">
                ${index + 1}
            </div>
            <div class="flex-1">
                <div class="font-bold text-gray-800 mb-1">Part ${index + 1}${isCompleted ? ' ✓' : ''}</div>
                <div class="text-sm text-gray-600 mb-2">
                    Sentences ${start}-${end}
                </div>
                <div class="text-xs text-gray-500">
                    ${sentenceCount} sentence${sentenceCount !== 1 ? 's' : ''}
                </div>
            </div>
            <div class="flex-shrink-0">
                <div class="w-6 h-6 rounded-full border-2 ${selectedParts.has(index) ? 'border-green-500' : 'border-gray-400'} flex items-center justify-center">
                    ${selectedParts.has(index) ? '<div class="w-3 h-3 rounded-full bg-green-500"></div>' : ''}
                </div>
            </div>
        </div>
    `;

            // Update click handler to match the new structure
            partDiv.addEventListener('click', () => {
                if (selectedParts.has(index)) {
                    selectedParts.delete(index);
                    partDiv.className = `p-4 rounded-lg border-2 ${isCompleted ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50'} cursor-pointer transition-all duration-200 hover:shadow-md`;
                    // Update the checkmark circle
                    const checkmarkDiv = partDiv.querySelector('.flex-shrink-0:last-child > div');
                    if (checkmarkDiv) {
                        checkmarkDiv.className = 'w-6 h-6 rounded-full border-2 border-gray-400 flex items-center justify-center';
                        checkmarkDiv.innerHTML = '';
                    }
                } else {
                    selectedParts.add(index);
                    partDiv.className = `p-4 rounded-lg border-2 ${isCompleted ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50'} cursor-pointer transition-all duration-200 hover:shadow-md`;
                    // Update the checkmark circle
                    const checkmarkDiv = partDiv.querySelector('.flex-shrink-0:last-child > div');
                    if (checkmarkDiv) {
                        checkmarkDiv.className = 'w-6 h-6 rounded-full border-2 border-green-500 flex items-center justify-center';
                        checkmarkDiv.innerHTML = '<div class="w-3 h-3 rounded-full bg-green-500"></div>';
                    }
                }
                updateUIState();
            });

            partsContainer.appendChild(partDiv);
        });

        // Select all button handler
        const selectAllBtn = document.getElementById('ar-select-all-btn');
        selectAllBtn.addEventListener('click', () => {
            const allSelected = selectedParts.size === parts.length;
            const partDivs = partsContainer.querySelectorAll('[data-index]');

            if (allSelected) {
                // Deselect all
                selectedParts.clear();
                partDivs.forEach(div => {
                    const index = parseInt(div.dataset.index);
                    div.className = 'p-4 rounded-lg border-2 border-gray-300 bg-gray-50 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-gray-400';
                    div.querySelector('.flex-shrink-0:last-child div:first-child').className = 'w-6 h-6 rounded-full border-2 border-gray-400 flex items-center justify-center';
                    div.querySelector('.flex-shrink-0:last-child div:first-child').innerHTML = '';
                });
            } else {
                // Select all
                parts.forEach((_, index) => selectedParts.add(index));
                partDivs.forEach(div => {
                    div.className = 'p-4 rounded-lg border-2 border-green-500 bg-green-50 cursor-pointer transition-all duration-200 hover:shadow-md';
                    div.querySelector('.flex-shrink-0:last-child div:first-child').className = 'w-6 h-6 rounded-full border-2 border-green-500 flex items-center justify-center';
                    div.querySelector('.flex-shrink-0:last-child div:first-child').innerHTML = '<div class="w-3 h-3 rounded-full bg-green-500"></div>';
                });
            }

            updateUIState();
        });

        // Initialize UI state
        updateUIState();

        // Event handlers
        const startButton = document.getElementById('ar-start-recall-btn');
        const cancelButton = document.getElementById('ar-cancel-recall-btn');

        const handleStart = () => {
            const selectedIndices = Array.from(selectedParts).sort((a, b) => a - b);

            if (selectedIndices.length === 0) {
                alert('Please select at least one part.');
                return;
            }

            const selectedPartIndex = selectedIndices[0];
            this.currentPartIndex = selectedPartIndex;
            localStorage.setItem(`lastSelectedPart_${this.selectedFlashcardList}`, selectedPartIndex);


            let selectedSentences = [];
            selectedIndices.forEach(idx => {
                selectedSentences = selectedSentences.concat(parts[idx]);
            });

            // Clean up
            startButton.removeEventListener('click', handleStart);
            cancelButton.removeEventListener('click', handleCancel);
            selectAllBtn.removeEventListener('click', selectAllBtn.onclick);

            // Remove modal
            modal.remove();

            // Start active recall
            this.main.sentences = selectedSentences;
            this.initializeActiveRecallState();
            this.setupActiveRecallUI();
        };

        const handleCancel = () => {
            // Clean up
            startButton.removeEventListener('click', handleStart);
            cancelButton.removeEventListener('click', handleCancel);
            selectAllBtn.removeEventListener('click', selectAllBtn.onclick);

            // Remove modal
            modal.remove();
        };

        startButton.addEventListener('click', handleStart);
        cancelButton.addEventListener('click', handleCancel);

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                handleCancel();
            }
        });

        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                handleCancel();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    initializeActiveRecallState() {
        this.main.currentSentenceIndex = -1;
        this.main.userAnswers = [];
        this.main.startTimes = [];
        this.main.results = [];
    }

    setupActiveRecallUI() {
        const modeSelect = document.getElementById('ar-mode-select');
        if (modeSelect) {
            this.main.activeRecallMode = modeSelect.value;
            if (this.main.activeRecallMode === 'beginner') {
                const hintDisplay = document.getElementById('ar-hint-display');
                if (hintDisplay) {
                    hintDisplay.classList.remove('hidden');
                    hintDisplay.style.display = 'block';
                    hintDisplay.textContent = 'Loading...';
                }
            }
        }
        if (document.getElementById('ar-current-sentence')) {
            document.getElementById('ar-current-sentence').textContent = 'Loading...';
        }
        document.getElementById('ar-total').textContent = this.main.sentences.length;
        this.updateProgress();
    }

    async startActiveRecall() {
        this.main.currentSentenceIndex = 0;
        await this.showCurrentSentence();
    }

    async showCurrentSentence() {
        const sentence = this.main.sentences[this.main.currentSentenceIndex].trim();
        const displayArea = document.getElementById('ar-current-sentence');
        const inputArea = document.getElementById('ar-input-area');
        const userInput = document.getElementById('ar-user-input');
        const hintDisplay = document.getElementById('ar-hint-display');

        displayArea.innerHTML = '<span class="text-gray-500">Loading audio...</span>';
        inputArea.classList.add('hidden');
        document.getElementById('ar-start-btn').classList.add('hidden');
        document.getElementById('ar-next-btn').classList.remove('hidden');
        document.getElementById('ar-back-btn').classList.remove('hidden');
        document.getElementById('ar-repeat-btn').classList.remove('hidden');
        document.getElementById('ar-finish-btn').classList.remove('hidden');

        if (this.main.isTouchDevice) {
            ['ar-next-btn', 'ar-back-btn', 'ar-repeat-btn', 'ar-finish-btn'].forEach(id => {
                const btn = document.getElementById(id);
                if (btn) {
                    btn.classList.add('py-3');
                    btn.style.minHeight = '44px';
                }
            });
        }

        document.getElementById('ar-back-btn').disabled = this.main.currentSentenceIndex === 0;
        this.main.startTimes[this.main.currentSentenceIndex] = Date.now();
        this.updateTimer();
        this.main.timerInterval = setInterval(() => this.updateTimer(), 1000);

        displayArea.textContent = '🎧 Listen carefully...';
        this.resetHintDisplay();
        const translation = await this.updateTranslation();

        this.main.speech.speak(sentence).then(() => {
            if (this.main.isTouchDevice) {
                setTimeout(() => {
                    document.body.style.overflow = 'hidden';
                    setTimeout(() => { document.body.style.overflow = 'auto'; }, 50);
                }, 10);
            }
            setTimeout(async () => {
                inputArea.classList.remove('hidden');
                userInput.value = '';
                if (this.main.isTouchDevice) {
                    setTimeout(() => {
                        userInput.focus();
                        this.addMobileEnterButton();
                        const mobileEnterBtn = document.getElementById('mobile-enter-btn');
                        if (mobileEnterBtn) mobileEnterBtn.classList.add('hidden');
                    }, 100);
                } else {
                    userInput.focus();
                }
                displayArea.innerHTML = `
                <div class="text-center">
                    <div class="text-lg mb-2">✍️ Write what you heard:</div>
                    <div class="text-sm text-gray-500">Sentence ${this.main.currentSentenceIndex + 1} of ${this.main.sentences.length}</div>
                </div>`;
                if (this.main.activeRecallMode === 'beginner') {
                    this.updateHintDisplay();
                    document.getElementById('ar-translation').textContent = translation;
                } else {
                    hintDisplay.classList.add('hidden');
                    hintDisplay.style.display = 'none';
                }
            }, 1000);
        });
    }

    updateTimer() {
        if (this.main.startTimes[this.main.currentSentenceIndex]) {
            const elapsed = Math.floor((Date.now() - this.main.startTimes[this.main.currentSentenceIndex]) / 1000);
            if (document.getElementById('ar-timer')) {
                document.getElementById('ar-timer').textContent = `Time: ${elapsed}s`;
            }
        }
    }

    updateProgress() {
        const progress = this.main.currentSentenceIndex >= 0 ? this.main.currentSentenceIndex : 0;
        const percentage = (progress / this.main.sentences.length) * 100;
        document.getElementById('ar-current').textContent = progress;
        document.getElementById('ar-progress-bar').style.width = `${percentage}%`;
        const status = document.getElementById('ar-status');
        if (this.main.currentSentenceIndex < 0) {
            status.textContent = 'Ready to start';
        } else if (this.main.currentSentenceIndex < this.main.sentences.length) {
            status.textContent = `Sentence ${this.main.currentSentenceIndex + 1} of ${this.main.sentences.length}`;
        } else {
            status.textContent = 'Practice completed!';
        }
    }

    checkAnswer() {
        const userInput = document.getElementById('ar-user-input').value.trim();
        const correctSentence = this.main.sentences[this.main.currentSentenceIndex].replace(/[\p{P}]/gu, '').trim();
        if (!userInput) {
            alert('Please type what you heard!');
            return;
        }
        this.main.userAnswers[this.main.currentSentenceIndex] = userInput;
        this.main.results[this.main.currentSentenceIndex] = this.compareSentences(userInput, correctSentence);
        this.showSentenceFeedback(this.main.currentSentenceIndex);
        setTimeout(() => {
            if (this.main.currentSentenceIndex < this.main.sentences.length - 1) {
                this.nextSentence();
            } else {
                this.main.currentSentenceIndex++;
                this.finishActiveRecall();
            }
        }, 3000);
    }

    compareSentences(userSentence, correctSentence) {
        const userWords = userSentence.toLowerCase().split(/\s+/).filter(w => w.trim());
        const correctWords = correctSentence.toLowerCase().split(/\s+/).filter(w => w.trim());
        const result = { userSentence, correctSentence, words: [], correctCount: 0, totalWords: correctWords.length, matchedWords: new Set(), extraWords: [] };
        const userWordMatches = new Array(userWords.length).fill(null);
        const correctWordMatches = new Array(correctWords.length).fill(false);
        userWords.forEach((userWord, userIndex) => {
            const correctIndex = correctWords.findIndex((correctWord, idx) => !correctWordMatches[idx] && this.wordsMatch(userWord, correctWord));
            if (correctIndex !== -1) { userWordMatches[userIndex] = correctIndex; correctWordMatches[correctIndex] = true; result.correctCount++; }
        });
        userWords.forEach((userWord, userIndex) => {
            if (userWordMatches[userIndex] === null) {
                const correctIndex = correctWords.findIndex((correctWord, idx) => !correctWordMatches[idx] && this.wordsMatch(userWord, correctWord, 0.6));
                if (correctIndex !== -1) { userWordMatches[userIndex] = correctIndex; correctWordMatches[correctIndex] = true; result.correctCount++; }
            }
        });
        userWords.forEach((userWord, userIndex) => {
            const correctIndex = userWordMatches[userIndex];
            const correctWord = correctIndex !== null ? correctWords[correctIndex] : '';
            result.words.push({ user: userWord, correct: correctWord, isCorrect: correctIndex !== null, isFuzzyMatch: correctIndex !== null && userWord !== correctWord });
            if (correctIndex !== null) result.matchedWords.add(correctIndex);
        });
        correctWords.forEach((correctWord, correctIndex) => {
            if (!correctWordMatches[correctIndex]) result.words.push({ user: '', correct: correctWord, isCorrect: false, isMissing: true });
        });
        userWords.forEach((userWord, userIndex) => {
            if (userWordMatches[userIndex] === null) result.extraWords.push(userWord);
        });
        result.accuracy = Math.round((result.correctCount / result.totalWords) * 100);
        return result;
    }

    showSentenceFeedback(sentenceIndex) {
        const result = this.main.results[sentenceIndex];
        const displayArea = document.getElementById('ar-current-sentence');
        let feedbackHTML = `<div class="text-left w-full">`;
        feedbackHTML += `<div class="font-semibold mb-2">Your input vs Correct sentence:</div>`;
        feedbackHTML += `<div class="mb-3 p-3 bg-gray-100 rounded">`;
        const correctWords = result.words.filter(w => w.isCorrect && !w.isFuzzyMatch);
        const fuzzyWords = result.words.filter(w => w.isFuzzyMatch);
        const missingWords = result.words.filter(w => w.isMissing);
        const wrongWords = result.words.filter(w => !w.isCorrect && !w.isMissing && w.user);
        if (correctWords.length > 0) { feedbackHTML += `<div class="mb-2"><span class="text-green-600 font-semibold">✓ Correct:</span> ${correctWords.map(w => w.user).join(' ')}</div>`; }
        if (fuzzyWords.length > 0) { feedbackHTML += `<div class="mb-2"><span class="text-yellow-600 font-semibold">≈ Close:</span> ${fuzzyWords.map(w => `${w.user} (→ ${w.correct})`).join(' ')}</div>`; }
        if (missingWords.length > 0) { feedbackHTML += `<div class="mb-2"><span class="text-red-600 font-semibold">✗ Missing:</span> ${missingWords.map(w => w.correct).join(' ')}</div>`; }
        if (wrongWords.length > 0) { feedbackHTML += `<div class="mb-2"><span class="text-red-600 font-semibold">✗ Extra:</span> ${wrongWords.map(w => w.user).join(' ')}</div>`; }
        feedbackHTML += `</div>`;
        feedbackHTML += `<div class="text-sm text-gray-600">Accuracy: ${result.accuracy}% (${result.correctCount}/${result.totalWords} words matched)</div>`;
        feedbackHTML += `</div>`;
        displayArea.innerHTML = feedbackHTML;
        document.getElementById('ar-input-area').classList.add('hidden');
    }

    async nextSentence() {
        if (this.main.currentSentenceIndex < this.main.sentences.length - 1) {
            this.main.currentSentenceIndex++;
            await this.showCurrentSentence();
            this.updateProgress();
        }
    }

    async previousSentence() {
        if (this.main.currentSentenceIndex > 0) {
            this.main.currentSentenceIndex--;
            await this.showCurrentSentence();
            this.updateProgress();
            if (this.main.results[this.main.currentSentenceIndex]) {
                this.showSentenceFeedback(this.main.currentSentenceIndex);
            }
        }
    }

    repeatAudio() {
        const repeatBtn = document.getElementById('ar-repeat-btn');
        if (repeatBtn) {
            repeatBtn.classList.add('glow-scale');
            const originalText = repeatBtn.textContent;
            repeatBtn.textContent = '🔊 Playing...';
            setTimeout(() => { repeatBtn.classList.remove('glow-scale'); repeatBtn.textContent = originalText; }, 800);
        }
        if (!Array.isArray(this.main.sentences) || this.main.sentences.length === 0) return;
        const idx = typeof this.main.currentSentenceIndex === 'number' ? this.main.currentSentenceIndex : 0;
        if (idx < 0 || idx >= this.main.sentences.length) return;
        const raw = this.main.sentences[idx];
        if (typeof raw !== 'string') return;
        const sentence = raw.trim();
        if (!sentence) return;
        this.main.speech.speak(sentence);
    }

    // Add this method to your ActiveRecallModule class
    getCurrentPartIndex() {
        const lastSelectedPart = JSON.parse(localStorage.getItem(`lastSelectedPart_${this.selectedFlashcardList}`));
        if (lastSelectedPart !== null) {
            return parseInt(lastSelectedPart);
        }

        return -1; // Unable to determine
    }

    finishActiveRecall() {
        clearInterval(this.main.timerInterval);
        this.showFinalResults();
        this.updateProgress();
        this.selectedFlashcardList = JSON.parse(localStorage.getItem('lastARList'));

        if (this.selectedFlashcardList) {
            // Track this part as completed
            const partIndex = this.getCurrentPartIndex();
            if (partIndex !== -1) {
                console.log('Part index:-->> ', partIndex);
                this.trackPartCompletion(partIndex);

                this.checkAllPartsCompleted();
            }

            // Update the list tracking array
            const arListArray = JSON.parse(localStorage.getItem('ARListArray') || '[]');
            if (!arListArray.includes(this.selectedFlashcardList)) {
                arListArray.push(this.selectedFlashcardList);
                localStorage.setItem('ARListArray', JSON.stringify(arListArray));
            }
        }
    }

    // Add these new methods:
    trackPartCompletion(partIndex) {
        if (!this.selectedFlashcardList || partIndex === -1) return;

        const completionKey = `completedParts_${this.selectedFlashcardList}`;
        let completedParts = JSON.parse(localStorage.getItem(completionKey) || '[]');

        if (!completedParts.includes(partIndex)) {
            completedParts.push(partIndex);
            localStorage.setItem(completionKey, JSON.stringify(completedParts));
            console.log(`Part ${partIndex + 1} marked as completed for ${this.selectedFlashcardList}`);
        }
    }

    checkAllPartsCompleted() {
        if (!this.selectedFlashcardList) return;

        // Get total number of parts
        const allSentences = this.originalAllSentences ||
            this.main.input.value.split(/[.!?]+/).filter(s => s.trim().length > 5);
        const totalParts = Math.ceil(allSentences.length / 50);

        // Get completed parts
        const completionKey = `completedParts_${this.selectedFlashcardList}`;
        const completedParts = JSON.parse(localStorage.getItem(completionKey) || '[]');

        // Check if all parts are completed
        const allPartsCompleted = completedParts.length >= totalParts;

        if (allPartsCompleted) {
            const completionKey = `completedARLists`;
            let completedLists = JSON.parse(localStorage.getItem(completionKey) || '[]');
            console.log('completedLists: ', completedLists);
            if (!completedLists) {
                localStorage.setItem(completionKey, JSON.stringify([]));
                completedLists = [];
            }
            console.log('completedLists after: ', completedLists);

            if (!completedLists.includes(this.selectedFlashcardList)) {
                completedLists.push(this.selectedFlashcardList);
                localStorage.setItem(completionKey, JSON.stringify(completedLists));
                console.log(`List ${this.selectedFlashcardList} marked as completed`);
            }
            this.showCompletionNotification();
        }

        return allPartsCompleted;
    }

    showCompletionNotification() {
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg z-50 animate-bounce';
        notification.innerHTML = `
        <div class="flex items-center">
            <span class="text-2xl mr-3">🎉</span>
            <div>
                <div class="font-bold">Amazing Progress!</div>
                <div>You've completed all parts of "${this.selectedFlashcardList}"!</div>
            </div>
        </div>
    `;

        document.body.appendChild(notification);

        // Remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    showFinalResults() {
        clearInterval(this.main.timerInterval);
        const totalAccuracy = Math.round(this.main.results.reduce((sum, r) => sum + r.accuracy, 0) / this.main.results.length);
        const totalCorrect = this.main.results.reduce((sum, r) => sum + r.correctCount, 0);
        const totalWords = this.main.results.reduce((sum, r) => sum + r.totalWords, 0);
        document.getElementById('ar-summary').innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div class="p-3 bg-blue-50 rounded-lg">
                <div class="text-2xl font-bold text-blue-600">${this.main.sentences.length}</div>
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
                <div class="text-2xl font-bold text-yellow-600">${Math.round(totalWords / this.main.sentences.length)}</div>
                <div class="text-sm text-yellow-800">Avg. Words/Sentence</div>
            </div>
            <div class="p-3 bg-red-50 rounded-lg">
                <div class="text-2xl font-bold text-red-600">${this.formatSecondsToMMSS(Math.floor((Date.now() - this.main.startTimes[0]) / 1000))}</div>
                <div class="text-sm text-red-800">Total Time</div>
            </div>
        </div>`;
        const detailedResults = document.getElementById('ar-detailed-results');
        detailedResults.innerHTML = this.main.results.map((result, index) => {
            const correctWords = result.correctSentence.split(/\s+/);
            const sequenceDisplay = this.getSequenceDisplay(result, correctWords);
            return `
        <div class="p-4 bg-white rounded-lg border border-gray-200">
            <div class="flex justify-between items-center mb-3">
                <span class="font-semibold">Sentence ${index + 1}</span>
                <span class="px-3 py-1 rounded-full text-sm font-medium ${result.accuracy >= 90 ? 'bg-green-100 text-green-800' : result.accuracy >= 70 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}">${result.accuracy}% accuracy</span>
            </div>
            <div class="mb-2"><strong>Correct:</strong> <span class="text-gray-700">${result.correctSentence}</span></div>
            <div class="mb-2"><strong>Your input:</strong> <span class="text-gray-700">${result.userSentence || "(no input)"}</span></div>
            <div class="mb-3"><strong>Sequence comparison:</strong><div class="sentence-comparison mt-2 p-3 bg-gray-50 rounded-lg font-mono text-lg">${sequenceDisplay}</div></div>
            <div class="text-sm text-gray-600 grid grid-cols-2 gap-2 mt-3">
                <div>Words matched: ${result.correctCount}/${result.totalWords}</div>
                <div>Fuzzy matches: ${result.words.filter(w => w.isFuzzyMatch).length}</div>
                <div>Missing words: ${result.words.filter(w => w.isMissing).length}</div>
                <div>Extra words: ${result.extraWords.length}</div>
            </div>
        </div>`;
        }).join('');
        const resultsContainer = document.getElementById('ar-results');
        if (resultsContainer && resultsContainer.classList) resultsContainer.classList.remove('hidden');
    }

    formatSecondsToMMSS(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    }

    getSequenceDisplay(result, correctWords) {
        let displayHTML = '';
        const wordMap = new Map();
        result.words.forEach(wordObj => {
            if (wordObj.isCorrect && wordObj.correct) {
                const correctIndex = correctWords.findIndex(w => w.toLowerCase() === wordObj.correct.toLowerCase());
                if (correctIndex !== -1) wordMap.set(correctIndex, wordObj);
            }
        });
        result.words.forEach(wordObj => {
            if (wordObj.isMissing && wordObj.correct) {
                const correctIndex = correctWords.findIndex(w => w.toLowerCase() === wordObj.correct.toLowerCase());
                if (correctIndex !== -1) wordMap.set(correctIndex, wordObj);
            }
        });
        correctWords.forEach((correctWord, index) => {
            const wordObj = wordMap.get(index);
            if (wordObj) {
                if (wordObj.isMissing) {
                    displayHTML += `<span id="missing" class="text-red-600 px-1 rounded" title="Missing word">${wordObj.correct}</span> `;
                } else if (wordObj.isFuzzyMatch) {
                    displayHTML += `<span class="text-yellow-600 px-1 rounded relative group" title="Close match: ${wordObj.user} → ${wordObj.correct}">${wordObj.user}<span class="absolute bottom-full left-0 bg-yellow-100 text-yellow-800 text-xs p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10">${wordObj.correct}</span></span> `;
                } else if (wordObj.isCorrect) {
                    displayHTML += `<span class="text-green-600 font-semibold">${wordObj.user}</span> `;
                }
            } else {
                displayHTML += `<span class="text-gray-400">${correctWord}</span> `;
            }
        });
        return displayHTML;
    }

    resetActiveRecall() {
        clearInterval(this.main.timerInterval);
        const results = document.getElementById('ar-results');
        if (results) results.classList.add('hidden');
        const inputArea = document.getElementById('ar-input-area');
        if (inputArea) inputArea.classList.add('hidden');
        document.getElementById('ar-start-btn').classList.remove('hidden');
        document.getElementById('ar-next-btn').classList.add('hidden');
        document.getElementById('ar-back-btn').classList.add('hidden');
        document.getElementById('ar-repeat-btn').classList.add('hidden');
        document.getElementById('ar-finish-btn').classList.add('hidden');
        document.getElementById('passive-learning-btn').classList.remove('hidden');
    }
}
