import { SpeechService } from '../utils/vocab-tool-utils/speech.js'

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
        this.spacedRepetitionMode = false;
        this.spacedRepetitionCards = []; // Cards for current SR session
        this.currentSRCardIndex = 0; // Current card in SR session
        this.srSessionData = JSON.parse(localStorage.getItem('srSessionData')) || {}; // SR progress
        this.voiceSelect = document.getElementById("voiceSelect");

        this.speechSynth = window.speechSynthesis;
        this.speech = new SpeechService(this);


        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderFlashcards();
        this.renderCustomListButtons(false);
        this.updatePaginationControls();
        this.updateSRButton();
        this.speech.loadVoices();
        feather.replace();
        AOS.init();
    }

    updateSRButton() {
        const srBtn = document.getElementById('spaced-repetition-btn');
        if (srBtn) {
            const stats = this.getSRStatistics();
            srBtn.textContent = `Spaced Repetition (${stats.due} due)`;
            srBtn.title = `${stats.due} cards due for review out of ${stats.total} total cards`;
        }
    }

    exitSpacedRepetitionMode() {
        this.spacedRepetitionMode = false;
        this.currentSRCardIndex = 0;
        this.spacedRepetitionCards = [];
        this.rescheduledCards = [];
        this.currentPage = 1;
        this.renderFlashcards();
    }

    // Add this method to setup spaced repetition
    setupSpacedRepetition() {
        if (this.flashcards.length === 0) {
            this.showNotification('No flashcards available for spaced repetition!');
            return;
        }

        // Get cards that are due for review
        const now = Date.now();
        const dueCards = this.flashcards.filter(card => {
            const cardKey = `${card.german}|${card.english}`;
            const cardData = this.srSessionData[cardKey];

            if (!cardData) {
                // New card - include it
                return true;
            }

            // Card is due if nextReview time has passed
            return cardData.nextReview <= now;
        });

        if (dueCards.length === 0) {
            this.showNotification('No cards due for review right now! Great job!');
            return;
        }

        // Limit to 500 cards per session
        this.spacedRepetitionCards = dueCards.slice(0, 500);
        this.spacedRepetitionMode = true;
        this.currentSRCardIndex = 0;

        // Initialize rescheduled cards array
        this.rescheduledCards = [];

        // Reset currentPage when entering SR mode
        this.currentPage = 1;

        // Switch to single card mode for better SR experience
        this.singleCardMode = true;
        this.renderFlashcards();

        this.showNotification(`Starting spaced repetition with ${this.spacedRepetitionCards.length} cards! Use A/H/G/E for ratings, M for mastered, Space to flip, Arrows to navigate.`);
    }

    // Add SR controls to flashcard back
    renderSpacedRepetitionControls(flashcard, card) {
        console.log('renderSpacedRepetitionControls called for card:', card.german);

        const srControls = document.createElement('div');
        srControls.className = 'mt-4 flex flex-wrap gap-2 justify-center';
        srControls.innerHTML = `
        <button class="sr-again-btn px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600" title="Shortcut: A">
            Again (1 min) [A]
        </button>
        <button class="sr-hard-btn px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600" title="Shortcut: H">
            Hard (10 min) [H]
        </button>
        <button class="sr-good-btn px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600" title="Shortcut: G">
            Good (1 day) [G]
        </button>
        <button class="sr-easy-btn px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600" title="Shortcut: E">
            Easy (4 days) [E]
        </button>
    `;

        // Add event listeners for SR buttons
        const againBtn = srControls.querySelector('.sr-again-btn');
        if (againBtn) {
            console.log('Adding event listener to Again button');
            againBtn.addEventListener('click', (e) => {
                console.log('SR Again button clicked - EVENT FIRED');
                e.stopPropagation();
                this.handleSRRating(card, 1); // 1 minute
            });
        } else {
            console.error('Again button not found!');
        }

        const hardBtn = srControls.querySelector('.sr-hard-btn');
        if (hardBtn) {
            hardBtn.addEventListener('click', (e) => {
                console.log('SR Hard button clicked');
                e.stopPropagation();
                this.handleSRRating(card, 10); // 10 minutes
            });
        }

        const goodBtn = srControls.querySelector('.sr-good-btn');
        if (goodBtn) {
            goodBtn.addEventListener('click', (e) => {
                console.log('SR Good button clicked');
                e.stopPropagation();
                this.handleSRRating(card, 1440); // 1 day in minutes
            });
        }

        const easyBtn = srControls.querySelector('.sr-easy-btn');
        if (easyBtn) {
            easyBtn.addEventListener('click', (e) => {
                console.log('SR Easy button clicked');
                e.stopPropagation();
                this.handleSRRating(card, 5760); // 4 days in minutes
            });
        }

        return srControls;
    }

    handleSRRating(card, minutesUntilNext) {
        console.log('SR Rating called:', {
            currentSRCardIndex: this.currentSRCardIndex,
            totalSRCards: this.spacedRepetitionCards.length,
            minutesUntilNext
        });

        const cardKey = `${card.german}|${card.english}`;
        const now = Date.now();

        // Update or create SR data for this card
        if (!this.srSessionData[cardKey]) {
            this.srSessionData[cardKey] = {
                easeFactor: 2.5,
                interval: 0,
                repetitions: 0
            };
        }

        const cardData = this.srSessionData[cardKey];

        if (minutesUntilNext === 1) { // Again
            cardData.repetitions = 0;
            cardData.interval = 1;
            console.log('Rescheduling card for current session (Again):', card.german);
            this.rescheduleCardForCurrentSession(card, 3);

        } else if (minutesUntilNext === 10) { // Hard
            cardData.repetitions += 1;
            cardData.interval = Math.max(1, cardData.interval * 1.2);
            console.log('Rescheduling card for current session (Hard):', card.german);
            this.rescheduleCardForCurrentSession(card, 8);

        } else { // Good or Easy
            cardData.repetitions += 1;

            if (cardData.repetitions === 1) {
                cardData.interval = 1;
            } else if (cardData.repetitions === 2) {
                cardData.interval = 6;
            } else {
                cardData.interval = Math.round(cardData.interval * cardData.easeFactor);
            }

            if (minutesUntilNext === 1440) { // Good
                cardData.easeFactor = Math.max(1.3, cardData.easeFactor - 0.15);
            } else { // Easy
                cardData.easeFactor = Math.min(2.5, cardData.easeFactor + 0.1);
            }
        }

        cardData.nextReview = now + (minutesUntilNext * 60 * 1000);
        cardData.lastReviewed = now;

        localStorage.setItem('srSessionData', JSON.stringify(this.srSessionData));

        // Move to next card FIRST
        this.currentSRCardIndex++;
        console.log('Moved to next card:', {
            newSRCardIndex: this.currentSRCardIndex,
            totalSRCards: this.spacedRepetitionCards.length
        });

        // THEN process rescheduled cards - this is crucial!
        this.processRescheduledCardsIfNeeded();

        // Check if session is completed AFTER processing rescheduled cards
        if (this.currentSRCardIndex >= this.spacedRepetitionCards.length) {
            if (this.hasRescheduledCards()) {
                console.log('Main session completed, processing rescheduled cards');
                this.processRescheduledCards();
            } else {
                console.log('SR session completed');
                this.spacedRepetitionMode = false;
                this.currentSRCardIndex = 0;
                this.spacedRepetitionCards = [];
                this.clearRescheduledCards();
                this.showNotification('Spaced repetition session completed! Great job!');
            }
        }

        console.log('Calling renderFlashcards');
        this.renderFlashcards();
    }

    rescheduleCardForCurrentSession(card, insertAfterCards = 3) {
        if (!this.rescheduledCards) {
            this.rescheduledCards = [];
        }

        // Add the card to rescheduled queue with position info
        this.rescheduledCards.push({
            card: card,
            rescheduledAt: Date.now(),
            insertAfter: this.currentSRCardIndex + insertAfterCards
        });

        console.log('Card rescheduled for current session:', card.german, 'will insert after card', this.currentSRCardIndex + insertAfterCards);
    }

    // New method to check if we need to insert rescheduled cards
    processRescheduledCardsIfNeeded() {
        console.log('processRescheduledCardsIfNeeded called - current index:', this.currentSRCardIndex);

        if (!this.hasRescheduledCards()) {
            console.log('No rescheduled cards to process');
            return;
        }

        console.log('Rescheduled cards available:', this.rescheduledCards.length);
        const cardsToInsert = [];

        // Find cards that should be inserted at or before current position
        for (let i = this.rescheduledCards.length - 1; i >= 0; i--) {
            const rescheduled = this.rescheduledCards[i];
            console.log('Checking rescheduled card:', rescheduled.card.german, 'insertAfter:', rescheduled.insertAfter, 'current index:', this.currentSRCardIndex);

            if (rescheduled.insertAfter <= this.currentSRCardIndex) {
                console.log('Inserting rescheduled card now:', rescheduled.card.german);
                cardsToInsert.push(rescheduled);
                this.rescheduledCards.splice(i, 1);
            }
        }

        // Insert the cards at current position
        if (cardsToInsert.length > 0) {
            console.log('Inserting', cardsToInsert.length, 'rescheduled cards');
            cardsToInsert.reverse().forEach(rescheduled => {
                const insertPosition = this.currentSRCardIndex;
                this.spacedRepetitionCards.splice(insertPosition, 0, rescheduled.card);
                console.log('Inserted card at position:', insertPosition, 'New total cards:', this.spacedRepetitionCards.length);
            });

            // Since we inserted cards, we need to adjust the current index
            this.currentSRCardIndex += cardsToInsert.length - 1;
            console.log('Adjusted current index to:', this.currentSRCardIndex);
        } else {
            console.log('No cards to insert at this position');
        }
    }

    hasRescheduledCards() {
        return this.rescheduledCards && this.rescheduledCards.length > 0;
    }

    clearRescheduledCards() {
        this.rescheduledCards = [];
    }

    processRescheduledCards() {
        if (!this.hasRescheduledCards()) return;

        console.log('Processing all remaining rescheduled cards:', this.rescheduledCards.length);

        // Add all rescheduled cards back to the end of the session
        this.rescheduledCards.forEach(rescheduled => {
            // Only add if not already in the current session
            const alreadyInSession = this.spacedRepetitionCards.some(
                c => c.german === rescheduled.card.german && c.english === rescheduled.card.english
            );

            if (!alreadyInSession) {
                this.spacedRepetitionCards.push(rescheduled.card);
                console.log('Added rescheduled card to end of session:', rescheduled.card.german);
            }
        });

        console.log('Processed rescheduled cards. New total:', this.spacedRepetitionCards.length);
        this.clearRescheduledCards();

        // Reset to continue from current position
        this.currentSRCardIndex = this.currentSRCardIndex; // Stay at current position

        this.showNotification(`Added ${this.rescheduledCards.length} rescheduled cards back to session`);
    }

    // Update setupEventListeners to include SR button
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

        // === FIXED: Single Spaced Repetition button listener (toggle mode) ===
        document.getElementById("spaced-repetition-btn").addEventListener("click", () => {
            if (this.spacedRepetitionMode) {
                // If already in SR mode, exit it
                this.exitSpacedRepetitionMode();
                this.showNotification('Exited spaced repetition mode');
            } else {
                // Start SR mode
                this.setupSpacedRepetition();
            }
        });

        document.getElementById('slow-speak').addEventListener('change', (e) => {
            this.useSlowSpeak = e.target.checked;
            console.log("On Off set to:", !this.useSlowSpeak ? "Normal" : "Slow");
        });

        this.setupEditModal();

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
                this.showNotification('No custom lists available.');
            }
        });

        document.getElementById('show-not-mastered-btn').addEventListener('click', () => {
            const listName = this.getCurrentListName();

            if (listName && this.customLists[listName]) {
                this.flashcards = [...this.customLists[listName]];
            }
            const notMastered = this.flashcards.filter(c => !c.mastered);
            if (notMastered.length === 0) {
                this.showNotification('All words mastered!');
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

        // Pagination - work differently in SR mode vs normal mode
        // Pagination - work differently in SR mode vs normal mode
        document.getElementById('next-page-btn').addEventListener('click', () => {
            if (this.spacedRepetitionMode) {
                if (this.currentSRCardIndex < this.spacedRepetitionCards.length - 1) {
                    this.currentSRCardIndex++;
                    // Process rescheduled cards when manually navigating
                    this.processRescheduledCardsIfNeeded();
                    this.renderFlashcards();
                }
            } else {
                const totalPages = this.singleCardMode
                    ? this.flashcards.length
                    : Math.ceil(this.flashcards.length / this.cardsPerPage);

                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.renderFlashcards();
                }
            }
        });

        document.getElementById('prev-page-btn').addEventListener('click', () => {
            if (this.spacedRepetitionMode) {
                // In SR mode, go back for testing
                if (this.currentSRCardIndex > 0) {
                    this.currentSRCardIndex--;
                    this.renderFlashcards();
                }
            } else {
                // Normal mode pagination
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.renderFlashcards();
                }
            }
        });

        // Add flashcards modal
        document.getElementById('add-flashcards-btn').addEventListener('click', () => {
            this.handleAddFlashcards();
        });

        // Enhanced drag and drop for the container
        const container = document.getElementById('custom-lists-container');
        if (container) {
            container.addEventListener('dragover', (e) => {
                e.preventDefault();
                container.classList.add('drag-over-zone');
            });

            container.addEventListener('dragleave', (e) => {
                if (!container.contains(e.relatedTarget)) {
                    container.classList.remove('drag-over-zone');
                }
            });

            container.addEventListener('drop', (e) => {
                e.preventDefault();
                container.classList.remove('drag-over-zone');
            });
        }

        // Playing audio event listener with v keyword for speak-btn
        document.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'v' && document.activeElement === document.body) {
                const activeCard = document.querySelector('.flashcard');
                if (activeCard) {
                    const idx = activeCard.dataset.index;
                    const sentence = this.flashcards[idx]?.sentence ? `, ${this.flashcards[idx].sentence}` : '';
                    const text = this.flashcards[idx].german + ',' + sentence;
                    // adding word and sentence together
                    const lang = 'de-DE';
                    this.speakWord(text, 0.8, lang);
                }
            }
        });

        this.setupAddFlashcardsModal();
    }

    // Add method to get SR statistics
    getSRStatistics() {
        const now = Date.now();
        let dueCount = 0;
        let totalCards = 0;

        this.flashcards.forEach(card => {
            const cardKey = `${card.german}|${card.english}`;
            totalCards++;

            const cardData = this.srSessionData[cardKey];
            if (!cardData || cardData.nextReview <= now) {
                dueCount++;
            }
        });

        return {
            due: dueCount,
            total: totalCards,
            percentage: totalCards > 0 ? Math.round(((totalCards - dueCount) / totalCards) * 100) : 0
        };
    }

    sanitizeInput(input) {
        const substitutions = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;'
        };

        const substituted = input.replace(/[&<>"'/]/g, (match) => substitutions[match]);
        return substituted;
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

    setupEditModal() {
        const modal = document.getElementById('edit-flashcard-modal');
        const closeBtn = document.getElementById('close-edit-modal');
        const saveBtn = document.getElementById('save-edit-btn');

        // Add null checks for all elements
        if (!modal || !closeBtn || !saveBtn) {
            console.warn('Edit modal elements not found. Modal might not be available on this page.');
            return;
        }

        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });

        saveBtn.addEventListener('click', () => {
            this.handleEditFlashcard();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });

        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                modal.classList.add('hidden');
            }
        });
    }

    openEditModal(cardIndex) {
        const modal = document.getElementById('edit-flashcard-modal');
        if (!modal) {
            console.error('Edit modal not found');
            return;
        }

        const card = this.flashcards[cardIndex];
        if (!card) return;

        // Safely set values with null checks
        const germanWordInput = document.getElementById('edit-german-word');
        const germanSentenceInput = document.getElementById('edit-german-sentence');
        const englishWordInput = document.getElementById('edit-english-word');
        const englishTranslationInput = document.getElementById('edit-english-translation');
        const cardIndexInput = document.getElementById('edit-card-index');

        if (germanWordInput) germanWordInput.value = card.german;
        if (germanSentenceInput) germanSentenceInput.value = card.sentence || '';
        if (englishWordInput) englishWordInput.value = card.english;
        if (englishTranslationInput) englishTranslationInput.value = card.sentenceTranslation || '';
        if (cardIndexInput) cardIndexInput.value = cardIndex;

        modal.classList.remove('hidden');
    }

    handleEditFlashcard() {
        const cardIndexInput = document.getElementById('edit-card-index');
        const germanWordInput = document.getElementById('edit-german-word');
        const englishWordInput = document.getElementById('edit-english-word');

        if (!cardIndexInput || !germanWordInput || !englishWordInput) {
            console.error('Required edit form elements not found');
            return;
        }

        const cardIndex = parseInt(cardIndexInput.value);
        const germanWord = this.sanitizeInput(germanWordInput.value.trim());
        const germanSentence = this.sanitizeInput(document.getElementById('edit-german-sentence')?.value.trim()) || '';
        const englishWord = this.sanitizeInput(englishWordInput.value.trim());
        const englishTranslation = this.sanitizeInput(document.getElementById('edit-english-translation')?.value.trim()) || '';

        if (!germanWord || !englishWord) {
            this.showNotification('Failed to update flashcard. Missing required fields.');
            return;
        }

        // Validate card index
        if (cardIndex < 0 || cardIndex >= this.flashcards.length) {
            this.showNotification('Failed to update flashcard. Invalid index.');
            return;
        }

        this.flashcards[cardIndex] = {
            german: germanWord,
            english: englishWord,
            sentence: germanSentence || undefined,
            sentenceTranslation: englishTranslation || undefined,
            mastered: this.flashcards[cardIndex].mastered // Preserve mastered status
        };

        this.saveFlashcards();
        this.renderFlashcards();

        const modal = document.getElementById('edit-flashcard-modal');
        if (modal) modal.classList.add('hidden');

        this.showNotification('Flashcard updated successfully!');
    }

    handleRemoveFlashcard(cardIndex) {
        if (confirm('Are you sure you want to remove this flashcard?')) {
            this.flashcards.splice(cardIndex, 1);
            this.saveFlashcards();
            this.renderFlashcards();
            this.showNotification('Flashcard removed successfully!');
        }
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
        console.log('renderSingleCardMode called:', {
            spacedRepetitionMode: this.spacedRepetitionMode,
            currentSRCardIndex: this.currentSRCardIndex,
            currentPage: this.currentPage,
            totalFlashcards: this.flashcards.length,
            totalSRCards: this.spacedRepetitionCards.length
        });

        container.className = "flex items-center justify-center mx-auto max-w-3xl";

        let card;
        let cardInfo = '';
        let actualIndex;
        let currentHeading = '';

        if (this.spacedRepetitionMode) {
            // In SR mode, use SR cards and index
            card = this.spacedRepetitionCards[this.currentSRCardIndex];
            if (!card) {
                // If no card found, exit SR mode and re-render
                this.spacedRepetitionMode = false;
                this.currentSRCardIndex = 0;
                this.spacedRepetitionCards = [];
                this.renderFlashcards();
                return;
            }
            actualIndex = this.currentSRCardIndex;
            // Add progress indicator for SR mode
            cardInfo = `<div class="absolute top-4 left-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
            ${this.currentSRCardIndex + 1} / ${this.spacedRepetitionCards.length}
        </div>`;
        } else {
            // In normal single card mode, use flashcards and currentPage
            card = this.flashcards[this.currentPage - 1];
            if (!card) {
                // If no card at current page, reset to page 1
                this.currentPage = 1;
                card = this.flashcards[0];
                if (!card) return; // No cards at all
            }
            actualIndex = this.currentPage - 1;

            // Add progress indicator for normal single card mode
            cardInfo = `<div class="absolute top-4 left-4 bg-gray-500 text-white px-3 py-1 rounded-full text-sm">
            ${this.currentPage} / ${this.flashcards.length}
        </div>`;
        }

        // Get current card's heading
        currentHeading = card.heading || '';

        const flashcard = document.createElement('div');
        flashcard.className = `flashcard w-full h-96 flex items-center justify-center relative`;
        flashcard.dataset.index = actualIndex;

        flashcard.addEventListener('click', (e) => {
            console.log('Flashcard clicked:', {
                target: e.target,
                classList: e.target.classList,
                currentSRCardIndex: this.currentSRCardIndex
            });
        });

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

        // Create back content div
        const backContentDiv = document.createElement('div');
        backContentDiv.className = 'flex flex-col items-center justify-center';
        backContentDiv.innerHTML = backContent;

        console.log('Calling renderSpacedRepetitionControls with card:', {
            german: card.german,
            english: card.english,
            index: actualIndex
        });

        // Add SR controls if in SR mode
        if (this.spacedRepetitionMode) {
            const srControls = this.renderSpacedRepetitionControls(flashcard, card);
            backContentDiv.appendChild(srControls);
        } else {
            // Regular controls for non-SR mode
            const regularControls = document.createElement('div');
            regularControls.className = 'mt-4 flex space-x-2';
            regularControls.innerHTML = `
            <button class="master-btn px-4 py-2 ${card.mastered ? 'bg-green-500' : 'bg-gray-500'} text-white rounded text-sm" title="Shortcut: M">
                ${card.mastered ? 'Not Mastered' : 'Mastered'} [M]
            </button>
            <button class="edit-btn px-4 py-2 bg-blue-500 text-white rounded text-sm">
                Edit
            </button>
            <button class="remove-btn px-4 py-2 bg-red-500 text-white rounded text-sm">
                Remove
            </button>
        `;
            backContentDiv.appendChild(regularControls);
        }

        // Create heading display (only show if heading exists)
        const headingDisplay = currentHeading ?
            `<div class="absolute top-4 right-4 z-30 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-full shadow-lg border border-white border-opacity-30">
                <div class="flex items-center space-x-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-folder">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span class="text-sm font-medium">${currentHeading}</span>
                </div>
            </div>` : '';

        flashcard.innerHTML = `
        <div class="flashcard-inner h-full w-full relative ${card.mastered ? 'border-2 border-solid border-green-200 rounded-2xl' : ''}">
            ${cardInfo}
            ${headingDisplay}
            <div class="flashcard-front absolute inset-0 bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center justify-center cursor-pointer transform-style-preserve-3d backface-hidden">
                ${frontContent}
                <button class="speak-btn mt-4 p-3 bg-indigo-100 rounded-full hover:bg-indigo-200">
                    <i data-feather="volume-2" class="text-indigo-700 w-6 h-6"></i>
                </button>
                <p class="text-xs text-gray-500 mt-8">Click to flip</p>
                ${card.mastered ? '<i data-feather="check-circle" class="text-green-500 mt-2 w-12 h-12 mt-4"></i>' : ''}
            </div>
            <div class="flashcard-back absolute inset-0 bg-indigo-100 rounded-2xl shadow-xl p-8 flex flex-col items-center justify-center cursor-pointer transform-style-preserve-3d backface-hidden transform-rotate-y-180">
                ${backContentDiv.innerHTML}
            </div>
        </div>`;

        container.appendChild(flashcard);

        // Call feather.replace() for other icons
        setTimeout(() => {
            feather.replace();
        }, 0);

        this.setupFlashcardEventListeners(flashcard);
        this.updatePaginationControls();
    }

    renderGridMode(container) {
        container.className = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 gap-4 mx-auto max-w-5xl";
        const startIndex = (this.currentPage - 1) * this.cardsPerPage;
        const endIndex = Math.min(startIndex + this.cardsPerPage, this.flashcards.length);

        let lastHeading = '';

        this.flashcards.slice(startIndex, endIndex).forEach((card, idx) => {
            const actualIndex = startIndex + idx;

            // Add heading if it exists and is different from previous
            if (card.heading && card.heading !== lastHeading) {
                const headingElement = document.createElement('div');
                headingElement.className = 'col-span-full bg-gray-200 p-3 rounded-lg border-l-4 border-blue-500 mb-2';
                headingElement.innerHTML = `
                <h3 class="text-lg font-semibold text-gray-800 flex items-center">
                    <i data-feather="folder" class="mr-2 w-4 h-4"></i>
                    ${card.heading}
                </h3>
            `;
                container.appendChild(headingElement);
                lastHeading = card.heading;
            }

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
            <div class="flashcard-inner min-h-64 ${card.mastered ? 'border-2 border-solid border-green-200 rounded-lg' : ''}">
                <div class="flashcard-front bg-white rounded-lg shadow-md p-3 flex flex-col gap-5 items-center justify-center cursor-pointer h-full">
                    ${frontContent}
                    <button class="speak-btn mt-3 p-3 bg-indigo-100 rounded-full hover:bg-indigo-200">
                        <i data-feather="volume-2" class="text-indigo-700 w-5 h-5"></i>
                    </button>
                    <p class="text-xs text-gray-500 mt-5">Click to flip</p>
                    ${card.mastered ? '<i data-feather="check-circle" class="text-green-500 mt-2 w-6 h-6"></i>' : ''}
                </div>
                <div class="flashcard-back bg-indigo-100 rounded-lg shadow-md p-2 flex flex-col gap-6 items-center justify-center cursor-pointer h-full">
                    ${backContent}
                    <div class="mt-1 flex space-x-1">
                        <button class="master-btn px-2 py-0.5 ${card.mastered ? 'bg-green-500' : 'bg-gray-500'} text-white rounded text-xs">
                            ${card.mastered ? 'Not Mastered' : 'Mastered'}
                        </button>
                        <button class="edit-btn px-2 py-0.5 bg-blue-500 text-white rounded text-xs">
                            Edit
                        </button>
                        <button class="remove-btn px-2 py-0.5 bg-red-500 text-white rounded text-xs">
                            Remove
                        </button>
                    </div>
                </div>
            </div>`;
            container.appendChild(flashcard);
            this.setupFlashcardEventListeners(flashcard);
        });

        this.updatePaginationControls();
        feather.replace();
    }

    setupFlashcardEventListeners(flashcard) {
        // In the setupFlashcardEventListeners method, replace the document keydown event listener with:
        if (!window.hasAttachedFlashcardListener) {
            document.addEventListener('keydown', (e) => {
                // Get the flashcards container to check visibility
                const flashcardsContainer = document.getElementById('flashcards-container');
                const isContainerVisible = flashcardsContainer && !flashcardsContainer.classList.contains('hidden');

                // Only process keys if body is focused AND container is visible
                if (document.activeElement !== document.body || !isContainerVisible) {
                    return;
                }

                // Prevent default only for our specific keys
                const srKeys = ['a', 'h', 'g', 'e', 'm'];
                if (srKeys.includes(e.key.toLowerCase()) && this.singleCardMode) {
                    e.preventDefault();
                }

                // Space to flip card
                if (e.code === 'Space' && this.singleCardMode) {
                    const currentFlashcard = document.querySelector('.flashcard');
                    e.preventDefault();
                    currentFlashcard?.classList.toggle('flipped');
                }

                // Spaced Repetition keyboard shortcuts
                if (this.spacedRepetitionMode && this.singleCardMode) {
                    const currentCard = this.spacedRepetitionCards[this.currentSRCardIndex];
                    if (currentCard) {
                        switch (e.key.toLowerCase()) {
                            case 'a': // Again
                                console.log('Keyboard shortcut: Again');
                                this.handleSRRating(currentCard, 1);
                                break;
                            case 'h': // Hard
                                console.log('Keyboard shortcut: Hard');
                                this.handleSRRating(currentCard, 10);
                                break;
                            case 'g': // Good
                                console.log('Keyboard shortcut: Good');
                                this.handleSRRating(currentCard, 1440);
                                break;
                            case 'e': // Easy
                                console.log('Keyboard shortcut: Easy');
                                this.handleSRRating(currentCard, 5760);
                                break;
                        }
                    }
                }

                // Mastered shortcut (works in both normal and SR mode)
                if (e.key.toLowerCase() === 'm' && this.singleCardMode) {
                    console.log('Keyboard shortcut: Mastered');
                    const currentFlashcard = document.querySelector('.flashcard');
                    if (currentFlashcard) {
                        const idx = parseInt(currentFlashcard.dataset.index);
                        let currentCard;

                        if (this.spacedRepetitionMode) {
                            currentCard = this.spacedRepetitionCards[idx];
                        } else {
                            currentCard = this.flashcards[idx];
                        }

                        if (currentCard) {
                            currentCard.mastered = !currentCard.mastered;
                            this.saveFlashcards();
                            this.updateProgress();
                            this.renderFlashcards();

                            const action = currentCard.mastered ? 'marked as mastered' : 'unmarked as mastered';
                            this.showNotification(`Card ${action}!`);
                        }
                    }
                }

                // Left/Right arrows for navigation - only when container is visible
                if (e.code === 'ArrowRight') {
                    e.preventDefault();
                    if (this.spacedRepetitionMode) {
                        if (this.currentSRCardIndex < this.spacedRepetitionCards.length - 1) {
                            this.currentSRCardIndex++;
                            this.processRescheduledCardsIfNeeded();
                            this.renderFlashcards();
                        }
                    } else {
                        document.getElementById('next-page-btn')?.click();
                    }
                } else if (e.code === 'ArrowLeft') {
                    e.preventDefault();
                    if (this.spacedRepetitionMode) {
                        if (this.currentSRCardIndex > 0) {
                            this.currentSRCardIndex--;
                            this.renderFlashcards();
                        }
                    } else {
                        document.getElementById('prev-page-btn')?.click();
                    }
                }
            });

            window.hasAttachedFlashcardListener = true;
        }

        flashcard.addEventListener('click', function (event) {
            if (!event.target.classList.contains('master-btn') &&
                !event.target.classList.contains('edit-btn') &&
                !event.target.classList.contains('remove-btn')) {
                this.classList.toggle('flipped');
            }
        });

        const masterBtn = flashcard.querySelector('.master-btn');
        if (masterBtn) {
            masterBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(flashcard.dataset.index);
                this.flashcards[idx].mastered = !this.flashcards[idx].mastered;
                console.log('Toggled mastered status');

                // Update the current custom list with the modified flashcards
                this.updateCurrentCustomList();

                // Save to localStorage
                this.saveFlashcards();

                // Update progress
                this.updateProgress();

                // Only update buttons without reloading from localStorage
                this.renderCustomListButtons(true);

                // Re-render flashcards
                this.renderFlashcards();
            });
        }

        // Update speak button to handle flipped state
        const speakBtn = flashcard.querySelector('.speak-btn');
        if (speakBtn) {
            speakBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(flashcard.dataset.index);
                const text = this.flashcards[idx].german + ',' + this.flashcards[idx].sentence;
                // adding word and sentence together
                const lang = 'de-DE';
                this.speakWord(text, 0.8, lang);
            });
        }

        // Add edit and remove buttons functionality
        const editBtn = flashcard.querySelector('.edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(flashcard.dataset.index);
                this.openEditModal(idx);
            });
        }

        const removeBtn = flashcard.querySelector('.remove-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(flashcard.dataset.index);
                this.handleRemoveFlashcard(idx);
            });
        }
        setTimeout(() => {
            const againBtn = flashcard.querySelector('.sr-again-btn');
            const hardBtn = flashcard.querySelector('.sr-hard-btn');
            const goodBtn = flashcard.querySelector('.sr-good-btn');
            const easyBtn = flashcard.querySelector('.sr-easy-btn');

            if (againBtn) {
                console.log('Setting up SR Again button in setupFlashcardEventListeners');
                againBtn.addEventListener('click', (e) => {
                    console.log('SR Again button clicked from setupFlashcardEventListeners');
                    e.stopPropagation();
                    e.preventDefault();
                    const idx = parseInt(flashcard.dataset.index);
                    const currentCard = this.spacedRepetitionMode ?
                        this.spacedRepetitionCards[idx] :
                        this.flashcards[idx];
                    this.handleSRRating(currentCard, 1);
                });
            }

            // Add similar handlers for other buttons...
            if (hardBtn) {
                hardBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const idx = parseInt(flashcard.dataset.index);
                    const currentCard = this.spacedRepetitionMode ?
                        this.spacedRepetitionCards[idx] :
                        this.flashcards[idx];
                    this.handleSRRating(currentCard, 10);
                });
            }

            if (goodBtn) {
                goodBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const idx = parseInt(flashcard.dataset.index);
                    const currentCard = this.spacedRepetitionMode ?
                        this.spacedRepetitionCards[idx] :
                        this.flashcards[idx];
                    this.handleSRRating(currentCard, 1440);
                });
            }

            if (easyBtn) {
                easyBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const idx = parseInt(flashcard.dataset.index);
                    const currentCard = this.spacedRepetitionMode ?
                        this.spacedRepetitionCards[idx] :
                        this.flashcards[idx];
                    this.handleSRRating(currentCard, 5760);
                });
            }
        }, 100);
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
        if (this.spacedRepetitionMode) {
            // In SR mode, show SR-specific controls
            const totalPages = this.spacedRepetitionCards.length;
            document.getElementById('page-info').textContent = `Card ${this.currentSRCardIndex + 1} of ${totalPages} (SR Mode)`;

            const controls = document.getElementById('pagination-controls');
            controls.classList.toggle('hidden', totalPages <= 1);

            // Disable pagination buttons in SR mode but keep them visible for visual consistency
            document.getElementById('prev-page-btn').disabled = this.currentSRCardIndex === 0;
            document.getElementById('next-page-btn').disabled = this.currentSRCardIndex >= totalPages - 1;
        } else {
            // Normal mode
            const totalPages = this.singleCardMode
                ? this.flashcards.length
                : Math.ceil(this.flashcards.length / this.cardsPerPage);

            document.getElementById('page-info').textContent = `Page ${this.currentPage} of ${totalPages}`;

            const controls = document.getElementById('pagination-controls');
            controls.classList.toggle('hidden', totalPages <= 1);

            document.getElementById('prev-page-btn').disabled = this.currentPage === 1;
            document.getElementById('next-page-btn').disabled = this.currentPage === totalPages;
        }
    }

    // Update speakWord to handle language
    // speakWord(text, rate = 0.8, lang = 'de-DE') {
    //     if (!text.trim()) return;
    //     if (this.useSlowSpeak) rate = 0.6;
    //     console.log('rate ---> ', rate);

    //     this.utterance = new SpeechSynthesisUtterance(text);
    //     this.utterance.lang = lang;
    //     this.utterance.rate = rate;

    //     speechSynthesis.speak(this.utterance);
    // }

    speakWord(text, rate = 0.8, lang = 'de-DE') { return this.speech.speakText(text, this.voiceSelect.value, rate); }

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

    renderCustomListButtons(buttonsOnly = false) {
        const container = document.getElementById('custom-lists-container');

        if (!buttonsOnly) {
            // Full render: reload from localStorage and update everything
            this.customLists = JSON.parse(localStorage.getItem('customGermanLists')) || {};
        }
        // If buttonsOnly is true, use the existing this.customLists without reloading

        container.innerHTML = '';

        Object.keys(this.customLists).forEach(listName => {
            const wrapper = document.createElement('div');
            wrapper.className = 'relative group';
            wrapper.draggable = true;
            wrapper.dataset.listName = listName;

            // Calculate mastery statistics for this list
            const listCards = this.customLists[listName];
            const masteredCount = listCards.filter(card => card.mastered).length;
            const totalCount = listCards.length;
            const masteryPercentage = totalCount > 0 ? Math.round((masteredCount / totalCount) * 100) : 0;

            // Determine list color and icon based on mastery
            let listColor, listIcon, listTitle;

            if (masteryPercentage === 100 && totalCount > 0) {
                // Fully mastered - Green with target icon
                listColor = 'bg-green-600 hover:bg-green-700';
                listIcon = 'target';
                listTitle = 'Fully mastered! 🎯';
            } else if (masteryPercentage >= 50) {
                // Partially mastered - Yellow with percentage
                listColor = 'bg-yellow-600 hover:bg-yellow-700';
                listIcon = 'bar-chart-2';
                listTitle = `${masteryPercentage}% mastered`;
            } else if (masteryPercentage > 10 && masteryPercentage < 50) {
                // Partially mastered - Blue with percentage
                listColor = 'bg-blue-600 hover:bg-blue-700';
                listIcon = 'bar-chart-2';
                listTitle = `${masteryPercentage}% mastered`;
            } else {
                // No mastery - Blue with list icon
                listColor = 'bg-purple-600 hover:bg-purple-700';
                listIcon = 'list';
                listTitle = 'No cards mastered yet';
            }

            // Add drag handle
            const dragHandle = document.createElement('div');
            dragHandle.className = 'absolute -left-6 top-1/2 transform -translate-y-1/2 cursor-grab text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity';

            // List button with dynamic color and icon
            const btn = document.createElement('button');
            btn.className = `px-4 py-2 ${listColor} text-white rounded-lg flex items-center transition-colors duration-200`;
            btn.title = listTitle;

            // Create icon and text content
            btn.innerHTML = `
            <i data-feather="${listIcon}" class="mr-2 w-4 h-4"></i>
            ${listName} (${totalCount})
            ${masteryPercentage > 0 && masteryPercentage < 100 ? `<span class="ml-2 text-xs bg-yellow-500 px-2 py-1 rounded-full">${masteryPercentage}%</span>` : ''}
        `;

            btn.addEventListener('click', () => {
                this.flashcards = [...this.customLists[listName]];
                this.saveFlashcards();
                this.originalListName = listName;
                this.currentPage = 1;
                this.updateSRButton();
                this.renderFlashcards();
            });

            // Remove button
            const removeBtn = document.createElement('button');
            removeBtn.className = 'absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600';
            removeBtn.innerHTML = '×';
            removeBtn.title = `Delete "${listName}" list`;
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Delete the "${listName}" list?`)) {
                    delete this.customLists[listName];
                    localStorage.setItem('customGermanLists', JSON.stringify(this.customLists));
                    this.renderCustomListButtons(true); // Use buttonsOnly when deleting
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

            // Drag and drop events
            wrapper.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', listName);
                wrapper.classList.add('opacity-50');
                if (e.target === dragHandle) {
                    e.dataTransfer.setData('text/plain', listName);
                }
            });

            wrapper.addEventListener('dragend', () => {
                wrapper.classList.remove('opacity-50');
                container.querySelectorAll('.drag-over').forEach(el => {
                    el.classList.remove('drag-over');
                });
            });

            wrapper.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                wrapper.classList.add('drag-over');
            });

            wrapper.addEventListener('dragenter', (e) => {
                e.preventDefault();
                wrapper.classList.add('drag-over');
            });

            wrapper.addEventListener('dragleave', () => {
                wrapper.classList.remove('drag-over');
            });

            wrapper.addEventListener('drop', (e) => {
                e.preventDefault();
                wrapper.classList.remove('drag-over');

                const draggedListName = e.dataTransfer.getData('text/plain');
                if (draggedListName !== listName) {
                    this.reorderLists(draggedListName, listName);
                }
            });

            // Assemble the wrapper
            wrapper.appendChild(dragHandle);
            wrapper.appendChild(btn);
            wrapper.appendChild(removeBtn);
            container.appendChild(wrapper);
        });

        feather.replace();
    }

    reorderLists(draggedListName, targetListName) {
        if (draggedListName === targetListName) return;

        const lists = Object.entries(this.customLists);
        const draggedIndex = lists.findIndex(([name]) => name === draggedListName);
        const targetIndex = lists.findIndex(([name]) => name === targetListName);

        if (draggedIndex === -1 || targetIndex === -1) return;

        // Remove dragged item and insert at target position
        const [draggedItem] = lists.splice(draggedIndex, 1);
        lists.splice(targetIndex, 0, draggedItem);

        // Convert back to object
        this.customLists = Object.fromEntries(lists);
        localStorage.setItem('customGermanLists', JSON.stringify(this.customLists));
        this.renderCustomListButtons(true);

        this.showNotification(`Moved "${draggedListName}" before "${targetListName}"`);
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
            this.showNotification('Please enter both list name and flashcards!');
            return;
        }

        const newCards = [];
        let currentHeading = ''; // Track current heading for grouping

        this.sanitizeInput(raw).split('\n').forEach(line => {
            line = line.trim();
            if (!line) return;

            // Check if this line is a heading [[heading text]]
            const headingMatch = line.match(/^\[\[(.+)\]\]$/);
            if (headingMatch) {
                currentHeading = headingMatch[1].trim();
                return; // Skip processing as a flashcard
            }

            // NEW FORMAT: German word ((german sentence)) :: English word ((english translation))
            const newFormatMatch = line.match(/^(.+?)\s*\(\((.*?)\)\)\s*::\s*(.+?)\s*\(\((.*?)\)\)$/);

            if (newFormatMatch) {
                const [, german, sentence, english, sentenceTranslation] = newFormatMatch;
                newCards.push({
                    german: german.trim(),
                    sentence: sentence.trim(),
                    english: english.trim(),
                    sentenceTranslation: sentenceTranslation.trim(),
                    mastered: false,
                    heading: currentHeading // Add current heading to card
                });
            }
            // OLD FORMAT with :: separator (backward compatibility)
            else if (line.includes('::')) {
                const parts = line.split('::').map(p => p.trim());
                if (parts.length === 2 && parts[0] && parts[1]) {
                    newCards.push({
                        german: parts[0],
                        english: parts[1],
                        mastered: false,
                        heading: currentHeading // Add current heading to card
                    });
                }
            }
            // LEGACY FALLBACK: Try to parse with various separators (original behavior)
            else {
                const parts = line.split(/\s*(–|--|:|-)\s*/).filter((p, i) => i === 0 || (i % 2 === 1 ? false : true)).map(p => p.trim());
                if (parts.length === 2 && parts[0] && parts[1]) {
                    newCards.push({
                        german: parts[0],
                        english: parts[1],
                        mastered: false,
                        heading: currentHeading // Add current heading to card
                    });
                } else {
                    console.warn('Skipping invalid flashcard format:', line);
                }
            }
        });

        if (newCards.length > 0) {
            this.customLists[this.sanitizeInput(listName)] = newCards;
            localStorage.setItem('customGermanLists', JSON.stringify(this.customLists));
            document.getElementById('new-flashcards-input').value = '';
            document.getElementById('list-name-input').value = '';
            this.flashcards = [...newCards];
            this.saveFlashcards();
            this.renderFlashcards();
            this.renderCustomListButtons(false);

            this.showNotification(`Added ${newCards.length} flashcards to "${listName}"`);
        } else {
            this.showNotification('No valid flashcards found! Check your format.');
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