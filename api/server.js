const express = require("express");
const cors = require("cors");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const app = express();

const PORT = 3003;

const LIBRETRANSLATE_URL =
    "http://127.0.0.1:5000";

const PIPER_BIN =
    "/opt/piper/venv/bin/piper";

const VOICES = {

    fr: {
        name: "fr_FR-siwis-medium",
        model:
            "/opt/piper/voices/fr_FR-siwis-medium.onnx"
    },

    es: {
        name: "es_MX-ald-medium",
        model:
            "/opt/piper/voices/es_MX-ald-medium.onnx"
    }

};


/* =========================================================
   EXPRESS
   ========================================================= */

app.use(
    cors({
        origin: "*"
    })
);

app.use(
    express.json({
        limit: "1mb"
    })
);


/* =========================================================
   HEALTH
   ========================================================= */

app.get("/api/health", (req, res) => {

    const voices = {};

    for (const [language, voice] of Object.entries(VOICES)) {

        voices[language] = {

            name: voice.name,

            available:
                fs.existsSync(voice.model)

        };

    }

    res.json({

        status: "ok",

        service:
            "SPE4Knerd API",

        version:
            "1.3.0",

        translation:
            true,

        translationEngine:
            "LibreTranslate",

        translationUrl:
            LIBRETRANSLATE_URL,

        audio:
            true,

        audioEngine:
            "Piper",

        piper:
            fs.existsSync(PIPER_BIN),

        voices

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


        if (!Array.isArray(texts)) {

            return res.status(400).json({

                error:
                    "texts doit être un tableau"

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

        const cleanTexts =
            texts.map(text =>
                typeof text === "string"
                    ? text.trim()
                    : ""
            );


        /* ---------------------------------------------
           SOURCE = TARGET
           --------------------------------------------- */

        if (source === target) {

            return res.json({

                source,

                target,

                translations:
                    cleanTexts

            });

        }


        /* ---------------------------------------------
           LIBRETRANSLATE
           --------------------------------------------- */

        const response =
            await fetch(
                `${LIBRETRANSLATE_URL}/translate`,
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            q:
                                cleanTexts,

                            source,

                            target,

                            format:
                                "text"

                        })

                }
            );


        const data =
            await response.json();


        /* ---------------------------------------------
           ERROR LIBRETRANSLATE
           --------------------------------------------- */

        if (!response.ok) {

            console.error(
                "[TRANSLATE] LibreTranslate error:",
                data
            );

            return res.status(
                response.status
            ).json({

                error:
                    "Erreur LibreTranslate",

                details:
                    data

            });

        }


        /* ---------------------------------------------
           NORMALISATION
           
           LibreTranslate peut renvoyer :

           {
               translatedText: [
                   "...",
                   "...",
                   "..."
               ]
           }

           ou, selon le comportement/version :

           {
               translatedText: "..."
           }

           ou éventuellement un tableau
           d'objets.

           On normalise TOUJOURS vers :

           translations: [
               "...",
               "...",
               "..."
           ]
           --------------------------------------------- */

        let translations = [];


        if (
            data &&
            Array.isArray(data.translatedText)
        ) {

            translations =
                data.translatedText;

        }

        else if (
            data &&
            typeof data.translatedText === "string"
        ) {

            translations = [
                data.translatedText
            ];

        }

        else if (
            Array.isArray(data)
        ) {

            translations =
                data.map(item => {

                    if (
                        item &&
                        typeof item.translatedText === "string"
                    ) {

                        return item.translatedText;

                    }

                    return "";

                });

        }


        /* ---------------------------------------------
           SECURITE
           --------------------------------------------- */

        translations =
            translations.map(
                translation =>
                    typeof translation === "string"
                        ? translation
                        : String(translation ?? "")
            );


        /* ---------------------------------------------
           VERIFICATION DU NOMBRE
           --------------------------------------------- */

        if (
            translations.length !==
            cleanTexts.length
        ) {

            console.error(
                "[TRANSLATE] Nombre inattendu:",
                {
                    expected:
                        cleanTexts.length,

                    received:
                        translations.length,

                    data
                }
            );

            return res.status(502).json({

                error:
                    "Nombre de traductions inattendu",

                expected:
                    cleanTexts.length,

                received:
                    translations.length,

                details:
                    data

            });

        }


        console.log(
            `[TRANSLATE] ${cleanTexts.length} phrase(s) ${source} → ${target}`
        );


        /* ---------------------------------------------
           RESPONSE
           --------------------------------------------- */

        return res.json({

            source,

            target,

            translations

        });


    }

    catch (error) {

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
   AUDIO / PIPER
   ========================================================= */

app.post("/api/audio", async (req, res) => {

    let outputFile = null;

    try {

        const {
            text,
            language
        } = req.body;


        /* ---------------------------------------------
           VALIDATION TEXTE
           --------------------------------------------- */

        if (
            typeof text !== "string" ||
            !text.trim()
        ) {

            return res.status(400).json({

                error:
                    "Texte manquant"

            });

        }


        if (text.length > 1000) {

            return res.status(400).json({

                error:
                    "Texte trop long (maximum 1000 caractères)"

            });

        }


        /* ---------------------------------------------
           VALIDATION LANGUE
           --------------------------------------------- */

        if (!language) {

            return res.status(400).json({

                error:
                    "Langue manquante"

            });

        }


        const voice =
            VOICES[language];


        if (!voice) {

            return res.status(400).json({

                error:
                    "Langue audio non supportée",

                supportedLanguages:
                    Object.keys(VOICES)

            });

        }


        /* ---------------------------------------------
           CHECK PIPER
           --------------------------------------------- */

        if (!fs.existsSync(PIPER_BIN)) {

            console.error(
                "[AUDIO] Piper introuvable:",
                PIPER_BIN
            );

            return res.status(500).json({

                error:
                    "Moteur Piper introuvable"

            });

        }


        /* ---------------------------------------------
           CHECK MODEL
           --------------------------------------------- */

        if (!fs.existsSync(voice.model)) {

            console.error(
                "[AUDIO] Modèle introuvable:",
                voice.model
            );

            return res.status(500).json({

                error:
                    "Modèle vocal introuvable",

                language,

                voice:
                    voice.name

            });

        }


        /* ---------------------------------------------
           FICHIER TEMPORAIRE
           --------------------------------------------- */

        const id =
            crypto.randomBytes(16)
                .toString("hex");

        outputFile =
            path.join(
                os.tmpdir(),
                `spe4knerd-${id}.wav`
            );


        /* ---------------------------------------------
           PIPER
           --------------------------------------------- */

        await new Promise(
            (resolve, reject) => {

                const piper =
                    spawn(
                        PIPER_BIN,
                        [
                            "--model",
                            voice.model,

                            "--output_file",
                            outputFile
                        ],
                        {
                            stdio: [
                                "pipe",
                                "pipe",
                                "pipe"
                            ]
                        }
                    );


                let stderr = "";


                piper.stderr.on(
                    "data",
                    data => {

                        stderr +=
                            data.toString();

                    }
                );


                piper.on(
                    "error",
                    error => {

                        reject(error);

                    }
                );


                piper.on(
                    "close",
                    code => {

                        if (code !== 0) {

                            reject(
                                new Error(
                                    `Piper exit code ${code}: ${stderr}`
                                )
                            );

                            return;

                        }


                        resolve();

                    }
                );


                piper.stdin.write(
                    text
                );

                piper.stdin.end();

            }
        );


        /* ---------------------------------------------
           CHECK OUTPUT
           --------------------------------------------- */

        if (
            !fs.existsSync(outputFile)
        ) {

            throw new Error(
                "Piper n'a pas généré le fichier WAV"
            );

        }


        const stats =
            fs.statSync(outputFile);


        if (stats.size === 0) {

            throw new Error(
                "Le fichier WAV généré est vide"
            );

        }


        console.log(
            `[AUDIO] ${language} ${voice.name} ${stats.size} bytes`
        );


        /* ---------------------------------------------
           RESPONSE
           --------------------------------------------- */

        res.setHeader(
            "Content-Type",
            "audio/wav"
        );

        res.setHeader(
            "Content-Length",
            stats.size
        );

        res.setHeader(
            "Cache-Control",
            "no-store"
        );


        res.sendFile(
            outputFile,
            error => {

                if (error) {

                    console.error(
                        "[AUDIO] sendFile error:",
                        error
                    );

                }


                /* -----------------------------------------
                   SUPPRESSION DU TEMPORAIRE
                   ----------------------------------------- */

                if (
                    outputFile &&
                    fs.existsSync(outputFile)
                ) {

                    fs.unlink(
                        outputFile,
                        unlinkError => {

                            if (unlinkError) {

                                console.error(
                                    "[AUDIO] Suppression temporaire:",
                                    unlinkError
                                );

                            }

                        }
                    );

                    outputFile = null;

                }

            }
        );


    }

    catch (error) {

        console.error(
            "[AUDIO] Exception:",
            error
        );


        if (
            !res.headersSent
        ) {

            return res.status(500).json({

                error:
                    "Erreur génération audio",

                details:
                    error.message

            });

        }


    }

    finally {

        /* ---------------------------------------------
           CLEANUP SI REPONSE NON ENVOYEE
           --------------------------------------------- */

        if (
            outputFile &&
            fs.existsSync(outputFile)
        ) {

            fs.unlink(
                outputFile,
                error => {

                    if (error) {

                        console.error(
                            "[AUDIO] Cleanup:",
                            error
                        );

                    }

                }
            );

        }

    }

});


/* =========================================================
   404
   ========================================================= */

app.use(
    (req, res) => {

        res.status(404).json({

            error:
                "Route introuvable"

        });

    }
);


/* =========================================================
   ERROR HANDLER
   ========================================================= */

app.use(
    (error, req, res, next) => {

        console.error(
            "[SERVER] Error:",
            error
        );

        if (
            res.headersSent
        ) {

            return next(error);

        }

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
            `Version    : 1.3.0`
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
            `Audio      : Piper`
        );

        console.log(
            `Piper      : ${PIPER_BIN}`
        );

        console.log(
            "========================================"
        );

    }
);