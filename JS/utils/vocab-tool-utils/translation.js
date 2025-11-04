// JS/translation.js
export class TranslationService {
    constructor(main) {
        this.main = main;
        this.useOfflineTranslate = false;
        this.offlineApiUrl = 'http://127.0.0.1:5000';

        window.trans = this;
    }

    joinTranslationChunks(data) {
        if (!Array.isArray(data?.[0])) return "(error)";
        return data[0].map(chunk => chunk[0].replace(/\n/g, " ")).join(" ");
    }

    async translate(text, article = false, extended = false) {
        // Try offline LibreTranslate first if enabled
        if (this.useOfflineTranslate) {
            try {
                const offlineResult = await this.translateOffline(text, article, extended);
                if (offlineResult && offlineResult !== "(error)") {
                    return offlineResult;
                }
            } catch (error) {
                console.log('Offline translation failed, falling back to online:', error);
            }
        }

        // Fallback to Google Translate
        return this.translateOnline(text, article, extended);
    }

    async translateOffline(text, article = false, extended = false) {
        try {
            // LibreTranslate API format
            const payload = {
                q: text,
                source: article ? 'en' : 'de',
                target: article ? 'de' : this.main.selectedLang,
                format: 'text',
                alternatives: 3
            };

            const response = await fetch(`${this.offlineApiUrl}/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            console.log('------->> ', data);

            // // For now, return basic translation
            if (extended) {
                // You might need to implement additional endpoints for extended data
                return {
                    sentences: [{ trans: data.translatedText, orig: text }],
                    // Faking google api response
                    dict: { pos: '', terms: data?.alternatives, entry: '' },
                    examples: {}
                };
            }

            return data.translatedText;

        } catch (error) {
            console.error('LibreTranslate error:', error);
            throw error; // Let the caller handle fallback
        }
    }

    async translateOnline(text, article = false, extended = false) {
        try {
            let res = '';
            if (article) {
                res = await fetch(
                    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=de&dt=t&q=" +
                    encodeURIComponent(text)
                );
            } else if (extended) {
                res = await fetch(
                    "https://translate.googleapis.com/translate_a/single?dt=t&dt=bd&dt=qc&dt=rm&dt=ex&client=gtx&hl=en&sl=de&tl=" +
                    encodeURIComponent(this.main.selectedLang) +
                    "&q=" + encodeURIComponent(text) + "&dj=1"
                );
            } else {
                res = await fetch(
                    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=de&tl=" +
                    encodeURIComponent(this.main.selectedLang) +
                    "&dt=t&q=" + encodeURIComponent(text)
                );
            }
            const data = await res.json();

            if (extended) {
                return data;
            } else {
                return this.joinTranslationChunks(data);
            }
        } catch {
            return extended ? null : "(error)";
        }
    }

    // Method to toggle between offline/online translation
    setTranslationMode(useOffline) {
        this.useOfflineTranslate = useOffline;
    }

    // Method to check if LibreTranslate is available
    async checkOfflineAvailability() {
        try {
            const response = await fetch(`${this.offlineApiUrl}/languages`, {
                method: 'GET',
                timeout: 5000
            });
            return response.ok;
        } catch {
            return false;
        }
    }
}