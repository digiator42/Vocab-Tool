// Tab Manager Module
export class TabManager {
    constructor() {
        this.vocabTab = document.getElementById("tab-vocab");
        this.vocabTool = document.getElementById("vocab-tool");
        this.flashTab = document.getElementById("tab-flash");
        this.flashTool = document.getElementById("flashcard-tool");
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.handleInitialTab();
    }

    setQueryParam(key, value) {
        const url = new URL(window.location);
        url.searchParams.set(key, value);
        window.history.replaceState({}, '', url);
    }

    setupEventListeners() {
        this.vocabTab.addEventListener("click", () => this.switchToVocab());
        this.flashTab.addEventListener("click", () => this.switchToFlashcards());
    }

    handleInitialTab() {
        const params = new URL(window.location).searchParams;
        if (params.get('page') === 'flashcards') {
            this.flashTab.click();
        } else {
            this.vocabTab.click();
        }
    }

    switchToVocab() {
        this.setQueryParam('page', 'vocab');
        this.vocabTool.classList.remove("hidden");
        this.flashTool.classList.add("hidden");
        this.vocabTab.classList.add("bg-blue-700");
        this.flashTab.classList.remove("bg-indigo-700");
    }

    switchToFlashcards() {
        this.setQueryParam('page', 'flashcards');
        this.flashTool.classList.remove("hidden");
        this.vocabTool.classList.add("hidden");
        this.flashTab.classList.add("bg-indigo-700");
        this.vocabTab.classList.remove("bg-blue-700");
    }
}