/**
 * User settings. API keys live in this browser's localStorage only: they are
 * never committed, logged, or sent anywhere except to the provider they
 * belong to (Google for the Gemini key, Groq for the Groq key).
 */
// Live model IDs checked on 2026-11-09 at https://aistudio.google.com/docs/models
export const MODELS = [
  { id: 'gemini-3.8-live', label: 'Gemini 3.8 Live (recommandé)' },
  { id: 'gemini-3.1-flash-live-preview', label: 'Gemini 3.1 Flash Live (ancien, secours)' },
] as const;

/**
 * Text models for the debrief and the "Pourquoi ?" explanations. Checked on
 * 2026-11-10 at https://aistudio.google.com/docs/models and /docs/pricing:
 * all three are "free of charge" on the free tier. If the chosen one is
 * refused, the analyzer tries the next ones in this order.
 */
export const ANALYSIS_MODELS = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (recommandé)' },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash (stable)' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (le plus rapide)' },
] as const;

/** Names checked on 2026-11-10 in the TTS voice list (/docs/speech-generation#voices). */
export const VOICES = ['Puck', 'Charon', 'Fenrir', 'Orus', 'Kore', 'Aoede'] as const;

/**
 * How long the learner may stay silent before Jake takes his turn. A longer
 * pause leaves time to search for a word, and adds the same time to the delay
 * before every answer.
 */
export const PAUSES = [
  { ms: 500, label: 'Rapide — Jake répond après 0,5 s de silence' },
  { ms: 900, label: 'Posé — 0,9 s de silence' },
  { ms: 1500, label: 'Je prends mon temps — 1,5 s de silence' },
] as const;

/**
 * Where the text of the learner's own sentences comes from. The corrections
 * are built on it, so it must keep the learner's mistakes.
 * - live: the Gemini Live input transcription (no extra key, no extra call)
 * - groq: Groq Whisper on each turn's audio (needs a free Groq key)
 * - groq-prompt: the same, with a learner-style prompt (see transcribe/groq.ts)
 * - gemini-audio: a Gemini text model asked for a verbatim transcript
 */
export const TRANSCRIPT_SOURCES = [
  { id: 'live', label: 'Gemini Live (sans clé en plus)' },
  { id: 'groq', label: 'Groq Whisper (clé Groq gratuite)' },
  { id: 'groq-prompt', label: 'Groq Whisper + consigne « apprenant » (clé Groq)' },
  { id: 'gemini-audio', label: 'Gemini Flash, transcription mot à mot' },
] as const;
export type TranscriptSource = (typeof TRANSCRIPT_SOURCES)[number]['id'];

export interface Settings {
  apiKey: string;
  groqKey: string;
  model: string;
  voice: string;
  pauseMs: number;
  analysisModel: string;
  transcriptSource: TranscriptSource;
  /** Show the live transcript during the talk. */
  showTranscript: boolean;
}

const KEY = 'english-buddy.settings.v1';
export const DEFAULTS: Settings = {
  apiKey: '',
  groqKey: '',
  model: MODELS[0].id,
  voice: VOICES[0],
  pauseMs: PAUSES[0].ms,
  analysisModel: ANALYSIS_MODELS[0].id,
  transcriptSource: 'live',
  showTranscript: true,
};

type Store = Pick<Storage, 'getItem' | 'setItem'>;

const pick = <T>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

export function loadSettings(store: Store = localStorage): Settings {
  try {
    const raw = store.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<Settings>;
    return {
      apiKey: typeof p.apiKey === 'string' ? p.apiKey : '',
      groqKey: typeof p.groqKey === 'string' ? p.groqKey : '',
      model: pick(
        p.model,
        MODELS.map((m) => m.id as string),
        DEFAULTS.model,
      ),
      voice: pick(p.voice, VOICES as readonly string[], DEFAULTS.voice),
      pauseMs: pick(
        p.pauseMs,
        PAUSES.map((x) => x.ms as number),
        DEFAULTS.pauseMs,
      ),
      analysisModel: pick(
        p.analysisModel,
        ANALYSIS_MODELS.map((m) => m.id as string),
        DEFAULTS.analysisModel,
      ),
      transcriptSource: pick(
        p.transcriptSource,
        TRANSCRIPT_SOURCES.map((s) => s.id),
        DEFAULTS.transcriptSource,
      ),
      showTranscript: typeof p.showTranscript === 'boolean' ? p.showTranscript : true,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings, store: Store = localStorage): void {
  store.setItem(KEY, JSON.stringify({ ...s, apiKey: s.apiKey.trim(), groqKey: s.groqKey.trim() }));
}

/** "AIza…abcd": enough to recognise the key without showing it. */
export function maskKey(key: string): string {
  const k = key.trim();
  if (!k) return '';
  return k.length <= 8 ? '••••' : `${k.slice(0, 4)}…${k.slice(-4)}`;
}

/**
 * The transcript source actually usable with the keys present: Groq without a
 * Groq key falls back to Gemini Live, so everything works without it.
 */
export function effectiveSource(
  s: Pick<Settings, 'transcriptSource' | 'groqKey'>,
): TranscriptSource {
  if (s.transcriptSource.startsWith('groq') && !s.groqKey.trim()) return 'live';
  return s.transcriptSource;
}
