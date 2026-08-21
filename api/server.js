"use strict";

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const app = express();

/* =========================================================
   CONFIGURATION
   ========================================================= */

const PORT = 3003;

const HOST =
    process.env.HOST ||
    "127.0.0.1";

const LIBRETRANSLATE_URL =
    process.env.LIBRETRANSLATE_URL ||
    "http://127.0.0.1:5000";

const PIPER_BIN =
    process.env.PIPER_BIN ||
    "/opt/piper/venv/bin/piper";

const PIPER_VOICES_DIR =
    process.env.PIPER_VOICES_DIR ||
    "/opt/piper/voices";

/* =========================================================
   VOIX
   ========================================================= */

const VOICES = {

    fr: {
        name: "fr_FR-siwis-medium",

        model:
            path.join(
                PIPER_VOICES_DIR,
                "fr_FR-siwis-medium.onnx"
            ),

        config:
            path.join(
                PIPER_VOICES_DIR,
                "fr_FR-siwis-medium.onnx.json"
            )
    },

    es: {
        name: "es_MX-ald-medium",

        model:
            path.join(
                PIPER_VOICES_DIR,
                "es_MX-ald-medium.onnx"
            ),

        config:
            path.join(
                PIPER_VOICES_DIR,
                "es_MX-ald-medium.onnx.json"
            )
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
   STARTUP
   ========================================================= */

console.log("========================================");
console.log(" SPE4Knerd API");
console.log("========================================");
console.log("Version    : 1.3.0");
console.log("Port       :", PORT);
console.log("Translation: LibreTranslate");
console.log("LT URL     :", LIBRETRANSLATE_URL);
console.log("Audio      : Piper");
console.log("Piper      :", PIPER_BIN);
console.log("Voices     :", PIPER_VOICES_DIR);
console.log("========================================");

/* =========================================================
   HEALTH
   ========================================================= */

app.get("/api/health", (req, res) => {

    const voices = {};

    for (
        const [language, voice]
        of Object.entries(VOICES)
    ) {

        voices[language] = {

            name:
                voice.name,

            model:
                voice.model,

            config:
                voice.config,

            available:
                fs.existsSync(voice.model) &&
                fs.existsSync(voice.config)

        };

    }

    res.json({

        status:
            "ok",

        service:
            "SPE4Knerd API",

        version:
            "1.3.0",

        translation:
            true,

        translationEngine:
            "LibreTranslate",

        audio:
            true,

        audioEngine:
            "Piper",

        piper:
            fs.existsSync(PIPER_BIN),

        piperBinary:
            PIPER_BIN,

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

        if (
            typeof source !== "string" ||
            typeof target !== "string"
        ) {

            return res.status(400).json({

                error:
                    "source et target sont obligatoires"

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

        const cleanTexts =
            texts.map(text =>
                typeof text === "string"
                    ? text.trim()
                    : ""
            );

        /* ---------------------------------------------
           MÊME LANGUE
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
           ERREUR
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

        let translations = [];

        if (
            data &&
            Array.isArray(
                data.translatedText
            )
        ) {

            translations =
                data.translatedText;

        }

        else if (
            data &&
            typeof data.translatedText ===
                "string"
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
                        typeof item.translatedText ===
                            "string"
                    ) {

                        return item.translatedText;

                    }

                    return "";

                });

        }

        /* ---------------------------------------------
           CONTRÔLE
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
                    translations.length

            });

        }

        console.log(
            `[TRANSLATE] ${cleanTexts.length} phrase(s) ${source} → ${target}`
        );

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
   PIPER
   ========================================================= */

function generateAudio(
    text,
    voice,
    outputFile
) {

    return new Promise(
        (resolve, reject) => {

            console.log(
                "[AUDIO] Piper démarrage"
            );

            console.log(
                "[AUDIO] Model:",
                voice.model
            );

            console.log(
                "[AUDIO] Output:",
                outputFile
            );

            const piper =
                spawn(
                    PIPER_BIN,
                    [
                        "--model",
                        voice.model,

                        "--config",
                        voice.config,

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

            let stdout = "";
            let stderr = "";

            /* -----------------------------------------
               STDOUT
               ----------------------------------------- */

            piper.stdout.on(
                "data",
                data => {

                    stdout +=
                        data.toString();

                }
            );

            /* -----------------------------------------
               STDERR
               ----------------------------------------- */

            piper.stderr.on(
                "data",
                data => {

                    const chunk =
                        data.toString();

                    stderr += chunk;

                    console.error(
                        "[PIPER]",
                        chunk.trim()
                    );

                }
            );

            /* -----------------------------------------
               ERREUR PROCESSUS
               ----------------------------------------- */

            piper.on(
                "error",
                error => {

                    console.error(
                        "[AUDIO] Piper process error:",
                        error
                    );

                    reject(error);

                }
            );

            /* -----------------------------------------
               FIN
               ----------------------------------------- */

            piper.on(
                "close",
                code => {

                    console.log(
                        "[AUDIO] Piper terminé, code:",
                        code
                    );

                    if (code !== 0) {

                        const error =
                            new Error(
                                `Piper exited with code ${code}: ${stderr}`
                            );

                        reject(error);

                        return;

                    }

                    if (
                        !fs.existsSync(
                            outputFile
                        )
                    ) {

                        reject(
                            new Error(
                                "Piper terminé mais aucun WAV n'a été créé"
                            )
                        );

                        return;

                    }

                    const stats =
                        fs.statSync(
                            outputFile
                        );

                    if (
                        stats.size === 0
                    ) {

                        reject(
                            new Error(
                                "Piper a créé un fichier WAV vide"
                            )
                        );

                        return;

                    }

                    console.log(
                        "[AUDIO] WAV créé:",
                        stats.size,
                        "bytes"
                    );

                    resolve();

                }
            );

            /* -----------------------------------------
               ENVOI DU TEXTE À PIPER
               ----------------------------------------- */

            piper.stdin.write(
                text.trim()
            );

            piper.stdin.write(
                "\n"
            );

            piper.stdin.end();

        }
    );

}

/* =========================================================
   AUDIO API
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

        if (
            text.length > 1000
        ) {

            return res.status(400).json({

                error:
                    "Texte trop long"

            });

        }

        /* ---------------------------------------------
           VALIDATION LANGUE
           --------------------------------------------- */

        if (
            typeof language !== "string"
        ) {

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
                    `Langue audio non supportée : ${language}`

            });

        }

        /* ---------------------------------------------
           PIPER
           --------------------------------------------- */

        if (
            !fs.existsSync(
                PIPER_BIN
            )
        ) {

            return res.status(500).json({

                error:
                    "Piper introuvable",

                path:
                    PIPER_BIN

            });

        }

        /* ---------------------------------------------
           MODÈLE
           --------------------------------------------- */

        if (
            !fs.existsSync(
                voice.model
            )
        ) {

            console.error(
                "[AUDIO] Modèle introuvable:",
                voice.model
            );

            return res.status(500).json({

                error:
                    "Modèle Piper introuvable",

                model:
                    voice.model

            });

        }

        /* ---------------------------------------------
           CONFIG
           --------------------------------------------- */

        if (
            !fs.existsSync(
                voice.config
            )
        ) {

            console.error(
                "[AUDIO] Config introuvable:",
                voice.config
            );

            return res.status(500).json({

                error:
                    "Configuration Piper introuvable",

                config:
                    voice.config

            });

        }

        /* ---------------------------------------------
           FICHIER TEMPORAIRE
           --------------------------------------------- */

        const id =
            crypto
                .randomBytes(16)
                .toString("hex");

        outputFile =
            path.join(
                "/tmp",
                `spe4knerd-${id}.wav`
            );

        console.log(
            `[AUDIO] Génération ${language} ${voice.name}`
        );

        /* ---------------------------------------------
           GÉNÉRATION PIPER
           --------------------------------------------- */

        await generateAudio(
            text,
            voice,
            outputFile
        );

        /* ---------------------------------------------
           ENVOI
           --------------------------------------------- */

        console.log(
            "[AUDIO] Envoi:",
            outputFile
        );

        res.sendFile(
            outputFile,
            {
                headers: {

                    "Content-Type":
                        "audio/wav",

                    "Cache-Control":
                        "no-store"

                }
            },
            error => {

                if (error) {

                    console.error(
                        "[AUDIO] sendFile error:",
                        error
                    );

                    if (
                        !res.headersSent
                    ) {

                        res.status(
                            error.statusCode ||
                            500
                        ).json({

                            error:
                                "Erreur lors de l'envoi audio"

                        });

                    }

                }

                /* -------------------------------------
                   SUPPRESSION APRÈS ENVOI
                   ------------------------------------- */

                fs.unlink(
                    outputFile,
                    unlinkError => {

                        if (
                            unlinkError &&
                            unlinkError.code !==
                                "ENOENT"
                        ) {

                            console.error(
                                "[AUDIO] Nettoyage impossible:",
                                unlinkError
                            );

                        }

                        else {

                            console.log(
                                "[AUDIO] Fichier temporaire supprimé"
                            );

                        }

                    }
                );

            }
        );

        /*
         * IMPORTANT :
         *
         * On ne met PAS outputFile = null ici.
         *
         * Le callback sendFile() doit pouvoir
         * supprimer le fichier.
         */

    }

    catch (error) {

        console.error(
            "[AUDIO] Exception:",
            error
        );

        /* ---------------------------------------------
           NETTOYAGE SI ERREUR AVANT sendFile()
           --------------------------------------------- */

        if (
            outputFile &&
            fs.existsSync(outputFile)
        ) {

            try {

                fs.unlinkSync(
                    outputFile
                );

            }

            catch (cleanupError) {

                console.error(
                    "[AUDIO] Erreur nettoyage:",
                    cleanupError
                );

            }

        }

        if (
            !res.headersSent
        ) {

            return res.status(500).json({

                error:
                    "Erreur interne du serveur",

                details:
                    error.message

            });

        }

    }

});

/* =========================================================
   404
   ========================================================= */

app.use(
    "/api",
    (req, res) => {

        res.status(404).json({

            error:
                "Endpoint API introuvable"

        });

    }
);

/* =========================================================
   ERREURS EXPRESS
   ========================================================= */

app.use(
    (error, req, res, next) => {

        console.error(
            "[EXPRESS] Error:",
            error
        );

        if (
            res.headersSent
        ) {

            return next(error);

        }

        res.status(500).json({

            error:
                "Erreur serveur"

        });

    }
);

/* =========================================================
   DÉMARRAGE
   ========================================================= */

app.listen(
    PORT,
    HOST,
    () => {

        console.log(
            `SPE4Knerd API listening on ${HOST}:${PORT}`
        );

    }
);