import { SpeechService } from '../utils/vocab-tool-utils/speech.js'

// Flashcards Tool Module
export class FlashcardsTool {
    constructor() {
        this.flashcards = JSON.parse(localStorage.getItem('germanFlashcards')) || [];
        this.customLists = JSON.parse(localStorage.getItem('customGermanLists')) || {};
        this.isFiltered = false;
        this.filteredFlashcards = [];
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
        this.currentListName = null;
        this.hasAttachedFlashcardListener = false;
        this.isNotMasteredSR = false;

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
        this.syncCurrentListName();
        this.setupSearch();
        this.speech.loadVoices();
        feather.replace();
        AOS.init();
    }

    debugListState(listName) {
        const fromLocalStorage = JSON.parse(localStorage.getItem('customGermanLists')) || {};
        const fromMemory = this.customLists;

        console.log('=== DEBUG LIST STATE ===');
        console.log('List name:', listName);
        console.log('In localStorage exists:', !!fromLocalStorage[listName]);
        console.log('In memory exists:', !!fromMemory[listName]);
        console.log('LocalStorage cards:', fromLocalStorage[listName]?.length);
        console.log('Memory cards:', fromMemory[listName]?.length);
        console.log('Are they same object?', fromLocalStorage[listName] === fromMemory[listName]);
        console.log('Are they same content?', JSON.stringify(fromLocalStorage[listName]) === JSON.stringify(fromMemory[listName]));
        console.log('========================');
    }

    getCurrentCards() {
        if (this.spacedRepetitionMode) {
            return this.spacedRepetitionCards;
        } else if (this.isFiltered && this.filteredFlashcards.length > 0) {
            return this.filteredFlashcards;
        } else {
            return this.flashcards;
        }
    }

    getCurrentCardIndex() {
        if (this.spacedRepetitionMode) {
            return this.currentSRCardIndex;
        } else if (this.singleCardMode) {
            return this.currentPage - 1;
        } else {
            // For grid mode, we need to find the active card
            const activeCard = document.querySelector('.flashcard.active');
            if (activeCard) {
                return parseInt(activeCard.dataset.index);
            }
            return 0;
        }
    }

    decodeOutput(output) {
        if (!output) return '';
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

        let SRList = [];

        const notMasteredSRCards = this.flashcards.filter(c => !c.mastered);
        if (notMasteredSRCards.length === 0) {
            this.showNotification('All words mastered!');
            return;
        }

        this.isNotMasteredSR ? SRList = notMasteredSRCards : SRList = this.flashcards;

        const dueCards = SRList.filter(card => {
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
            Good (4 days) [G]
        </button>
        <button class="sr-easy-btn px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600" title="Shortcut: E">
            Easy (9 days) [E]
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
                this.handleSRRating(card, 5760); // 4 days in minutes
            });
        }

        const easyBtn = srControls.querySelector('.sr-easy-btn');
        if (easyBtn) {
            easyBtn.addEventListener('click', (e) => {
                console.log('SR Easy button clicked');
                e.stopPropagation();
                this.handleSRRating(card, 12960); // 9 days in minutes
            });
        }

        return srControls;
    }

    calculateInsertPosition(currentPos, totalLength, timeInterval) {
        let jumpSize;

        // For insertion after 1 minute - 10% ahead + random
        if (timeInterval === 1) {
            jumpSize = Math.max(1, Math.floor(currentPos * 0.1)) + Math.floor(Math.random() * 8);
        }
        // For insertion after 10 minutes - 30% ahead + random
        else if (timeInterval === 10) {
            jumpSize = Math.max(1, Math.floor(currentPos * 0.3)) + Math.floor(Math.random() * 15);
        }
        else {
            jumpSize = 1 + Math.floor(Math.random() * 2); // Default case
        }

        // Ensure the jump doesn't exceed remaining space in the list
        const remainingSpace = totalLength - currentPos - 1; // -1 to leave room for at least one card after
        jumpSize = Math.min(jumpSize, Math.max(1, remainingSpace));

        console.log('jumpSize ===> ', jumpSize, 'currentPos:', currentPos, 'totalLength:', totalLength);
        return jumpSize;
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
            const pos = this.calculateInsertPosition(this.currentSRCardIndex, this.spacedRepetitionCards.length, minutesUntilNext);
            console.log('=====>>> ', this.currentSRCardIndex, this.spacedRepetitionCards.length, minutesUntilNext, pos);
            this.rescheduleCardForCurrentSession(card, pos);

        } else if (minutesUntilNext === 10) { // Hard
            cardData.repetitions += 1;
            cardData.interval = Math.max(1, cardData.interval * 1.2);
            console.log('Rescheduling card for current session (Hard):', card.german);
            const pos = this.calculateInsertPosition(this.currentSRCardIndex, this.spacedRepetitionCards.length, minutesUntilNext);
            console.log('=====>>> ', this.currentSRCardIndex, this.spacedRepetitionCards.length, minutesUntilNext, pos);
            this.rescheduleCardForCurrentSession(card, pos);

        } else { // Good or Easy
            cardData.repetitions += 1;

            if (cardData.repetitions === 1) {
                cardData.interval = 1;
            } else if (cardData.repetitions === 2) {
                cardData.interval = 6;
            } else {
                cardData.interval = Math.round(cardData.interval * cardData.easeFactor);
            }

            if (minutesUntilNext === 43200) { // Mastered
                cardData.easeFactor = Math.min(2.5, cardData.easeFactor + 0.5);
            }

            if (minutesUntilNext === 5760) { // Good
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

        document.getElementById('not-mastered-sr').addEventListener('change', (e) => {
            this.isNotMasteredSR = e.target.checked;
            this.updateSRButton();
            console.log("set to:", !this.isNotMasteredSR ? "Normal SR" : "!mastered SR");
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
            const originalListName = localStorage.getItem('originalListName');
            if (originalListName && this.customLists[originalListName]) {
                this.flashcards = [...this.customLists[originalListName]];
                this.isFiltered = false; // Exit filtered mode
                this.filteredFlashcards = [];
                this.currentPage = 1;
                this.renderFlashcards();
                this.showNotification('Showing all cards');
            } else {
                this.showNotification('No original list found');
            }
        });

        document.getElementById('show-not-mastered-btn').addEventListener('click', () => {
            const listName = this.getCurrentListName();

            // Store the original list name
            if (listName) {
                localStorage.setItem('originalListName', listName);
                console.log('Stored original list:', listName);
            }

            // Get the original flashcards
            let originalFlashcards = [];
            if (listName && this.customLists[listName]) {
                originalFlashcards = [...this.customLists[listName]];
            } else {
                originalFlashcards = [...this.flashcards];
            }

            const notMastered = originalFlashcards.filter(c => !c.mastered);
            if (notMastered.length === 0) {
                this.showNotification('All words mastered!');
                return;
            }

            // Set filtered state
            this.isFiltered = true;
            this.filteredFlashcards = notMastered;
            this.currentPage = 1;

            // Render using filtered cards
            this.renderFlashcards();
            this.showNotification(`Showing ${notMastered.length} non-mastered cards`);
        });

        // Speak functionality - updated to handle all states
        document.addEventListener('click', e => {
            if (e.target.closest('.speak-btn') || e.target.closest('.speak-btn i')) {
                const card = e.target.closest('.flashcard');
                const idx = parseInt(card.dataset.index);

                // Get the correct cards based on current mode
                const currentCards = this.getCurrentCards();

                if (idx >= 0 && idx < currentCards.length) {
                    const currentCard = currentCards[idx];

                    // Handle flipped state
                    const text = this.isFlipped ? currentCard.english : currentCard.german;
                    const lang = this.isFlipped ? 'en-US' : 'de-DE';

                    // Add sentence if available
                    const fullText = this.isFlipped
                        ? (currentCard.sentenceTranslation ? `${text}, ${currentCard.sentenceTranslation}` : text)
                        : (currentCard.sentence ? `${text}, ${currentCard.sentence}` : text);

                    this.speakWord(this.decodeOutput(fullText), 0.8, lang);
                }
            }
        });

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
                    this.renderFlashcards(this.isFiltered ? true : false);
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
                    this.renderFlashcards(this.isFiltered ? true : false);
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
                const currentCards = this.getCurrentCards();
                const currentIndex = this.getCurrentCardIndex();

                if (currentIndex >= 0 && currentIndex < currentCards.length) {
                    const card = currentCards[currentIndex];
                    const sentence = card?.sentence ? `, ${card.sentence}` : '';
                    const text = card.german + ',' + sentence;
                    const lang = 'de-DE';
                    this.speakWord(this.decodeOutput(text), 0.8, lang);
                }
            }
        });

        this.setupAddFlashcardsModal();
    }

    setupSearch() {
        const searchInput = document.getElementById('flashcard-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }
    }

    handleSearch(query) {
        query = query.trim().toLowerCase();

        if (!query) {
            // If query is empty, reset to normal view
            this.isFiltered = false;
            this.filteredFlashcards = [];
            this.currentPage = 1;
            this.renderFlashcards();
            return;
        }

        // Get all flashcards from all lists
        const allFlashcards = [];

        // Add flashcards from all custom lists
        const customLists = JSON.parse(localStorage.getItem('customGermanLists') || '{}');

        // Iterate over the object keys
        Object.keys(customLists).forEach(key => {
            const list = customLists[key];
            if (Array.isArray(list)) {
                list.forEach(card => {
                    allFlashcards.push({
                        ...card,
                        listName: key // Add list name (the key) for reference
                    });
                });
            }
        });

        // Filter cards across all lists
        const results = allFlashcards.filter(card => {
            const german = (card.german || '').toLowerCase();
            const english = (card.english || '').toLowerCase();
            return german.includes(query) || english.includes(query);
        });

        // Sort results: German matches first
        results.sort((a, b) => {
            const aGerman = (a.german || '').toLowerCase();
            const bGerman = (b.german || '').toLowerCase();
            const aMatch = aGerman.includes(query);
            const bMatch = bGerman.includes(query);

            if (aMatch && !bMatch) return -1;
            if (!aMatch && bMatch) return 1;
            return 0;
        });

        this.isFiltered = results.length > 0 ? true : false;
        this.filteredFlashcards = results;
        this.currentPage = 1;
        this.renderFlashcards(true);
    }

    // Add method to get SR statistics
    getSRStatistics() {
        const now = Date.now();
        let dueCount = 0;
        let totalCards = 0;

        let SRList = [];

        const notMasteredSRCards = this.flashcards.filter(c => !c.mastered);
        if (notMasteredSRCards.length === 0) {
            this.showNotification('All words mastered!');
            return;
        }

        this.isNotMasteredSR ? SRList = notMasteredSRCards : SRList = this.flashcards;

        SRList.forEach(card => {
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
    }

    updateProgress() {
        const masteredCount = this.flashcards.filter(c => c.mastered).length;
        const percentage = this.flashcards.length ? Math.round((masteredCount / this.flashcards.length) * 100) : 0;
        document.getElementById('progress-bar').style.width = `${percentage}%`;
        document.getElementById('progress-list-name').textContent = this.decodeOutput(localStorage.getItem('originalListName'));
        document.getElementById('progress-percentage').textContent = `${percentage}%`;
    }

    updateCurrentListInStorage() {
        if (this.currentListName && this.customLists[this.currentListName]) {
            // Create a fresh copy to avoid reference issues
            this.customLists[this.currentListName] = JSON.parse(JSON.stringify(this.flashcards));
            localStorage.setItem('customGermanLists', JSON.stringify(this.customLists));
            console.log('Explicitly updated list:', this.currentListName);
        }
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

        // Get the correct cards based on current mode
        const currentCards = this.getCurrentCards();
        const card = currentCards[cardIndex];

        if (!card) return;

        // Safely set values with null checks
        const germanWordInput = document.getElementById('edit-german-word');
        const germanSentenceInput = document.getElementById('edit-german-sentence');
        const englishWordInput = document.getElementById('edit-english-word');
        const englishTranslationInput = document.getElementById('edit-english-translation');
        const cardIndexInput = document.getElementById('edit-card-index');

        if (germanWordInput) germanWordInput.value = this.decodeOutput(card.german);
        if (germanSentenceInput) germanSentenceInput.value = this.decodeOutput(card.sentence) || '';
        if (englishWordInput) englishWordInput.value = this.decodeOutput(card.english);
        if (englishTranslationInput) englishTranslationInput.value = this.decodeOutput(card.sentenceTranslation) || '';
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

        // Get current cards
        const currentCards = this.getCurrentCards();
        if (cardIndex < 0 || cardIndex >= currentCards.length) {
            this.showNotification('Failed to update flashcard. Invalid index.');
            return;
        }

        const cardToEdit = currentCards[cardIndex];
        const originalListName = localStorage.getItem('originalListName') || this.getCurrentListName();

        if (!originalListName) {
            this.showNotification('Cannot update: No original list found');
            return;
        }

        // SIMPLE SOLUTION: Read lists fresh from localStorage
        const customListsFromStorage = JSON.parse(localStorage.getItem('customGermanLists')) || {};

        if (!customListsFromStorage[originalListName]) {
            this.showNotification(`List "${originalListName}" not found in storage`);
            return;
        }

        // Update the current view
        currentCards[cardIndex] = {
            german: germanWord,
            english: englishWord,
            sentence: germanSentence || undefined,
            sentenceTranslation: englishTranslation || undefined,
            mastered: cardToEdit.mastered,
            heading: cardToEdit.heading
        };

        // Find and update in the original list from storage
        const originalList = customListsFromStorage[originalListName];
        const originalCardIndex = originalList.findIndex(card =>
            card.german === cardToEdit.german && card.english === cardToEdit.english
        );

        if (originalCardIndex !== -1) {
            // Create a new object to avoid reference issues
            originalList[originalCardIndex] = {
                german: germanWord,
                english: englishWord,
                sentence: germanSentence || undefined,
                sentenceTranslation: englishTranslation || undefined,
                mastered: cardToEdit.mastered,
                heading: originalList[originalCardIndex].heading
            };

            // Save back to localStorage
            localStorage.setItem('customGermanLists', JSON.stringify(customListsFromStorage));

            // Update in-memory reference
            this.customLists = customListsFromStorage;
        }

        // Update main flashcards
        const mainCardIndex = this.flashcards.findIndex(card =>
            card.german === cardToEdit.german && card.english === cardToEdit.english
        );
        if (mainCardIndex !== -1) {
            this.flashcards[mainCardIndex] = currentCards[cardIndex];
        }

        localStorage.setItem('germanFlashcards', JSON.stringify(this.flashcards));
        this.renderFlashcards();

        document.getElementById('edit-flashcard-modal').classList.add('hidden');
        this.showNotification('Flashcard updated successfully!');
    }

    handleRemoveFlashcard(cardIndex) {
        if (confirm('Are you sure you want to remove this flashcard?')) {
            // Get the correct cards based on current mode
            const currentCards = this.getCurrentCards();
            const cardToRemove = currentCards[cardIndex];

            if (!cardToRemove) {
                this.showNotification('Card not found!');
                return;
            }

            // Remove from current view
            currentCards.splice(cardIndex, 1);

            // Update the ORIGINAL list in customGermanLists
            const originalListName = localStorage.getItem('originalListName') || this.getCurrentListName();
            if (originalListName && this.customLists[originalListName]) {
                const originalList = this.customLists[originalListName];

                // Find the matching card in the original list
                const originalCardIndex = originalList.findIndex(card =>
                    card.german === cardToRemove.german && card.english === cardToRemove.english
                );

                if (originalCardIndex !== -1) {
                    // Remove from the original list
                    originalList.splice(originalCardIndex, 1);
                    localStorage.setItem('customGermanLists', JSON.stringify(this.customLists));
                }
            }

            // Also remove from main flashcards
            const mainCardIndex = this.flashcards.findIndex(card =>
                card.german === cardToRemove.german && card.english === cardToRemove.english
            );
            if (mainCardIndex !== -1) {
                this.flashcards.splice(mainCardIndex, 1);
            }

            localStorage.setItem('germanFlashcards', JSON.stringify(this.flashcards));
            this.renderFlashcards();

            this.showNotification('Flashcard removed successfully!');
        }
    }

    debugStorage() {
        const germanFlashcards = JSON.parse(localStorage.getItem('germanFlashcards') || '[]');
        const customGermanLists = JSON.parse(localStorage.getItem('customGermanLists') || '{}');
        const currentListName = this.getCurrentListName();

        console.log('=== STORAGE DEBUG ===');
        console.log('germanFlashcards:', germanFlashcards.length, 'cards');
        console.log('customGermanLists keys:', Object.keys(customGermanLists));
        console.log('currentListName:', currentListName);

        if (currentListName && customGermanLists[currentListName]) {
            console.log('current list cards:', customGermanLists[currentListName].length);
            console.log('mastered in current list:', customGermanLists[currentListName].filter(c => c.mastered).length);
        }
        console.log('=====================');
    }

    renderFlashcards(isSearching) {
        const container = document.getElementById('flashcards-container');
        container.innerHTML = '';

        // Determine which cards to render
        let cardsToRender;
        if (this.isFiltered && this.filteredFlashcards.length > 0) {
            cardsToRender = this.filteredFlashcards;
            console.log('Rendering filtered cards:', cardsToRender.length);
        } else {
            cardsToRender = this.flashcards;
            console.log('Rendering normal cards:', cardsToRender.length);
        }

        if (this.singleCardMode) {
            this.renderSingleCardMode(container, cardsToRender, isSearching);
        } else {
            this.renderGridMode(container, cardsToRender, isSearching);
        }

        feather.replace();
        this.updateProgress();
    }

    renderSingleCardMode(container, cardsToRender = this.flashcards, isSearching) {
        console.log('renderSingleCardMode called with:', cardsToRender.length, 'cards');

        container.className = "flex items-center justify-center mx-auto max-w-3xl";

        let card;
        let cardInfo = '';
        let actualIndex;
        let currentHeading = '';

        if (this.spacedRepetitionMode) {
            // In SR mode, use SR cards and index
            card = this.spacedRepetitionCards[this.currentSRCardIndex];
            if (!card) {
                this.spacedRepetitionMode = false;
                this.currentSRCardIndex = 0;
                this.spacedRepetitionCards = [];
                this.renderFlashcards();
                return;
            }
            actualIndex = this.currentSRCardIndex;
            cardInfo = `<div class="absolute top-4 left-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
            ${this.currentSRCardIndex + 1} / ${this.spacedRepetitionCards.length}
        </div>`;
        } else {
            // Use the passed cardsToRender instead of this.flashcards
            card = cardsToRender[this.currentPage - 1];
            if (!card) {
                this.currentPage = 1;
                card = cardsToRender[0];
                if (!card) return;
            }
            actualIndex = this.currentPage - 1;

            cardInfo = `<div class="absolute top-4 left-4 bg-gray-500 text-white px-3 py-1 rounded-full text-sm">
            ${this.currentPage} / ${cardsToRender.length}
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
            backContentDiv.innerHTML += `<button class="master-btn-sr mt-3 px-4 py-2 ${card.mastered ? 'bg-green-500' : 'bg-gray-500'} text-white rounded text-sm" title="Shortcut: M">
                ${card.mastered ? 'Not Mastered' : 'Mastered'} (30 days) [M]
                </button>`;
        } else {
            // Regular controls for non-SR mode
            const regularControls = document.createElement('div');
            regularControls.className = 'mt-4 flex space-x-2';
            regularControls.innerHTML = `
            <div class="mt-1 flex flex-col space-x-1">
                <div class="mt-1 flex space-x-2">
                    <button class="master-btn px-4 py-2 ${card.mastered ? 'bg-green-500' : 'bg-gray-500'} text-white rounded text-sm" title="Shortcut: M">
                        ${card.mastered ? 'Not Mastered' : 'Mastered'} [M]
                    </button>
                    <button class="edit-btn px-4 py-2 bg-blue-500 text-white rounded text-sm">
                        Edit
                    </button>
                    <button class="remove-btn px-4 py-2 bg-red-500 text-white rounded text-sm">
                        Remove
                    </button>
                </div>
                <button class="add-dark-btn px-2 py-3 mt-5 bg-black text-white rounded text-xs">
                    Add to Dark List
                </button>
            </div>
        `;
            backContentDiv.appendChild(regularControls);
        }

        // Create heading display (only show if heading exists)
        const headingDisplay = currentHeading || isSearching && card.listName ?
            `<div class="absolute top-4 right-4 z-30 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-full shadow-lg border border-white border-opacity-30">
                <div class="flex items-center space-x-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-folder">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span class="text-sm font-medium">${currentHeading || card.listName}</span>
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

    renderGridMode(container, cardsToRender = this.flashcards, isSearching = false) {
        container.className = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 gap-4 mx-auto max-w-5xl";
        const startIndex = (this.currentPage - 1) * this.cardsPerPage;
        const endIndex = Math.min(startIndex + this.cardsPerPage, cardsToRender.length);

        let lastHeading = '';

        cardsToRender.slice(startIndex, endIndex).forEach((card, idx) => {
            const actualIndex = startIndex + idx;

            // Add heading if it exists and is different from previous
            if (isSearching && card.listName !== lastHeading || card.heading && card.heading !== lastHeading) {
                console.log(isSearching, card.listName, card.heading, lastHeading);

                if (!card.heading && !isSearching) {
                    return;
                }

                const headingElement = document.createElement('div');
                headingElement.className = 'col-span-full bg-gray-200 p-3 rounded-lg border-l-4 border-blue-500 mb-2';
                headingElement.innerHTML = `
                <h3 class="text-lg font-semibold text-gray-800 flex items-center">
                    <i data-feather="folder" class="mr-2 w-4 h-4"></i>
                    ${card.listName || card.heading}
                </h3>
            `;
                container.appendChild(headingElement);
                console.log(card.listName === lastHeading);

                lastHeading = card.listName || card.heading;
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
                        <button class="master-btn px-2 py-1 ${card.mastered ? 'bg-green-500' : 'bg-gray-500'} text-white rounded text-xs">
                            ${card.mastered ? 'Not Mastered' : 'Mastered'}
                        </button>
                        <button class="edit-btn px-2 py-1 bg-blue-500 text-white rounded text-xs">
                            Edit
                        </button>
                        <button class="remove-btn px-2 py-1 bg-red-500 text-white rounded text-xs">
                            Remove
                        </button>
                    </div>
                    <button class="add-dark-btn px-2 py-1 bg-black text-white rounded text-xs">
                        Add to Dark List
                    </button>
                </div>
            </div>`;
            container.appendChild(flashcard);
            this.setupFlashcardEventListeners(flashcard);
        });

        this.updatePaginationControls();
        feather.replace();
    }

    handleAddToDarkList() {

        const listName = 'Dark List';
        let currentCard = '';

        const currentCards = this.getCurrentCards();
        const currentIndex = this.getCurrentCardIndex();

        if (currentIndex >= 0 && currentIndex < currentCards.length) {
            currentCard = currentCards[currentIndex];
        }


        let customLists = JSON.parse(localStorage.getItem('customGermanLists')) || {};

        // Create new list if it doesn't exist
        if (!customLists[listName]) {
            customLists[listName] = [];
        }

        const exists = customLists[listName].some(card =>
            card.german === currentCard.german && card.english === currentCard.english
        );

        if (!exists) {
            customLists[listName].push({
                german: currentCard.german,
                sentence: currentCard.sentence,
                english: currentCard.english,
                mastered: false
            });
            this.showNotification('Card Added');
        } else {
            this.showNotification('Card Already Exists!');
        }
        localStorage.setItem('customGermanLists', JSON.stringify(customLists));
        // Refresh flashcard lists
        // this.FCL.refreshFlashcardLists();
    }

    handleMasterBtn() {
        console.log('Keyboard shortcut: Mastered');
        const currentCards = this.getCurrentCards();
        const currentIndex = this.getCurrentCardIndex();

        if (currentIndex >= 0 && currentIndex < currentCards.length) {
            const currentCard = currentCards[currentIndex];
            currentCard.mastered = !currentCard.mastered;

            // Update the ORIGINAL list in customGermanLists
            const originalListName = localStorage.getItem('originalListName') || this.getCurrentListName();
            if (originalListName && this.customLists[originalListName]) {
                const originalList = this.customLists[originalListName];

                // Find the matching card in the original list
                const originalCardIndex = originalList.findIndex(card =>
                    card.german === currentCard.german && card.english === currentCard.english
                );

                if (originalCardIndex !== -1) {
                    originalList[originalCardIndex].mastered = currentCard.mastered;
                    localStorage.setItem('customGermanLists', JSON.stringify(this.customLists));
                }
            }

            // Also update main flashcards
            const mainCardIndex = this.flashcards.findIndex(card =>
                card.german === currentCard.german && card.english === currentCard.english
            );
            if (mainCardIndex !== -1) {
                this.flashcards[mainCardIndex].mastered = currentCard.mastered;
            }

            localStorage.setItem('germanFlashcards', JSON.stringify(this.flashcards));
            this.updateProgress();
            this.refreshCustomListButtons();
            if (this.spacedRepetitionMode && this.singleCardMode) {
                console.log('Keyboard shortcut: Mastered');
                this.handleSRRating(currentCard, 43200);
                return;
            };
            this.renderFlashcards();

            const action = currentCard.mastered ? 'marked as mastered' : 'unmarked as mastered';
            // this.showNotification(`Card ${action}!`);
        }
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
                                this.handleSRRating(currentCard, 5760);
                                break;
                            case 'e': // Easy
                                console.log('Keyboard shortcut: Easy');
                                this.handleSRRating(currentCard, 12960);
                                break;
                        }
                    }
                }

                const masterSRBtn = document.getElementsByClassName('master-btn-sr')[0];
                if (masterSRBtn) {
                    masterSRBtn.addEventListener('click', () => {
                        this.handleMasterBtn();
                    });
                }

                // Mastered shortcut (works in both normal and SR mode)
                if (e.key.toLowerCase() === 'm' && this.singleCardMode) {
                    this.handleMasterBtn();
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
                !event.target.classList.contains('remove-btn') &&
                !event.target.classList.contains('speak-btn')) {

                // Remove active class from all cards
                document.querySelectorAll('.flashcard').forEach(card => {
                    card.classList.remove('active');
                });

                // Add active class to clicked card
                this.classList.add('active');
                this.classList.toggle('flipped');
            }
        });

        const masterBtn = flashcard.querySelector('.master-btn');
        if (masterBtn) {
            masterBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(flashcard.dataset.index);

                // Get the ORIGINAL list name
                const originalListName = localStorage.getItem('originalListName') || this.getCurrentListName();
                console.log('Master toggle - originalListName:', originalListName, this.isFiltered);

                // Determine which card was clicked based on filtered state
                let clickedCard;
                let cardSource;

                if (this.isFiltered) {
                    clickedCard = this.filteredFlashcards[idx];
                    cardSource = 'filtered';
                } else {
                    clickedCard = this.flashcards[idx];
                    cardSource = 'normal';
                }

                console.log('Clicked card from:', cardSource, clickedCard);

                if (!clickedCard) {
                    console.error('No card found at index:', idx);
                    return;
                }

                // Toggle mastered status
                clickedCard.mastered = !clickedCard.mastered;

                // Update the ORIGINAL list in customGermanLists
                if (originalListName && this.customLists[originalListName]) {
                    const originalList = this.customLists[originalListName];

                    // Find the matching card in the original list
                    const originalCardIndex = originalList.findIndex(card =>
                        card.german === clickedCard.german && card.english === clickedCard.english
                    );

                    if (originalCardIndex !== -1) {
                        // Update the mastered status in the original list
                        originalList[originalCardIndex].mastered = clickedCard.mastered;
                        localStorage.setItem('customGermanLists', JSON.stringify(this.customLists));
                        console.log('Updated original list:', originalListName);

                        // Also update the main flashcards
                        this.flashcards[originalCardIndex].mastered = clickedCard.mastered;
                    }
                }

                // Update germanFlashcards
                localStorage.setItem('germanFlashcards', JSON.stringify(this.flashcards));

                this.updateProgress();

                // If we're in filtered mode and card is now mastered, remove it from filtered view
                if (this.isFiltered && clickedCard.mastered) {
                    this.filteredFlashcards = this.filteredFlashcards.filter(card =>
                        !(card.german === clickedCard.german && card.english === clickedCard.english)
                    );
                    console.log('Removed mastered card from filtered view. Remaining:', this.filteredFlashcards.length);

                    if (this.filteredFlashcards.length === 0) {
                        this.showNotification('All filtered words mastered!');
                        this.isFiltered = false;
                    }
                }
                this.renderCustomListButtons();
                this.renderFlashcards();

                this.showNotification('Mastery status updated!');
            });
        }

        // Update speak button to handle all states
        const speakBtn = flashcard.querySelector('.speak-btn');
        if (speakBtn) {
            speakBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(flashcard.dataset.index);
                const currentCards = this.getCurrentCards();

                if (idx >= 0 && idx < currentCards.length) {
                    const card = currentCards[idx];
                    const text = card.german + ',' + (card.sentence || '');
                    const lang = 'de-DE';
                    this.speakWord(this.decodeOutput(text), 0.8, lang);
                }
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
                console.log('-------->>> ', removeBtn);
                e.stopPropagation();
                const idx = parseInt(flashcard.dataset.index);
                this.handleRemoveFlashcard(idx);
            });
        }

        const addToDarkList = flashcard.querySelector('.add-dark-btn');
        if (addToDarkList) {
            addToDarkList.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('-------->>> ', addToDarkList);
                this.handleAddToDarkList();
                this.refreshCustomListButtons();
            });
        }

        setTimeout(() => {
            const againBtn = flashcard.querySelector('.sr-again-btn');
            const hardBtn = flashcard.querySelector('.sr-hard-btn');
            const goodBtn = flashcard.querySelector('.sr-good-btn');
            const easyBtn = flashcard.querySelector('.sr-easy-btn');

            const masterSRBtn = document.getElementsByClassName('master-btn-sr')[0];
            if (masterSRBtn) {
                masterSRBtn.addEventListener('click', () => {
                    this.handleMasterBtn();
                });
            }

            if (againBtn) {
                console.log('Setting up SR Again button in setupFlashcardEventListeners');
                againBtn.addEventListener('click', (e) => {
                    console.log('SR Again button clicked from setupFlashcardEventListeners');
                    e.stopPropagation();
                    e.preventDefault();
                    const idx = parseInt(flashcard.dataset.index);

                    // Use getCurrentCards() instead of conditional logic
                    const currentCards = this.getCurrentCards();
                    const currentCard = currentCards[idx];

                    if (currentCard) {
                        this.handleSRRating(currentCard, 1);
                    }
                });
            }

            // Add similar handlers for other buttons...
            if (hardBtn) {
                hardBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const idx = parseInt(flashcard.dataset.index);

                    // Use getCurrentCards() instead of conditional logic
                    const currentCards = this.getCurrentCards();
                    const currentCard = currentCards[idx];

                    if (currentCard) {
                        this.handleSRRating(currentCard, 10);
                    }
                });
            }

            if (goodBtn) {
                goodBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const idx = parseInt(flashcard.dataset.index);

                    // Use getCurrentCards() instead of conditional logic
                    const currentCards = this.getCurrentCards();
                    const currentCard = currentCards[idx];

                    if (currentCard) {
                        this.handleSRRating(currentCard, 5760);
                    }
                });
            }

            if (easyBtn) {
                easyBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const idx = parseInt(flashcard.dataset.index);

                    // Use getCurrentCards() instead of conditional logic
                    const currentCards = this.getCurrentCards();
                    const currentCard = currentCards[idx];

                    if (currentCard) {
                        this.handleSRRating(currentCard, 12960);
                    }
                });
            }
        }, 100);
    }

    openEditListModal(listName) {
        // Create or show edit list modal
        let modal = document.getElementById('edit-list-modal');

        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'edit-list-modal';
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden';
            modal.innerHTML = `
            <div class="bg-white rounded-lg p-6 w-96">
                <h3 class="text-lg font-bold mb-4">Edit List Name</h3>
                <input type="text" id="edit-list-name-input" class="w-full p-2 border rounded mb-4" value="${listName}">
                <div class="flex justify-end space-x-2">
                    <button id="cancel-edit-list" class="px-4 py-2 bg-gray-500 text-white rounded">Cancel</button>
                    <button id="save-edit-list" class="px-4 py-2 bg-blue-500 text-white rounded">Save</button>
                </div>
            </div>
        `;
            document.body.appendChild(modal);

            // Add event listeners
            document.getElementById('cancel-edit-list').addEventListener('click', () => {
                modal.classList.add('hidden');
            });

            document.getElementById('save-edit-list').addEventListener('click', () => {
                this.handleEditListName(listName);
            });

            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.add('hidden');
            });
        }

        document.getElementById('edit-list-name-input').value = listName;
        modal.classList.remove('hidden');
    }

    handleEditListName(oldListName) {
        const newListNameInput = document.getElementById('edit-list-name-input');
        const newListName = this.sanitizeInput(newListNameInput.value.trim());

        if (!newListName) {
            this.showNotification('List name cannot be empty!');
            return;
        }

        if (newListName === oldListName) {
            document.getElementById('edit-list-modal').classList.add('hidden');
            return;
        }

        if (this.customLists[newListName]) {
            this.showNotification('A list with this name already exists!');
            return;
        }

        // Rename the list
        this.customLists[newListName] = this.customLists[oldListName];
        delete this.customLists[oldListName];

        // Update currentListName if this was the current list
        if (this.currentListName === oldListName) {
            this.currentListName = newListName;
        }

        localStorage.setItem('customGermanLists', JSON.stringify(this.customLists));
        this.renderCustomListButtons(true);
        document.getElementById('edit-list-modal').classList.add('hidden');

        this.showNotification(`List renamed from "${oldListName}" to "${newListName}"`);
    }

    syncCurrentListName() {
        const detectedListName = this.getCurrentListName();
        if (detectedListName && detectedListName !== this.currentListName) {
            console.log('Syncing currentListName from', this.currentListName, 'to', detectedListName);
            this.currentListName = detectedListName;
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
            console.log('----->> console log');
            // Determine which cards to use for pagination
            const totalCards = this.isFiltered ? this.filteredFlashcards.length : this.flashcards.length;
            const totalPages = this.singleCardMode
                ? totalCards
                : Math.ceil(totalCards / this.cardsPerPage);

            document.getElementById('page-info').textContent = `Page ${this.currentPage} of ${totalPages}${this.isFiltered ? ' (Filtered)' : ''}`;

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

    speakWord(text, rate = 0.9, lang = 'de-DE') {
        this.useSlowSpeak ? rate = 0.6 : rate = rate;
        return this.speech.speakText(text, this.voiceSelect.value, rate, false);
    }

    getCurrentListName() {
        // First try to get from localStorage (for filtered scenarios)
        const storedListName = localStorage.getItem('originalListName');
        if (storedListName && this.customLists[storedListName]) {
            return storedListName;
        }

        // Then try the tracked currentListName
        if (this.currentListName && this.customLists[this.currentListName]) {
            return this.currentListName;
        }

        // Fallback to comparison method
        const cur = JSON.stringify(this.flashcards);
        for (const [listName, listCards] of Object.entries(this.customLists)) {
            if (JSON.stringify(listCards) === cur) return listName;
        }

        return null;
    }

    updateCurrentCustomList() {
        if (this.currentListName) {
            this.customLists[this.currentListName] = JSON.parse(JSON.stringify(this.flashcards));
            localStorage.setItem('customGermanLists', JSON.stringify(this.customLists));
        }
    }

    refreshCustomListButtons() {
        // Reload the latest data from localStorage
        this.customLists = JSON.parse(localStorage.getItem('customGermanLists')) || {};
        this.renderCustomListButtons(true); // buttonsOnly = true to preserve current state
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
                listTitle = ''; // 'Fully mastered! 🎯';
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
                listTitle = ''; // 'No cards mastered yet';
            }
            
            if (listName == 'Dark List') {
                listColor = 'bg-gray-800 hover:bg-gray-900';
                listIcon = 'list';
            }


            // List button with dynamic color and icon
            const btn = document.createElement('button');
            btn.className = `px-4 py-2 ${listColor} text-white rounded-lg flex items-center transition-colors duration-200 w-full`;
            btn.title = `${listTitle} | ${masteredCount}/${totalCount} cards mastered`;

            // Create icon and text content
            btn.innerHTML = `
                <i data-feather="${listIcon}" class="mr-2 w-4 h-4"></i>
                ${listName}
                <div class="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2">
                    <span class="text-xs bg-purple-900 px-2 py-1 rounded-full">${totalCount}</span>
                    ${masteryPercentage > 0 && masteryPercentage < 100 ? `
                    <span class="text-xs bg-yellow-500 px-2 py-1 rounded-full">${masteryPercentage}%</span>
                    ` : ''}
                </div>
                `;

            btn.addEventListener('click', () => {
                console.log('Loading list:', listName);

                // COMPLETELY RESET everything
                this.isFiltered = false;
                this.filteredFlashcards = [];
                this.spacedRepetitionMode = false;
                this.currentSRCardIndex = 0;
                this.spacedRepetitionCards = [];

                // Read FRESH from localStorage - don't trust any in-memory state
                const customListsFromStorage = JSON.parse(localStorage.getItem('customGermanLists')) || {};

                if (!customListsFromStorage[listName]) {
                    this.showNotification(`List "${listName}" not found!`);
                    return;
                }

                // Create a DEEP COPY of the list to avoid any reference issues
                this.flashcards = JSON.parse(JSON.stringify(customListsFromStorage[listName]));

                // Update in-memory state
                this.customLists = customListsFromStorage;
                this.currentListName = listName;
                this.originalListName = listName;

                // Save to both storage locations
                localStorage.setItem('germanFlashcards', JSON.stringify(this.flashcards));
                localStorage.setItem('originalListName', listName);

                this.currentPage = 1;
                this.updateSRButton();
                this.renderFlashcards();

                console.log('Successfully loaded list:', listName, 'with', this.flashcards.length, 'cards');
                this.showNotification(`Loaded "${listName}" list with ${this.flashcards.length} cards`);
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

                    // If we're deleting the current list, switch to another list
                    if (this.currentListName === listName) {
                        const remainingLists = Object.keys(this.customLists);
                        if (remainingLists.length > 0) {
                            this.flashcards = [...this.customLists[remainingLists[0]]];
                            this.currentListName = remainingLists[0];
                        } else {
                            this.flashcards = [];
                            this.currentListName = null;
                        }
                        this.saveFlashcards();
                        this.renderFlashcards();
                    }

                    this.renderCustomListButtons(true); // Use buttonsOnly when deleting
                    this.showNotification(`List "${listName}" deleted successfully`);
                }
            });

            // Drag and drop events (without drag handle)
            wrapper.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', listName);
                wrapper.classList.add('opacity-50');
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

            // Assemble the wrapper (without drag handle)
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
            const sanitizedListName = this.sanitizeInput(listName);
            this.customLists[sanitizedListName] = newCards;
            localStorage.setItem('customGermanLists', JSON.stringify(this.customLists));

            document.getElementById('new-flashcards-input').value = '';
            document.getElementById('list-name-input').value = '';

            this.flashcards = [...newCards];
            this.currentListName = sanitizedListName; // Set current list
            this.originalListName = sanitizedListName; // Also set original
            localStorage.setItem('germanFlashcards', JSON.stringify(this.flashcards));

            this.renderFlashcards();
            this.refreshCustomListButtons(); // Change this line

            this.showNotification(`Added ${newCards.length} flashcards to "${listName}"`);

            // Close the modal
            document.getElementById('add-flashcards-modal').classList.add('hidden');
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

    // Stop word highlighting
    stopWordHighlighting() {
        // Just ignore the callback error   
    }
}