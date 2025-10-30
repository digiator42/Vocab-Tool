// JS/speech.js
export class SpeechService {
    constructor(main) {
        this.main = main;
    }

    speak(text, lang = "de", slow = this.main.useSlowVoice) {
        return new Promise((resolve) => {
            console.log('Loading speech for:', text, 'in', lang);
            if (lang === null || text === '' || this.main.isStopSpeechRequested) {
                resolve();
                return;
            }
            this.main.setStatus("Loading audio...");

            try {
                if (this.main.useOfflineSpeak) {
                    console.log('========Offline Speaking Mode=========', this.main)
                    const selectedVoiceName = this.main.voiceSelect.value;
                    this.speakText(text, selectedVoiceName, this.main.rate);
                    resolve(); //
                    return;
                }
                const url = `/api/tts?text=${encodeURIComponent(text)}&lang=${lang}&slow=${slow}`;
                const audio = new Audio(url);
                audio.play();
                audio.onplaying = () => this.main.setStatus("Speaking...");
                audio.onended = () => {
                    this.main.setStatus("Ready");
                    resolve();
                };
                audio.onerror = () => {
                    this.main.setStatus("Speech error");
                    resolve();
                };
            } catch {
                this.main.setStatus("Speech error, System voice");
                const selectedVoiceName = this.main.voiceSelect.value;
                this.speakText(text, selectedVoiceName, this.main.rate);
                resolve();
            }
        });
    }

    findGermanVoices() {
        const voices = this.main.speechSynth.getVoices();
        this.main.germanVoices = voices.filter(voice => voice.lang.startsWith('de-'));
        console.log('Available German voices:', this.main.germanVoices.map(v => v.name));
    }

    loadVoices() {
        console.log('Loading voices...');

        const voiceChangeHandler = () => {
            this.findGermanVoices();
            this.populateVoiceDropdown();
        };

        window.speechSynthesis.onvoiceschanged = voiceChangeHandler;

        if (this.main.speechSynth.getVoices().length > 0) {
            voiceChangeHandler();
        }
    }

    getAvailableVoices() {
        return this.main.germanVoices;
    }

    speakText(text, voiceName, rate = 1) {
        if (!text.trim()) return;
        this.main.speechSynth.cancel();
        this.main.utterance = new SpeechSynthesisUtterance(text);
        this.main.utterance.lang = 'de-DE';
        this.main.utterance.rate = rate;

        console.log('Selected voice name:', voiceName);

        const selectedVoice = this.main.germanVoices.find(voice => voice.name === voiceName);
        if (selectedVoice) {
            this.main.utterance.voice = selectedVoice;
        } else {
            console.warn(`Voice "${voiceName}" not found. Falling back to default German voice.`);
        }

        this.main.utterance.onend = () => {
            this.main.isSpeaking = false;
            this.main.isPaused = false;
            this.main.utterance = null;
            if (this.main.playBtn) this.main.playBtn.textContent = 'Play';
            const focusModePlayBTN = document.getElementById("focus-play-btn");
            if (focusModePlayBTN) focusModePlayBTN.textContent = 'Play';
        };

        this.main.speechSynth.speak(this.main.utterance);
        this.main.isSpeaking = true;
        if (this.main.playBtn) this.main.playBtn.textContent = 'Pause';
        const focusModePlayBTN = document.getElementById("focus-play-btn");
        if (focusModePlayBTN) focusModePlayBTN.textContent = 'Pause';
    }

    populateVoiceDropdown() {
        if (!this.main.voiceSelect) return;
        if (this.getAvailableVoices().length === 0) {
            console.warn('Voices not yet loaded. Cannot populate dropdown.');
            return;
        }

        this.main.voiceSelect.innerHTML = '';
        this.getAvailableVoices().forEach(voice => {
            const option = document.createElement('option');
            option.textContent = voice.name;
            option.value = voice.name;
            if (voice.name.includes('Killian')) {
                option.selected = true;
            }
            this.main.voiceSelect.appendChild(option);
        });
    }

    stopSpeech() {
        this.main.isStopSpeechRequested = !this.main.isStopSpeechRequested;
        const focusModeStopBtn = document.getElementById("focus-stop-btn");

        const stopSpeecBtn = document.getElementById("stopSpeechBtn");
        if (this.main.isStopSpeechRequested) {
            stopSpeecBtn.innerHTML = 'Activate Speech';
            if (focusModeStopBtn) focusModeStopBtn.innerText = stopSpeecBtn.innerHTML;
            this.main.showNotification("Speech Stopped");
        }
        else {
            stopSpeecBtn.innerHTML = 'Stop Speech';
            if (focusModeStopBtn) focusModeStopBtn.innerText = stopSpeecBtn.innerHTML;
            this.main.showNotification("Speech Activated");
        }
    }
}