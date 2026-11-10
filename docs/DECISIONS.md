# Decisions

One line per decision: date, decision, why. Newest at the bottom.

| Date | Decision | Why |
|---|---|---|
| 2026-11-09 | For Franco first, then 5–20 friends; no payments | Prove it works for him before opening it |
| 2026-11-09 | PC browser only | Easiest for 3D, mic and headset; mobile later if ever |
| 2026-11-09 | 0–10 $/month; each user brings their own free API key | Budget; free quotas multiply with users |
| 2026-11-09 | Corrections by recast during the talk + French debrief at the end | Keeps the talk fluid, still explains every mistake |
| 2026-11-09 | VRoid / VRM cel-shaded characters, no webcam | VRM has lookAt, expressions and visemes built in; privacy and simplicity |
| 2026-11-09 | Singing: karaoke with a score, duet with the character, songs from mistakes | Franco's choice |
| 2026-11-09 | AI characters only, no multiplayer, no leaderboard | Keeps the site static, no game server |
| 2026-11-09 | Import of the learner's own documents | Goal: understand teaching documents |
| 2026-11-09 | American and British accents | Franco's choice |
| 2026-11-09 | v1 scenes: office, café, street; cast Jake / Emma / Maya | Franco approved the cast |
| 2026-11-09 | Challenges: missions, daily challenge, expressions to place | Franco's choice |
| 2026-11-09 | Progress in a free online account (Supabase); voice never stored | Follows the user across computers; privacy |
| 2026-11-09 | From Duolingo: spaced repetition, adaptive difficulty, "Pourquoi ?" button, character memory, real-speaking streak, detailed score + scene map. Rejected: hearts, leagues | Duolingo analysis; speaking is Duolingo's weak point and our focus |
| 2026-11-09 | Free-licence VRM first; Franco creates his own characters in VRoid Studio later | Phase 0 can start at once |
| 2026-11-09 | Headset with mic | No speaker echo to fight |
| 2026-11-09 | Stack: Vite + TS, three.js + three-vrm, Gemini Live (BYOK), GitHub Pages, Supabase from phase 3 | Free, browser-only, fits the GTX 1070 |
| 2026-11-09 | Code and technical docs in English; STATE.md and test guides in French | Franco reads and validates them |
| 2026-11-09 | Models: Fable 5.2 for phases 0 and 6, Opus 5.5 for the rest | Use the most capable model where the risk is highest |
| 2026-11-09 | Phase 0 voice model: `gemini-3.8-live` (default); `gemini-3.1-flash-live-preview` selectable as a backup | Checked on <https://aistudio.google.com/docs/models>: 3.8 Live is the current Live model, 3.1 Flash Live is marked legacy, the 2.5 native-audio model is limited to existing users. The pricing page lists all of them as "free of charge" on the free tier, without published limits |
| 2026-11-09 | Live API called with `apiVersion: "v1beta"` first, then `v1`, then `v1alpha` if the handshake is refused | Measured from the build session: `@google/genai` 3.0.0 defaults to `v1`, whose Live WebSocket endpoint answers HTTP 404; `v1beta` accepts the handshake (HTTP 101) and answers a fake key with close code 1007 "API key not valid" |
| 2026-11-09 | Live session config: audio out only, input + output transcription on, server voice detection with `silenceDurationMs: 500`, sliding-window context compression, session resumption | Docs (<https://aistudio.google.com/docs/live-api/capabilities>, `/session-management`): server default silence ≈ 800 ms and 500–800 ms is recommended, so 500 ms cuts the delay; audio sessions stop at 15 min without compression; a connection lives about 10 min, so the 10-minute acceptance talk needs resumption on `goAway` |
| 2026-11-09 | Jake's voice: `Puck` by default, five others selectable | Voice names come from memory of the Gemini TTS voice list, **not checked** in the docs (the Live page only shows `Kore`). If Google rejects one, pick another in the settings |
| 2026-11-09 | Phase 0 character: VRoid sample `HairSample_Male.vrm` (CC0, VRM 0.x), committed in `public/models` | CC0 is written in the file's own metadata; a male model fits Jake; see `docs/ASSETS.md` |
| 2026-11-09 | Lip sync = loudness of the output audio + a three-band split (100–600 / 600–2200 / 2200–7000 Hz) mapped to the five VRM visemes | As the brief asks: cheap, in sync, mouth closed in silences. Not phoneme-accurate; revisit only if Franco finds it unconvincing |
| 2026-11-09 | Delay shown on screen = last microphone frame above an adaptive loudness threshold → first audio chunk of Jake's answer, median of the last 10 turns | It is what the learner feels (it includes Google's 500 ms end-of-speech wait). Measured in the browser, so it does not depend on Google reporting timings |
| 2026-11-09 | Idle motion is procedural (bones moved by code), no animation clips yet | No licence question in phase 0; clips and retargeting belong to phase 2 |
| 2026-11-09 | One workflow builds, tests and deploys to GitHub Pages on every push to `main` or `phase-*`; the Pages site shows the last branch pushed | One Pages site per repo: simple and enough while there is one working branch at a time |
| 2026-11-10 | "Ton rythme de parole" setting: the end-of-turn silence is chosen by the learner (500 / 900 / 1500 ms), default 500 ms | Franco's request after the first test: learners who pause to search for a word must not be cut off. Cost: the same time is added to every answer, so the on-screen delay rises with it. The Live API only offers a silence duration, not a detection of unfinished sentences; a smarter end-of-turn detection would mean running our own detector in the browser (parked in STATE.md) |
| 2026-11-10 | Transcription gets the language hint `languageCodes: ["en-US"]` (input and output); if Google refuses the setup, the app reconnects once without it | Franco saw his words badly written while Jake understood him: the transcript is produced by a separate recogniser, not by the voice model. The field exists in `@google/genai` 3.0.0 (`AudioTranscriptionConfig`); its effect and its acceptance by the Gemini API are **not measured**. Transcription mode stays `VERBATIM` (default) so the learner's mistakes are kept for phase 1 |
| 2026-11-10 | Default speaking pace is now "Posé" (900 ms of silence ends a turn) | Franco's test: at 500 ms Jake often started while he was still talking; at 900 ms Jake lets him finish, for about +0.4 s of delay (median 1.42 s measured, target 1.5 s) |
| 2026-11-10 | Phase 0 validated by Franco; Gemini Live free tier kept as the voice pipeline, no fallback built | Measured with his free key: 11 min 43 without a rejection or a drop, median delay 1.0–1.4 s |
