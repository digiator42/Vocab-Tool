// flashcard-list-service.js
export class FlashcardListService {
    constructor(vocabTool) {
        this.vocabTool = vocabTool;
        this.selectedFlashcardList = null;
        this.isFlashCardLoadRequested = false;
    }

    // Setup flashcard list selection UI
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
            this.vocabTool.output.insertAdjacentElement('afterend', selectorContainer);
        } else {
            // Fallback: insert after the output
            this.vocabTool.output.insertAdjacentElement('afterend', selectorContainer);
        }

        this.populateFlashcardLists();
        this.setupFlashcardListListeners();
    }

    populateFlashcardLists() {
        const listsContainer = document.getElementById('flashcard-lists-container');
        const noListsMessage = document.getElementById('no-lists-message');

        if (!listsContainer) return;

        // Get flashcard lists from localStorage
        const customLists = this.getFlashcardLists();
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
            button.textContent = `${this.vocabTool.decodeOutput(listName)} (${list.length})`;
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

        const customLists = this.getFlashcardLists();
        const list = customLists[listName];

        if (!list) return;

        selectedListName.textContent = this.vocabTool.decodeOutput(listName);
        selectedListCount.textContent = `${list.length} flashcards`;
        selectedListInfo.classList.remove('hidden');

        // Store the selected list name
        this.selectedFlashcardList = listName;
    }

    // Load flashcards into active recall
    loadFlashcardsIntoActiveRecall() {
        if (!this.selectedFlashcardList) {
            alert('Please select a flashcard list first!');
            return;
        }

        const customLists = this.getFlashcardLists();
        const list = customLists[this.selectedFlashcardList];

        if (!list || list.length === 0) {
            alert('Selected list is empty!');
            return;
        }

        // DEBUG: Check what's actually stored
        console.log('=== DEBUG: Raw flashcard data ===');
        console.log('Selected list:', this.selectedFlashcardList);

        // Combine German words and sentences, decode sanitized input and replace slashes
        const textContent = list.map(card => {
            let content = this.vocabTool.decodeSanitizedInput(card.german);

            // Replace slashes with commas in German text
            content = content.replace(/\//g, ',');

            if (card.sentence) {
                let sentence = this.vocabTool.decodeSanitizedInput(card.sentence);
                sentence = sentence.replace(/\//g, ',');
                content += `, ${sentence}`;
            }
            return content;
        }).join('. ');

        list.forEach((card, index) => {
            console.log(`Card ${index}:`, {
                german: card.german,
                english: card.english,
                germanRaw: JSON.stringify(card.german),
                sentence: card.sentence,
                sentenceRaw: card.sentence ? JSON.stringify(card.sentence) : 'No sentence'
            });
        });

        console.log('=== END DEBUG ===');
        console.log('Processed text content:', textContent);

        // Set the text in the input area
        this.vocabTool.input.value = textContent;

        // Process the text
        this.isFlashCardLoadRequested = true;

        // Show success message
        this.vocabTool.setStatus(`Loaded ${list.length} flashcards from "${this.selectedFlashcardList}"`);

        // Scroll to the top to see the processed text
        this.vocabTool.input.scrollIntoView({ behavior: 'smooth' });

        // Auto-open Active Recall tool
        setTimeout(() => {
            const activeRecallBtn = document.getElementById('active-recall-btn');
            if (activeRecallBtn && activeRecallBtn.textContent.includes('Active Recall')) {
                activeRecallBtn.click();
            }
        }, 100);
    }

    // Get flashcard lists from localStorage
    getFlashcardLists() {
        return JSON.parse(localStorage.getItem('customGermanLists')) || {};
    }

    // Save flashcard lists to localStorage
    saveFlashcardLists(lists) {
        localStorage.setItem('customGermanLists', JSON.stringify(lists));
    }

    // Add a word to a flashcard list
    addWordToList(listName, german, english, sentence = null) {
        let customLists = this.getFlashcardLists();
        if (!customLists[listName]) {
            customLists[listName] = [];
        }

        const exists = customLists[listName].some(card =>
            card.german === german && card.english === english
        );

        if (exists) {
            return { success: false, message: "Already exists in this list." };
        }

        const newCard = { german, english, mastered: false };
        if (sentence) {
            newCard.sentence = sentence;
        }

        customLists[listName].push(newCard);
        this.saveFlashcardLists(customLists);

        return { success: true, message: `Added to "${listName}"!` };
    }

    // Create a new flashcard list
    createNewList(listName, initialCards = []) {
        let customLists = this.getFlashcardLists();

        if (customLists[listName]) {
            return { success: false, message: "List already exists. Choose it above." };
        }

        customLists[listName] = initialCards;
        this.saveFlashcardLists(customLists);

        return { success: true, message: `Created "${listName}"!` };
    }

    // Remove a flashcard list
    removeList(listName) {
        let customLists = this.getFlashcardLists();
        if (customLists[listName]) {
            delete customLists[listName];
            this.saveFlashcardLists(customLists);

            // Clear selection if the removed list was selected
            if (this.selectedFlashcardList === listName) {
                this.selectedFlashcardList = null;
                document.getElementById('selected-list-info').classList.add('hidden');
            }

            return { success: true, message: `Removed list "${listName}"` };
        }
        return { success: false, message: "List not found." };
    }

    // Get cards from a specific list
    getCardsFromList(listName) {
        const customLists = this.getFlashcardLists();
        return customLists[listName] || [];
    }

    // Update a card in a list
    updateCard(listName, oldGerman, oldEnglish, newGerman, newEnglish, newSentence = null) {
        let customLists = this.getFlashcardLists();
        const list = customLists[listName];

        if (!list) {
            return { success: false, message: "List not found." };
        }

        const cardIndex = list.findIndex(card =>
            card.german === oldGerman && card.english === oldEnglish
        );

        if (cardIndex === -1) {
            return { success: false, message: "Card not found." };
        }

        list[cardIndex] = {
            german: newGerman,
            english: newEnglish,
            sentence: newSentence,
            mastered: list[cardIndex].mastered
        };

        this.saveFlashcardLists(customLists);
        return { success: true, message: "Card updated successfully." };
    }

    // Toggle mastered status for a card
    toggleMasteredStatus(listName, german, english) {
        let customLists = this.getFlashcardLists();
        const list = customLists[listName];

        if (!list) {
            return { success: false, message: "List not found." };
        }

        const card = list.find(card =>
            card.german === german && card.english === english
        );

        if (!card) {
            return { success: false, message: "Card not found." };
        }

        card.mastered = !card.mastered;
        this.saveFlashcardLists(customLists);

        return {
            success: true,
            message: `Card marked as ${card.mastered ? 'mastered' : 'not mastered'}`,
            mastered: card.mastered
        };
    }

    // Refresh the flashcard lists display
    refreshFlashcardLists() {
        this.populateFlashcardLists();

        // Clear selection if the selected list no longer exists
        if (this.selectedFlashcardList) {
            const customLists = this.getFlashcardLists();
            if (!customLists[this.selectedFlashcardList]) {
                this.selectedFlashcardList = null;
                document.getElementById('selected-list-info').classList.add('hidden');
            }
        }
    }

    // Get statistics for a flashcard list
    getListStats(listName) {
        const list = this.getCardsFromList(listName);
        if (!list) {
            return null;
        }

        const totalCards = list.length;
        const masteredCards = list.filter(card => card.mastered).length;
        const progress = totalCards > 0 ? (masteredCards / totalCards) * 100 : 0;

        return {
            total: totalCards,
            mastered: masteredCards,
            progress: progress.toFixed(1),
            remaining: totalCards - masteredCards
        };
    }

    // Get all list names
    getAllListNames() {
        const customLists = this.getFlashcardLists();
        return Object.keys(customLists);
    }
}