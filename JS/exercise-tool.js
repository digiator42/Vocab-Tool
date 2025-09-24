// Exercise Tool Module
export class ExerciseTool {
    constructor() {
        this.solutions = [];
        this.availableExercises = [];
        this.init();
    }

    async init() {
        console.log('Initializing ExerciseTool...');
        await this.loadAvailableExercises();
        this.setupEventListeners();
        this.createFileBrowser();
        window.exerciseTool = this;
    }

    async loadAvailableExercises() {
        try {
            // Fetch the list of available exercise files
            const response = await fetch('/data/exercises/index.json');
            if (response.ok) {
                this.availableExercises = await response.json();
            } else {
                console.warn('No exercise index found, using default list');
                this.availableExercises = [
                    { name: 'basic_articles.txt', title: 'Basic Articles' },
                    { name: 'verb_conjugation.txt', title: 'Verb Conjugation' },
                    { name: 'prepositions.txt', title: 'Prepositions' }
                ];
            }
        } catch (error) {
            console.error('Error loading exercise list:', error);
            this.availableExercises = [];
        }
    }

    createFileBrowser() {
        const exerciseArea = document.getElementById('exerciseArea');

        // Create file browser section
        const fileBrowser = document.createElement('div');
        fileBrowser.className = 'mb-6 p-4 bg-gray-50 rounded-lg';
        fileBrowser.innerHTML = `
            <h3 class="text-lg font-semibold mb-3">Available Exercises</h3>
            <div class="flex flex-wrap gap-2 mb-3">
                <select id="exerciseSelector" class="flex-1 p-2 border rounded">
                    <option value="">Select an exercise...</option>
                </select>
                <button id="loadExerciseBtn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                    Load Exercise
                </button>
            </div>
            <div class="text-sm text-gray-600">
                Or write your own exercise below using [[answer]] format
            </div>
        `;

        // Insert file browser before the textarea
        const textarea = document.getElementById('exerciseInput');
        textarea.parentNode.insertBefore(fileBrowser, textarea);

        // Populate the dropdown
        this.populateExerciseDropdown();
    }

    populateExerciseDropdown() {
        const selector = document.getElementById('exerciseSelector');
        selector.innerHTML = '<option value="">Select an exercise...</option>';

        this.availableExercises.forEach(exercise => {
            const option = document.createElement('option');
            option.value = exercise.name;
            option.textContent = exercise.title || exercise.name;
            selector.appendChild(option);
        });
    }

    setupEventListeners() {
        // File browser events
        document.addEventListener('click', (e) => {
            if (e.target.matches('#loadExerciseBtn')) {
                this.loadSelectedExercise();
            }
            if (e.target.matches('#checkExercisesBtn')) {
                this.checkAnswers();
            } else if (e.target.matches('#resetExercisesBtn')) {
                this.resetAnswers();
            } else if (e.target.matches('#showSolutionsBtn')) {
                this.showSolutions();
            } else if (e.target.matches('#loadSampleExercisesBtn')) {
                this.loadSampleExercises();
            }
        });

        // Load exercise on Enter key in selector
        document.getElementById('exerciseSelector')?.addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadSelectedExercise();
            }
        });

        // Render exercises button
        const renderBtn = document.getElementById('renderExercisesBtn');
        if (renderBtn) {
            renderBtn.addEventListener('click', () => this.renderExercises());
        }
    }

    async loadSelectedExercise() {
        const selector = document.getElementById('exerciseSelector');
        const fileName = selector.value;

        if (!fileName) {
            alert('Please select an exercise first.');
            return;
        }

        try {
            const response = await fetch(`/data/exercises/${fileName}`);
            if (!response.ok) {
                throw new Error(`File not found: ${fileName}`);
            }

            const content = await response.text();
            document.getElementById('exerciseInput').value = content;

            // Auto-render the exercise
            this.renderExercises();

            // Show success message
            this.showMessage(`Loaded: ${this.getExerciseTitle(fileName)}`, 'success');

        } catch (error) {
            console.error('Error loading exercise:', error);
            this.showMessage(`Error loading exercise: ${error.message}`, 'error');
        }
    }

    getExerciseTitle(fileName) {
        const exercise = this.availableExercises.find(e => e.name === fileName);
        return exercise?.title || fileName;
    }

    showMessage(message, type = 'info') {
        // Remove existing messages
        const existingMsg = document.getElementById('exerciseMessage');
        if (existingMsg) {
            existingMsg.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.id = 'exerciseMessage';
        messageDiv.className = `p-3 rounded mb-4 ${type === 'success' ? 'bg-green-100 text-green-800' :
                type === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-blue-100 text-blue-800'
            }`;
        messageDiv.textContent = message;

        const exerciseArea = document.getElementById('exerciseArea');
        exerciseArea.parentNode.insertBefore(messageDiv, exerciseArea);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }

    renderExercises() {
        const exerciseInput = document.getElementById("exerciseInput");
        const text = document.getElementById("exerciseInput").value;
        const container = document.getElementById("exerciseArea");
        this.solutions = [];

        if (!text.trim()) {
            container.innerHTML = '<p class="text-red-500 p-4 bg-red-50 rounded">Please enter some exercises first.</p>';
            return;
        }

        // Replace [[answer]] with inputs
        let idx = 0;
        const parsed = text.replace(/\[\[(.*?)\]\]/g, (match, ans) => {
            this.solutions.push(ans.trim().toLowerCase());
            return `<input type="text" data-id="${idx++}" 
                class="border p-2 rounded w-32 text-center focus:ring-2 focus:ring-blue-300 transition-colors"/>`;
        });

        container.innerHTML = `
            <div class="prose max-w-none bg-white p-6 rounded-lg border border-gray-200">
                <div class="whitespace-pre-line leading-7 text-gray-800">${parsed}</div>
            </div>
            <div class="mt-6 flex flex-wrap gap-3">
                <button id="checkExercisesBtn" 
                    class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">
                    ✅ Check Answers
                </button>
                <button id="resetExercisesBtn" 
                    class="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition-colors">
                    🔄 Retry
                </button>
                <button id="showSolutionsBtn" 
                    class="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors">
                    📖 Show Solutions
                </button>
                <button onclick="document.getElementById('exerciseInput').value = ''; document.getElementById('exerciseArea').innerHTML = '';" 
                    class="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition-colors">
                    🗑️ Clear Exercise
                </button>
            </div>
        `;

        exerciseInput.value = '';

        document.getElementById("exerciseResult").innerHTML = "";
    }

    checkAnswers() {
        const inputs = document.querySelectorAll("#exerciseArea input[data-id]");
        let correct = 0;

        inputs.forEach(inp => {
            const id = inp.dataset.id;
            const user = inp.value.trim().toLowerCase();
            const sol = this.solutions[id];

            if (user === sol) {
                inp.classList.remove("border-red-500", "bg-red-50");
                inp.classList.add("border-green-500", "bg-green-50", "text-green-800");
                correct++;
            } else {
                inp.classList.remove("border-green-500", "bg-green-50", "text-green-800");
                inp.classList.add("border-red-500", "bg-red-50", "text-red-800");
            }
        });

        const percent = Math.round((correct / this.solutions.length) * 100);
        const resultEl = document.getElementById("exerciseResult");

        let message = `Score: ${correct}/${this.solutions.length} (${percent}%)`;
        if (percent === 100) {
            message += " 🎉 Perfect!";
            resultEl.className = "mt-4 font-semibold text-green-600 text-lg";
        } else if (percent >= 70) {
            message += " 👍 Good job!";
            resultEl.className = "mt-4 font-semibold text-blue-600 text-lg";
        } else {
            resultEl.className = "mt-4 font-semibold text-red-600 text-lg";
        }

        resultEl.innerHTML = `<div class="p-3 rounded-lg bg-gray-50">${message}</div>`;
    }

    resetAnswers() {
        const inputs = document.querySelectorAll("#exerciseArea input[data-id]");
        inputs.forEach(inp => {
            inp.value = "";
            inp.classList.remove("border-green-500", "border-red-500", "bg-green-50", "bg-red-50", "text-green-800", "text-red-800");
            inp.classList.add("border-gray-300", "bg-white");
        });
        document.getElementById("exerciseResult").innerHTML = "";
    }

    showSolutions() {
        const inputs = document.querySelectorAll("#exerciseArea input[data-id]");
        inputs.forEach(inp => {
            const id = inp.dataset.id;
            inp.value = this.solutions[id];
            inp.classList.remove("border-red-500", "bg-red-50", "border-green-500", "bg-green-50");
            inp.classList.add("border-blue-500", "bg-blue-50", "text-blue-800");
        });

        document.getElementById("exerciseResult").innerHTML =
            '<div class="p-3 rounded-lg bg-blue-50 text-blue-800 font-semibold">📚 Solutions revealed. Study them and try again!</div>';
    }

    loadSampleExercises() {
        const sampleExercises = `Fill in the blanks with the correct articles:

            1. Ich habe [[einen]] Hund.
            2. Sie trinkt [[die]] Milch.
            3. Wir gehen in [[das]] Kino.
            4. Er liest [[ein]] Buch.
            5. Das ist [[der]] Mann.

            Complete the sentences with the correct verb forms:

            6. Ich [[gehe]] heute ins Kino. (gehen)
            7. Du [[isst]] einen Apfel. (essen)
            8. Er [[liest]] das Buch. (lesen)`;

        document.getElementById('exerciseInput').value = sampleExercises;
        this.renderExercises();
    }
}