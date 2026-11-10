# Singing — what can sing for free? (phase 7 spike)

Written on 2026-11-10 from the official docs of the day, `npm view`, and
requests made from the build session. **No real key was available and nothing
was listened to**: no line below judges a voice by ear. "Measured" means a
fact checked by a request or a registry listing; "docs" means read in the
provider's documentation; "assumed" is a judgement.

Constraints (BRIEF.md): browser only, no server of ours, each user's own
free key, 0–10 $ a month in total, no voice stored, public repository (free
licences only), friends who are not technical.

What a duet needs: a voice that sings **given English words** on **given
notes**, in time with a backing track we control (the lyrics on screen and
the learner's score depend on that clock).

## The options

| | What it is | Sings our words on our notes? | Weight in the browser | Licence / terms | Free? | Likely quality (assumed) |
|---|---|---|---|---|---|---|
| **Lyria 3.5** (`lyria-3.5`), Lyria 3 Clip / Pro (`lyria-3-clip-preview`, `lyria-3-pro-preview`) | Google's song generators (Interactions API, `POST /v1beta/interactions`), MP3/WAV 44.1 kHz with "vocals, timed lyrics, and full instrumental arrangements"; own lyrics accepted with `[Verse]` / `[Chorus]` tags (docs) | Words: yes (docs do not promise verbatim). Notes and tempo: **no** — it composes its own tune, different on each call ("results may vary between calls") | 0 (a request) | Output carries a SynthID watermark; prompts asking for an artist's voice or copyrighted lyrics are blocked (docs) | **No**: the pricing page says "Free tier: Not available" for all three; 0.04–0.08 $ per song | High for a song to listen to; useless as a karaoke track (we would not know where each word falls) |
| **Lyria RealTime** (`lyria-realtime-exp`) | Streaming music over WebSocket (`v1beta`), 48 kHz stereo PCM | **No**: "Instrumental only"; a `VOCALIZATION` mode adds wordless voices "as another instrument" (docs) | 0 | Experimental model, watermarked output | Not on the pricing page (unknown); experimental limits | Good backing music, no control of the notes, no words |
| **Gemini TTS** (`gemini-3.8-flash-tts`, `-flash-lite-tts`) | Speech from text, 24 kHz PCM; style by `speech_metadata.style` and inline tags (`<laugh>`, `<sigh>`…) (docs) | Words: yes, verbatim. Notes: **no** — the docs list no singing, no pitch per syllable; "pitch" is a prosody word for a whole turn. Third-party notes say a `[singing]` tag gives a sing-song delivery at best, sometimes read aloud | 0 | Gemini API terms | **Yes**: "Free of charge" on the free tier (pricing page), limits unpublished | A spoken or chanted line, not a melody; timing not controllable, so it would drift from the lyrics on screen |
| **Gemini Live** (`gemini-3.8-live`, what the characters speak with) | Real-time voice | Can be asked to sing; no doc says it can, no control of notes or tempo, 1–1.4 s of delay (measured in phase 0) | 0 | — | Yes (measured: 11 min 43 on Franco's free key) | Unknown; cannot be synchronised with a backing track or with the learner |
| **Neural singing synthesis in the browser** (DiffSinger / OpenUtau voicebanks through onnxruntime-web) | Acoustic model + vocoder, driven by notes and phonemes | Yes in principle | Not found ready-made: the ONNX export targets desktop runtimes (CUDA, DirectML, CPU); no maintained web build or English voicebank with a clear redistribution licence was found (search, 2026-11-10). Typical voicebank + vocoder: 100–300 MB (assumed) | Each voicebank has its own terms, often non-commercial or no redistribution | Free to run | Best open quality, but a research project of its own: weeks, not a phase |
| **Formant speech synthesis that can be pitched** (eSpeak NG via WebAssembly: `mespeak` 2.0.2, `espeak-ng` 1.0.2, `@echogarden/espeak-ng-emscripten` 0.3.5) | Robotic speech; pitch can be set per utterance, so each syllable could be rendered on its note | Yes, crudely | 18–25 MB unpacked (measured, `npm view`) | **GPL-3.0** (measured, `npm view`): shipping it inside this site would put the whole bundle under GPL obligations | Free | Poor: a 1990s robot voice, glued syllable by syllable. Fun for ten seconds, not a duet partner |
| **Physical-model voice** (Trio by Paul Batchelor, Rust + WebAssembly) | A sung vowel instrument with harmonies | **No words**: vowels only (README mentions no lyrics) | Small | MIT | Free | Pleasant "aah", no lyrics |
| **Browser `speechSynthesis`** | The system voices (used by "Écouter le modèle") | Words yes; one pitch value per utterance, timing not sample-accurate, voices differ on each PC, weak in Firefox | 0 | — | Free | Spoken, off the beat |
| **Melody played by WebAudio** (our own code) | Oscillators and filters: a soft lead that "hums" each note with vowel-like formants, plus a light accompaniment and a count-in | No words; **notes and timing exact** (the same clock drives the lyrics, the dance and the score) | 0 (a few hundred lines) | Ours | Free, no key, works offline | A clear, in-tune guide melody. Honest: it is a hum, not a singer |

Also measured from the build session: the Interactions endpoint answers the
CORS preflight for the Pages origin (HTTP 200), so a paid Lyria call would be
possible from the browser later; a fake key on the TTS model answers 400
`API_KEY_INVALID` (the route exists; the model was not exercised).

Sources: <https://aistudio.google.com/docs/models>,
<https://aistudio.google.com/docs/pricing>,
<https://aistudio.google.com/docs/music-generation>,
<https://aistudio.google.com/docs/realtime-music-generation>,
<https://aistudio.google.com/docs/speech-generation>,
<https://github.com/openvpi/DiffSinger/blob/refactor/docs/README-SVS-onnx.md>,
<https://github.com/PaulBatchelor/trio>, npm registry (`npm view`,
2026-11-10).

## Verdict

**No free option gives an acceptable sung voice that follows our notes.**
The good singer (Lyria) is paid and chooses its own melody; the free voices
(Gemini TTS, Live) speak; the free singers are either wordless, GPL robots or
a research project. This is risk n° 2 of the brief, confirmed on paper — not
by ear, since nothing could be played here.

## Choice

1. **Karaoke engine of our own (WebAudio)**: every song is data (notes and
   syllables). One clock schedules the count-in, the accompaniment, the
   highlighted word, Maya's moves and the expected time of each word. No
   key, no download, works offline.
2. **Maya does not sing words. She hums the melody** (a vowel-like formant
   lead, routed through the lip-sync analyser so her mouth follows), **keeps
   the beat** (a sober sway, a clap at the end) **and encourages**. Three
   ways to sing: with her humming along, alone over the accompaniment, or in
   turns (she hums a line, the learner sings the next one). This is the
   "best alternative" to the duet; the screen says "Maya fredonne", never
   "Maya chante".
3. **Scoring**: pronunciation per word by the phase 6 `PronunciationScorer`
   (told that the words are sung); rhythm per word measured **in the
   browser** from the take's loudness against the song's clock (no key
   needed), refined by Groq Whisper word timestamps when a Groq key is
   present.
4. **Parked** (STATE.md, "Points ouverts"): an optional "real song" button
   with Lyria 3.5 for a learner who has a paid key (about 0.08 $ a song, to
   listen to, not to score); trying `gemini-3.8-flash-tts` with a real key
   to hear what a "sung" style gives.

## What Franco should judge on his return

- Is the hum pleasant enough to sing along with, or irritating?
- Does the rhythm score feel fair with his headset (a Bluetooth headset adds
  0.1–0.3 s; the score removes one constant delay per take)?
- Does Gemini judge sung words sensibly (long vowels are normal in a song)?
