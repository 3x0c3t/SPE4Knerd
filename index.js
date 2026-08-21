"use strict";

/* =========================================================
   SPE4Knerd
   V1.1
   Interface + traduction + audio
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

const appStatus =
    document.getElementById("appStatus");


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
    },

    en: {
        code: "EN",
        name: "English",
        flag: "🇬🇧"
    },

    de: {
        code: "DE",
        name: "Deutsch",
        flag: "🇩🇪"
    },

    it: {
        code: "IT",
        name: "Italiano",
        flag: "🇮🇹"
    }

};


/* =========================================================
   ÉTAT
   ========================================================= */

const state = {

    sourceLanguage: "fr",

    targetLanguage: "es",

    sentences: [],

    translations: [],

    audioUrls: [],

    generating: false

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


    return text

        .replace(/\r\n/g, "\n")

        .replace(/\n+/g, " ")

        .split(
            /(?<=[.!?…。！？])\s+/
        )

        .map(
            sentence =>
                sentence.trim()
        )

        .filter(
            sentence =>
                sentence.length > 0
        );

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
   STATUT APPLICATION
   ========================================================= */

function setAppStatus(text) {

    if (appStatus) {

        appStatus.textContent =
            text;

    }

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


    const languageInfo =
        languages[language];


    languageElement.textContent =
        languageInfo
            ? `${languageInfo.flag} ${languageInfo.code}`
            : language.toUpperCase();


    const textElement =
        document.createElement("p");

    textElement.className =
        "sentence-text";

    textElement.textContent =
        text;


    article.appendChild(
        number
    );

    article.appendChild(
        languageElement
    );

    article.appendChild(
        textElement
    );


    return article;

}


/* =========================================================
   APERÇU
   ========================================================= */

function renderPreview() {

    preview.innerHTML = "";


    state.sentences.forEach(
        (sentence, index) => {

            const sourceElement =
                createSentenceElement(
                    sentence,
                    index,
                    state.sourceLanguage,
                    "source"
                );


            const translation =
                state.translations[index]
                ||
                "Traduction à générer...";


            const translationElement =
                createSentenceElement(
                    translation,
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
   API TRANSLATION
   ========================================================= */

async function translateSentences() {

    if (
        state.sentences.length === 0
    ) {

        return [];

    }


    const response =
        await fetch(
            "/api/translate",
            {

                method:
                    "POST",

                headers: {

                    "Content-Type":
                        "application/json"

                },

                body:
                    JSON.stringify({

                        source:
                            state.sourceLanguage,

                        target:
                            state.targetLanguage,

                        texts:
                            state.sentences

                    })

            }
        );


    if (!response.ok) {

        let message =
            `Erreur HTTP ${response.status}`;


        try {

            const error =
                await response.json();


            if (error.error) {

                message =
                    error.error;

            }

        } catch (_) {

            /* Réponse non JSON */

        }


        throw new Error(
            message
        );

    }


    const data =
        await response.json();


    if (
        !data.translations ||
        !Array.isArray(
            data.translations
        )
    ) {

        throw new Error(
            "Réponse de traduction invalide"
        );

    }


    if (
        data.translations.length !==
        state.sentences.length
    ) {

        console.error(
            "[TRANSLATE] Réponse reçue:",
            data
        );


        throw new Error(
            "Nombre de traductions inattendu"
        );

    }


    return data.translations;

}


/* =========================================================
   API AUDIO
   ========================================================= */

async function generateAudio(
    text,
    language
) {

    const response =
        await fetch(
            "/api/audio",
            {

                method:
                    "POST",

                headers: {

                    "Content-Type":
                        "application/json"

                },

                body:
                    JSON.stringify({

                        language:
                            language,

                        text:
                            text

                    })

            }
        );


    if (!response.ok) {

        let message =
            `Erreur audio HTTP ${response.status}`;


        try {

            const error =
                await response.json();


            if (error.error) {

                message =
                    error.error;

            }

        } catch (_) {

            /* Réponse non JSON */

        }


        throw new Error(
            message
        );

    }


    const blob =
        await response.blob();


    if (
        !blob ||
        blob.size === 0
    ) {

        throw new Error(
            "Fichier audio vide"
        );

    }


    return URL.createObjectURL(
        blob
    );

}


/* =========================================================
   LIBÉRATION DES AUDIO
   ========================================================= */

function revokeAudioUrls() {

    state.audioUrls.forEach(
        url => {

            try {

                URL.revokeObjectURL(
                    url
                );

            } catch (_) {

                /* Rien */

            }

        }
    );


    state.audioUrls = [];

}


/* =========================================================
   GÉNÉRATION AUDIO COMPLÈTE
   ========================================================= */

async function generateAllAudio() {

    revokeAudioUrls();


    if (
        state.sentences.length === 0
    ) {

        audioStatus.textContent =
            "Audio non généré";

        return;

    }


    const sequence = [];


    for (
        let index = 0;
        index < state.sentences.length;
        index++
    ) {

        sequence.push({

            number:
                index + 1,

            language:
                state.sourceLanguage,

            text:
                state.sentences[index],

            type:
                "source"

        });


        sequence.push({

            number:
                index + 1,

            language:
                state.targetLanguage,

            text:
                state.translations[index],

            type:
                "target"

        });

    }


    const audioUrls = [];


    for (
        let index = 0;
        index < sequence.length;
        index++
    ) {

        const item =
            sequence[index];


        const languageInfo =
            languages[item.language];


        audioStatus.textContent =
            `Audio ${index + 1}/${sequence.length} : ` +
            `${languageInfo ? languageInfo.code : item.language.toUpperCase()}`;


        const url =
            await generateAudio(
                item.text,
                item.language
            );


        audioUrls.push(
            url
        );

    }


    state.audioUrls =
        audioUrls;


    /*
     * Le lecteur HTML ne peut lire qu'un fichier
     * à la fois.
     *
     * On place donc le premier audio dans le lecteur.
     * La séquence complète reste disponible dans
     * state.audioUrls pour l'étape suivante.
     */

    if (
        state.audioUrls.length > 0
    ) {

        audioPlayer.src =
            state.audioUrls[0];

        audioPlayer.load();

    }


    audioStatus.textContent =
        `${sequence.length} audio généré(s)`;

}


/* =========================================================
   LECTURE DE LA SÉQUENCE AUDIO
   ========================================================= */

let audioSequenceIndex =
    0;


function playAudioSequence() {

    if (
        state.audioUrls.length === 0
    ) {

        return;

    }


    audioSequenceIndex =
        0;


    playNextAudio();

}


function playNextAudio() {

    if (
        audioSequenceIndex >=
        state.audioUrls.length
    ) {

        audioStatus.textContent =
            `${state.audioUrls.length} audio terminé(s)`;

        return;

    }


    const url =
        state.audioUrls[
            audioSequenceIndex
        ];


    audioPlayer.src =
        url;


    audioPlayer.load();


    audioPlayer.onended =
        () => {

            audioSequenceIndex++;

            playNextAudio();

        };


    audioPlayer.play()
        .catch(
            error => {

                console.error(
                    "[AUDIO] Lecture:",
                    error
                );

            }
        );

}


/* =========================================================
   GÉNÉRATION
   ========================================================= */

async function generate() {

    if (
        state.generating
    ) {

        return;

    }


    const text =
        sourceText.value.trim();


    if (!text) {

        state.sentences = [];

        state.translations = [];

        revokeAudioUrls();

        updateSentenceCounter();

        renderEmptyPreview();

        audioStatus.textContent =
            "Audio non généré";

        setAppStatus(
            "READY"
        );

        return;

    }


    state.generating =
        true;


    generateButton.disabled =
        true;


    setAppStatus(
        "TRANSLATING"
    );


    audioStatus.textContent =
        "Découpage des phrases...";


    try {

        /* ---------------------------------------------
           PHRASES
           --------------------------------------------- */

        state.sentences =
            splitSentences(
                text
            );


        state.translations =
            [];


        updateSentenceCounter();

        renderPreview();


        if (
            state.sentences.length === 0
        ) {

            throw new Error(
                "Aucune phrase détectée"
            );

        }


        /* ---------------------------------------------
           TRADUCTION
           --------------------------------------------- */

        setAppStatus(
            "TRANSLATING"
        );


        audioStatus.textContent =
            "Traduction en cours...";


        state.translations =
            await translateSentences();


        renderPreview();


        /* ---------------------------------------------
           AUDIO
           --------------------------------------------- */

        setAppStatus(
            "AUDIO"
        );


        await generateAllAudio();


        /* ---------------------------------------------
           TERMINÉ
           --------------------------------------------- */

        setAppStatus(
            "READY"
        );


    } catch (error) {

        console.error(
            "[SPE4Knerd] Erreur:",
            error
        );


        setAppStatus(
            "ERROR"
        );


        audioStatus.textContent =
            `Erreur : ${error.message}`;


    } finally {

        state.generating =
            false;


        generateButton.disabled =
            false;

    }

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
        languages[
            state.sourceLanguage
        ];


    const target =
        languages[
            state.targetLanguage
        ];


    if (!source || !target) {

        return;

    }


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


    /*
     * Changement de langue :
     * les anciennes traductions/audio
     * ne sont plus valables.
     */

    revokeAudioUrls();


    state.translations =
        [];


    audioPlayer.removeAttribute(
        "src"
    );


    audioPlayer.load();


    if (
        state.sentences.length > 0
    ) {

        renderPreview();

    }


    audioStatus.textContent =
        "Audio non généré";

}


/* =========================================================
   EFFACER
   ========================================================= */

function clearText() {

    revokeAudioUrls();


    state.sentences =
        [];


    state.translations =
        [];


    sourceText.value =
        "";


    updateCharacterCounter();

    updateSentenceCounter();

    renderEmptyPreview();


    audioPlayer.removeAttribute(
        "src"
    );


    audioPlayer.load();


    audioStatus.textContent =
        "Audio non généré";


    setAppStatus(
        "READY"
    );

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
    generate
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

setAppStatus(
    "READY"
);