// Main Application Entry Point
import { VocabularyTool } from './vocab-tool.js';
import { FlashcardsTool } from './flashcards-tool.js';
import { ImportExportManager } from './import-export.js';
import { TabManager } from './tab-manager.js';
import { ExerciseTool } from './exercise-tool.js';
import { germanStories } from './stories.js'

document.addEventListener('DOMContentLoaded', function () {

    if (typeof browser === "undefined") {
        var browser = chrome;
    }

    // Initialize all modules
    const tabManager = new TabManager();
    const importExportManager = new ImportExportManager();

    // Initialize tools only when needed
    let vocabTool, flashCardsTool, exerciseTool;

    // Initialize vocabulary tool when its tab is clicked or if it's the default tab
    document.getElementById("tab-vocab").addEventListener("click", () => {
        if (!vocabTool) {
            vocabTool = new VocabularyTool();
        }
    });

    // Initialize flashcards tool when its tab is clicked
    document.getElementById("tab-flash").addEventListener("click", () => {
        if (!flashCardsTool) {
            flashCardsTool = new FlashcardsTool();
        }
        // second click on flashcards tab refreshes the custom lists
        flashCardsTool.renderCustomListButtons();
    });

    document.getElementById("tab-exercise").addEventListener("click", () => {
        if (!exerciseTool) {
            exerciseTool = new ExerciseTool();
            window.exerciseTool = exerciseTool;
        }
    });

    // Initialize the default tool based on URL parameter
    const params = new URL(window.location).searchParams;
    if (params.get('page') === 'flashcards') {
        flashCardsTool = new FlashcardsTool();
    } else {
        vocabTool = new VocabularyTool();
    }

    // Populate story selection dropdown
    const storySelect = document.getElementById('storySelect');
    const storyContainer = document.getElementById('input');

    for (const [key, value] of Object.entries(germanStories)) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = value.title;
      storySelect.appendChild(option);
    }

    function displayStory() {
      storyContainer.value = germanStories[storySelect.value].text;
    }

    storySelect.addEventListener('change', displayStory);
});