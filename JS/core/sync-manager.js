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

    validatePassword(password) {
        if (!password || password.length < 8) {
            return false;
        }
        return true;
    }

    async hashPassword(password) {
        // Use SHA-256 to hash the password
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    async getPasswordHash() {
        // Get hashed password from localStorage or prompt for password and hash it
        let passwordHash = localStorage.getItem('syncPasswordHash');

        if (!passwordHash) {
            while (true) {
                const password = prompt('Enter your sync password (minimum 8 characters):');

                if (!password) {
                    // User cancelled
                    return null;
                }

                if (!this.validatePassword(password)) {
                    alert('❌ Password must be at least 8 characters long. Please try again.');
                    continue;
                }

                // Hash the password
                passwordHash = await this.hashPassword(password);

                // Valid password - ask if they want to remember it
                const remember = confirm('Remember password for this session?');
                if (remember) {
                    localStorage.setItem('syncPasswordHash', passwordHash);
                }
                break;
            }
        }

        return passwordHash;
    }

    async uploadData() {
        const passwordHash = await this.getPasswordHash();
        if (!passwordHash) return;

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
                    passwordHash: passwordHash,
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
                // Clear stored password hash if it's wrong
                if (result.error === 'Unauthorized') {
                    localStorage.removeItem('syncPasswordHash');
                }
            }
        } catch (error) {
            console.error('Upload error:', error);
            this.showNotification('❌ Upload failed. Check console for details.');
        }
    }

    async downloadData() {
        const passwordHash = await this.getPasswordHash();
        if (!passwordHash) return;

        try {
            this.showNotification('Downloading data...');

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'download',
                    passwordHash: passwordHash
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
                    localStorage.removeItem('syncPasswordHash');
                }
            }
        } catch (error) {
            console.error('Download error:', error);
            this.showNotification('❌ Download failed. Check console for details.');
        }
    }

    async getServerInfo() {
        const password = await this.getPasswordHash();
        if (!password) return;

        try {

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'info',
                    passwordHash: passwordHash
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
                    localStorage.removeItem('syncPasswordHash');
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