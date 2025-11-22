// Main Application Entry Point
import { VocabularyTool } from '../features/vocab-tool.js';
import { FlashcardsTool } from '../features/flashcards-tool.js';
import { ImportExportManager } from '../utils/import-export.js';
import { TabManager } from './tab-manager.js';
import { ExerciseTool } from '../features/exercise-tool.js';
import { germanStories } from '../utils/stories.js';
import { SyncManager } from './sync-manager.js';

const processBtn = document.getElementById("processBtn");

document.addEventListener('DOMContentLoaded', function () {

    if (typeof browser === "undefined") {
        var browser = chrome;
    }

    const toggleBtn = document.getElementById('toggleTheme');

    if (localStorage.getItem('theme') === 'dark-mode') {
        document.body.classList.add('dark-mode');
        toggleBtn.innerHTML = '☀️';
    }

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const isDark = document.body.classList.toggle('dark-mode');
            console.log('Theme toggled. Dark mode:', isDark, document.body.classList);
            toggleBtn.innerHTML = isDark ? '☀️' : '🌙';
            if (isDark) {
                localStorage.setItem('theme', 'dark-mode');
            } else {
                localStorage.removeItem('theme');
            }
        });
    }

    // Initialize all modules
    const tabManager = new TabManager();
    const importExportManager = new ImportExportManager();

    // Initialize tools only when needed
    let vocabTool, flashCardsTool, exerciseTool, syncManager;

    syncManager = new SyncManager();
    window.syncManager = syncManager;

    // Initialize vocabulary tool when its tab is clicked or if it's the default tab
    document.getElementById("tab-vocab").addEventListener("click", () => {
        if (!vocabTool) {
            vocabTool = new VocabularyTool();
        }
    });

    // Initialize flashcards tool when its tab is clicked
    document.getElementById("tab-flash").addEventListener("click", () => {
        if (!flashCardsTool) {
            console.log('Initializing FlashcardsTool...');
            flashCardsTool = new FlashcardsTool();
        }
        // second click on flashcards tab refreshes the custom lists
        flashCardsTool.renderCustomListButtons();
    });

    // Open sync modal
    document.getElementById('open-sync-modal').addEventListener('click', () => {
        document.getElementById('sync-data-modal').classList.remove('hidden');
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
    } else if (params.get('page') === 'vocab') {
        vocabTool = new VocabularyTool();
    } else {
        exerciseTool = new ExerciseTool();
    }


    // Populate story selection dropdown
    const storySelect = document.getElementById('storySelect');
    const storyContainer = document.getElementById('input');

    for (const [key, value] of Object.entries(germanStories)) {
        console.log(key);
        const option = document.createElement('option');
        option.value = key;  // Store the key (story name)
        option.textContent = value.title;
        storySelect.appendChild(option);
    }

    function displayStory() {
        const selectedKey = storySelect.value;  // Get the selected key
        const originalText = germanStories[selectedKey].text;  // Use key to get text from germanStories
        const formattedText = formatStoryText(originalText);
        storyContainer.value = formattedText;

        // Save selected story KEY to localStorage
        localStorage.setItem('lastSelectedStory', selectedKey);
        processBtn.click();  // Trigger processing of the new story
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

            // Check if we've reached 52 words AND the current word ends with a period
            if (wordCount >= 52 && word.endsWith('.')) {
                result.push(currentChunk.join(' '));
                currentChunk = [];
                wordCount = 0;
            }
            // If we've reached 52 words but no period, keep going until we find one
            else if (wordCount >= 52) {
                // Continue adding words until we find a period
                let periodFound = false;
                for (let j = i + 1; j < words.length; j++) {
                    currentChunk.push(words[j]);
                    wordCount++;
                    i = j; // Move the index forward

                    if (words[j].endsWith('.')) {
                        periodFound = true;
                        break;
                    }
                }

                // If we found a period (or reached end), add the chunk
                result.push(currentChunk.join(' '));
                currentChunk = [];
                wordCount = 0;
            }
        }

        // Add any remaining words
        if (currentChunk.length > 0) {
            result.push(currentChunk.join(' '));
        }

        return result.join('\n\n');
    }

    // Load last selected story from localStorage
    function loadLastSelectedStory() {
        const lastStoryKey = localStorage.getItem('lastSelectedStory');
        if (lastStoryKey && germanStories[lastStoryKey]) {
            storySelect.value = lastStoryKey;  // Set the dropdown to the saved key
            displayStory();  // This will get the text from germanStories using the key
        } else {
            // If no saved story or invalid story, load the first one
            storySelect.selectedIndex = 0;
            displayStory();
        }
    }

    storySelect.addEventListener('change', displayStory);

    // Initialize with the last selected story when page loads
    loadLastSelectedStory();


    const hamburger = document.getElementById('hamburger-menu');
    const sidebar = document.getElementById('list-sidebar-container');
    const overlay = document.getElementById('sidebar-overlay');

    // Only show hamburger menu on the flashcard tool and on smaller screens
    function checkFlashcardToolActive() {
        const flashcardTool = document.getElementById('flashcard-tool');
        const isLargeScreen = window.innerWidth > 1024;

        if (!flashcardTool.classList.contains('hidden') && !isLargeScreen) {
            hamburger.style.display = 'flex';
        } else {
            hamburger.style.display = 'none';
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            hamburger.classList.remove('active');
        }
    }

    // Toggle sidebar
    hamburger.addEventListener('click', function () {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
        hamburger.classList.toggle('active');
    });

    // Close sidebar when clicking on overlay
    overlay.addEventListener('click', function () {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        hamburger.classList.remove('active');
    });

    // Check when switching tabs
    document.getElementById('tab-flash').addEventListener('click', function () {
        setTimeout(checkFlashcardToolActive, 100);
    });

    document.getElementById('tab-vocab').addEventListener('click', function () {
        setTimeout(checkFlashcardToolActive, 100);
    });

    document.getElementById('tab-exercise').addEventListener('click', function () {
        setTimeout(checkFlashcardToolActive, 100);
    });

    // Check on window resize
    window.addEventListener('resize', checkFlashcardToolActive);

    // Initial check
    checkFlashcardToolActive();

    document.getElementById('formatTxtBtn').addEventListener('click', function () {
        const text = document.getElementById('input').value;
        const formattedText = formatStoryText(text);
        document.getElementById('input').value = formattedText;
    });
});