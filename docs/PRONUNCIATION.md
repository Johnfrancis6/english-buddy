# Pronunciation scoring — free options compared (phase 6)

Written on 2026-11-10 from the official docs of the day and from requests
made from the build session. **No real key was available**: nothing below
measures the accuracy of a scorer on a real voice. "Measured" means a fact
checked by a request or a file listing; "docs" means read in the provider's
documentation; "assumed" is a judgement.

Constraints (BRIEF.md): browser only, no server of ours, each user's own key,
0–10 $ a month in total, no voice stored, friends who are not technical.

## The options

| | Gemini Flash (audio in, structured JSON) | Groq Whisper (`verbose_json`, word timestamps) | Azure Speech Pronunciation Assessment | Phoneme model in the browser (transformers.js / ONNX) |
|---|---|---|---|---|
| What it returns | Whatever we ask in the schema: a score per word, the sound at fault, what it heard, a French tip | The words it recognised, with start/end times; per segment `avg_logprob`, `no_speech_prob`. **No confidence per word** (docs) | Accuracy 0–100 per **phoneme**, syllable (en-US), word and sentence; fluency, completeness, prosody (en-US); error type per word: mispronunciation, omission, insertion (docs) | Phonemes heard (IPA or TIMIT set); scoring = our own alignment against expected phonemes |
| Per word | Yes (judgement) | Only "recognised or not" | Yes (measured acoustically) | Yes, after our own alignment |
| Per sound | Yes, from our enum (th, h, r, vowels, -ed, stress) — judgement | No | Yes: each phoneme has its score (we map `th`/`dh`/`hh`/`r`/`ih`/`iy`/`uh`/`uw`) | Yes, but only as good as our alignment and G2P |
| Word stress | Asked in the prompt (judgement) | No | Prosody score for the sentence (en-US); no per-word stress in the REST answer | No (phonemes only) |
| Likely precision for a French speaker | **Unknown, assumed medium**: a language model listening to audio; no doc claims pronunciation skills (the audio page lists transcription, sound understanding, timestamps). Risks: too kind, or invents problems; scores may drift between runs | **Low sensitivity, assumed**: Whisper is built to understand accented speech, so it recognises many badly said words; its language model can guess a word from context. Useful only as a check ("not even recognised") | **Highest, assumed from its design**: a model made for this task, phoneme by phoneme. Still: tuned on native references, so a French accent with correct sounds may lose points | Unknown; depends on the model (trained on native speech: TIMIT, Common Voice) and on our alignment code |
| Weight in the browser | 0 (a request) | 0 (a request) | 0 with the REST API (the Speech SDK would add several MB; not needed) | **Measured** (Hugging Face file listing, 2026-11-10): `wav2vec2-lv-60-espeak-cv-ft-ONNX` 197 MB (q4f16) to 1.26 GB (fp32), 318 MB int8; `speako-phoneme-recognizer` 355 MB (q8); plus a pronunciation dictionary (~4 MB) and onnxruntime-web. CPU (WASM) speed unknown |
| Account | None more: the Gemini key every user already has | The optional Groq key (free, phase 1) | **An Azure account** + a Speech resource (F0). Azure sign-up usually asks for a card for identity (assumed, not checked with an account) | None |
| Free limits | Free tier "free of charge" without published limits (pricing page, phase 1); audio = 32 tokens per second (docs). One sentence ≈ 160 tokens of audio | Free plan; exact limits only visible in an account (phase 1); minimum billed length 10 s per request (docs) — irrelevant on the free plan | F0: 5 audio hours a month of speech to text (pricing page). The page does not say whether pronunciation assessment draws on it; Microsoft Q&A says it is billed as standard speech to text → assumed inside the 5 hours. At ~5 s per sentence: ~3,600 sentences a month. Blocked, not billed, at the limit (Q&A) | Unlimited (runs locally) |
| From the browser | Yes (used since phase 1) | Yes (CORS measured in phase 1) | **Yes, measured**: the regional endpoint answers the CORS preflight with `access-control-allow-origin: *` and allows `ocp-apim-subscription-key`, `pronunciation-assessment`; a fake key gets 401 | Yes |
| Audio limits | 20 MB per request inline (docs) | 25 MB (docs) | 30 s for pronunciation assessment over REST (docs) | Memory |

Sources: <https://aistudio.google.com/docs/audio>,
<https://console.groq.com/docs/speech-to-text>,
<https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment>,
<https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short>,
<https://azure.microsoft.com/en-us/pricing/details/speech/>,
<https://huggingface.co/onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX>,
<https://huggingface.co/robg/speako-phoneme-recognizer>.

## Choice

1. **Default, for everyone: Gemini Flash**, with the key every learner
   already has. One request per sentence: the WAV and the sentence go in,
   a JSON per word comes out (score, sounds at fault from a fixed enum,
   what it heard, a French tip). Zero weight, zero new account.
2. **Cross-check when a Groq key is present: Whisper** with word timestamps.
   A word of the sentence that Whisper did not recognise cannot score above
   55, whatever Gemini says. This guards against the main risk of a
   language-model judge (being too kind) with a signal that does not come
   from the same model.
3. **Optional, the most precise: Azure Pronunciation Assessment**, if the
   learner pastes an Azure Speech key and region in the settings. It then
   replaces Gemini. Recommended for Franco (5 free hours a month is plenty),
   not required: it needs an Azure account, which is too much to ask of
   every friend. Added to "À faire au retour" in STATE.md.
4. **Rejected for v1: a phoneme model in the browser.** 200–350 MB to
   download before the first sentence, plus a dictionary and alignment code
   of our own, for a precision nobody has measured on French speakers.
   Worth revisiting only if the online options disappoint.

Everything is shown as an **estimation**: the score of a read sentence,
from a machine.

## How it works in the app

- `PronunciationScorer` (`src/pronunciation/types.ts`): `score({ wav,
  reference })` → per-word scores, sounds, overall. Implementations:
  `GeminiScorer`, `WhisperCheckedScorer` (wraps the main one), `AzureScorer`;
  `makeScorer()` picks from the keys present.
- A take is recorded from the chosen microphone (16 kHz PCM), kept in
  memory, sent once as WAV, then dropped. Only the sentence and the scores
  are stored (IndexedDB v5, store `pron`, last 500 attempts).
- Sentences: due "sound" cards first, then the learner's own lessons
  (right forms of their mistakes, example sentences of their words) with the
  most hard sounds, then a bank of 24 sentences written for the platform
  (4 per sound), weakest sounds first; a new learner meets all six sounds.
- Sounds (th, h, r, short/long vowels, -ed, word stress) are tagged from the
  spelling by a small rule set (`src/pronunciation/sounds.ts`): a guide for
  choosing sentences and grouping scores, not a phonetic dictionary.
- FSRS: a word below 60 becomes a "sound" card (word, its sentence, the
  tip). When it comes back in the exercise, its score grades the card
  (≥ 90 easy, ≥ 70 good, ≥ 55 hard, else again). Flash reviews show it too
  (self-graded).
- "Mes progrès": a "Prononciation" bar (mean of the last 20 sentences, kept
  out of the B1/B2/C1 level) and "Sons à travailler" (mean per sound over 30
  days, weakest first).
