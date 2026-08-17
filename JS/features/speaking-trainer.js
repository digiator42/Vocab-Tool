// German Speaking Trainer — Gemini-powered speaking practice
export const GERMAN_TRAINER_MODES = {
    tandem_coach: {
        label: 'Tandem Coach',
        systemInstruction: `You are a patient German A2/B1 speaking coach using the Tandem Method (real conversation).
- Ask ONE question at a time: only yes/no questions or questions answerable in 1-3 words.
- Always repeat the user's answer back to them as a perfect, complete German sentence first.
- Only use Präsens and Perfekt tenses. Never use Genitiv or Konjunktiv.
- Keep responses under 15 words.
- Never break character. Stay in German.`,
    },
    rewrite_mess: {
        label: 'Raw Speech Corrector',
        systemInstruction: `You are a strict but encouraging German A2/B1 editor.
- Do NOT translate the text. Rewrite it into correct, simple A2-level German.
- Start with: "Korrekt: " followed by the corrected version.
- Then list the 2 biggest grammar/vocabulary mistakes (or fewer if there are fewer).
- Give exactly ONE short sentence of explanation per mistake.
- Keep everything in German.`,
    },
    sentence_starters: {
        label: 'Sentence Starters',
        systemInstruction: `You are a German A2/B1 fluency coach.
- Provide 5 incomplete German sentence starters from everyday life that the user must complete out loud, for example: "Wenn ich müde bin, ______".
- After the user completes a sentence, confirm it by repeating their full correct sentence.
- Check grammar and word order. Explain a mistake in one short sentence.
- Keep everything in German.`,
    },
};

const ROUTINE_STAGES = [
    {
        index: 0,
        startMin: 0,
        endMin: 5,
        mode: 'rewrite_mess',
        title: 'Voice Ramble',
        desc: 'Speak freely about your day. Don’t worry about mistakes — the coach will correct you.',
    },
    {
        index: 1,
        startMin: 5,
        endMin: 10,
        mode: 'rewrite_mess',
        title: 'Review Corrections',
        desc: 'Read the corrected sentences and the top 2 mistakes the coach listed.',
    },
    {
        index: 2,
        startMin: 10,
        endMin: 15,
        mode: 'rewrite_mess',
        title: 'TTS Repetition',
        desc: 'Listen to your last corrected sentence — it will be played 3 times. Repeat out loud.',
        action: 'tts',
    },
    {
        index: 3,
        startMin: 15,
        endMin: 20,
        mode: 'sentence_starters',
        title: 'Sentence Starters',
        desc: 'Complete 3 sentence starters. Say "weiter" for more starters.',
        action: 'starters',
    },
];

export class SpeakingTrainer {
    constructor() {
        this.apiKey = localStorage.getItem('GEMINI_API_KEY') || '';
        this.currentMode = 'tandem_coach';
        this.messages = [];
        this.genai = null;
        this.recognition = null;
        this.recording = false;
        this.busy = false;
        this.correctedTexts = [];
        this.voiceName = localStorage.getItem('TRAINER_VOICE_NAME') || '';
        this.routine = {
            running: false,
            startedAt: null,
            timerId: null,
            stageIndex: 0,
        };

        this.cacheElements();
        this.setupEventListeners();
        this.renderModeButtons();
        this.renderApiKeyStatus();
        this.initRecognition();
        this.initVoices();
        this.appendWelcome();

        window.speakingTrainer = this;
    }

    cacheElements() {
        this.section = document.getElementById('speaking-trainer');
        this.conversation = document.getElementById('trainer-conversation');
        this.input = document.getElementById('trainer-input');
        this.sendBtn = document.getElementById('trainer-send-btn');
        this.micBtn = document.getElementById('trainer-mic-btn');
        this.modeButtons = this.section.querySelectorAll('.trainer-mode-btn');
        this.settingsBtn = document.getElementById('trainer-settings-btn');
        this.keyDot = document.getElementById('trainer-key-dot');
        this.settingsModal = document.getElementById('trainer-settings-modal');
        this.closeSettingsBtn = document.getElementById('trainer-close-settings');
        this.saveKeyBtn = document.getElementById('trainer-save-key');
        this.keyInput = document.getElementById('trainer-key-input');
        this.keyStatus = document.getElementById('trainer-key-status');
        this.routineToggle = document.getElementById('trainer-routine-toggle');
        this.routineBar = document.getElementById('trainer-routine-bar');
        this.routineStage = document.getElementById('trainer-routine-stage');
        this.routineTimer = document.getElementById('trainer-routine-timer');
        this.voiceSelect = document.getElementById('trainer-voice-select');
        this.voiceTestBtn = document.getElementById('trainer-voice-test');
    }

    setupEventListeners() {
        this.sendBtn.addEventListener('click', () => this.send());
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.send();
            }
        });
        this.micBtn.addEventListener('click', () => this.toggleRecording());
        this.modeButtons.forEach((btn) => {
            btn.addEventListener('click', () => this.selectMode(btn.dataset.mode));
        });
        this.settingsBtn.addEventListener('click', () => this.openSettings());
        this.closeSettingsBtn.addEventListener('click', () => this.closeSettings());
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) this.closeSettings();
        });
        this.saveKeyBtn.addEventListener('click', () => this.onSaveKey());
        this.routineToggle.addEventListener('click', () => this.toggleRoutine());
        if (this.voiceSelect) {
            this.voiceSelect.addEventListener('change', () => {
                this.voiceName = this.voiceSelect.value;
                localStorage.setItem('TRAINER_VOICE_NAME', this.voiceName);
            });
        }
        if (this.voiceTestBtn) {
            this.voiceTestBtn.addEventListener('click', () => this.speakGerman('Hallo! Ich bin eine deutsche Stimme.', 1));
        }
    }

    welcomeFor(modeId) {
        switch (modeId) {
            case 'rewrite_mess':
                return 'Hallo! 📝 Sprich einfach drauflos — auch wenn dein Deutsch holprig ist. Ich schreibe es in korrektes Deutsch um und zeige dir deine 2 größten Fehler.';
            case 'sentence_starters':
                return 'Hallo! ✍️ Sag „Satzanfänge“, und ich gebe dir 5 Satzanfänge zum Vervollständigen.';
            default:
                return 'Hallo! 🎤 Ich bin dein Tandem-Sprachcoach. Ich stelle dir einfache Ja/Nein-Fragen auf Deutsch. Antworte mir!';
        }
    }

    appendWelcome() {
        this.conversation.innerHTML = '';
        this.messages = [];
        const wrapper = document.createElement('div');
        wrapper.className = 'trainer-msg trainer-msg-model';
        wrapper.textContent = this.welcomeFor(this.currentMode);
        this.conversation.appendChild(wrapper);
        this.conversation.scrollTop = this.conversation.scrollHeight;
    }

    renderModeButtons() {
        this.modeButtons.forEach((btn) => {
            const active = btn.dataset.mode === this.currentMode;
            btn.classList.toggle('bg-teal-600', active);
            btn.classList.toggle('text-white', active);
            btn.classList.toggle('border-teal-600', active);
            btn.classList.toggle('bg-white', !active);
            btn.classList.toggle('dark:bg-gray-800', !active);
            btn.classList.toggle('text-gray-700', !active);
            btn.classList.toggle('border-gray-300', !active);
        });
    }

    selectMode(modeId) {
        if (modeId === this.currentMode) return;
        this.currentMode = modeId;
        this.renderModeButtons();
        this.appendWelcome();
    }

    renderApiKeyStatus() {
        const hasKey = !!this.apiKey;
        if (this.keyDot) this.keyDot.classList.toggle('bg-red-500', !hasKey);
        if (this.keyDot) this.keyDot.classList.toggle('bg-green-500', hasKey);
        if (this.keyStatus) {
            this.keyStatus.textContent = hasKey
                ? '✅ API key saved.'
                : '⚠️ No API key set — add one to start chatting.';
        }
        if (this.keyInput) this.keyInput.value = this.apiKey;
    }

    openSettings() {
        this.settingsModal.classList.remove('hidden');
        this.settingsModal.classList.add('flex');
        this.keyInput.focus();
    }

    closeSettings() {
        this.settingsModal.classList.add('hidden');
        this.settingsModal.classList.remove('flex');
    }

    async onSaveKey() {
        const key = this.keyInput.value.trim();
        if (!key) {
            this.keyStatus.textContent = '⚠️ Please enter a key.';
            return;
        }
        this.keyStatus.textContent = '🔍 Testing key…';
        this.saveKeyBtn.disabled = true;
        try {
            const ok = await this.testKey(key);
            if (ok) {
                this.apiKey = key;
                localStorage.setItem('GEMINI_API_KEY', key);
                this.renderApiKeyStatus();
                this.keyStatus.textContent = '✅ Key works! Saved.';
                setTimeout(() => this.closeSettings(), 900);
            } else {
                this.keyStatus.textContent = '❌ Invalid key. Check it and try again.';
            }
        } catch (err) {
            this.keyStatus.textContent = '❌ Could not reach Gemini: ' + (err.message || err);
        } finally {
            this.saveKeyBtn.disabled = false;
        }
    }

    async testKey(key) {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: 'ping' }] }] }),
            }
        );
        return res.ok;
    }

    initRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            this.micBtn.title = 'Web Speech API not supported in this browser';
            this.micBtn.disabled = true;
            this.micBtn.classList.add('opacity-40');
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = 'de-DE';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.continuous = false;
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            const pos = this.insertPos || {
                start: this.input.selectionStart ?? this.input.value.length,
                end: this.input.selectionEnd ?? this.input.value.length,
            };
            this.insertAt(pos.start, pos.end, transcript);
            this.insertPos = null;
            this.setRecording(false);
        };
        recognition.onerror = (e) => {
            console.warn('STT error:', e.error);
            this.setRecording(false);
        };
        recognition.onend = () => this.setRecording(false);
        this.recognition = recognition;
    }

    toggleRecording() {
        if (!this.recognition) {
            alert('Web Speech API is not supported in this browser. Try Chrome or Edge.');
            return;
        }
        if (this.recording) {
            this.recognition.stop();
            this.setRecording(false);
            return;
        }
        this.captureInsertPos();
        try {
            this.recognition.start();
            this.setRecording(true);
        } catch (err) {
            console.warn('Could not start recognition:', err);
        }
    }

    captureInsertPos() {
        this.insertPos = {
            start: this.input.selectionStart ?? this.input.value.length,
            end: this.input.selectionEnd ?? this.input.value.length,
        };
    }

    insertAt(start, end, text) {
        const el = this.input;
        const before = el.value.slice(0, start);
        const after = el.value.slice(end);
        let insert = text.trim();
        if (insert) {
            if (before && !/\s$/.test(before)) insert = ' ' + insert;
            if (after && !/^\s/.test(after)) insert = insert + ' ';
        }
        el.value = before + insert + after;
        const newPos = (before + insert).length;
        el.focus();
        el.setSelectionRange(newPos, newPos);
    }

    setRecording(on) {
        this.recording = on;
        this.micBtn.classList.toggle('trainer-recording', on);
        this.micBtn.textContent = on ? '⏹' : '🎤';
    }

    async send() {
        if (this.busy) return;
        const text = this.input.value.trim();
        if (!text) return;
        this.input.value = '';
        this.busy = true;
        this.sendBtn.disabled = true;
        this.sendBtn.textContent = '…';
        try {
            await this.callGemini(text);
        } finally {
            this.busy = false;
            this.sendBtn.disabled = false;
            this.sendBtn.textContent = 'Send';
        }
    }

    appendMessage(role, text) {
        const wrapper = document.createElement('div');
        wrapper.className = role === 'user' ? 'trainer-msg trainer-msg-user' : 'trainer-msg trainer-msg-model';
        const textNode = document.createElement('span');
        if (role === 'assistant') {
            textNode.innerHTML = this.renderMarkdown(text);
        } else {
            textNode.textContent = text;
        }
        wrapper.appendChild(textNode);
        if (role === 'assistant') {
            const playBtn = document.createElement('button');
            playBtn.className = 'trainer-tts-btn';
            playBtn.textContent = '🔊';
            playBtn.title = 'Play this reply with the selected voice';
            playBtn.addEventListener('click', () => this.speakGerman(text, 1));
            wrapper.appendChild(playBtn);
        }
        this.conversation.appendChild(wrapper);
        this.conversation.scrollTop = this.conversation.scrollHeight;
        this.messages.push({ role, text });
    }

    renderMarkdown(text) {
        return (text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    }

    stripMarkdown(text) {
        return (text || '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*\*/g, '');
    }

    async callGemini(userText) {
        if (!this.apiKey) {
            this.appendMessage('assistant', '⚠️ Bitte setze zuerst deinen Gemini API Key. (Settings button above)');
            return;
        }
        this.appendMessage('user', userText);
        const mode = GERMAN_TRAINER_MODES[this.currentMode];
        const contents = this.messages.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.text }],
        }));
        try {
            const reply = await this.requestGemini(mode.systemInstruction, contents);
            this.appendMessage('assistant', reply);
            if (this.currentMode === 'rewrite_mess') this.correctedTexts.push(reply);
            this.speakGerman(reply, 1);
        } catch (err) {
            this.appendMessage('assistant', '⚠️ ' + (err.message || err));
        }
    }

    async requestGemini(systemInstruction, contents) {
        try {
            if (!this.genai) {
                const mod = await import('https://cdn.jsdelivr.net/npm/@google/genai/+esm');
                this.genai = new mod.GoogleGenAI({ apiKey: this.apiKey });
            }
            const res = await this.genai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents,
                config: { systemInstruction, temperature: 0.3 },
            });
            const text =
                res?.text ||
                (res?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('') ||
                '';
            if (text) return text.trim();
            throw new Error('Empty response from Gemini');
        } catch (err) {
            if (err && err.message && err.message.includes('Empty response')) throw err;
            return this.requestGeminiREST(systemInstruction, contents);
        }
    }

    async requestGeminiREST(systemInstruction, contents) {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(this.apiKey)}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_instruction: { parts: [{ text: systemInstruction }] },
                    contents,
                    generationConfig: { temperature: 0.3 },
                }),
            }
        );
        if (!res.ok) {
            const errData = await res.json().catch(() => null);
            throw new Error(
                `Gemini error (${res.status}): ${errData?.error?.message || res.statusText}`
            );
        }
        const data = await res.json();
        const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
        if (!text) throw new Error('Empty response from Gemini');
        return text.trim();
    }

    speakGerman(text, times = 1) {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const cleanText = this.stripMarkdown(text);
        const voice = this.getSelectedVoice();
        const speakOnce = (remaining) => {
            if (remaining <= 0) return;
            const utter = new SpeechSynthesisUtterance(cleanText);
            utter.lang = 'de-DE';
            utter.rate = 0.85;
            if (voice) utter.voice = voice;
            utter.onend = () => speakOnce(remaining - 1);
            utter.onerror = () => speakOnce(remaining - 1);
            window.speechSynthesis.speak(utter);
        };
        speakOnce(times);
    }

    initVoices() {
        if (!('speechSynthesis' in window)) {
            if (this.voiceSelect) {
                this.voiceSelect.disabled = true;
                this.voiceSelect.innerHTML = '<option>Speech synthesis not supported</option>';
            }
            if (this.voiceTestBtn) this.voiceTestBtn.disabled = true;
            return;
        }
        this.loadVoices();
        window.speechSynthesis.addEventListener('voiceschanged', () => this.loadVoices());
    }

    loadVoices() {
        if (!this.voiceSelect || !('speechSynthesis' in window)) return;
        const voices = window.speechSynthesis
            .getVoices()
            .filter((v) => v.lang && v.lang.toLowerCase().startsWith('de'));
        const previous = this.voiceSelect.value || this.voiceName;
        this.voiceSelect.innerHTML = '';
        if (voices.length === 0) {
            const opt = document.createElement('option');
            opt.textContent = 'No German voices found';
            opt.disabled = true;
            this.voiceSelect.appendChild(opt);
            this.voiceSelect.disabled = true;
            return;
        }
        this.voiceSelect.disabled = false;
        voices.forEach((v) => {
            const opt = document.createElement('option');
            opt.value = v.name;
            opt.textContent = `${v.name} (${v.lang})`;
            this.voiceSelect.appendChild(opt);
        });
        this.voiceSelect.value =
            previous && voices.some((v) => v.name === previous) ? previous : voices[0].name;
        this.voiceName = this.voiceSelect.value;
    }

    getSelectedVoice() {
        if (!('speechSynthesis' in window)) return null;
        const voices = window.speechSynthesis.getVoices();
        const name = this.voiceSelect ? this.voiceSelect.value : this.voiceName;
        const match = name && voices.find((v) => v.name === name);
        if (match) return match;
        return (
            voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('de')) || null
        );
    }

    playTTSOfLastCorrection() {
        const last = this.correctedTexts[this.correctedTexts.length - 1];
        if (!last) {
            this.routineStage.textContent = '⚠️ No corrected text yet — speak during the Voice Ramble stage first.';
            return;
        }
        this.speakGerman(last, 3);
    }

    async requestStarters() {
        await this.callGemini('Gib mir 5 Satzanfänge für den Alltag.');
    }

    toggleRoutine() {
        if (this.routine.running) {
            this.stopRoutine();
        } else {
            this.startRoutine();
        }
    }

    startRoutine() {
        this.routine.running = true;
        this.routine.startedAt = Date.now();
        this.routineToggle.textContent = 'Stop Routine';
        this.routineToggle.classList.remove('bg-teal-600', 'hover:bg-teal-700');
        this.routineToggle.classList.add('bg-red-600', 'hover:bg-red-700');
        this.applyRoutineStage(0);
        this.routine.timerId = setInterval(() => this.tickRoutine(), 1000);
    }

    stopRoutine() {
        this.routine.running = false;
        clearInterval(this.routine.timerId);
        this.routineToggle.textContent = 'Start Routine';
        this.routineToggle.classList.remove('bg-red-600', 'hover:bg-red-700');
        this.routineToggle.classList.add('bg-teal-600', 'hover:bg-teal-700');
        this.routineTimer.textContent = '';
    }

    tickRoutine() {
        const elapsedMin = (Date.now() - this.routine.startedAt) / 60000;
        if (elapsedMin >= 20) {
            this.stopRoutine();
            this.routineBar.style.width = '100%';
            this.routineStage.textContent = '🎉 Routine complete! Great work.';
            return;
        }
        let idx = 0;
        for (const stage of ROUTINE_STAGES) {
            if (elapsedMin >= stage.startMin) idx = stage.index;
        }
        if (idx !== this.routine.stageIndex) this.applyRoutineStage(idx);
        this.routineBar.style.width = Math.min((elapsedMin / 20) * 100, 100) + '%';
        const remaining = Math.ceil(20 - elapsedMin);
        this.routineTimer.textContent = remaining + ' min left';
    }

    applyRoutineStage(idx) {
        this.routine.stageIndex = idx;
        const stage = ROUTINE_STAGES[idx];
        if (this.currentMode !== stage.mode) {
            this.currentMode = stage.mode;
            this.renderModeButtons();
            this.appendWelcome();
        }
        this.routineStage.textContent = `Stage ${idx + 1}/4 · ${stage.title} — ${stage.desc}`;
        if (stage.action === 'tts') this.playTTSOfLastCorrection();
        if (stage.action === 'starters') this.requestStarters();
    }
}