export class PassiveLearningService {
    constructor(vocabTool) {
        this.vocabTool = vocabTool;
        this.sentences = [];
        this.currentIndex = 0;
        this.isListening = false;
        this.recognition = null;
        this.modal = null;
        this.playCount = 0;
        this.maxPlays = 3;
        this.isPlaying = false;
        this.setupRecognition();
    }

    setupRecognition() {
        if ('webkitSpeechRecognition' in window) {
            this.recognition = new webkitSpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'de-DE';

            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                this.validateInput(transcript);
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error', event.error);
                let msg = 'Error: ' + event.error;
                if (event.error === 'not-allowed') {
                    msg = 'Microphone access denied. Please allow microphone access.';
                }
                this.updateStatus(msg, 'text-red-500');
                this.isListening = false;
                this.updateUI();
            };

            this.recognition.onend = () => {
                this.isListening = false;
                this.updateUI();
            };
        } else {
            console.warn('Speech recognition not supported');
        }
    }

    startPassiveLearning(text) {
        if (!text || !text.trim()) {
            alert('No text to process!');
            return;
        }

        // Split text into sentences (basic splitting by .!?)
        this.sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        this.sentences = this.sentences.map(s => s.trim()).filter(s => s.length > 0);

        if (this.sentences.length === 0) {
            alert('Could not find any sentences.');
            return;
        }

        this.currentIndex = 0;
        this.createModal();
        this.processNextSentence();
    }

    createModal() {
        if (this.modal) {
            this.modal.remove();
        }

        this.modal = document.createElement('div');
        this.modal.className = 'fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50';
        this.modal.innerHTML = `
            <div class="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-800">🎧 Passive Learning</h2>
                    <button id="pl-close-btn" class="text-gray-500 hover:text-gray-700">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <div class="mb-8 text-center">
                    <div class="text-sm text-gray-500 mb-2">Sentence <span id="pl-progress">1</span> of <span id="pl-total">0</span></div>
                    <div id="pl-current-sentence" class="text-xl font-medium text-gray-800 min-h-[3em] flex items-center justify-center p-4 bg-gray-50 rounded-lg">
                        Ready to start...
                    </div>
                </div>

                <div class="flex flex-col items-center gap-4">
                    <div id="pl-status" class="text-sm font-medium text-blue-600 h-6"></div>
                    
                    <div class="flex gap-4">
                        <button id="pl-mic-btn" class="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            <span class="text-xl">🎤</span>
                            <span>Speak</span>
                        </button>
                        
                        <button id="pl-skip-btn" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                            Skip
                        </button>
                    </div>

                    <div id="pl-feedback" class="mt-4 p-3 rounded-lg w-full text-center hidden"></div>
                </div>
            </div>
        `;

        document.body.appendChild(this.modal);

        document.getElementById('pl-close-btn').onclick = () => this.close();
        document.getElementById('pl-mic-btn').onclick = () => this.startListening();
        document.getElementById('pl-skip-btn').onclick = () => this.nextSentence();
    }

    async processNextSentence() {
        if (this.currentIndex >= this.sentences.length) {
            this.finish();
            return;
        }

        const sentence = this.sentences[this.currentIndex];
        this.updateUI(sentence);

        // Reset state for new sentence
        this.playCount = 0;
        this.updateStatus('Listen carefully...');

        await this.playSequence(sentence);
    }

    async playSequence(sentence) {
        this.isPlaying = true;
        this.updateUI();

        for (let i = 1; i <= this.maxPlays; i++) {
            if (!this.modal) return; // Stopped
            this.playCount = i;
            this.updateStatus(`Playing ${i}/${this.maxPlays}...`);
            await this.vocabTool.speech.speak(sentence, 'de', this.vocabTool.useOfflineSpeak, false); // Using existing speak method

            if (i < this.maxPlays) {
                await new Promise(r => setTimeout(r, 1000)); // Pause between plays
            }
        }

        this.isPlaying = false;
        this.updateStatus('Now repeat the sentence!');
        this.updateUI();

        // Auto-start listening after plays? Maybe better to let user click button to avoid awkward timing
        // But user asked "allowing the user to say it along after the voice play"
        // Let's enable the mic button and maybe highlight it
    }

    startListening() {
        if (!this.recognition) {
            alert('Speech recognition not supported in this browser.');
            return;
        }
        if (this.isListening) {
            this.recognition.stop();
            return;
        }

        this.recognition.start();
        this.isListening = true;
        this.updateStatus('Listening...', 'text-red-600');
        this.updateUI();
    }

    validateInput(transcript) {
        const target = this.sentences[this.currentIndex];
        const normalizedTranscript = transcript.toLowerCase().replace(/[.,!?]/g, '').trim();
        const normalizedTarget = target.toLowerCase().replace(/[.,!?]/g, '').trim();

        // Simple similarity check (can be improved with Levenshtein distance later if needed)
        const isCorrect = normalizedTranscript === normalizedTarget || normalizedTarget.includes(normalizedTranscript); // Lenient check

        const feedbackEl = document.getElementById('pl-feedback');
        feedbackEl.classList.remove('hidden', 'bg-green-100', 'text-green-800', 'bg-red-100', 'text-red-800');

        if (isCorrect) {
            feedbackEl.textContent = `Correct! You said: "${transcript}"`;
            feedbackEl.classList.add('bg-green-100', 'text-green-800');
            this.updateStatus('Great job!', 'text-green-600');

            setTimeout(() => {
                this.nextSentence();
            }, 1500);
        } else {
            feedbackEl.innerHTML = `
                <div>Not quite. You said: "${transcript}"</div>
                <div class="text-sm mt-1">Target: "${target}"</div>
            `;
            feedbackEl.classList.add('bg-red-100', 'text-red-800');
            this.updateStatus('Try again', 'text-red-600');
        }
    }

    nextSentence() {
        this.currentIndex++;
        document.getElementById('pl-feedback').classList.add('hidden');
        this.processNextSentence();
    }

    updateUI(sentence = null) {
        if (!this.modal) return;

        document.getElementById('pl-progress').textContent = this.currentIndex + 1;
        document.getElementById('pl-total').textContent = this.sentences.length;

        if (sentence) {
            document.getElementById('pl-current-sentence').textContent = sentence;
        }

        const micBtn = document.getElementById('pl-mic-btn');
        micBtn.disabled = this.isPlaying;

        if (this.isListening) {
            micBtn.classList.add('animate-pulse', 'bg-red-600');
            micBtn.classList.remove('bg-blue-600');
            micBtn.innerHTML = '<span class="text-xl">⏹️</span><span>Stop</span>';
        } else {
            micBtn.classList.remove('animate-pulse', 'bg-red-600');
            micBtn.classList.add('bg-blue-600');
            micBtn.innerHTML = '<span class="text-xl">🎤</span><span>Speak</span>';
        }
    }

    updateStatus(text, className = 'text-blue-600') {
        const statusEl = document.getElementById('pl-status');
        if (statusEl) {
            statusEl.className = `text-sm font-medium h-6 ${className}`;
            statusEl.textContent = text;
        }
    }

    finish() {
        if (this.modal) {
            this.modal.innerHTML = `
                <div class="bg-white rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl text-center">
                    <div class="text-5xl mb-4">🎉</div>
                    <h2 class="text-2xl font-bold text-gray-800 mb-2">Session Complete!</h2>
                    <p class="text-gray-600 mb-6">You've practiced all sentences.</p>
                    <button id="pl-finish-btn" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        Close
                    </button>
                </div>
            `;
            document.getElementById('pl-finish-btn').onclick = () => this.close();
        }
    }

    close() {
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
        if (this.recognition) {
            this.recognition.abort();
        }
        this.isPlaying = false;
        this.vocabTool.speech.stopSpeech();
    }
}
