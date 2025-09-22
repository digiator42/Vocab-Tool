// Import/Export Module
export class ImportExportManager {
    constructor() {
        this.init();
    }

    async init() {
        await this.loadInitialData();
        this.setupEventListeners();
    }

    async loadInitialData() {
        let customLists = JSON.parse(localStorage.getItem('customGermanLists') || '{}');
        if (!customLists || Object.keys(customLists).length === 0) {
            try {
                const res = await fetch('/data.json');
                if (res.ok) {
                    const data = await res.json();
                    if (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length > 0) {
                        localStorage.setItem('customGermanLists', JSON.stringify(data));
                        location.reload();
                    }
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
        const customLists = JSON.parse(localStorage.getItem('customGermanLists')) || {};
        const exportData = {};

        for (const [name, cards] of Object.entries(customLists)) {
            exportData[name] = cards.map(c => ({
                german: c.german,
                english: c.english,
                mastered: !!c.mastered
            }));
        }

        const jsonStr = JSON.stringify(exportData, null, 2);
        jsonArea.value = jsonStr;

        // Download as file
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'german-flashcards.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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
            const importedData = JSON.parse(data);
            if (typeof importedData !== 'object' || Array.isArray(importedData)) throw new Error();

            let customLists = JSON.parse(localStorage.getItem('customGermanLists')) || {};
            let importedCount = 0;

            for (const [name, cards] of Object.entries(importedData)) {
                if (Array.isArray(cards) && cards.length && cards[0].german && cards[0].english) {
                    if (!customLists[name]) {
                        customLists[name] = [];
                    }

                    const existing = new Set(customLists[name].map(c => c.german + '|' + c.english));
                    cards.forEach(card => {
                        const key = card.german + '|' + card.english;
                        if (!existing.has(key)) {
                            customLists[name].push({
                                german: card.german,
                                english: card.english,
                                mastered: !!card.mastered
                            });
                            importedCount++;
                        }
                    });
                }
            }

            localStorage.setItem('customGermanLists', JSON.stringify(customLists));
            jsonArea.value = data;
            location.reload();

            this.showNotification(`Imported ${importedCount} new flashcards${type === 'text' ? ' from text' : ''}.`);
        } catch {
            jsonArea.value = "Invalid JSON format.";
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