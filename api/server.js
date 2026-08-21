"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const app = express();


/* =========================================================
   CONFIGURATION
   ========================================================= */

const PORT = Number(process.env.PORT || 3003);

const LIBRETRANSLATE_URL =
    process.env.LIBRETRANSLATE_URL ||
    "http://127.0.0.1:5000";

const PIPER_BIN =
    process.env.PIPER_BIN ||
    "/opt/piper/venv/bin/piper";

const PIPER_VOICES_DIR =
    process.env.PIPER_VOICES_DIR ||
    "/opt/piper/voices";

const VERSION = "1.3.0";


/* =========================================================
   VOIX
   ========================================================= */

const VOICES = {

    fr: {
        name: "fr_FR-siwis-medium",
        model: path.join(
            PIPER_VOICES_DIR,
            "fr_FR-siwis-medium.onnx"
        )
    },

    es: {
        name: "es_MX-ald-medium",
        model: path.join(
            PIPER_VOICES_DIR,
            "es_MX-ald-medium.onnx"
        )
    }

};


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

    const voices = {};

    for (const [language, voice] of Object.entries(VOICES)) {

        voices[language] = {
            name: voice.name,
            available: fs.existsSync(voice.model)
        };

    }

    res.json({

        status: "ok",

        service:
            "SPE4Knerd API",

        version:
            VERSION,

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
           SOURCE = TARGET
           --------------------------------------------- */

        if (source === target) {

            return res.json({

                source,
                target,
                translations: texts

            });

        }


        /* ---------------------------------------------
           LIBRETRANSLATE
           --------------------------------------------- */

        const response =
            await fetch(
                `${LIBRETRANSLATE_URL}/translate`,
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body: JSON.stringify({

                        q: texts,

                        source,

                        target,

                        format: "text"

                    })

                }
            );


        const data =
            await response.json();


        /* ---------------------------------------------
           ERROR
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
           --------------------------------------------- */

        let translations;


        if (Array.isArray(data)) {

            translations =
                data.map(
                    item =>
                        item.translatedText
                );

        } else {

            translations = [
                data.translatedText
            ];

        }


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

    let outputFile = null;

    try {

        const {
            text,
            language
        } = req.body;


        /* ---------------------------------------------
           VALIDATION
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
           TEMP FILE
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

        console.log(
            `[AUDIO] ${language} → ${voice.name}`
        );


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
                                "ignore",
                                "pipe"
                            ]

                        }
                    );


                let stderr = "";


                piper.stderr.on(
                    "data",
                    chunk => {

                        stderr +=
                            chunk.toString();

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
                                    `Piper exited with code ${code}: ${stderr}`
                                )
                            );

                            return;

                        }


                        resolve();

                    }
                );


                piper.stdin.write(
                    text.trim()
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
                "Piper n'a produit aucun fichier audio"
            );

        }


        const stats =
            fs.statSync(outputFile);


        if (stats.size === 0) {

            throw new Error(
                "Le fichier audio est vide"
            );

        }


        console.log(
            `[AUDIO] WAV généré: ${stats.size} octets`
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


        const stream =
            fs.createReadStream(
                outputFile
            );


        stream.on(
            "error",
            error => {

                console.error(
                    "[AUDIO] Stream error:",
                    error
                );

            }
        );


        stream.on(
            "close",
            () => {

                fs.unlink(
                    outputFile,
                    () => {}
                );

                outputFile = null;

            }
        );


        stream.pipe(res);


    } catch (error) {

        console.error(
            "[AUDIO] Exception:",
            error
        );


        if (
            outputFile &&
            fs.existsSync(outputFile)
        ) {

            fs.unlink(
                outputFile,
                () => {}
            );

        }


        if (!res.headersSent) {

            return res.status(500).json({

                error:
                    "Erreur lors de la génération audio"

            });

        }

    }

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
            `Version    : ${VERSION}`
        );

        console.log(
            `Port       : ${PORT}`
        );

        console.log(
            "Translation: LibreTranslate"
        );

        console.log(
            `LT URL     : ${LIBRETRANSLATE_URL}`
        );

        console.log(
            "Audio      : Piper"
        );

        console.log(
            `Piper      : ${PIPER_BIN}`
        );

        console.log(
            "========================================"
        );

    }
);