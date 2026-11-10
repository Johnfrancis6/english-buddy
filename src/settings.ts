/**
 * User settings. The API key lives in this browser's localStorage only: it is
 * never committed, logged, or sent anywhere except to Google's API.
 */
// Model IDs checked on 2026-11-09 at https://aistudio.google.com/docs/models
export const MODELS = [
  { id: 'gemini-3.8-live', label: 'Gemini 3.8 Live (recommandé)' },
  { id: 'gemini-3.1-flash-live-preview', label: 'Gemini 3.1 Flash Live (ancien, secours)' },
] as const;

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

export interface Settings {
  apiKey: string;
  model: string;
  voice: string;
  pauseMs: number;
}

const KEY = 'english-buddy.settings.v1';
export const DEFAULTS: Settings = {
  apiKey: '',
  model: MODELS[0].id,
  voice: VOICES[0],
  pauseMs: PAUSES[1].ms,
};

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export function loadSettings(store: Store = localStorage): Settings {
  try {
    const raw = store.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<Settings>;
    return {
      apiKey: typeof p.apiKey === 'string' ? p.apiKey : '',
      model: MODELS.some((m) => m.id === p.model) ? (p.model as string) : DEFAULTS.model,
      voice: (VOICES as readonly string[]).includes(p.voice ?? '')
        ? (p.voice as string)
        : DEFAULTS.voice,
      pauseMs: PAUSES.some((x) => x.ms === p.pauseMs) ? (p.pauseMs as number) : DEFAULTS.pauseMs,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings, store: Store = localStorage): void {
  store.setItem(KEY, JSON.stringify({ ...s, apiKey: s.apiKey.trim() }));
}

/** "AIza…abcd": enough to recognise the key without showing it. */
export function maskKey(key: string): string {
  const k = key.trim();
  if (!k) return '';
  return k.length <= 8 ? '••••' : `${k.slice(0, 4)}…${k.slice(-4)}`;
}
