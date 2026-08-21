"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

const PORT = Number(process.env.PORT) || 3001;
const LIBRETRANSLATE_URL =
    process.env.LIBRETRANSLATE_URL || "http://127.0.0.1:5000";

const VERSION = "1.2.0";

/* =========================================================
   MIDDLEWARE
   ========================================================= */

app.use(cors());

app.use(
    express.json({
        limit: "1mb"
    })
);

/* =========================================================
   LOG
   ========================================================= */

app.use((req, res, next) => {

    console.log(
        `[API] ${req.method} ${req.path}`
    );

    next();

});

/* =========================================================
   HEALTH
   ========================================================= */

app.get("/api/health", async (req, res) => {

    let translation = false;

    try {

        const response = await fetch(
            `${LIBRETRANSLATE_URL}/languages`
        );

        translation = response.ok;

    } catch (error) {

        translation = false;

    }

    res.json({
        status: "ok",
        service: "SPE4Knerd API",
        version: VERSION,
        translation,
        translationEngine: "LibreTranslate",
        translationUrl: LIBRETRANSLATE_URL
    });

});

/* =========================================================
   LIBRETRANSLATE
   ========================================================= */

async function translateTexts(
    source,
    target,
    texts
) {

    if (source === target) {

        return texts;

    }

    const translations = [];

    for (const text of texts) {

        const response = await fetch(
            `${LIBRETRANSLATE_URL}/translate`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    q: text,

                    source: source,

                    target: target,

                    format: "text"

                })
            }
        );

        const data = await response.json();

        if (!response.ok) {

            console.error(
                "[TRANSLATE] LibreTranslate error:",
                data
            );

            throw new Error(
                data?.error ||
                "Erreur LibreTranslate"
            );

        }

        if (
            typeof data.translatedText !==
            "string"
        ) {

            console.error(
                "[TRANSLATE] Réponse invalide:",
                data
            );

            throw new Error(
                "Réponse LibreTranslate invalide"
            );

        }

        translations.push(
            data.translatedText
        );

    }

    return translations;

}

/* =========================================================
   TRANSLATE
   ========================================================= */

app.post("/api/translate", async (req, res) => {

    try {

        const {
            source,
            target,
            texts
        } = req.body;

        /* ---------------------------------------------
           VALIDATION
           --------------------------------------------- */

        if (!source) {

            return res.status(400).json({
                error: "Langue source manquante"
            });

        }

        if (!target) {

            return res.status(400).json({
                error: "Langue cible manquante"
            });

        }

        if (!Array.isArray(texts)) {

            return res.status(400).json({
                error: "texts doit être un tableau"
            });

        }

        if (texts.length === 0) {

            return res.json({
                source,
                target,
                translations: []
            });

        }

        if (texts.length > 100) {

            return res.status(400).json({
                error:
                    "Maximum 100 phrases par requête"
            });

        }

        /* ---------------------------------------------
           NETTOYAGE
           --------------------------------------------- */

        const cleanTexts = texts.map(
            text => String(text).trim()
        );

        if (
            cleanTexts.some(
                text => text.length === 0
            )
        ) {

            return res.status(400).json({
                error:
                    "Une ou plusieurs phrases sont vides"
            });

        }

        /* ---------------------------------------------
           TRANSLATION
           --------------------------------------------- */

        const translations =
            await translateTexts(
                source,
                target,
                cleanTexts
            );

        console.log(
            `[TRANSLATE] ${cleanTexts.length} phrase(s) ${source} → ${target}`
        );

        return res.json({

            source,

            target,

            translations

        });

    } catch (error) {

        console.error(
            "[TRANSLATE] Exception:",
            error
        );

        return res.status(502).json({

            error:
                "Erreur du moteur de traduction",

            details:
                error.message

        });

    }

});

/* =========================================================
   SENTENCE SPLITTER
   ========================================================= */

function splitSentences(text) {

    return text
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .split(
            /(?<=[.!?…])\s+|\n+/
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
   PROCESS FULL TEXT
   ========================================================= */

app.post("/api/process", async (req, res) => {

    try {

        const {
            source,
            target,
            text
        } = req.body;

        /* ---------------------------------------------
           VALIDATION
           --------------------------------------------- */

        if (!source) {

            return res.status(400).json({
                error:
                    "Langue source manquante"
            });

        }

        if (!target) {

            return res.status(400).json({
                error:
                    "Langue cible manquante"
            });

        }

        if (
            typeof text !== "string" ||
            text.trim().length === 0
        ) {

            return res.status(400).json({
                error:
                    "Texte source manquant"
            });

        }

        /* ---------------------------------------------
           SPLIT
           --------------------------------------------- */

        const sentences =
            splitSentences(text);

        if (sentences.length === 0) {

            return res.json({

                source,

                target,

                sentenceCount: 0,

                sentences: []

            });

        }

        if (sentences.length > 100) {

            return res.status(400).json({

                error:
                    "Maximum 100 phrases par texte"

            });

        }

        /* ---------------------------------------------
           TRANSLATION
           --------------------------------------------- */

        const translations =
            await translateTexts(
                source,
                target,
                sentences
            );

        /* ---------------------------------------------
           BUILD RESULT
           --------------------------------------------- */

        const result =
            sentences.map(
                (sentence, index) => ({

                    id: index + 1,

                    source:
                        sentence,

                    translation:
                        translations[index],

                    sourceLang:
                        source,

                    targetLang:
                        target

                })
            );

        console.log(
            `[PROCESS] ${sentences.length} phrase(s) ${source} → ${target}`
        );

        return res.json({

            source,

            target,

            sentenceCount:
                result.length,

            sentences:
                result

        });

    } catch (error) {

        console.error(
            "[PROCESS] Exception:",
            error
        );

        return res.status(502).json({

            error:
                "Erreur lors du traitement du texte",

            details:
                error.message

        });

    }

});

/* =========================================================
   AUDIO
   ========================================================= */

app.post("/api/audio", async (req, res) => {

    return res.status(501).json({

        error:
            "Génération audio non disponible",

        message:
            "Le moteur audio sera ajouté ultérieurement."

    });

});

/* =========================================================
   404
   ========================================================= */

app.use((req, res) => {

    res.status(404).json({

        error:
            "Endpoint introuvable"

    });

});

/* =========================================================
   ERROR HANDLER
   ========================================================= */

app.use(
    (error, req, res, next) => {

        console.error(
            "[API] ERROR:",
            error
        );

        res.status(500).json({

            error:
                "Erreur interne du serveur"

        });

    }
);

/* =========================================================
   START
   ========================================================= */

app.listen(
    PORT,
    "127.0.0.1",
    () => {

        console.log(
            "========================================"
        );

        console.log(
            " SPE4Knerd API"
        );

        console.log(
            "========================================"
        );

        console.log(
            `Version    : ${VERSION}`
        );

        console.log(
            `Port       : ${PORT}`
        );

        console.log(
            `Translation: LibreTranslate`
        );

        console.log(
            `LT URL     : ${LIBRETRANSLATE_URL}`
        );

        console.log(
            "========================================"
        );

    }
);