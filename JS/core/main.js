// Main Application Entry Point
import { VocabularyTool } from '../features/vocab-tool.js';
import { FlashcardsTool } from '../features/flashcards-tool.js';
import { ImportExportManager } from '../utils/import-export.js';
import { TabManager } from './tab-manager.js';
import { ExerciseTool } from '../features/exercise-tool.js';
import { germanStories } from '../utils/stories.js';
import { SyncManager } from './sync-manager.js';

const processBtn = document.getElementById("processBtn");
let currentStoryKey = null;

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

    // Initialize sidebars
    initFlashcardSidebar();
    initVocabSidebar();


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

    function debugHamburgerStates() {
        const isLargeScreen = window.innerWidth > 1024;
        console.log('Window width:', window.innerWidth);
        console.log('Is large screen (>1024px):', isLargeScreen);

        const flashcardTool = document.getElementById('flashcard-tool');
        const vocabTool = document.getElementById('vocab-tool');

        console.log('Flashcard tool hidden:', flashcardTool.classList.contains('hidden'));
        console.log('Vocab tool hidden:', vocabTool.classList.contains('hidden'));

        const flashHamburger = document.getElementById('hamburger-menu');
        const vocabHamburger = document.getElementById('vocab-hamburger-menu');

        console.log('Flash hamburger display:', flashHamburger?.style.display);
        console.log('Vocab hamburger display:', vocabHamburger?.style.display);
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

    // Check on window resize
    window.addEventListener('resize', checkSidebarVisibility);

    // Initial check
    checkSidebarVisibility();

    document.getElementById('tab-flash').addEventListener('click', function () {
        setTimeout(checkSidebarVisibility, 100);
    });

    document.getElementById('tab-vocab').addEventListener('click', function () {
        setTimeout(checkSidebarVisibility, 100);
    });

    document.getElementById('tab-exercise').addEventListener('click', function () {
        setTimeout(checkSidebarVisibility, 100);
    });

    document.getElementById('formatTxtBtn').addEventListener('click', function () {
        const text = document.getElementById('input').value;
        const formattedText = formatStoryText(text);
        document.getElementById('input').value = formattedText;
    });

    function initFlashcardSidebar() {
        const hamburger = document.getElementById('hamburger-menu');
        const sidebar = document.getElementById('list-sidebar-container');
        const overlay = document.getElementById('sidebar-overlay');

        if (!hamburger || !sidebar) return;

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
    }

    // Update your initVocabSidebar function:
    function initVocabSidebar() {
        const hamburger = document.getElementById('vocab-hamburger-menu');
        const sidebar = document.getElementById('vocab-stories-sidebar');
        const overlay = document.getElementById('vocab-sidebar-overlay');

        if (!hamburger || !sidebar) return;

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
    }

    // Function to render stories in the sidebar (simplified)
    function renderStoriesInSidebar() {
        const storiesContainer = document.getElementById('stories-list-container');
        if (!storiesContainer) return;

        storiesContainer.innerHTML = '';

        // Sort stories by title
        const sortedStories = Object.entries(germanStories)
            .sort((a, b) => a[1].title.localeCompare(b[1].title));

        sortedStories.forEach(([key, story]) => {
            const storyElement = createStoryElement(key, story);
            storiesContainer.appendChild(storyElement);
        });

        // Mark active story
        const lastStoryKey = localStorage.getItem('lastSelectedStory') || sortedStories[0]?.[0];
        if (lastStoryKey) {
            const activeStory = storiesContainer.querySelector(`[data-story-key="${lastStoryKey}"]`);
            if (activeStory) {
                activeStory.classList.add('active');
                // Load the story
                displayStory(lastStoryKey);
            }
        }
    }

    function createStoryElement(key, story) {
        const div = document.createElement('div');
        div.className = 'story-item';
        div.setAttribute('data-story-key', key);

        // Estimate word count
        const wordCount = estimateWordCount(story.text);

        div.innerHTML = `
            <div class="flex flex-col">
                <div class="text-gray-800 text-xs">${story.title}</div>
                <div class="text-xs text-gray-500 mt-1">${wordCount} words</div>
            </div>
        `;

        div.addEventListener('click', () => {
            // Remove active class from all stories
            document.querySelectorAll('.story-item').forEach(item => {
                item.classList.remove('active');
            });

            // Add active class to clicked story
            div.classList.add('active');

            // Load the story
            displayStory(key);

            // Close sidebar on mobile
            if (window.innerWidth <= 1024) {
                const sidebar = document.getElementById('vocab-stories-sidebar');
                const overlay = document.getElementById('vocab-sidebar-overlay');
                const hamburger = document.getElementById('vocab-hamburger-menu');

                if (sidebar) sidebar.classList.remove('active');
                if (overlay) overlay.classList.remove('active');
                if (hamburger) hamburger.classList.remove('active');
            }
        });

        return div;
    }

    function estimateWordCount(text) {
        if (!text) return 0;
        return text.split(/\s+/).filter(word => word.length > 0).length;
    }

    function displayStory(storyKey) {
        if (!germanStories[storyKey]) return;

        const storyContainer = document.getElementById('input');
        const originalText = germanStories[storyKey].text;
        const formattedText = formatStoryText(originalText);
        storyContainer.value = formattedText;

        // Save selected story KEY to localStorage
        localStorage.setItem('lastSelectedStory', storyKey);
        currentStoryKey = storyKey;

        // Trigger processing of the new story
        if (processBtn) {
            processBtn.click();
        }
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

            if (wordCount >= 52 && word.endsWith('.')) {
                result.push(currentChunk.join(' '));
                currentChunk = [];
                wordCount = 0;
            } else if (wordCount >= 52) {
                let periodFound = false;
                for (let j = i + 1; j < words.length; j++) {
                    currentChunk.push(words[j]);
                    wordCount++;
                    i = j;

                    if (words[j].endsWith('.')) {
                        periodFound = true;
                        break;
                    }
                }

                result.push(currentChunk.join(' '));
                currentChunk = [];
                wordCount = 0;
            }
        }

        if (currentChunk.length > 0) {
            result.push(currentChunk.join(' '));
        }

        return result.join('\n\n');
    }

    document.getElementById('hamburger-menu').addEventListener('click', function () {
        console.log('Hamburger clicked!');
        console.log('Sidebar classes:', document.getElementById('list-sidebar-container').className);
        console.log('Hamburger classes:', this.className);
    });

    function checkSidebarVisibility() {
        const flashcardTool = document.getElementById('flashcard-tool');
        const vocabTool = document.getElementById('vocab-tool');
        const isLargeScreen = window.innerWidth > 1024;

        const flashHamburger = document.getElementById('hamburger-menu');
        const vocabHamburger = document.getElementById('vocab-hamburger-menu');

        // Flashcard hamburger visibility
        if (flashHamburger) {
            if (!flashcardTool.classList.contains('hidden') && !isLargeScreen) {
                flashHamburger.style.display = 'flex';
            } else {
                flashHamburger.style.display = 'none';
                // Also close sidebar if open
                const flashSidebar = document.getElementById('list-sidebar-container');
                const flashOverlay = document.getElementById('sidebar-overlay');
                if (flashSidebar) flashSidebar.classList.remove('active');
                if (flashOverlay) flashOverlay.classList.remove('active');
                flashHamburger.classList.remove('active');
            }
        }

        // Vocabulary hamburger visibility
        if (vocabHamburger) {
            if (!vocabTool.classList.contains('hidden') && !isLargeScreen) {
                vocabHamburger.style.display = 'flex';
            } else {
                vocabHamburger.style.display = 'none';
                // Also close sidebar if open
                const vocabSidebar = document.getElementById('vocab-stories-sidebar');
                const vocabOverlay = document.getElementById('vocab-sidebar-overlay');
                if (vocabSidebar) vocabSidebar.classList.remove('active');
                if (vocabOverlay) vocabOverlay.classList.remove('active');
                vocabHamburger.classList.remove('active');
            }
        }
    }

    // Initialize with the last selected story when page loads
    const lastStoryKey = localStorage.getItem('lastSelectedStory');
    if (lastStoryKey && germanStories[lastStoryKey]) {
        displayStory(lastStoryKey);
    } else {
        const firstStoryKey = Object.keys(germanStories)[0];
        if (firstStoryKey) {
            displayStory(firstStoryKey);
        }
    }

    // Format text button
    document.getElementById('formatTxtBtn').addEventListener('click', function () {
        const text = document.getElementById('input').value;
        const formattedText = formatStoryText(text);
        document.getElementById('input').value = formattedText;
    });

    // Render stories when vocab tab is clicked
    document.getElementById("tab-vocab").addEventListener("click", () => {
        setTimeout(() => {
            renderStoriesInSidebar();
        }, 100);
    });

    // Initial render of stories
    renderStoriesInSidebar();

    setTimeout(debugHamburgerStates, 1500);
});