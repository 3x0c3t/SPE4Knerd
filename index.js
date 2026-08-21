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


    /*
     * Sécurité supplémentaire.
     *
     * L'API doit toujours retourner :
     *
     * [
     *   "traduction 1",
     *   "traduction 2",
     *   "traduction 3"
     * ]
     *
     */

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
        !contentType.includes("audio/wav")
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

        /*
         * Phrase source
         */

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


        /*
         * Traduction
         */

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

    if (
        state.audioSequence.length === 0
    ) {

        return;

    }


    revokeAudioUrls();

    stopAudio();


    state.audioSequence =
        buildAudioSequence();


    state.audioIndex = 0;


    const total =
        state.audioSequence.length;


    console.log(
        "[AUDIO] Séquence:",
        state.audioSequence
    );


    for (
        let index = 0;
        index < total;
        index++
    ) {

        const item =
            state.audioSequence[index];


        const current =
            index + 1;


        audioStatus.textContent =
            `Audio ${current}/${total} — ${item.language.toUpperCase()}`;


        setAppStatus(
            `AUDIO ${current}/${total}`
        );


        const url =
            await generateAudio(
                item.language,
                item.text,
                current,
                total
            );


        item.url =
            url;

    }


    state.audioIndex = 0;


    audioStatus.textContent =
        `${total} audio(s) généré(s)`;


    setAppStatus("READY");


    /*
     * Le premier audio est chargé.
     *
     * On ne force pas play() ici :
     * les navigateurs peuvent bloquer l'autoplay
     * après plusieurs requêtes réseau.
     */

    if (
        state.audioSequence.length > 0
    ) {

        audioPlayer.src =
            state.audioSequence[0].url;

        audioPlayer.load();

        audioPlayer.style.display =
            "block";

    }

}


/* =========================================================
   LECTURE DE LA SÉQUENCE
   ========================================================= */

function playAudioSequence() {

    if (
        state.audioSequence.length === 0
    ) {

        return;

    }


    state.audioIndex = 0;


    playCurrentAudio();

}


/* =========================================================
   LECTURE AUDIO COURANTE
   ========================================================= */

async function playCurrentAudio() {

    if (
        state.audioIndex >=
        state.audioSequence.length
    ) {

        audioStatus.textContent =
            "Lecture terminée";

        setAppStatus("READY");

        return;

    }


    const item =
        state.audioSequence[
            state.audioIndex
        ];


    if (!item.url) {

        audioStatus.textContent =
            "Audio indisponible";

        setAppStatus("ERROR");

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

        /*
         * Autoplay bloqué par le navigateur.
         * Le lecteur reste disponible avec son bouton Play.
         */

        console.warn(
            "[AUDIO] Lecture automatique bloquée:",
            error
        );

        audioStatus.textContent =
            `Audio ${item.number}/${state.audioSequence.length} prêt — cliquez sur ▶`;

    }

}


/* =========================================================
   AUDIO TERMINÉ
   ========================================================= */

function handleAudioEnded() {

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

        audioStatus.textContent =
            "Lecture terminée";

        setAppStatus("READY");

        return;

    }


    /*
     * Petit délai pour éviter que deux phrases
     * soient collées acoustiquement.
     */

    setTimeout(
        () => {

            playCurrentAudio();

        },
        150
    );

}


/* =========================================================
   GÉNÉRATION
   ========================================================= */

async function generate() {

    if (state.generating) {

        return;

    }


    const text =
        sourceText.value.trim();


    if (!text) {

        state.sentences = [];

        state.translations = [];

        state.audioSequence = [];

        revokeAudioUrls();

        stopAudio();

        updateSentenceCounter();

        renderEmptyPreview();

        audioStatus.textContent =
            "Audio non généré";

        setAppStatus("READY");

        return;

    }


    state.generating =
        true;


    generateButton.disabled =
        true;


    /*
     * Nettoyage de l'ancienne génération.
     */

    revokeAudioUrls();

    stopAudio();

    state.audioSequence = [];

    state.audioIndex = 0;


    try {

        /* ---------------------------------------------
           DÉCOUPAGE
           --------------------------------------------- */

        state.sentences =
            splitSentences(text);


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


        audioStatus.textContent =
            `${state.sentences.length} phrase(s) traduite(s)`;


        /* ---------------------------------------------
           AUDIO
           --------------------------------------------- */

        setAppStatus(
            "AUDIO"
        );


        await generateAllAudio();


        /*
         * Tout est prêt.
         */

        setAppStatus(
            "READY"
        );


        audioStatus.textContent =
            `${state.audioSequence.length} audio(s) prêt(s)`;


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


    /*
     * Si du texte existe déjà,
     * les anciennes traductions et les anciens
     * audios ne correspondent plus aux langues.
     */

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
            "Nouvelle langue sélectionnée";

    }

}


/* =========================================================
   EFFACER
   ========================================================= */

function clearText() {

    revokeAudioUrls();

    stopAudio();


    state.audioSequence = [];

    state.audioIndex = 0;

    state.sentences = [];

    state.translations = [];


    sourceText.value =
        "";


    updateCharacterCounter();

    updateSentenceCounter();

    renderEmptyPreview();


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


/*
 * Lecture automatique de la séquence
 * quand un fichier arrive à la fin.
 */

if (audioPlayer) {

    audioPlayer.addEventListener(
        "ended",
        handleAudioEnded
    );

}


/*
 * Si l'utilisateur appuie directement
 * sur Play après génération, on synchronise
 * l'index avec le fichier courant.
 */

if (audioPlayer) {

    audioPlayer.addEventListener(
        "play",
        () => {

            if (
                state.audioSequence.length === 0
            ) {

                return;

            }

            /*
             * L'utilisateur peut lancer le premier
             * fichier manuellement.
             */

            if (
                state.audioIndex >=
                state.audioSequence.length
            ) {

                state.audioIndex = 0;

            }

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

setAppStatus(
    "READY"
);


if (audioPlayer) {

    audioPlayer.style.display =
        "none";

}