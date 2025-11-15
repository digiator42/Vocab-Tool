// JS/speech.js
export class SpeechService {
    constructor(main) {
        this.main = main;
        this.germanVoices = [];
    }

    speak(text, lang = "de", slow = this.main.useSlowVoice, isFullText = false) {
        return new Promise((resolve) => {
            console.log('Loading speech for:', text, 'in', lang, 'Full text:', isFullText);
            if (lang === null || text === '' || this.main.isStopSpeechRequested) {
                resolve();
                return;
            }
            this.main.setStatus("Loading audio...");

            try {
                if (this.main.useOfflineSpeak) {
                    console.log('========Offline Speaking Mode=========', this.main)
                    const selectedVoiceName = this.main.voiceSelect.value;
                    // Use different function based on whether it's full text or selection
                    if (isFullText) {
                        this.speakText(text, selectedVoiceName, this.main.rate, true);
                    } else {
                        this.speakSelectedText(text, selectedVoiceName, this.main.rate);
                    }
                } else {
                    console.log('online speak', slow ? 'Slow voice is activated' : 'Slow Voice NOT active');
                    const url = `/api/tts?text=${encodeURIComponent(text)}&lang=${lang}&slow=${slow}`;
                    const audio = new Audio(url);
                    audio.play();
                    audio.onplaying = () => this.main.setStatus("Speaking...");
                    audio.onended = () => this.main.setStatus("Ready");
                    audio.onerror = () => this.main.setStatus("Speech error");
                }
            } catch {
                this.main.setStatus("Speech error, System voice");
                const selectedVoiceName = this.main.voiceSelect.value;
                // Use different function based on whether it's full text or selection
                if (isFullText) {
                    this.speakText(text, selectedVoiceName, this.main.rate, true);
                } else {
                    this.speakSelectedText(text, selectedVoiceName, this.main.rate);
                }
            }

            resolve();
        });
    }

    // New function specifically for selected words (no boundary tracking)
    speakSelectedText(text, voiceName, rate = this.rate) {
        if (!text.trim()) return;

        console.log('🔊 Speaking SELECTED text (no highlighting):', text);

        this.main.speechSynth.cancel();
        this.main.stopWordHighlighting();

        this.main.utterance = new SpeechSynthesisUtterance(text);
        this.main.utterance.lang = 'de-DE';
        this.main.utterance.rate = rate;

        const selectedVoice = this.germanVoices.find(voice => voice.name === voiceName);
        if (selectedVoice) {
            this.main.utterance.voice = selectedVoice;
        }

        // NO boundary tracking for selected words

        this.main.utterance.onstart = () => {
            this.main.isSpeaking = true;
            if (this.main.playBtn) this.main.playBtn.textContent = 'Pause';
            const focusModePlayBTN = document.getElementById("focus-play-btn");
            if (focusModePlayBTN) focusModePlayBTN.textContent = 'Pause';
        };

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

    findGermanVoices() {
        const voices = this.main.speechSynth.getVoices();
        this.germanVoices = voices.filter(voice => voice.lang.startsWith('de-'));
        console.log('Available German voices:', this.germanVoices.map(v => v.name));
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
        return this.germanVoices;
    }

    speakText(text, voiceName, rate = this.rate, enableHighlighting = false) {
        if (!text.trim()) return;

        console.log('🔊 Speaking text, highlighting enabled:', enableHighlighting);

        this.main.speechSynth.cancel();
        this.main.stopWordHighlighting();

        this.main.utterance = new SpeechSynthesisUtterance(text);
        this.main.utterance.lang = 'de-DE';
        this.main.utterance.rate = rate;

        const selectedVoice = this.germanVoices.find(voice => voice.name === voiceName);
        if (selectedVoice) {
            this.main.utterance.voice = selectedVoice;
        }

        // ONLY enable boundary tracking for full text highlighting
        if (enableHighlighting) {
            this.main.utterance.onboundary = (event) => {
                if (event.name === 'word') {
                    const charIndex = event.charIndex;
                    const wordLength = event.charLength;

                    this.main.clearAllSpeakingHighlights();

                    const currentWord = text.substring(charIndex, charIndex + wordLength).trim();
                    console.log('🔊 Speaking word:', currentWord, 'at index:', charIndex);

                    this.main.highlightCurrentWordByIndex(charIndex, wordLength);
                }
            };
        }

        this.main.utterance.onstart = () => {
            this.main.isSpeaking = true;
            if (this.main.playBtn) this.main.playBtn.textContent = 'Pause';
            const focusModePlayBTN = document.getElementById("focus-play-btn");
            if (focusModePlayBTN) focusModePlayBTN.textContent = 'Pause';
        };

        this.main.utterance.onend = () => {
            this.main.isSpeaking = false;
            this.main.isPaused = false;
            this.main.utterance = null;
            this.main.stopWordHighlighting();
            if (this.main.playBtn) this.main.playBtn.textContent = 'Play';
            const focusModePlayBTN = document.getElementById("focus-play-btn");
            if (focusModePlayBTN) focusModePlayBTN.textContent = 'Play';
        };

        this.main.utterance.onerror = () => {
            this.main.stopWordHighlighting();
        };

        this.main.speechSynth.speak(this.main.utterance);
        this.main.isSpeaking = true;
        if (this.main.playBtn) this.main.playBtn.textContent = 'Pause';
        const focusModePlayBTN = document.getElementById("focus-play-btn");
        if (focusModePlayBTN) focusModePlayBTN.textContent = 'Pause';
    }

    // Helper method to get spans for a given text
    getSpansForText(text) {
        const allSpans = Array.from(this.main.output.querySelectorAll('span'));
        const words = text.split(/\s+/);
        const matchingSpans = [];

        words.forEach(word => {
            const matchingSpan = allSpans.find(span =>
                span.textContent.trim().toLowerCase() === word.toLowerCase()
            );
            if (matchingSpan) {
                matchingSpans.push(matchingSpan);
            }
        });

        return matchingSpans;
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

        // Stop any ongoing speech immediately
        if (this.main.useOfflineSpeak) {
            // Stop Web Speech API
            this.main.speechSynth.cancel();
            this.main.isSpeaking = false;
            this.main.isPaused = false;
            if (this.main.playBtn) this.main.playBtn.textContent = 'Play';
            const focusModePlayBTN = document.getElementById("focus-play-btn");
            if (focusModePlayBTN) focusModePlayBTN.textContent = 'Play';
        } else {
            // Stop audio element if playing
            const audioElements = document.querySelectorAll('audio');
            audioElements.forEach(audio => {
                audio.pause();
                audio.currentTime = 0;
            });
        }

        if (this.main.isStopSpeechRequested) {
            stopSpeecBtn.innerHTML = 'Activate Speech';
            this.main.playBtn.textContent = 'Play Audio';
            this.main.isSpeaking = !this.main.isSpeaking;
            this.main.speechSynth.cancel();
            if (focusModeStopBtn) focusModeStopBtn.innerText = stopSpeecBtn.innerHTML;
            this.main.showNotification("Speech Stopped");
            this.main.stopWordHighlighting();
        } else {
            stopSpeecBtn.innerHTML = 'Stop Speech';
            if (focusModeStopBtn) focusModeStopBtn.innerText = stopSpeecBtn.innerHTML;
            this.main.showNotification("Speech Activated");
        }
    }
}