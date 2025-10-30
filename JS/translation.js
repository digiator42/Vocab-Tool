// JS/translation.js
export class TranslationService {
    constructor(main) {
        this.main = main;
    }

    joinTranslationChunks(data) {
        if (!Array.isArray(data?.[0])) return "(error)";
        return data[0].map(chunk => chunk[0].replace(/\n/g, " ")).join(" ");
    }

    async translate(text, article = false, extended = false) {
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
}


