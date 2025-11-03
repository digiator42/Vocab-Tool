// article-service.js
export class ArticleService {
    constructor(vocabTool) {
        this.vocabTool = vocabTool;
    }

    // Helper method to check if a word is likely a noun
    async isLikelyNoun(word) {
        // Simple heuristic: German nouns are capitalized
        // if (word.charAt(0) !== word.charAt(0).toUpperCase()) {
        //     return false;
        // }

        try {
            console.log('<- getting in is likely noun ->')
            // Use the translation API to get part of speech info
            const extendedData = await this.vocabTool.translation.translate(word, false, true);
            if (extendedData && extendedData.dict && extendedData.dict.length > 0) {
                const pos = extendedData.dict[0].pos;
                return pos === 'noun' || pos === 'substantiv';
            }
        } catch (error) {
            console.log('Could not determine part of speech for:', word);
        }

        // Fallback: assume capitalized German words are nouns
        return /^[A-ZÄÖÜ]/.test(word);
    }

    // Helper method to extract article from gender data
    getArticleFromGender(gender) {
        if (gender.der) return 'Der';
        if (gender.die) return 'Die';
        if (gender.das) return 'Das';
        return ''; // Fallback
    }

    // Main method to get article for a word
    async getArticle(word) {
        try {
            const response = await fetch(`https://german-genders.vercel.app/api/search/${encodeURIComponent(word.toLowerCase())}`);
            const data = await response.json();

            console.log('Article API response:', data);

            if (data.responseType === 900) {
                // Single article case
                const article = this.getArticleFromGender(data.gender);
                return {
                    success: true,
                    article: article,
                    baseWord: data.title,
                    type: 'single',
                    originalWord: word
                };
            } else if (data.responseType === 901) {
                // Multiple articles case (homonym)
                const articles = [];
                if (data.gender.der) articles.push('Der');
                if (data.gender.die) articles.push('Die');
                if (data.gender.das) articles.push('Das');

                return {
                    success: true,
                    articles: articles,
                    baseWord: data.title,
                    type: 'multiple',
                    originalWord: word
                };
            } else {
                return {
                    success: false,
                    error: 'No article data found'
                };
            }
        } catch (error) {
            console.error('Error getting article:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Handle multiple articles case in batch modal
    handleMultipleArticles(word, data, germanWordSpan, button, selectionIndex) {
        const articles = [];
        if (data.gender.der) articles.push('Der');
        if (data.gender.die) articles.push('Die');
        if (data.gender.das) articles.push('Das');

        const baseWord = data.title;

        // Store words in button dataset
        button.dataset.originalWord = word;
        button.dataset.baseWord = baseWord;
        button.dataset.allArticles = JSON.stringify(articles);

        if (articles.length > 1) {
            // Notify user about multiple articles
            const message = `Multiple articles found for "${baseWord}": ${articles.join(', ')}. Using "${articles[0]}" by default. Click "Make Sure" for details.`;
            this.vocabTool.showNotification(message, 10000);
        }

        // Set the article in the German word span
        const articleWord = `${articles[0]} ${baseWord.charAt(0).toUpperCase() + baseWord.slice(1)}`;
        germanWordSpan.textContent = articleWord;

        // Store the original and base words
        germanWordSpan.dataset.originalWord = word;
        germanWordSpan.dataset.baseWord = baseWord;

        // Update button for multiple articles case
        button.textContent = articles.length > 1 ? '⚠️ Make Sure' : '✓ Make Sure';
        button.classList.remove('bg-blue-500', 'hover:bg-blue-600');

        if (articles.length > 1) {
            button.classList.add('bg-orange-500', 'hover:bg-orange-600');
        } else {
            button.classList.add('bg-green-500', 'hover:bg-green-600');
        }

        button.disabled = false;

        console.log(`Multiple articles found for "${word}" (base: ${baseWord}): ${articles.join(', ')}. Using "${articles[0]}"`);
    }

    async getGoogleArticle(word) {
        // First, get the English translation of the German word
        const englishTranslation = await this.vocabTool.translation.translate(word);
        console.log(`English translation: "${englishTranslation}"`);

        // Now translate "the + english_word" back to German to get the article
        const articleWord = await this.vocabTool.translation.translate('the ' + englishTranslation, true);
        console.log(`German with article: "${articleWord}"`);

        return articleWord;
    }

    // Show detailed article information for multiple articles
    async showArticleDetails(word, articles, button) {
        const baseWord = button.dataset.baseWord || word;
        const originalWord = button.dataset.originalWord || word;

        // Open dictionary when showing details
        const currentArticle = articles[0];
        window.open(`https://der-artikel.de/${currentArticle.toLowerCase()}/${baseWord.charAt(0).toUpperCase() + baseWord.slice(1)}.html`);

        // Create modal to show all possible articles
        let googleWordArticle = await this.getGoogleArticle(originalWord);
        googleWordArticle = googleWordArticle.charAt(0).toUpperCase() + googleWordArticle.slice(1);
        const googleArticle = googleWordArticle;

        const detailModal = document.createElement('div');
        detailModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        detailModal.id = 'article-detail-modal';
        detailModal.innerHTML = `
            <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3 class="text-lg font-bold mb-4">Word Information</h3>
                ${originalWord !== baseWord ? `
                    <div class="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
                        <p class="text-sm text-blue-800">
                            <strong>Note:</strong> "${originalWord}" is the plural form.<br>
                            The base (singular) form is "<strong>${baseWord}</strong>".
                        </p>
                    </div>
                ` : ''}
                <p class="mb-4">The word "<strong>${baseWord}</strong>" can have multiple articles:</p>
                <div class="space-y-2 mb-4">
                    ${articles.map(article => `
                        <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span class="font-medium text-black">${article} ${baseWord}</span>
                            <button class="use-article-btn px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                                    data-article="${article}">
                                Use This
                            </button>
                        </div>
                        `).join('')}
                        <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span class="font-medium text-black">${googleWordArticle}</span>
                            <button class="use-article-btn px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                                data-article="${googleArticle}">
                                Use This
                            </button>
                        </div >
                </div >
                <p class="text-sm text-gray-600 mb-4">
                    Each article represents a different meaning or usage of the word.
                </p>
                <div class="flex justify-end">
                    <button class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600" id="close-article-modal">
                        Close
                    </button>
                </div>
            </div >
    `;

        document.body.appendChild(detailModal);

        // Add event listeners
        detailModal.querySelector('#close-article-modal').addEventListener('click', () => {
            detailModal.remove();
        });

        detailModal.querySelectorAll('.use-article-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const selectedArticle = e.target.dataset.article;
                console.log('---------->> ', selectedArticle);
                this.updateWordWithArticle(baseWord, selectedArticle, button);

                // Remove the hint notification if it exists
                const notification = button.closest('.p-3').querySelector('.bg-yellow-100');
                if (notification) {
                    notification.remove();
                }

                detailModal.remove();
            });
        });

        // Close modal when clicking outside
        detailModal.addEventListener('click', (e) => {
            if (e.target === detailModal) {
                detailModal.remove();
            }
        });
    }

    // Update word with selected article
    updateWordWithArticle(baseWord, article, button) {
        const selectionIndex = parseInt(button.dataset.index);
        const selectionsList = document.getElementById('batch-selections-list');
        const selectionDiv = selectionsList.children[selectionIndex];
        const germanWordSpan = selectionDiv.querySelector('.german-word');

        const articleWord = `${ article } ${ baseWord.charAt(0).toUpperCase() + baseWord.slice(1) } `;
        germanWordSpan.textContent = articleWord;

        // Update button classes individually
        button.textContent = '✓ Done';
        button.classList.remove('bg-orange-500', 'hover:bg-orange-600');
        button.classList.add('bg-green-500', 'hover:bg-green-600');
        button.disabled = true;
    }

    // Handle get article button click in batch modal
    async handleGetArticle(word, selectionIndex, button) {
        // Show loading state
        const originalText = button.textContent;
        button.textContent = 'Loading...';
        button.disabled = true;

        console.log(`Getting article for "${word}"(selection index ${ selectionIndex })`);

        const selectionsList = document.getElementById('batch-selections-list');
        const selectionDiv = selectionsList.children[selectionIndex];
        const germanWordSpan = selectionDiv.querySelector('.german-word');

        // Check if article already fetched
        const articles = ['Der', 'Die', 'Das'];
        const matchedArticle = articles.find(a => germanWordSpan.textContent.startsWith(a + ' '));

        if (matchedArticle) {
            console.log('Article already fetched, opening dictionary>>>> ');

            const originalWord = button.dataset.originalWord || word;
            const baseWord = button.dataset.baseWord || originalWord;

            window.open(`https://der-artikel.de/${matchedArticle.toLowerCase()}/${baseWord.charAt(0).toUpperCase() + baseWord.slice(1)}.html`);
    button.textContent = '✓ Make Sure';
button.disabled = false;
return;
        }

try {
    const result = await this.getArticle(word);

    if (!result.success) {
        throw new Error(result.error);
    }

    const baseWord = result.baseWord;
    button.dataset.originalWord = word;
    button.dataset.baseWord = baseWord;

    if (result.type === 'single') {
        // Single article case
        const articleWord = `${result.article} ${baseWord.charAt(0).toUpperCase() + baseWord.slice(1)}`;
        germanWordSpan.textContent = articleWord;

        // Store the original word for reference
        germanWordSpan.dataset.originalWord = word;
        germanWordSpan.dataset.baseWord = baseWord;

        if (word !== baseWord) {
            germanWordSpan.title = `Base form of "${word}"`;
            germanWordSpan.classList.add('cursor-help', 'border-b', 'border-dotted', 'border-gray-400');
            germanWordSpan.textContent += ` / ${word}`;
        }

        // Update the button to show completion
        button.textContent = '✓ Make Sure';
        button.classList.remove('bg-blue-500', 'hover:bg-blue-600');
        button.classList.add('bg-green-500', 'hover:bg-green-600');
        button.disabled = false;

        console.log(`Updated "${word}" (base: ${baseWord}) -> "${articleWord}"`);

    } else if (result.type === 'multiple') {
        // Multiple articles case
        this.handleMultipleArticles(word, {
            gender: {
                der: result.articles.includes('Der'),
                die: result.articles.includes('Die'),
                das: result.articles.includes('Das')
            },
            title: baseWord
        }, germanWordSpan, button, selectionIndex);

        if (word !== baseWord) {
            germanWordSpan.textContent += ` / ${word}`;
        }
    }

} catch (error) {
    console.error('Error getting article:', error);
    button.textContent = 'Error';
    button.classList.remove('bg-blue-500', 'hover:bg-blue-600');
    button.classList.add('bg-red-500', 'hover:bg-red-600');

    setTimeout(() => {
        button.textContent = 'Get Article';
        button.classList.remove('bg-red-500', 'hover:bg-red-600');
        button.classList.add('bg-blue-500', 'hover:bg-blue-600');
        button.disabled = false;
    }, 1000);
}
    }
}