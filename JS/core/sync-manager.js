// Sync Manager Module
export class SyncManager {
    constructor() {
        this.apiUrl = '/api/sync-flashcards';
        this.setupEventListeners();
    }

    setupEventListeners() {
        const uploadBtn = document.getElementById('upload-data-btn');
        const downloadBtn = document.getElementById('download-data-btn');
        const infoBtn = document.getElementById('sync-info-btn');
        const setPasswordBtn = document.getElementById('set-password-btn');

        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => this.uploadData());
        }
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadData());
        }
        if (infoBtn) {
            infoBtn.addEventListener('click', () => this.getServerInfo());
        }
        if (setPasswordBtn) {
            setPasswordBtn.addEventListener('click', () => this.setPassword());
        }
    }

    async getPassword() {
        // Get password from localStorage or prompt
        let password = localStorage.getItem('syncPassword');

        if (!password) {
            password = prompt('Enter your sync password:');
            if (password) {
                const remember = confirm('Remember password for this session?');
                if (remember) {
                    localStorage.setItem('syncPassword', password);
                }
            }
        }

        return password;
    }

    async uploadData() {
        const password = await this.getPassword();
        if (!password) return;

        try {
            const customLists = JSON.parse(localStorage.getItem('customGermanLists')) || {};
            const srSessionData = JSON.parse(localStorage.getItem('srSessionData')) || {};
            const futureScheduledCards = JSON.parse(localStorage.getItem('futureScheduledCards')) || [];

            if (Object.keys(customLists).length === 0) {
                this.showNotification('No data to upload!');
                return;
            }

            this.showNotification('Uploading data...');

            // For backward compatibility with the server,
            // we need to send the data in the format the server expects
            const uploadData = {
                // Main data (what server expects)
                ...customLists,
                // Add SR data as a special key (won't break old server)
                __srSessionData: srSessionData,
                __futureScheduledCards: futureScheduledCards,
                __metadata: {
                    totalLists: Object.keys(customLists).length,
                    totalCards: this.calculateTotalCards(customLists),
                    totalSRSessions: Object.keys(srSessionData).length,
                    totalFutureScheduled: futureScheduledCards.length,
                    timestamp: new Date().toISOString()
                }
            };

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'upload',
                    data: uploadData,  // Send as flat object for compatibility
                    password: password,
                    timestamp: new Date().toISOString()
                })
            });

            const result = await response.json();

            if (result.success) {
                // Store local copy of what we uploaded for reference
                localStorage.setItem('lastUploadStats', JSON.stringify({
                    totalLists: Object.keys(customLists).length,
                    totalCards: this.calculateTotalCards(customLists),
                    timestamp: new Date().toISOString()
                }));

                this.showNotification(
                    `✅ Upload successful! ${result.listsCount} lists, ${result.totalCards} cards.`
                );
            } else {
                this.showNotification(`❌ Upload failed: ${result.error}`);
                // Clear stored password if it's wrong
                if (result.error === 'Unauthorized') {
                    localStorage.removeItem('syncPassword');
                }
            }
        } catch (error) {
            console.error('Upload error:', error);
            this.showNotification('❌ Upload failed. Check console for details.');
        }
    }

    async downloadData() {
        const password = await this.getPassword();
        if (!password) return;

        try {
            this.showNotification('Downloading data...');

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'download',
                    password: password
                })
            });

            const result = await response.json();

            if (result.success) {
                const existingLists = JSON.parse(localStorage.getItem('customGermanLists')) || {};
                const existingSRData = JSON.parse(localStorage.getItem('srSessionData')) || {};
                const existingFutureCards = JSON.parse(localStorage.getItem('futureScheduledCards')) || [];

                // Extract data from server response
                const serverLists = {};
                let serverSRData = {};
                let serverFutureCards = [];

                // Separate regular lists from special data
                for (const key in result.data) {
                    if (key === '__srSessionData') {
                        serverSRData = result.data[key] || {};
                    } else if (key === '__futureScheduledCards') {
                        serverFutureCards = result.data[key] || [];
                    } else if (key === '__metadata') {
                        // Ignore metadata for now
                        continue;
                    } else {
                        // This is a regular flashcard list
                        serverLists[key] = result.data[key];
                    }
                }

                // Merge flashcard lists (server data takes priority)
                const mergedLists = { ...existingLists, ...serverLists };

                // Merge SR session data
                const mergedSRData = this.mergeSRData(existingSRData, serverSRData);

                // Merge future scheduled cards
                const mergedFutureCards = this.mergeFutureScheduledCards(
                    existingFutureCards,
                    serverFutureCards
                );

                // Save merged data
                localStorage.setItem('customGermanLists', JSON.stringify(mergedLists));
                localStorage.setItem('srSessionData', JSON.stringify(mergedSRData));
                localStorage.setItem('futureScheduledCards', JSON.stringify(mergedFutureCards));

                this.showNotification(
                    `✅ Download successful! ${result.listsCount} lists, ${result.totalCards} cards downloaded.`
                );

                setTimeout(() => location.reload(), 1500);
            } else {
                this.showNotification(`❌ Download failed: ${result.error}`);
                if (result.error === 'Unauthorized') {
                    localStorage.removeItem('syncPassword');
                }
            }
        } catch (error) {
            console.error('Download error:', error);
            this.showNotification('❌ Download failed. Check console for details.');
        }
    }

    async getServerInfo() {
        const password = await this.getPassword();
        if (!password) return;

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'info',
                    password: password
                })
            });

            const result = await response.json();

            if (result.success) {
                if (result.hasData) {
                    // Check if we have local upload stats for more accuracy
                    const lastUploadStats = localStorage.getItem('lastUploadStats');

                    let message;
                    if (lastUploadStats) {
                        const stats = JSON.parse(lastUploadStats);
                        message = `📊 Server has ${stats.totalLists} lists with ${stats.totalCards} cards`;
                    } else {
                        message = `📊 Server has ${result.listsCount} lists with ${result.totalCards} cards`;
                    }

                    message += `. Last update: ${new Date(result.timestamp).toLocaleString()}`;

                    this.showNotification(message);
                } else {
                    this.showNotification('📊 No data found on server.');
                }
            } else {
                this.showNotification(`❌ Info check failed: ${result.error}`);
                if (result.error === 'Unauthorized') {
                    localStorage.removeItem('syncPassword');
                }
            }
        } catch (error) {
            console.error('Info check error:', error);
            this.showNotification('❌ Info check failed.');
        }
    }

    setPassword() {
        localStorage.removeItem('syncPassword');
        this.showNotification('Password cleared. You will be prompted next time.');
    }

    showNotification(message) {
        const notif = document.createElement('div');
        notif.textContent = message;
        notif.className = "fixed top-6 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded shadow z-50 text-sm";
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 5000);
    }

    // Helper methods

    calculateTotalCards(customLists) {
        let total = 0;
        for (const listName in customLists) {
            if (Array.isArray(customLists[listName])) {
                total += customLists[listName].length;
            }
        }
        return total;
    }

    mergeSRData(existing, downloaded) {
        const merged = { ...downloaded };

        // For each SR entry, keep the most recent progress
        for (const cardKey in existing) {
            const existingData = existing[cardKey];
            const downloadedData = downloaded[cardKey];

            if (downloadedData) {
                // Both exist - keep the one with the most recent review
                const existingLastReview = existingData.lastReviewed || 0;
                const downloadedLastReview = downloadedData.lastReviewed || 0;

                if (existingLastReview > downloadedLastReview) {
                    merged[cardKey] = existingData;
                }
            } else {
                // Only exists locally - add it
                merged[cardKey] = existingData;
            }
        }

        return merged;
    }

    mergeFutureScheduledCards(existing, downloaded) {
        const seen = new Set();
        const merged = [];

        // Helper function to create a unique key for a scheduled card
        const getCardKey = (item) => {
            return `${item.card?.german}|${item.card?.english}|${item.scheduledTime}`;
        };

        // Add downloaded cards first (server data takes priority)
        if (Array.isArray(downloaded)) {
            downloaded.forEach(item => {
                const key = getCardKey(item);
                if (!seen.has(key)) {
                    seen.add(key);
                    merged.push(item);
                }
            });
        }

        // Add local cards that don't conflict
        if (Array.isArray(existing)) {
            existing.forEach(item => {
                const key = getCardKey(item);
                if (!seen.has(key)) {
                    seen.add(key);
                    merged.push(item);
                }
            });
        }

        // Sort by scheduled time
        merged.sort((a, b) => a.scheduledTime - b.scheduledTime);

        return merged;
    }
}