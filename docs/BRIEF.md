# English Buddy — Build brief

Framing agreed with Franco on 2026-11-09 (framing session in the `Channel`
repo). This file is the reference for every build session. Decisions are
logged in [DECISIONS.md](DECISIONS.md); where we are is in
[STATE.md](STATE.md).

## 1. What we are building

A web platform, used on a PC in the browser, where the learner **speaks
English out loud with illustrated 3D characters** (VRoid / VRM, cel-shaded,
not realistic). The characters look at the learner, walk in their scene,
greet, fist-bump, laugh, ask questions, react, and sing. During the talk they
correct by **recasting** (repeating the learner's sentence in the right form,
without breaking the flow); a **debrief in French** at the end explains each
mistake. The platform remembers the learner, schedules reviews of their own
mistakes, sets challenges, and tracks progress from B1 towards C1.

### Franco's goals (the "why")

- Be taken more seriously at work thanks to his English.
- Understand English teaching documents better.
- Approach native speakers and talk fluently with them.
- Fit into English-speaking communities.
- Speak in every setting: work, family, street, restaurant, conference,
  school.

### Users and scale

- Franco first (current level about **B1**: understands well in writing,
  searches for words when speaking, struggles with fast native speech).
- Then 5 to 20 friends and family. No payments, no public launch.
- AI characters only. No multiplayer. No leaderboard.

### Hard constraints

| Constraint | Value |
|---|---|
| Device | PC, desktop browser (Chrome). Mobile is out of scope. |
| Franco's PC | NVIDIA GTX 1070 (8 GB), Windows + WSL2 |
| Audio | Headset with microphone (no speaker echo to handle; add a simple safeguard anyway) |
| Network | Wi-Fi, assumed stable |
| AI budget | 0–10 $/month in total. **Bring your own key**: every user pastes their own free API key(s). |
| Hosting | Free (GitHub Pages for the front end; Supabase free tier from phase 3) |
| Interface language | French UI and French debriefs; conversations in English |
| Accents | American and British |
| Voice recordings | **Never stored.** Only text is kept. |
| Repository | `Johnfrancis6/english-buddy` is **public**: no key, token or secret is ever committed |

## 2. Feature scope (version 1)

### Conversations

- Real-time voice conversation with one character at a time.
- Correction policy: recast during the talk; at the end, a debrief that lists
  mistakes by type with the correct form and a French explanation; a
  **"Pourquoi ?"** button on each correction gives a deeper explanation.
- Adaptive difficulty: speech rate, vocabulary and mission difficulty follow
  the learner profile (level, recent mistakes).
- **Character memory**: each character remembers facts about the learner
  (job, family, plans, the last conversation) and brings them up naturally.

### Characters and scenes (cast approved by Franco)

| Scene | Character | Profile |
|---|---|---|
| Café / restaurant | **Jake**, American, ~28 | Waiter turned friend. Joker, relaxed. Fist bump, loud laugh, everyday slang. |
| Office / meeting / interview | **Emma**, British, ~35 | Team manager. Polite, demanding, kind. Interviews, meetings, negotiation. |
| Street / park / meeting people | **Maya**, American, ~24 | Curious, chatty student, music fan. Meeting people, asking the way, small talk. **Sings duets with the learner.** |
| Later: conference / school | A British speaker (to be designed) | Out of v1 scope |

Behaviours every character needs: idle, blink, look at the camera (the
learner), walk within the scene, wave hello, fist bump, laugh, nod, think,
talk with lip sync, sing (Maya).

### Challenges and habit (taken from the Duolingo analysis)

- **Missions** inside a scene ("get a table on the terrace without saying
  *table*"), passed or failed, with a score.
- **Daily challenge**: about 5 minutes, built from the reviews that are due.
- **Expressions to place**: 3 to 5 expressions to use naturally in the talk;
  the character notices when they are used.
- **Spaced repetition** of the learner's own mistakes and new expressions,
  from talks and imported documents (FSRS algorithm, e.g. the `ts-fsrs`
  library).
- **Streak** that counts a day **only if the learner really spoke** (at least
  3 minutes of the learner's own speech), with one streak freeze per week.
- **Detailed score** per skill (fluency, grammar, vocabulary, listening,
  pronunciation) inside the B1 / B2 / C1 bands, and a **scene map** where
  harder scenes unlock as the score grows.
- Explicitly rejected: "hearts" or lives lost on mistakes, and leagues.

### Documents

- Import a PDF or a web link; study it with a character: explain hard
  vocabulary, ask questions about it, add words to the review queue.
- Full document text stays in the browser (IndexedDB); only extracted
  vocabulary and the title go to the account.

### Singing

- **Karaoke with a score**: lyrics on screen, the learner sings, the score is
  per word for pronunciation and timing. Only songs that are public domain
  or written for the platform (no copyrighted songs).
- **Duet** with Maya (she sings and dances).
- **Songs written from the learner's difficulties**: short lyrics built from
  frequent mistakes and the day's vocabulary.

### Progress tracking

- Mistakes by type and their trend week after week.
- Estimated level (B1 → B2 → C1) per skill; label it as an estimate.
- New words acquired, speaking time, average sentence length.
- Pronunciation score per word and hard sounds (th, h, r…).

### Accounts

- Free account (Supabase auth) so progress follows the user on any computer.
- Each user's API keys stay in their own browser (`localStorage`), never sent
  to our database.

## 3. Architecture

```
Browser (static site on GitHub Pages)
├── UI (French) ─ Vite + TypeScript
├── 3D ─ three.js + @pixiv/three-vrm (MToon / toon shading for scenes too)
│   ├── lookAt → camera, blink, expressions, visemes (aa ih ou ee oh)
│   └── animation clips retargeted onto VRM humanoid bones
├── Voice ─ Gemini Live API over WebSocket, user's own key (@google/genai)
│   ├── mic 16 kHz PCM in → audio out (24 kHz PCM) → WebAudio
│   ├── input + output transcription enabled (needed for corrections)
│   └── lip sync: AnalyserNode on the output audio → viseme weights
├── Analysis after each talk ─ Gemini text model, structured JSON output
│   └── mistakes, recasts, vocabulary, skill scores, memory facts
├── Reviews ─ ts-fsrs, daily challenge builder
└── Storage
    ├── localStorage: API keys, UI preferences
    ├── IndexedDB: full transcripts, imported documents
    └── Supabase (phase 3+): profile, mistakes, vocabulary, scores,
        character memory, streak — Row Level Security on every table
```

Rules for the architecture:

- **Check current model names and API shapes in the official docs** before
  coding (Gemini Live models change often; do not hard-code a name from
  memory). Record the chosen model in DECISIONS.md.
- Keep providers behind small interfaces (`VoiceSession`, `Analyzer`,
  `PronunciationScorer`) so a fallback can be swapped in.
- **Fallback voice pipeline** (if Gemini Live free tier fails or latency is
  bad): turn by turn = Groq Whisper (speech to text, free tier) + Gemini text
  model + a text-to-speech voice. Expect 1–2 s of delay.
- No backend server of our own in v1. Supabase is the only service we host.
- Assets: prefer **CC0** (Quaternius, Kenney…). Every third-party asset is
  listed in `docs/ASSETS.md` with source URL and licence. Mixamo files must
  not be published as raw files in this public repo; check the licence
  before using any Mixamo animation and log the decision.

## 4. Phases

Each phase ends with a deployed preview, a French test guide in
`docs/tests/phase-N.md`, and a stop: **nothing moves to the next phase
without Franco's go**. A phase may take several sessions.

| # | Phase | Main content | Recommended model |
|---|---|---|---|
| 0 | Risky links test | One free VRM in a simple scene, looks at you, blinks, talks live through Gemini with your key, lip sync; latency measured on screen | Fable 5.2 |
| 1 | Teaching conversation | Jake persona prompt, recast policy, live transcript, end-of-talk debrief in French, "Pourquoi ?" button | Opus 5.5 |
| 2 | Characters and scenes | Café, office, street scenes; Jake, Emma, Maya; walk, wave, fist bump, laugh, nod; scene picker | Opus 5.5 |
| 3 | Memory and progress | Character memory (facts about the learner, last talk) kept in the browser (IndexedDB); progress dashboard: mistakes by type week by week, speaking time, new words, level estimate (B1/B2/C1, shown as an estimate); Supabase accounts prepared but optional (code + SQL file, local-first; Franco activates it on his return) | Opus 5.5 |
| 4 | Habit and challenges | FSRS reviews of the learner's own mistakes (ts-fsrs), 5-minute daily challenge, missions in scenes with a score, expressions to place, streak (≥ 3 min of real speech, one freeze per week), scene map | Opus 5.5 |
| 5 | Onboarding and documents | French onboarding with a guide to create free keys (moved from phase 8); PDF import and study with a character, words to review (web links only where the site allows it) | Opus 5.5 |
| 6 | Pronunciation | Per-word score, hard sounds; compare free options first | Opus 5.5 |
| 7 | Singing | Spike first (what can sing for free?), then karaoke with a score, duet with Maya, songs from mistakes | Fable 5.2 |
| 8 | Launch prep | Polish, final harmonisation, full French test guide; stop before inviting friends and before merging to `main` (Franco decides) | Opus 5.5 |

Estimate: 15 to 24 build sessions, about 4 to 6 weeks with Franco's test
pauses.

### Phase 0 in detail (the first build session)

Goal: prove the two least-proven links (free real-time voice, a VRM that
talks convincingly) before building anything else.

1. Scaffold: Vite + TypeScript, `three`, `@pixiv/three-vrm`, `@google/genai`;
   ESLint/Prettier; Vitest for logic; one Playwright smoke test (page loads,
   canvas renders). Chromium is pre-installed in cloud sessions.
2. A settings panel (French) where the user pastes the Gemini key; stored in
   `localStorage` only; a clear "cette clé reste dans ton navigateur" note.
3. Load one **free-licence VRM** (check the licence, log it in
   `docs/ASSETS.md`), placed in a simple lit scene (floor, background colour,
   soft light). Camera at eye level.
4. The character looks at the camera (`vrm.lookAt`), blinks at random
   intervals, breathes / sways in idle.
5. "Démarrer" button → Gemini Live session with a short Jake persona
   (American, friendly, speaks slowly enough for B1, short turns). Microphone
   with echo cancellation on. The learner can interrupt.
6. Lip sync driven by the output audio (amplitude and a simple band split →
   visemes). Mouth must close in silences.
7. On-screen debug overlay: time from end of the learner's speech to the
   first audio byte (median of the last 10 turns), session state, errors in
   plain French.
8. Graceful handling: missing or wrong key, mic refused, free-tier
   rejection, WebSocket drop (offer to reconnect).
9. GitHub Actions: build, tests, deploy to GitHub Pages (see §6).
10. Write `docs/tests/phase-0.md` (French): what to do, what to look at, what
    to report.

Acceptance (Franco tests it):

- The link opens, the key is pasted once and remembered.
- Jake looks at you, blinks, moves a little; nothing is frozen or broken.
- You say "Hey, how are you doing?" and he answers in English with a natural
  voice; the median delay shown is **under 1.5 s** (to be measured, not
  assumed).
- The lips follow the voice and close in silences.
- You can interrupt him.
- A 10-minute talk runs without a free-tier rejection or a drop. If it fails,
  record exactly what happened and test the fallback pipeline before
  phase 1.

## 5. Teaching design notes (for phases 1–4)

- Character system prompt = persona + scene + mission + learner profile
  (level, top recent mistakes, expressions to place, memory facts) +
  correction policy. Policy: recast, never lecture during the talk, keep
  turns short, ask open questions, slow down and simplify when the learner
  struggles, switch to French only if the learner asks.
- Analysis runs on the transcript after the talk (structured JSON): mistakes
  `{type, said, correct, explanation_fr}`, new vocabulary, skill sub-scores,
  mission result, expressions used, memory facts to keep.
- **Risk to test in phase 1**: speech-to-text may silently "fix" the
  learner's grammar, which would hide mistakes. Compare the Live API input
  transcription with Groq Whisper on the same sentences with deliberate
  mistakes; choose the source that keeps the mistakes.
- Mistake taxonomy (start set, extend as needed): verb tense, agreement,
  articles, prepositions, word order, false friends (French → English),
  vocabulary choice, register, pronunciation.
- Level estimate: map sub-scores to bands; always show it as an estimate.

## 6. Delivery workflow

- Branches: build sessions push to their working branch; the preview site
  is deployed from that push so Franco can test. When a phase is validated,
  a pull request merges it into `main`, which Franco merges.
- GitHub Pages via Actions. One-time settings Franco must do (the session
  gives him the exact clicks in French): Settings → Pages → Source "GitHub
  Actions"; if the `github-pages` environment blocks the working branch,
  allow it under Settings → Environments.
- Vite `base` must match the Pages path (`/english-buddy/`).
- Tests green before every push: `npm test` (Vitest) and the Playwright
  smoke test (`--trace off`).

## 7. Franco's tasks outside the code

| When | Task |
|---|---|
| Now | Install the Claude GitHub App on `english-buddy` (pushes are refused until then) |
| Phase 0 | Enable GitHub Pages; paste his Gemini key in the test page |
| From phase 0, before phase 2 | Create Jake, Emma and Maya in VRoid Studio from the character sheets the build session writes (`docs/characters.md`); export VRM 1.0 |
| Phase 3 | Create a free Supabase project and give the project URL and the anon key (public by design, protected by Row Level Security) |
| Phase 7 | Maybe create an account for a pronunciation service, depending on the comparison |
| Every phase | Test with the French guide and give a go / no-go with remarks |

## 8. Risks, most uncertain first

1. **Gemini Live free tier**: Google no longer publishes the free-tier
   limits, and developers report rejections below the shown limits.
   Phase 0 measures it; the fallback pipeline is designed in.
2. **Singing duet**: free singing voices are weak. Spike before building;
   karaoke and songs from mistakes are safer than the duet.
3. **Mistakes hidden by speech-to-text** (see §5).
4. **Free pronunciation scoring**: options to compare in phase 7.
5. **Animation licences**: prefer CC0; Mixamo raw files are not
   redistributable.
6. **Keys in a public repo**: never commit a key; keys live in the browser.

## 9. Sources checked during framing (2026-11-09)

- Gemini Live free tier limits: <https://discuss.ai.google.dev/t/native-audio-live-free-tier-setup-quota-rejection-below-visible-tpm-which-admission-metric-applies/186840>,
  <https://firebase.google.com/docs/ai-logic/live-api/limits-and-specs>
- Groq Whisper limits: <https://console.groq.com/docs/rate-limits>
- three-vrm lookAt, visemes, Mixamo retargeting:
  <https://www.pkgstats.com/pkg:vrm-mixamo-retarget>,
  <https://pixiv.github.io/three-vrm/packages/three-vrm/examples/humanoidAnimation/mixamoVRMRigMap.js>
- Duolingo analysis: spaced repetition (Settles & Meeder, ACL 2016), Video
  Call with Lily, Adventures, Duolingo Score:
  <https://blog.duolingo.com/duolingo-max>, <https://blog.duolingo.com/adventures>,
  <https://blog.duolingo.com/duolingo-score/>,
  <https://www.techlearning.com/news/does-duolingo-work>
