// Tab Manager Module
export class TabManager {
    constructor() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        console.log('Initializing TabManager...');
        this.initializeElements();
        this.setupEventListeners();
        this.handleInitialTab();
    }

    initializeElements() {
        this.vocabTab = document.getElementById("tab-vocab");
        this.vocabTool = document.getElementById("vocab-tool");
        this.flashTab = document.getElementById("tab-flash");
        this.flashTool = document.getElementById("flashcard-tool");
        this.exerciseTab = document.getElementById("tab-exercise");
        this.exerciseTool = document.getElementById("exercise-tool");
    }

    setQueryParam(key, value) {
        const url = new URL(window.location);
        url.searchParams.set(key, value);
        window.history.replaceState({}, '', url);
    }

    setupEventListeners() {
        this.vocabTab.addEventListener("click", () => this.switchToVocab());
        this.flashTab.addEventListener("click", () => this.switchToFlashcards());
        this.exerciseTab.addEventListener("click", () => this.switchToExercises());
    }

    handleInitialTab() {
        const params = new URL(window.location).searchParams;
        const page = params.get('page');

        if (page === 'flashcards') {
            this.flashTab.click();
        } else if (page === 'exercises') {
            this.exerciseTab.click();
        } else {
            this.vocabTab.click();
        }
    }

    switchToVocab() {
        this.setQueryParam('page', 'vocab');
        this.vocabTool.classList.remove("hidden");
        this.flashTool.classList.add("hidden");
        this.exerciseTool.classList.add("hidden");
        this.vocabTab.classList.add("bg-blue-700");
        this.flashTab.classList.remove("bg-indigo-700");
        this.exerciseTab.classList.remove("bg-green-700");
    }

    switchToFlashcards() {
        this.setQueryParam('page', 'flashcards');
        this.flashTool.classList.remove("hidden");
        this.vocabTool.classList.add("hidden");
        this.exerciseTool.classList.add("hidden");
        this.flashTab.classList.add("bg-indigo-700");
        this.vocabTab.classList.remove("bg-blue-700");
        this.exerciseTab.classList.remove("bg-green-700");
    }

    switchToExercises() {
        this.setQueryParam('page', 'exercises');
        this.exerciseTool.classList.remove("hidden");
        this.vocabTool.classList.add("hidden");
        this.flashTool.classList.add("hidden");
        this.exerciseTab.classList.add("bg-green-700");
        this.vocabTab.classList.remove("bg-blue-700");
        this.flashTab.classList.remove("bg-indigo-700");
    }
}