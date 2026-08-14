// Main Application Entry Point
import { VocabularyTool } from '../features/vocab-tool.js';
import { FlashcardsTool } from '../features/flashcards-tool.js';
import { ImportExportManager } from '../utils/import-export.js';
import { TabManager } from './tab-manager.js';
import { ExerciseTool } from '../features/exercise-tool.js';
import { germanStories } from '../utils/stories.js';
// import { aiStories } from '../utils/stories.js';
import { netzwerkA2Stories } from '../utils/netzwerk-a2-stories.js';
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
        if (!flashCardsTool) {
            console.log('Initializing FlashcardsTool...');
            flashCardsTool = new FlashcardsTool();
        }
    } else if (params.get('page') === 'vocab') {
        if (!vocabTool) {
            vocabTool = new VocabularyTool();
        }
    } else {
        if (!exerciseTool) {
            exerciseTool = new ExerciseTool();
        }
    }

    const importExportManager = new ImportExportManager(flashCardsTool);


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
        exitPdfModeIfActive();
        processBtn.click();  // Trigger processing of the new story
    }

    // If a PDF or imported website is currently open in the vocab tool, close
    // it before loading a story
    function exitPdfModeIfActive() {
        if (!window.vocabTool) return;
        const vt = window.vocabTool;
        if (vt.webMode && typeof vt.exitWebMode === 'function') {
            vt.exitWebMode();
            return;
        }
        if (vt.pdfMode && typeof vt.exitPdfMode === 'function') {
            vt.exitPdfMode();
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
    function renderStoriesInSidebar(filter, stories) {
        if (!stories) {
            stories = germanStories;
        }

        const storiesContainer = document.getElementById('stories-list-container');
        if (!storiesContainer) return;

        storiesContainer.innerHTML = '';

        // Sort stories by title
        const sortedStories = Object.entries(stories)
            .sort((a, b) => a[1].title.localeCompare(b[1].title));

        sortedStories.forEach(([key, story]) => {
            if (filter && !story.title.toLowerCase().includes(filter.toLowerCase())) {
                return;
            }

            const { storyElement, colorClass } = createStoryElement(key, story);
            storiesContainer.appendChild(storyElement);
            storyElement.classList.add(colorClass);
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

    function renderTextsInSidebar(filter, texts = netzwerkA2Stories) {
        const storiesContainer = document.getElementById('stories-list-container');
        if (!storiesContainer) return;

        storiesContainer.innerHTML = '';

        Object.entries(texts).forEach(([level, pages]) => {
            Object.entries(pages).forEach(([pageRange, stories]) => {
                // Check if any story in this page matches the filter
                const filteredStories = Object.entries(stories).filter(([storyKey, story]) => {
                    return !filter || story.title.toLowerCase().includes(filter.toLowerCase());
                });

                if (filteredStories.length === 0) return;

                // Create one combined story for the entire page range
                const combinedStory = {
                    title: `${pageRange} - ${level}`,
                    // Combine all texts with double line breaks
                    text: filteredStories.map(([storyKey, story]) =>
                        `${story.title}\n\n${story.text}`
                    ).join('\n\n\n\n') // Double line break between stories
                };

                const storyKey = `${level}-${pageRange.replace(/\s+/g, '-').toLowerCase()}`;
                // Pass pageRange as the 4th parameter
                const { storyElement, colorClass } = createTextElement(storyKey, combinedStory, level, pageRange);

                storyElement.addEventListener('click', () => {
                    // Pass all story keys for this page
                    displayNetzwerkA2CombinedStory(level, pageRange, filteredStories.map(s => s[0]));
                });

                storiesContainer.appendChild(storyElement);
                storyElement.classList.add(colorClass);
            });
        });
    }

    // Update createTextElement to accept pageRange
    function createTextElement(key, story, level, pageRange) {
        const div = document.createElement('div');
        div.className = 'story-item';
        div.setAttribute('data-story-key', key);

        // Estimate word count using story.text
        const wordCount = estimateWordCount(story.text);

        let colorClass = 'bg-gray-800';
        if (level === 'A1') {
            colorClass = 'bg-green-200';
        } else if (level === 'A2/B1') {
            colorClass = 'bg-sky-200';
        } else if (level === 'A2') {
            colorClass = 'bg-yellow-200';
        } else if (level === 'B1') {
            colorClass = 'bg-purple-200';
        }

        // Calculate number of texts in this page range
        const numTexts = pageRange && netzwerkA2Stories[level] && netzwerkA2Stories[level][pageRange]
            ? Object.keys(netzwerkA2Stories[level][pageRange]).length
            : 0;

        div.innerHTML = `
        <div class="flex flex-col">
            <div class="text-xs font-medium">${story.title}</div>
            <div class="text-xs text-gray-500 mt-1">
                ${numTexts} texts • ${wordCount} words
            </div>
        </div>
    `;

        div.addEventListener('click', () => {
            // Remove active class from all stories
            document.querySelectorAll('.story-item').forEach(item => {
                item.classList.remove('active');
            });

            // Add active class to clicked story
            div.classList.add('active');
        });

        return { storyElement: div, colorClass };
    }

    // New function to display combined story
    function displayNetzwerkA2CombinedStory(level, pageRange, storyKeys) {
        if (!netzwerkA2Stories[level] || !netzwerkA2Stories[level][pageRange]) return;

        const storyContainer = document.getElementById('input');
        let combinedText = '';

        // Combine all stories from this page
        storyKeys.forEach(storyKey => {
            const story = netzwerkA2Stories[level][pageRange][storyKey];
            if (story) {
                combinedText += `${story.title}\n\n${story.text}\n\n\n\n`;
            }
        });

        // Remove the last extra line breaks
        combinedText = combinedText.trim();

        // const formattedText = formatStoryText(combinedText);
        storyContainer.value = combinedText;

        // Save selected story information to localStorage
        localStorage.setItem('lastSelectedStory', `${level}-${pageRange}`);
        currentStoryKey = `${level}-${pageRange}`;

        // Trigger processing of the new story
        exitPdfModeIfActive();
        if (processBtn) {
            processBtn.click();
        }
    }

    function createStoryElement(key, story) {
        const div = document.createElement('div');
        div.className = 'story-item';
        div.setAttribute('data-story-key', key);

        // Estimate word count
        const wordCount = estimateWordCount(story.text);

        let colorClass = 'bg-gray-800';
        if (story.title.includes('A1')) {
            colorClass = 'bg-green-200';
        } else if (story.title.includes('A2/B1')) {
            colorClass = 'bg-sky-200';
        } else if (story.title.includes('A2')) {
            colorClass = 'bg-yellow-200';
        } else if (story.title.includes('B1')) {
            colorClass = 'bg-purple-200';
        }

        div.innerHTML = `
            <div class="flex flex-col">
                <div class="text-xs">${story.title}</div>
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

        return { storyElement: div, colorClass };
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
        exitPdfModeIfActive();
        if (processBtn) {
            processBtn.click();
        }
    }

    function displayNetzwerkA2Story(level, pageRange, storyKey) {
        if (!netzwerkA2Stories[level][pageRange][storyKey]) return;

        const storyContainer = document.getElementById('input');
        const originalText = netzwerkA2Stories[level][pageRange][storyKey].text;
        const formattedText = formatStoryText(originalText);
        storyContainer.value = formattedText;

        // Save selected story KEY to localStorage
        localStorage.setItem('lastSelectedStory', storyKey);
        currentStoryKey = storyKey;

        // Trigger processing of the new story
        exitPdfModeIfActive();
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

    // AI Stories button
    document.getElementById('ai-stories-btn').addEventListener('click', () => {
        renderStoriesInSidebar(null, germanStories);
    });

    // Netzwerk neu A2 button
    document.getElementById('netzwerk-a2-btn').addEventListener('click', () => {
        renderTextsInSidebar(null, netzwerkA2Stories);
    });

    // Filter buttons
    document.getElementById('filter-all').addEventListener('click', () => {
        renderStoriesInSidebar();
    });
    document.getElementById('filter-a1').addEventListener('click', () => {
        renderStoriesInSidebar('A1');
    });
    document.getElementById('filter-a2').addEventListener('click', () => {
        renderStoriesInSidebar('A2');
    });
    document.getElementById('filter-b1').addEventListener('click', () => {
        renderStoriesInSidebar('B1');
    });
    document.getElementById('filter-b2').addEventListener('click', () => {
        renderStoriesInSidebar('B2');
    });

    setTimeout(debugHamburgerStates, 1500);
});