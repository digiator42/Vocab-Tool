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

            if (Object.keys(customLists).length === 0) {
                this.showNotification('No data to upload!');
                return;
            }

            this.showNotification('Uploading data...');

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'upload',
                    data: customLists,
                    srSessionData: srSessionData,
                    password: password, // Send actual password over HTTPS
                    timestamp: new Date().toISOString()
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification(
                    `✅ Upload successful! ${result.listsCount} lists, ${result.totalCards} cards, ${result.totalSRSessions} SR sessions.`
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
                const existingData = JSON.parse(localStorage.getItem('customGermanLists')) || {};
                const mergedData = { ...existingData, ...result.data };

                const existingSRData = JSON.parse(localStorage.getItem('srSessionData')) || {};
                const mergedSRData = { ...existingSRData, ...result.srSessionData };

                localStorage.setItem('customGermanLists', JSON.stringify(mergedData));
                localStorage.setItem('srSessionData', JSON.stringify(mergedSRData));

                this.showNotification(
                    `✅ Download successful! ${result.listsCount} lists, ${result.totalCards} cards, ${result.totalSRSessions} SR sessions downloaded.`
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
                    this.showNotification(
                        `📊 Server has ${result.listsCount} lists with ${result.totalCards} cards and ${result.totalSRSessions} SR sessions. ` +
                        `Last update: ${new Date(result.timestamp).toLocaleString()}`
                    );
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
}