"use strict";

/* =========================================================
   SPE4Knerd
   V1.2
   Interface + traduction + génération audio
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

    audioSequence: [],

    audioIndex: 0,

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
   STATUT APPLICATION
   ========================================================= */

function setAppStatus(text) {

    if (appStatus) {

        appStatus.textContent = text;

    }

}


/* =========================================================
   LIBÉRATION DES AUDIO URL
   ========================================================= */

function revokeAudioUrls() {

    state.audioUrls.forEach(url => {

        try {

            URL.revokeObjectURL(url);

        } catch (error) {

            console.warn(
                "[AUDIO] Impossible de libérer URL:",
                error
            );

        }

    });

    state.audioUrls = [];

}


/* =========================================================
   ARRÊT AUDIO
   ========================================================= */

function stopAudio() {

    if (!audioPlayer) {

        return;

    }

    audioPlayer.pause();

    audioPlayer.removeAttribute("src");

    audioPlayer.load();

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

            const sourceElement =
                createSentenceElement(
                    sentence,
                    index,
                    state.sourceLanguage,
                    "source"
                );


            const translation =
                state.translations[index]
                || "Traduction à générer...";


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


    console.log(
        "[TRANSLATE] Envoi:",
        state.sentences.length,
        "phrase(s)"
    );


    const response =
        await fetch(
            "/api/translate",
            {

                method: "POST",

                headers: {

                    "Content-Type":
                        "application/json"

                },

                body: JSON.stringify({

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

            /* réponse non JSON */

        }

        throw new Error(message);

    }


    const data =
        await response.json();


    if (
        !data.translations ||
        !Array.isArray(data.translations)
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
            "[TRANSLATE] Nombre reçu:",
            data.translations.length
        );

        console.error(
            "[TRANSLATE] Nombre attendu:",
            state.sentences.length
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
    language,
    text,
    index,
    total
) {

    console.log(
        `[AUDIO] ${index}/${total} ${language}:`,
        text
    );


    const response =
        await fetch(
            "/api/audio",
            {

                method: "POST",

                headers: {

                    "Content-Type":
                        "application/json"

                },

                body: JSON.stringify({

                    language,
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

            /* réponse non JSON */

        }

        throw new Error(message);

    }


    const contentType =
        response.headers.get(
            "Content-Type"
        );


    if (
        !contentType ||
        !contentType.toLowerCase().includes("audio/wav")
    ) {

        let message =
            "Réponse audio invalide";

        try {

            const textResponse =
                await response.text();

            console.error(
                "[AUDIO] Réponse reçue:",
                textResponse
            );

        } catch (_) {

            /* rien */

        }

        throw new Error(message);

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


    const url =
        URL.createObjectURL(blob);


    state.audioUrls.push(url);


    console.log(
        `[AUDIO] ${index}/${total} OK - ${blob.size} octets`
    );


    return url;

}


/* =========================================================
   CONSTRUCTION DE LA SÉQUENCE AUDIO
   ========================================================= */

function buildAudioSequence() {

    const sequence = [];


    for (
        let index = 0;
        index < state.sentences.length;
        index++
    ) {

        sequence.push({

            number:
                sequence.length + 1,

            sentenceIndex:
                index,

            language:
                state.sourceLanguage,

            text:
                state.sentences[index],

            type:
                "source"

        });


        sequence.push({

            number:
                sequence.length + 1,

            sentenceIndex:
                index,

            language:
                state.targetLanguage,

            text:
                state.translations[index],

            type:
                "translation"

        });

    }


    return sequence;

}


/* =========================================================
   GÉNÉRATION DE TOUS LES AUDIOS
   ========================================================= */

async function generateAllAudio() {

    state.audioSequence =
        buildAudioSequence();


    if (
        state.audioSequence.length === 0
    ) {

        return;

    }


    revokeAudioUrls();

    stopAudio();


    state.audioIndex = 0;


    const total =
        state.audioSequence.length;


    for (
        let index = 0;
        index < total;
        index++
    ) {

        const item =
            state.audioSequence[index];


        audioStatus.textContent =
            `Génération audio ${index + 1}/${total} — ${item.language.toUpperCase()}`;


        item.url =
            await generateAudio(
                item.language,
                item.text,
                index + 1,
                total
            );

    }


    audioStatus.textContent =
        `${total} audio(s) prêt(s)`;


    if (
        state.audioSequence.length > 0
    ) {

        audioPlayer.src =
            state.audioSequence[0].url;

        audioPlayer.load();

        audioPlayer.style.display =
            "";

        audioStatus.textContent =
            `Audio 1/${total} prêt — cliquez sur ▶`;

    }

}


/* =========================================================
   LECTURE AUDIO COURANTE
   ========================================================= */

async function playCurrentAudio() {

    if (
        state.audioSequence.length === 0
    ) {

        return;

    }


    if (
        state.audioIndex >=
        state.audioSequence.length
    ) {

        state.audioIndex = 0;

    }


    const item =
        state.audioSequence[
            state.audioIndex
        ];


    if (!item.url) {

        return;

    }


    audioPlayer.src =
        item.url;

    audioPlayer.load();


    audioStatus.textContent =
        `Lecture ${item.number}/${state.audioSequence.length} — ${item.language.toUpperCase()}`;


    try {

        await audioPlayer.play();

    } catch (error) {

        console.warn(
            "[AUDIO] Lecture automatique impossible:",
            error
        );

        audioStatus.textContent =
            `Audio ${item.number}/${state.audioSequence.length} prêt — cliquez sur ▶`;

    }

}


/* =========================================================
   AUDIO SUIVANT
   ========================================================= */

async function playNextAudio() {

    if (
        state.audioSequence.length === 0
    ) {

        return;

    }


    state.audioIndex++;


    if (
        state.audioIndex >=
        state.audioSequence.length
    ) {

        state.audioIndex = 0;

    }


    await playCurrentAudio();

}


/* =========================================================
   GÉNÉRATION PRINCIPALE
   ========================================================= */

async function generate() {

    if (state.generating) {

        return;

    }


    const text =
        sourceText.value.trim();


    if (!text) {

        audioStatus.textContent =
            "Aucun texte à générer";

        return;

    }


    state.generating = true;

    generateButton.disabled = true;


    try {

        setAppStatus("GENERATING");


        revokeAudioUrls();

        stopAudio();


        state.sentences =
            splitSentences(text);

        state.translations = [];

        state.audioSequence = [];

        state.audioIndex = 0;


        updateSentenceCounter();


        if (
            state.sentences.length === 0
        ) {

            renderEmptyPreview();

            setAppStatus("READY");

            return;

        }


        renderPreview();


        audioStatus.textContent =
            "Traduction en cours...";


        state.translations =
            await translateSentences();


        renderPreview();


        audioStatus.textContent =
            `${state.sentences.length} phrase(s) traduite(s)`;


        setAppStatus("AUDIO");


        await generateAllAudio();


        setAppStatus("READY");


    } catch (error) {

        console.error(
            "[SPE4Knerd] Erreur:",
            error
        );


        setAppStatus("ERROR");


        audioStatus.textContent =
            `Erreur : ${error.message}`;

    } finally {

        state.generating = false;

        generateButton.disabled = false;

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


    if (
        state.sentences.length > 0
    ) {

        state.translations = [];

        state.audioSequence = [];

        state.audioIndex = 0;

        revokeAudioUrls();

        stopAudio();

        renderPreview();


        audioStatus.textContent =
            "Audio non généré";

    }

}


/* =========================================================
   EFFACER
   ========================================================= */

function clearText() {

    revokeAudioUrls();

    stopAudio();


    sourceText.value = "";

    state.sentences = [];

    state.translations = [];

    state.audioSequence = [];

    state.audioIndex = 0;


    updateCharacterCounter();

    updateSentenceCounter();

    renderEmptyPreview();


    audioStatus.textContent =
        "Audio non généré";


    setAppStatus("READY");

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
   FIN D'UN AUDIO
   ========================================================= */

if (audioPlayer) {

    audioPlayer.addEventListener(
        "ended",
        () => {

            if (
                state.audioSequence.length === 0
            ) {

                return;

            }


            state.audioIndex++;


            if (
                state.audioIndex >=
                state.audioSequence.length
            ) {

                state.audioIndex = 0;

            }


            playCurrentAudio();

        }
    );


    audioPlayer.addEventListener(
        "error",
        () => {

            console.error(
                "[AUDIO] Erreur de lecture"
            );

            audioStatus.textContent =
                "Erreur de lecture audio";

        }
    );

}


/* =========================================================
   INITIALISATION
   ========================================================= */

updateCharacterCounter();

updateSentenceCounter();

updateLanguages();

renderEmptyPreview();

setAppStatus("READY");

if (audioPlayer) {

    audioPlayer.style.display = "";

}