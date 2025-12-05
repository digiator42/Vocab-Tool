import { FlashcardsTool } from '../features/flashcards-tool.js';
// Import/Export Module
export class ImportExportManager {
    constructor() {
        this.init();
        this.FCT = new FlashcardsTool();
    }

    async init() {
        await this.loadInitialData();
        this.setupEventListeners();
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

    decodeOutput(output) {
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

    needsSanitization(input) {
        if (typeof input !== 'string') return false;

        // Check for characters that need sanitization
        const unsafePattern = /[&<>"'/]/;
        return unsafePattern.test(input);
    }

    async loadInitialData() {
        let customLists = JSON.parse(localStorage.getItem('customGermanLists') || '{}');
        if (!customLists || Object.keys(customLists).length === 0) {
            try {
                const res = await fetch('/data/data.text');
                if (res.ok) {
                    const data = await res.text();
                    this.FCT.handleAddFlashcards(data, 'Initial Data');
                }
            } catch (e) {
                // Ignore fetch errors
            }
        }
    }

    setupEventListeners() {
        const importBtn = document.getElementById('import-json-btn');
        const importTextBtn = document.getElementById('import-json-text-btn');
        const exportBtn = document.getElementById('export-json-btn');
        const importInput = document.getElementById('import-json-input');
        const jsonArea = document.getElementById('import-export-json-area');

        exportBtn.addEventListener('click', () => this.exportData(jsonArea));
        importBtn.addEventListener('click', () => this.triggerFileImport(importInput));
        importInput.addEventListener('change', (e) => this.handleFileImport(e, jsonArea));
        importTextBtn.addEventListener('click', () => this.handleTextImport(jsonArea));
    }

    exportData(jsonArea) {
        try {
            const customLists = JSON.parse(localStorage.getItem('customGermanLists')) || {};
            const exportData = {};

            for (const [name, cards] of Object.entries(customLists)) {
                // Decode the list name
                const decodedName = this.decodeOutput(name);

                exportData[decodedName] = cards.map(c => ({
                    german: this.decodeOutput(c.german),
                    english: this.decodeOutput(c.english),
                    sentence: this.decodeOutput(c.sentence || ''),
                    sentenceTranslation: this.decodeOutput(c.sentenceTranslation || ''),
                    mastered: !!c.mastered
                }));
            }

            const jsonStr = JSON.stringify(exportData, null, 2);

            // Update the textarea
            if (jsonArea) {
                jsonArea.value = jsonStr;
            }

            // Alternative download method
            this.downloadJSON(jsonStr);

            this.showNotification(`Exported ${Object.keys(exportData).length} lists successfully!`);

        } catch (error) {
            console.error('Export error:', error);
            this.showNotification('Export failed!');
        }
    }

    // Separate method for download to ensure it works
    downloadJSON(jsonStr) {
        // Method 1: Try the standard approach first
        try {
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `german-flashcards-${new Date().toISOString().split('T')[0]}.json`;

            // This part is important for some browsers
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Revoke the object URL after a delay
            setTimeout(() => URL.revokeObjectURL(url), 100);
            return;
        } catch (error) {
            console.warn('Standard download failed, trying alternative method');
        }

        // Method 2: Alternative approach for browsers that block the first method
        try {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonStr);
            const link = document.createElement('a');
            link.href = dataStr;
            link.download = `german-flashcards-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('All download methods failed:', error);
            // Last resort: show the JSON in textarea and let user copy manually
            this.showNotification('Download blocked. Copy JSON from text area manually.');
        }
    }

    triggerFileImport(importInput) {
        importInput.value = "";
        importInput.click();
    }

    handleFileImport(e, jsonArea) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            this.processImportData(evt.target.result, jsonArea, 'file');
        };
        reader.readAsText(file);
    }

    handleTextImport(jsonArea) {
        const text = jsonArea.value.trim();
        if (!text) {
            jsonArea.value = "Paste JSON here first.";
            return;
        }
        this.processImportData(text, jsonArea, 'text');
    }

    processImportData(data, jsonArea, type) {
        try {
            // Trim and validate input
            const trimmedData = data.trim();
            if (!trimmedData) {
                throw new Error('Empty input');
            }

            const importedData = JSON.parse(trimmedData);

            // SANITIZE THE PARSED DATA
            const sanitizedData = {};
            for (const [name, cards] of Object.entries(importedData)) {
                // Only sanitize if the name contains unsafe characters
                const sanitizedName = this.needsSanitization(name) ? this.sanitizeInput(name) : name;

                if (!Array.isArray(cards)) {
                    console.warn(`Skipping "${sanitizedName}" - not an array`);
                    continue;
                }

                sanitizedData[sanitizedName] = cards.map((card, index) => {
                    if (!card || typeof card !== 'object') {
                        console.warn(`Skipping card ${index} in "${sanitizedName}" - not an object`);
                        return null;
                    }

                    return {
                        german: this.needsSanitization(card.german) ? this.sanitizeInput(card.german || '') : (card.german || ''),
                        english: this.needsSanitization(card.english) ? this.sanitizeInput(card.english || '') : (card.english || ''),
                        sentence: this.needsSanitization(card.sentence) ? this.sanitizeInput(card.sentence || '') : (card.sentence || ''),
                        sentenceTranslation: this.needsSanitization(card.sentenceTranslation) ? this.sanitizeInput(card.sentenceTranslation || '') : (card.sentenceTranslation || ''),
                        mastered: !!card.mastered
                    };
                }).filter(card => card !== null);

                if (sanitizedData[sanitizedName].length === 0) {
                    delete sanitizedData[sanitizedName];
                    console.warn(`Removed "${sanitizedName}" - no valid cards after sanitization`);
                }
            }

            // Use the sanitized data instead of the original importedData
            if (Object.keys(sanitizedData).length === 0) {
                throw new Error('No valid lists found after sanitization');
            }

            // Continue with the rest of your function using sanitizedData
            let customLists = JSON.parse(localStorage.getItem('customGermanLists')) || {};
            let importedCount = 0;
            let listCount = 0;

            for (const [name, cards] of Object.entries(sanitizedData)) {
                listCount++;

                if (!customLists[name]) {
                    customLists[name] = [];
                }

                const existing = new Set(customLists[name].map(c => c.german + '|' + c.english));

                cards.forEach((card) => {
                    const key = card.german + '|' + card.english;
                    if (!existing.has(key)) {
                        customLists[name].push(card);
                        importedCount++;
                        existing.add(key);
                    }
                });
            }

            if (listCount === 0) {
                throw new Error('No valid lists found in import data');
            }

            localStorage.setItem('customGermanLists', JSON.stringify(customLists));

            // Display the sanitized data in textarea
            jsonArea.value = JSON.stringify(sanitizedData, null, 2);

            this.showNotification(`Imported ${importedCount} new flashcards from ${listCount} lists${type === 'text' ? ' from text' : ''}.`);

            setTimeout(() => {
                location.reload();
            }, 1000);

        } catch (error) {
            console.error('Import error:', error);
            const errorMessage = error.message || 'Invalid JSON format';
            jsonArea.value = `Import Error: ${errorMessage}\n\nPlease check:\n- JSON syntax is correct\n- Data has { "ListName": [ { "german": "...", "english": "..." } ] } format\n- No trailing commas\n- Proper quotes`;

            this.showNotification(`Import failed: ${errorMessage}`);
        }
    }

    showNotification(message) {
        const notif = document.createElement('div');
        notif.textContent = message;
        notif.className = "fixed top-6 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded shadow z-50";
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 3500);
    }
}