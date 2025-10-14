// Flashcards Tool Module
export class FlashcardsTool {
    constructor() {
        this.flashcards = JSON.parse(localStorage.getItem('germanFlashcards')) || [];
        this.customLists = JSON.parse(localStorage.getItem('customGermanLists')) || {};
        this.originalListName = null;
        this.currentPage = 1;
        this.cardsPerPage = 20;
        this.singleCardMode = false;
        this.useSlowSpeak = false;
        this.isFlipped = false; // New state to track if list is flipped

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderFlashcards();
        this.renderCustomListButtons();
        this.updatePaginationControls();
        feather.replace();
        AOS.init();
    }

    saveFlashcards() {
        localStorage.setItem('germanFlashcards', JSON.stringify(this.flashcards));
        this.updateCurrentCustomList();
    }

    updateProgress() {
        const masteredCount = this.flashcards.filter(c => c.mastered).length;
        const percentage = this.flashcards.length ? Math.round((masteredCount / this.flashcards.length) * 100) : 0;
        document.getElementById('progress-bar').style.width = `${percentage}%`;
        document.getElementById('progress-percentage').textContent = `${percentage}%`;
    }

    renderFlashcards() {
        const container = document.getElementById('flashcards-container');
        container.innerHTML = '';

        if (this.singleCardMode) {
            this.renderSingleCardMode(container);
        } else {
            this.renderGridMode(container);
        }

        feather.replace();
        this.updateProgress();
    }

    renderSingleCardMode(container) {
        container.className = "flex items-center justify-center mx-auto max-w-3xl";
        const card = this.flashcards[this.currentPage - 1];
        if (!card) return;

        const flashcard = document.createElement('div');
        flashcard.className = `flashcard w-full h-96 flex items-center justify-center`;
        flashcard.dataset.index = this.currentPage - 1;

        // Determine front and back content based on flip state
        let frontContent, backContent;

        if (this.isFlipped) {
            // Flipped: English on front, German on back
            frontContent = card.sentenceTranslation ?
                `<h3 class="text-2xl font-bold text-center text-indigo-700 mb-2">${card.english}</h3>
                 <p class="text-sm text-gray-600 text-center italic">${card.sentenceTranslation}</p>` :
                `<h3 class="text-2xl font-bold text-center text-indigo-700">${card.english}</h3>`;

            backContent = card.sentence ?
                `<h3 class="text-xl font-semibold text-center text-gray-800 mb-2">${card.german}</h3>
                 <p class="text-sm text-gray-600 text-center italic">${card.sentence}</p>` :
                `<h3 class="text-xl font-semibold text-center text-gray-800">${card.german}</h3>`;
        } else {
            // Normal: German on front, English on back
            frontContent = card.sentence ?
                `<h3 class="text-2xl font-bold text-center text-indigo-700 mb-2">${card.german}</h3>
                 <p class="text-sm text-gray-600 text-center italic">${card.sentence}</p>` :
                `<h3 class="text-2xl font-bold text-center text-indigo-700">${card.german}</h3>`;

            backContent = card.sentenceTranslation ?
                `<h3 class="text-xl font-semibold text-center text-gray-800 mb-2">${card.english}</h3>
                 <p class="text-sm text-gray-600 text-center italic">${card.sentenceTranslation}</p>` :
                `<h3 class="text-xl font-semibold text-center text-gray-800">${card.english}</h3>`;
        }

        flashcard.innerHTML = `
            <div class="flashcard-inner h-full w-full ${card.mastered ? 'border-2 border-solid border-green-200 rounded-2xl' : ''}">
                <div class="flashcard-front bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center justify-center cursor-pointer h-full">
                    ${frontContent}
                    <button class="speak-btn mt-4 p-3 bg-indigo-100 rounded-full hover:bg-indigo-200">
                        <i data-feather="volume-2" class="text-indigo-700 w-6 h-6"></i>
                    </button>
                    <p class="text-xs text-gray-500 mt-8">Click to flip</p>
                    ${card.mastered ? '<i data-feather="check-circle" class="text-green-500 mt-2 w-12 h-12 mt-4"></i>' : ''}
                </div>
                <div class="flashcard-back bg-indigo-100 rounded-2xl shadow-xl p-8 flex flex-col items-center justify-center cursor-pointer h-full">
                    ${backContent}
                    <div class="mt-4">
                        <button class="master-btn px-4 py-2 ${card.mastered ? 'bg-green-500' : 'bg-gray-500'} text-white rounded text-sm">
                            ${card.mastered ? 'Mastered: click to undo' : 'Mark as Mastered'}
                        </button>
                    </div>
                </div>
            </div>`;
        container.appendChild(flashcard);

        this.setupFlashcardEventListeners(flashcard);
        this.updatePaginationControls();
    }

    renderGridMode(container) {
        container.className = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 mx-auto max-w-3xl";
        const startIndex = (this.currentPage - 1) * this.cardsPerPage;
        const endIndex = Math.min(startIndex + this.cardsPerPage, this.flashcards.length);

        this.flashcards.slice(startIndex, endIndex).forEach((card, idx) => {
            const actualIndex = startIndex + idx;
            const flashcard = document.createElement('div');
            flashcard.className = `flashcard`;
            flashcard.dataset.index = actualIndex;

            // Determine front and back content based on flip state
            let frontContent, backContent;

            if (this.isFlipped) {
                // Flipped: English on front, German on back
                frontContent = card.sentenceTranslation ?
                    `<h3 class="text-sm font-bold text-center text-indigo-700 mb-1">${card.english}</h3>
                     <p class="text-xs text-gray-600 text-center italic">${card.sentenceTranslation}</p>` :
                    `<h3 class="text-sm font-bold text-center text-indigo-700">${card.english}</h3>`;

                backContent = card.sentence ?
                    `<h3 class="text-xs font-semibold text-center text-gray-800 mb-1">${card.german}</h3>
                     <p class="text-xs text-gray-600 text-center italic">${card.sentence}</p>` :
                    `<h3 class="text-xs font-semibold text-center text-gray-800">${card.german}</h3>`;
            } else {
                // Normal: German on front, English on back
                frontContent = card.sentence ?
                    `<h3 class="text-sm font-bold text-center text-indigo-700 mb-1">${card.german}</h3>
                     <p class="text-xs text-gray-600 text-center italic">${card.sentence}</p>` :
                    `<h3 class="text-sm font-bold text-center text-indigo-700">${card.german}</h3>`;

                backContent = card.sentenceTranslation ?
                    `<h3 class="text-xs font-semibold text-center text-gray-800 mb-1">${card.english}</h3>
                     <p class="text-xs text-gray-600 text-center italic">${card.sentenceTranslation}</p>` :
                    `<h3 class="text-xs font-semibold text-center text-gray-800">${card.english}</h3>`;
            }

            flashcard.innerHTML = `
                <div class="flashcard-inner min-h-36 ${card.mastered ? 'border-2 border-solid border-green-200 rounded-lg' : ''}">
                    <div class="flashcard-front bg-white rounded-lg shadow-md p-3 flex flex-col items-center justify-center cursor-pointer h-full">
                        ${frontContent}
                        <button class="speak-btn mt-3 p-1 bg-indigo-100 rounded-full hover:bg-indigo-200">
                            <i data-feather="volume-2" class="text-indigo-700 w-3 h-3"></i>
                        </button>
                        <p class="text-xs text-gray-500 mt-5">Click to flip</p>
                        ${card.mastered ? '<i data-feather="check-circle" class="text-green-500 mt-2 w-6 h-6"></i>' : ''}
                    </div>
                    <div class="flashcard-back bg-indigo-100 rounded-lg shadow-md p-2 flex flex-col items-center justify-center cursor-pointer h-full">
                        ${backContent}
                        <div class="mt-1 flex space-x-1">
                            <button class="master-btn px-2 py-0.5 ${card.mastered ? 'bg-green-500' : 'bg-gray-500'} text-white rounded text-xs">
                                ${card.mastered ? 'Mastered' : 'Mark as Mastered'}
                            </button>
                        </div>
                    </div>
                </div>`;
            container.appendChild(flashcard);
            this.setupFlashcardEventListeners(flashcard);
        });

        this.updatePaginationControls();
    }

    setupFlashcardEventListeners(flashcard) {
        if (!window.hasAttachedFlashcardListener) {
            document.addEventListener('keydown', (e) => {
                // Space to flip card only if not on singleCardMode
                if (e.code === 'Space' && this.singleCardMode && document.activeElement === document.body) {
                    const currentFlashcard = document.querySelector('.flashcard');
                    e.preventDefault();
                    currentFlashcard?.classList.toggle('flipped');
                }

                // Left/Right arrows for pagination in singleCardMode
                if (e.code === 'ArrowRight') {
                    document.getElementById('next-page-btn')?.click();
                } else if (e.code === 'ArrowLeft') {
                    document.getElementById('prev-page-btn')?.click();
                }
            });

            window.hasAttachedFlashcardListener = true;
        }

        flashcard.addEventListener('click', function (event) {
            if (!event.target.classList.contains('master-btn')) {
                this.classList.toggle('flipped');
            }
        });

        const masterBtn = flashcard.querySelector('.master-btn');
        if (masterBtn) {
            masterBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(flashcard.dataset.index);
                this.flashcards[idx].mastered = !this.flashcards[idx].mastered;
                this.saveFlashcards();
                this.updateProgress();
                this.renderFlashcards();
            });
        }

        // Update speak button to handle flipped state
        const speakBtn = flashcard.querySelector('.speak-btn');
        if (speakBtn) {
            speakBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(flashcard.dataset.index);
                const text = this.isFlipped ? this.flashcards[idx].english : this.flashcards[idx].german;
                this.speakWord(text);
            });
        }
    }

    shuffleArray(array) {
        const newArr = [...array];
        for (let i = newArr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
        }
        return newArr;
    }

    updatePaginationControls() {
        const totalPages = this.singleCardMode
            ? this.flashcards.length
            : Math.ceil(this.flashcards.length / this.cardsPerPage);

        document.getElementById('page-info').textContent = `Page ${this.currentPage} of ${totalPages}`;

        const controls = document.getElementById('pagination-controls');
        controls.classList.toggle('hidden', totalPages <= 1);

        document.getElementById('prev-page-btn').disabled = this.currentPage === 1;
        document.getElementById('next-page-btn').disabled = this.currentPage === totalPages;
    }

    // Update speakWord to handle language
    speakWord(text, rate = 0.8, lang = 'de-DE') {
        if (!text.trim()) return;
        if (this.useSlowSpeak) rate = 0.6;
        console.log('rate ---> ', rate);

        this.utterance = new SpeechSynthesisUtterance(text);
        this.utterance.lang = lang;
        this.utterance.rate = rate;

        speechSynthesis.speak(this.utterance);
    }

    getCurrentListName() {
        const cur = JSON.stringify(this.flashcards);
        for (const [listName, listCards] of Object.entries(this.customLists)) {
            if (JSON.stringify(listCards) === cur) return listName;
        }
        return null;
    }

    updateCurrentCustomList() {
        const listName = this.getCurrentListName();
        if (listName && this.customLists[listName]) {
            this.customLists[listName] = [...this.flashcards];
            localStorage.setItem('customGermanLists', JSON.stringify(this.customLists));
        }
    }

    renderCustomListButtons() {
        const container = document.getElementById('custom-lists-container');
        this.customLists = JSON.parse(localStorage.getItem('customGermanLists')) || {};
        container.innerHTML = '';

        Object.keys(this.customLists).forEach(listName => {
            const wrapper = document.createElement('div');
            wrapper.className = 'relative group';

            const btn = document.createElement('button');
            btn.className = 'px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center';
            btn.innerHTML = `<i data-feather="list" class="mr-2"></i> ${listName} (${this.customLists[listName].length})`;
            btn.addEventListener('click', () => {
                this.flashcards = [...this.customLists[listName]];
                this.saveFlashcards();
                this.originalListName = listName;
                console.log('---> ', this.originalListName);
                this.currentPage = 1;
                this.renderFlashcards();
            });

            const removeBtn = document.createElement('button');
            removeBtn.className = 'absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100';
            removeBtn.innerHTML = '×';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Delete the "${listName}" list?`)) {
                    delete this.customLists[listName];
                    localStorage.setItem('customGermanLists', JSON.stringify(this.customLists));
                    this.renderCustomListButtons();
                    const listNames = Object.keys(this.customLists);
                    if (listNames.length > 0) {
                        this.flashcards = [...this.customLists[listNames[0]]];
                        this.saveFlashcards();
                        this.renderFlashcards();
                    } else {
                        this.flashcards = [];
                        this.saveFlashcards();
                        this.renderFlashcards();
                    }
                }
            });

            wrapper.appendChild(btn);
            wrapper.appendChild(removeBtn);
            container.appendChild(wrapper);
        });

        feather.replace();
    }
    setupEventListeners() {
        // View toggle
        document.getElementById("toggle-view-btn").addEventListener("click", () => {
            this.singleCardMode = !this.singleCardMode;
            document.getElementById("toggle-view-btn").textContent = this.singleCardMode
                ? "Switch to Grid Mode"
                : "Switch to Focus Mode";
            this.currentPage = 1;
            this.renderFlashcards();
        });

        // Flip list toggle
        document.getElementById("flip-list-btn").addEventListener("click", () => {
            this.isFlipped = !this.isFlipped;
            document.getElementById("flip-list-btn").textContent = this.isFlipped
                ? "Switch to German → English"
                : "Switch to English → German";
            this.currentPage = 1;
            this.renderFlashcards();
        });

        document.getElementById('slow-speak').addEventListener('change', (e) => {
            this.useSlowSpeak = e.target.checked;
            console.log("On Off set to:", !this.useSlowSpeak ? "Normal" : "Slow");
        });

        // Control buttons
        document.getElementById('shuffle-btn').addEventListener('click', () => {
            this.flashcards = this.shuffleArray(this.flashcards);
            this.saveFlashcards();
            this.renderFlashcards();
        });

        document.getElementById('reset-btn').addEventListener('click', () => {
            if (confirm('Reset progress for this list?')) {
                const listName = this.getCurrentListName();
                if (listName && this.customLists[listName]) {
                    this.customLists[listName] = this.customLists[listName].map(c => ({ ...c, mastered: false }));
                    localStorage.setItem('customGermanLists', JSON.stringify(this.customLists));
                    this.flashcards = [...this.customLists[listName]];
                    this.saveFlashcards();
                    this.renderFlashcards();
                }
            }
        });

        document.getElementById('show-original-btn').addEventListener('click', () => {
            const names = Object.keys(this.customLists);
            console.log('original -> ', this.originalListName);
            if (names.length > 0) {
                this.flashcards = [...this.customLists[this.originalListName || names[0]]];
                this.currentPage = 1;
                this.renderFlashcards();
            } else {
                alert('No custom lists available.');
            }
        });

        document.getElementById('show-not-mastered-btn').addEventListener('click', () => {
            const listName = this.getCurrentListName();

            if (listName && this.customLists[listName]) {
                this.flashcards = [...this.customLists[listName]];
            }
            const notMastered = this.flashcards.filter(c => !c.mastered);
            if (notMastered.length === 0) {
                alert('All words mastered!');
                return;
            }
            this.flashcards = notMastered;
            this.currentPage = 1;
            this.renderFlashcards();
        });

        // Speak functionality - updated to handle flipped state
        document.addEventListener('click', e => {
            if (e.target.closest('.speak-btn') || e.target.closest('.speak-btn i')) {
                const card = e.target.closest('.flashcard');
                const idx = card.dataset.index;
                const text = this.isFlipped ? this.flashcards[idx].english : this.flashcards[idx].german;
                const lang = this.isFlipped ? 'en-US' : 'de-DE';
                this.speakWord(text, 0.8, lang);
            }
        });

        // Pagination
        document.getElementById('next-page-btn').addEventListener('click', () => {
            const totalPages = this.singleCardMode
                ? this.flashcards.length
                : Math.ceil(this.flashcards.length / this.cardsPerPage);

            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.renderFlashcards();
            }
        });

        document.getElementById('prev-page-btn').addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderFlashcards();
            }
        });

        // Add flashcards modal
        document.getElementById('add-flashcards-btn').addEventListener('click', () => {
            this.handleAddFlashcards();
        });

        this.setupAddFlashcardsModal();
    }

    setupAddFlashcardsModal() {
        const openBtn = document.getElementById('open-add-flashcards-modal');
        const modal = document.getElementById('add-flashcards-modal');
        const closeBtn = document.getElementById('close-add-flashcards-modal');

        openBtn.addEventListener('click', () => { modal.classList.remove('hidden'); });
        closeBtn.addEventListener('click', () => { modal.classList.add('hidden'); });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    }

    handleAddFlashcards() {
        const raw = document.getElementById('new-flashcards-input').value.trim();
        const listName = document.getElementById('list-name-input').value.trim();

        if (!raw || !listName) {
            alert('Please enter both list name and flashcards!');
            return;
        }

        const newCards = [];
        raw.split('\n').forEach(line => {
            line = line.trim();
            if (!line) return;

            // Parse the format: German word (german sentence) - English word (english translation)
            const match = line.match(/^(.+?)\s*\((.*?)\)\s*[-–:]+?\s*(.+?)\s*\((.*?)\)$/);

            if (match) {
                // Format with sentences: German word (sentence) - English word (translation)
                const [, german, sentence, english, sentenceTranslation] = match;
                newCards.push({
                    german: german.trim(),
                    sentence: sentence.trim(),
                    english: english.trim(),
                    sentenceTranslation: sentenceTranslation.trim(),
                    mastered: false
                });
            } else {
                // Fallback to original format for backward compatibility
                const parts = line.split(/\s*(–|--|:|-|::)\s*/).filter((p, i) => i === 0 || (i % 2 === 1 ? false : true)).map(p => p.trim());
                if (parts.length === 2 && parts[0] && parts[1]) {
                    newCards.push({
                        german: parts[0],
                        english: parts[1],
                        mastered: false
                    });
                }
            }
        });

        if (newCards.length > 0) {
            this.customLists[listName] = newCards;
            localStorage.setItem('customGermanLists', JSON.stringify(this.customLists));
            document.getElementById('new-flashcards-input').value = '';
            document.getElementById('list-name-input').value = '';
            this.flashcards = [...newCards];
            this.saveFlashcards();
            this.renderFlashcards();
            this.renderCustomListButtons();

            this.showNotification(`Added ${newCards.length} flashcards to "${listName}"`);
        }
    }

    showNotification(message) {
        const notif = document.createElement('div');
        notif.textContent = message;
        notif.className = "fixed top-6 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded shadow z-50";
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 3500);
    }
}