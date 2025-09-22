// Main Application Entry Point
import { VocabularyTool } from './vocab-tool.js';
import { FlashcardsTool } from './flashcards-tool.js';
import { ImportExportManager } from './import-export.js';
import { TabManager } from './tab-manager.js';
import { ExerciseTool } from './exercise-tool.js';


document.addEventListener('DOMContentLoaded', function () {
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
});