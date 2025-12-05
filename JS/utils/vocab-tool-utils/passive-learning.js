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
        this.currentTranslation = '';
        this.transcriptBuffer = '';
        this.successFound = false;
        this.setupRecognition();
    }

    setupRecognition() {
        if ('webkitSpeechRecognition' in window) {
            this.recognition = new webkitSpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true; // Enable interim results
            this.recognition.lang = 'de-DE';

            this.recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';

                // Rebuild transcript from all results in the session
                for (let i = 0; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                this.transcriptBuffer = finalTranscript;
                const fullText = finalTranscript + interimTranscript;

                const displayEl = document.getElementById('pl-transcript-display');
                if (displayEl) {
                    displayEl.textContent = fullText;
                    displayEl.classList.remove('text-gray-400', 'italic');
                    if (finalTranscript && !interimTranscript) {
                        displayEl.classList.add('text-gray-800');
                        displayEl.classList.remove('text-gray-500');
                    } else {
                        displayEl.classList.add('text-gray-500');
                        displayEl.classList.remove('text-gray-800');
                    }
                }

                // Check for success immediately, but don't fail yet
                this.checkInput(fullText, false);
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error', event.error);
                let msg = 'Error: ' + event.error;

                // If it's a no-speech error but we have some buffer, maybe we can use it?
                // Or if it's just a timeout.
                if (event.error === 'no-speech' && this.transcriptBuffer) {
                    console.log("Recovering from no-speech with buffer:", this.transcriptBuffer);
                    this.checkInput(this.transcriptBuffer, true);
                    return;
                }

                if (event.error === 'not-allowed') {
                    msg = 'Microphone access denied. Please allow microphone access.';
                }

                // Don't show error if we just stopped listening manually or if we successfully validated
                if (event.error !== 'aborted') {
                    this.updateStatus(msg, 'text-red-500');
                }

                this.isListening = false;
                this.updateUI();
            };

            this.recognition.onend = () => {
                this.isListening = false;
                this.updateUI();

                // If we haven't found success yet, validate what we have as final
                if (!this.successFound && this.transcriptBuffer) {
                    this.checkInput(this.transcriptBuffer, true);
                }
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

        if (this.vocabTool.isStopSpeechRequested) {
            const stopSpeechBtn = document.getElementById("stopSpeechBtn");
            this.vocabTool.isStopSpeechRequested = false;
            stopSpeechBtn.innerHTML = 'Stop Speech';
        }

        // Split text into sentences (basic splitting by .!?)
        this.sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        this.sentences = this.sentences.map(s => s.trim()).filter(s => s.length > 0);

        if (this.sentences.length === 0) {
            alert('Could not find any sentences.');
            return;
        }

        if (this.sentences.length > 50) {
            // Split sentences into chunks of max 50 sentences each
            const chunks = [];
            for (let i = 0; i < this.sentences.length; i += 50) {
                chunks.push(this.sentences.slice(i, i + 50));
            }
            this.createChoiceModal(chunks);
            return;
        }

        this.currentIndex = 0;
        this.createModal();
        this.processNextSentence();
    }

    createChoiceModal(chunks) {
        if (this.modal) {
            this.modal.remove();
        }

        this.modal = document.createElement('div');
        this.modal.className = 'fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50';

        let optionsHTML = '';
        chunks.forEach((chunk, index) => {
            const startIndex = index * 50 + 1;
            const endIndex = Math.min((index + 1) * 50, this.sentences.length);
            optionsHTML += `
                <div class="mb-4">
                    <button data-chunk-index="${index}" 
                            class="pl-chunk-btn w-full px-6 py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-left transition-colors group">
                        <div class="flex justify-between items-center">
                            <div>
                                <div class="font-bold text-gray-800 text-lg">Part ${index + 1}</div>
                                <div class="text-sm text-gray-500 mt-1">Sentences ${startIndex} - ${endIndex}</div>
                            </div>
                            <div class="text-gray-400 group-hover:text-blue-500 transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                                </svg>
                            </div>
                        </div>
                        <div class="mt-2 text-sm text-gray-600 italic truncate">
                            "${chunk[0].substring(0, 60)}${chunk[0].length > 60 ? '...' : ''}"
                        </div>
                    </button>
                </div>
            `;
        });

        this.modal.innerHTML = `
            <div class="passive-learning-modal bg-white rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-800">🎧 Passive Learning - Select a Part</h2>
                    <button id="pl-close-btn" class="text-gray-500 hover:text-gray-700">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <div class="mb-4 text-gray-600">
                    <p class="mb-2">Your text contains ${this.sentences.length} sentences, which is too many for one session.</p>
                    <p>Please select a part to practice (max 50 sentences per session):</p>
                </div>

                <div class="max-h-[400px] overflow-y-auto pr-2">
                    ${optionsHTML}
                </div>

                <div class="mt-6 text-center text-sm text-gray-500">
                    You can come back later to practice other parts.
                </div>
            </div>
        `;

        document.body.appendChild(this.modal);

        // Add event listeners to chunk buttons
        document.getElementById('pl-close-btn').onclick = () => this.close();

        const chunkButtons = this.modal.querySelectorAll('.pl-chunk-btn');
        chunkButtons.forEach(btn => {
            btn.onclick = () => {
                const chunkIndex = parseInt(btn.getAttribute('data-chunk-index'));
                const selectedChunk = chunks[chunkIndex];

                // Set the sentences to the selected chunk
                this.sentences = selectedChunk;
                this.currentIndex = 0;

                // Remove the choice modal and create the practice modal
                if (this.modal) {
                    this.modal.remove();
                    this.modal = null;
                }

                this.createModal();
                this.processNextSentence();
            };
        });
    }

    createModal() {
        if (this.modal) {
            this.modal.remove();
        }

        this.modal = document.createElement('div');
        this.modal.className = 'fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50';
        this.modal.innerHTML = `
            <div class="passive-learning-modal bg-white rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-800">🎧 Passive Learning</h2>
                    <button id="pl-close-btn" class="text-gray-500 hover:text-gray-700">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <div class="mb-6 text-center relative">
                    <div class="text-sm text-gray-500">
                        Sentence <span id="pl-progress">1</span> of <span id="pl-total">0</span>
                    </div>

                    <div id="pl-current-sentence"
                        class="text-xl font-medium text-gray-800 min-h-[3em] flex items-center justify-center p-4 bg-gray-50 rounded-lg mt-2 relative">
                        <span id="pl-sentence-text">Ready to start...</span>
                        <!-- Tooltip lives inside here -->
                        <div id="pl-translation"
                            class="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-300 text-gray-800 text-xs italic px-2 py-1 border border-gray-300 rounded opacity-0 transition-opacity duration-200">
                            Translation goes here
                        </div>
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

                    <div class="w-full max-w-md min-h-[3rem] flex items-center justify-center">
                        <div id="pl-transcript-display" class="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-lg text-center text-lg text-gray-700 min-h-[3rem] flex items-center justify-center transition-all">
                            <span class="text-gray-400 italic">Spoken text will appear here...</span>
                        </div>
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

        // Get translation
        try {
            this.currentTranslation = await this.vocabTool.translate(sentence);
        } catch (e) {
            console.error("Translation failed", e);
            this.currentTranslation = "Translation unavailable";
        }

        this.updateUI(sentence);

        // Reset state for new sentence
        this.playCount = 0;
        this.transcriptBuffer = '';
        const displayEl = document.getElementById('pl-transcript-display');
        if (displayEl) {
            displayEl.innerHTML = '<span class="text-gray-400 italic">Spoken text will appear here...</span>';
            displayEl.classList.remove('text-gray-800', 'text-gray-500');
        }

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

        this.transcriptBuffer = '';
        this.successFound = false;
        const displayEl = document.getElementById('pl-transcript-display');
        if (displayEl) {
            displayEl.innerHTML = '<span class="text-gray-400 italic">Listening...</span>';
            displayEl.classList.remove('text-gray-800', 'text-gray-500');
        }
        this.recognition.start();
        this.isListening = true;
        this.updateStatus('Listening...', 'text-red-600');
        this.updateUI();
    }

    checkInput(transcript, isFinalCheck) {
        if (!transcript) return;

        const target = this.sentences[this.currentIndex];
        const normalizedTranscript = transcript.toLowerCase().replace(/[.,!?]/g, '').trim();
        const normalizedTarget = target.toLowerCase().replace(/[.,!?]/g, '').trim();

        // Levenshtein distance for fuzzy matching
        const distance = this.levenshteinDistance(normalizedTranscript, normalizedTarget);
        const maxLength = Math.max(normalizedTranscript.length, normalizedTarget.length);
        const similarity = 1 - (distance / maxLength);

        // Allow 80% similarity or max 2 character difference
        const isCorrect = similarity >= 0.8 || distance <= 2;

        const feedbackEl = document.getElementById('pl-feedback');
        feedbackEl.classList.remove('hidden', 'bg-green-100', 'text-green-800', 'bg-red-100', 'text-red-800');

        if (isCorrect) {
            this.successFound = true;
            this.recognition.stop(); // Stop listening

            feedbackEl.textContent = `Correct! You said: "${transcript}"`;
            feedbackEl.classList.add('bg-green-100', 'text-green-800');
            this.updateStatus('Great job!', 'text-green-600');

            setTimeout(() => {
                this.nextSentence();
            }, 1500);
        } else {
            feedbackEl.innerHTML = `
                <div>You said: "${transcript}"</div>
                <div class="text-sm mt-1">Target: "${target}"</div>
            `;
            feedbackEl.classList.add('bg-red-100', 'text-red-800');
            this.updateStatus('Try again', 'text-red-600');
        }
        // If not correct and not final check, do nothing (keep listening)
    }

    levenshteinDistance(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;

        const matrix = [];

        // increment along the first column of each row
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        // increment each column in the first row
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        // Fill in the rest of the matrix
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        Math.min(
                            matrix[i][j - 1] + 1, // insertion
                            matrix[i - 1][j] + 1 // deletion
                        )
                    );
                }
            }
        }

        return matrix[b.length][a.length];
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
            const sentenceTextEl = document.getElementById('pl-sentence-text');
            if (sentenceTextEl) {
                sentenceTextEl.textContent = sentence;
            }
        }

        if (this.currentTranslation) {
            document.getElementById('pl-translation').textContent = this.currentTranslation;
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
