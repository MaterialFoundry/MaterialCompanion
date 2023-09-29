const packageJson = require('../../package.json');

class Localization {
    constructor() {
    }

    language;
    translations;
    languages;

    async setLanguage(lang) {
            this.languages = packageJson.languages;
            this.language = this.languages.find(l => l.lang === lang)
            console.log(`Setting language to ${this.language.name}: `, this.language)
    
            await fetch(this.language.path)
                .then((response) => response.json())
                .then((json) => this.translations = json)
    }
    
    localize(str) {
        const translated = this.translations?.[str];
        if (translated == undefined) return str;
        return translated;
    }

    performLocalization() {
        for (let elmnt of document.all) {
            if (elmnt.tagName == "HTML" || elmnt.tagName == "BODY" || elmnt.tagName == "HEAD" || elmnt.tagName == "META" || elmnt.tagName == "TITLE" || elmnt.tagName == "SCRIPT" || elmnt.tagName == "STYLE") continue;
            let innerHTML = elmnt.innerHTML;
            if (!innerHTML.includes("{{")) continue;

            const split = innerHTML.split("{{");
            for (let part of split) {
                let replace = part.split("}}")[0];
                if (replace.includes("localize")) {
                    let replace2 = replace.split(/["'`]/g)[1];
                    const translation = i18n.localize(replace2);
                    innerHTML = innerHTML.replaceAll(`{{${replace}}}`, translation);
                }
            }
            elmnt.innerHTML = innerHTML;
        }
    }
}

module.exports = { Localization };