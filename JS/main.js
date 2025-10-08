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
        console.log(key);
        const option = document.createElement('option');
        option.value = key;
        option.textContent = value.title;
        storySelect.appendChild(option);
    }

    function displayStory() {
        const originalText = germanStories[storySelect.value].text;
        const formattedText = formatStoryText(originalText);
        storyContainer.value = formattedText;
    }

    function formatStoryText(text) {
        if (!text) return '';

        const words = text.split(/\s+/).filter(word => word.length > 0);
        const result = [];
        let currentChunk = [];
        let wordCount = 0;

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            currentChunk.push(word);
            wordCount++;

            // Check if we've reached or exceeded 52 words
            if (wordCount >= 52) {
                // Look ahead to find the next period
                let periodIndex = -1;

                // Search for the next period in the remaining words
                for (let j = i + 1; j < words.length; j++) {
                    if (words[j].includes('.')) {
                        periodIndex = j;
                        break;
                    }
                }

                // If we found a period nearby, include all words up to that period
                if (periodIndex !== -1 && periodIndex - i <= 15) { // Look up to 15 words ahead
                    // Add all words from current position to the period
                    for (let k = i + 1; k <= periodIndex; k++) {
                        currentChunk.push(words[k]);
                    }
                    i = periodIndex; // Skip ahead to the period
                    result.push(currentChunk.join(' '));
                    currentChunk = [];
                    wordCount = 0;
                } else {
                    // If no nearby period, just split at current position
                    result.push(currentChunk.join(' '));
                    currentChunk = [];
                    wordCount = 0;
                }
            }
        }

        // Add any remaining words
        if (currentChunk.length > 0) {
            result.push(currentChunk.join(' '));
        }

        return result.join('\n\n');
    }

    storySelect.addEventListener('change', displayStory);
});