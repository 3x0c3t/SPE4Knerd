"use strict";


/* =========================================================
   SPE4Knerd
   V1.0
   Interface + découpage des phrases
   ========================================================= */


/* =========================================================
   DOM
   ========================================================= */

const sourceLanguage =
    document.getElementById("sourceLanguage");

const targetLanguage =
    document.getElementById("targetLanguage");

const sourceText =
    document.getElementById("sourceText");

const characterCounter =
    document.getElementById("characterCounter");

const sentenceCounter =
    document.getElementById("sentenceCounter");

const preview =
    document.getElementById("preview");

const generateButton =
    document.getElementById("generateButton");

const clearButton =
    document.getElementById("clearButton");

const audioPlayer =
    document.getElementById("audioPlayer");

const audioMode =
    document.getElementById("audioMode");

const audioStatus =
    document.getElementById("audioStatus");

const sequenceSource =
    document.getElementById("sequenceSource");

const sequenceTarget =
    document.getElementById("sequenceTarget");

const sequenceSource2 =
    document.getElementById("sequenceSource2");

const sequenceTarget2 =
    document.getElementById("sequenceTarget2");


/* =========================================================
   LANGUES
   ========================================================= */

const languages = {

    fr: {
        code: "FR",
        name: "Français",
        flag: "🇫🇷"
    },

    es: {
        code: "ES",
        name: "Español",
        flag: "🇲🇽"
    }

};


/* =========================================================
   ÉTAT
   ========================================================= */

const state = {

    sourceLanguage: "fr",

    targetLanguage: "es",

    sentences: []

};


/* =========================================================
   COMPTEUR CARACTÈRES
   ========================================================= */

function updateCharacterCounter() {

    const count =
        sourceText.value.length;


    characterCounter.textContent =
        `${count} caractère${count === 1 ? "" : "s"}`;

}


/* =========================================================
   DÉCOUPAGE DES PHRASES
   ========================================================= */

function splitSentences(text) {

    if (!text.trim()) {

        return [];

    }


    /*
     * V1 :
     *
     * Découpage sur :
     *
     * .
     * !
     * ?
     * …
     * ponctuation espagnole
     * ponctuation chinoise/japonaise
     *
     * Les versions suivantes pourront utiliser
     * une logique beaucoup plus avancée.
     */

    return text

        .replace(/\r\n/g, "\n")

        .replace(/\n+/g, " ")

        .split(/(?<=[.!?…。！？])\s+/)

        .map(sentence => sentence.trim())

        .filter(sentence => sentence.length > 0);

}


/* =========================================================
   COMPTEUR PHRASES
   ========================================================= */

function updateSentenceCounter() {

    const count =
        state.sentences.length;


    sentenceCounter.textContent =
        `${count} phrase${count === 1 ? "" : "s"}`;

}


/* =========================================================
   ÉTAT VIDE
   ========================================================= */

function renderEmptyPreview() {

    preview.innerHTML = `

        <div class="empty-state">

            <div class="empty-icon">
                ⇅
            </div>

            <div class="empty-title">
                Aucun texte
            </div>

            <div class="empty-description">
                Collez un texte puis cliquez sur Générer.
            </div>

        </div>

    `;

}


/* =========================================================
   CRÉATION PHRASE
   ========================================================= */

function createSentenceElement(
    text,
    index,
    language,
    type
) {

    const article =
        document.createElement("article");


    article.className =
        `sentence-item sentence-${type}`;


    const number =
        document.createElement("span");

    number.className =
        "sentence-number";

    number.textContent =
        String(index + 1).padStart(2, "0");


    const languageElement =
        document.createElement("span");

    languageElement.className =
        "sentence-language";

    languageElement.textContent =
        `${languages[language].flag} ${languages[language].code}`;


    const textElement =
        document.createElement("p");

    textElement.className =
        "sentence-text";

    textElement.textContent =
        text;


    article.appendChild(number);

    article.appendChild(languageElement);

    article.appendChild(textElement);


    return article;

}


/* =========================================================
   APERÇU
   ========================================================= */

function renderPreview() {

    preview.innerHTML = "";


    state.sentences.forEach(
        (sentence, index) => {


            /*
             * Phrase source
             */

            const sourceElement =
                createSentenceElement(
                    sentence,
                    index,
                    state.sourceLanguage,
                    "source"
                );


            /*
             * Traduction provisoire
             */

            const translationElement =
                createSentenceElement(
                    "Traduction à générer...",
                    index,
                    state.targetLanguage,
                    "translation"
                );


            preview.appendChild(
                sourceElement
            );


            preview.appendChild(
                translationElement
            );

        }
    );

}


/* =========================================================
   GÉNÉRATION APERÇU
   ========================================================= */

function generatePreview() {

    const text =
        sourceText.value.trim();


    if (!text) {

        state.sentences = [];

        updateSentenceCounter();

        renderEmptyPreview();

        return;

    }


    state.sentences =
        splitSentences(text);


    updateSentenceCounter();

    renderPreview();


    audioStatus.textContent =
        `${state.sentences.length} phrase(s) détectée(s)`;

}


/* =========================================================
   MISE À JOUR DES LANGUES
   ========================================================= */

function updateLanguages() {

    state.sourceLanguage =
        sourceLanguage.value;

    state.targetLanguage =
        targetLanguage.value;


    const source =
        languages[state.sourceLanguage];

    const target =
        languages[state.targetLanguage];


    audioMode.textContent =
        `${source.code} → ${target.code}`;


    sequenceSource.textContent =
        `${source.flag} ${source.code}`;


    sequenceTarget.textContent =
        `${target.flag} ${target.code}`;


    sequenceSource2.textContent =
        `${source.flag} ${source.code}`;


    sequenceTarget2.textContent =
        `${target.flag} ${target.code}`;


    if (state.sentences.length > 0) {

        renderPreview();

    }

}


/* =========================================================
   EFFACER
   ========================================================= */

function clearText() {

    sourceText.value = "";

    state.sentences = [];


    updateCharacterCounter();

    updateSentenceCounter();

    renderEmptyPreview();


    audioPlayer.removeAttribute("src");

    audioPlayer.load();


    audioStatus.textContent =
        "Audio non généré";

}


/* =========================================================
   ÉVÉNEMENTS
   ========================================================= */

sourceText.addEventListener(
    "input",
    updateCharacterCounter
);


generateButton.addEventListener(
    "click",
    generatePreview
);


clearButton.addEventListener(
    "click",
    clearText
);


sourceLanguage.addEventListener(
    "change",
    updateLanguages
);


targetLanguage.addEventListener(
    "change",
    updateLanguages
);


/* =========================================================
   INITIALISATION
   ========================================================= */

updateCharacterCounter();

updateSentenceCounter();

updateLanguages();

renderEmptyPreview();