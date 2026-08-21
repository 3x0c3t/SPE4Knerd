"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 3001;

const GOOGLE_TRANSLATE_API_KEY =
    process.env.GOOGLE_TRANSLATE_API_KEY;


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

app.get("/api/health", (req, res) => {

    res.json({
        status: "ok",
        service: "SPE4Knerd API",
        version: "1.1.0",
        translation: Boolean(
            GOOGLE_TRANSLATE_API_KEY
        )
    });

});


/* =========================================================
   TRANSLATION
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
                translations: []
            });

        }


        if (texts.length > 100) {

            return res.status(400).json({
                error: "Maximum 100 phrases par requête"
            });

        }


        /* ---------------------------------------------
           SOURCE = TARGET
           --------------------------------------------- */

        if (source === target) {

            return res.json({
                translations: texts
            });

        }


        /* ---------------------------------------------
           GOOGLE API KEY
           --------------------------------------------- */

        if (!GOOGLE_TRANSLATE_API_KEY) {

            console.error(
                "[TRANSLATE] GOOGLE_TRANSLATE_API_KEY absente"
            );

            return res.status(500).json({
                error: "Clé Google Translation non configurée"
            });

        }


        /* ---------------------------------------------
           GOOGLE TRANSLATE
           --------------------------------------------- */

        const googleUrl =
            "https://translation.googleapis.com/language/translate/v2" +
            `?key=${encodeURIComponent(
                GOOGLE_TRANSLATE_API_KEY
            )}`;


        const googleResponse =
            await fetch(
                googleUrl,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        q: texts,

                        source: source,

                        target: target,

                        format: "text"

                    })
                }
            );


        const googleData =
            await googleResponse.json();


        /* ---------------------------------------------
           GOOGLE ERROR
           --------------------------------------------- */

        if (!googleResponse.ok) {

            console.error(
                "[TRANSLATE] Google error:",
                googleData
            );

            return res.status(
                googleResponse.status
            ).json({

                error:
                    "Erreur Google Translation",

                details:
                    googleData

            });

        }


        /* ---------------------------------------------
           RESPONSE
           --------------------------------------------- */

        const googleTranslations =
            googleData?.data?.translations;


        if (
            !Array.isArray(
                googleTranslations
            )
        ) {

            console.error(
                "[TRANSLATE] Réponse Google invalide:",
                googleData
            );

            return res.status(502).json({
                error:
                    "Réponse Google Translation invalide"
            });

        }


        const translations =
            googleTranslations.map(
                item =>
                    item.translatedText
            );


        console.log(
            `[TRANSLATE] ${texts.length} phrase(s) ${source} → ${target}`
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

        return res.status(500).json({
            error:
                "Erreur interne du serveur"
        });

    }

});


/* =========================================================
   AUDIO
   ========================================================= */

app.post("/api/audio", async (req, res) => {

    return res.status(501).json({

        error:
            "Génération audio non disponible en V1.1",

        message:
            "Le moteur audio sera ajouté dans une prochaine version."

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

app.use((error, req, res, next) => {

    console.error(
        "[API] ERROR:",
        error
    );

    res.status(500).json({

        error:
            "Erreur interne du serveur"

    });

});


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
            `Port       : ${PORT}`
        );

        console.log(
            `Translation: ${
                GOOGLE_TRANSLATE_API_KEY
                    ? "CONFIGURED"
                    : "NOT CONFIGURED"
            }`
        );

        console.log(
            "========================================"
        );

    }
);