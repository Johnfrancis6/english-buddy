import type { Level } from '../settings';

/**
 * The French welcome for a new learner (phase 5): what the platform is for,
 * the free Gemini key, the optional Groq key, headset and microphone, a
 * starting level and a first character. Whether it was seen is kept in this
 * browser only.
 */
export const WELCOME_STEPS = ['hello', 'gemini', 'groq', 'mic', 'level', 'character'] as const;
export type WelcomeStep = (typeof WELCOME_STEPS)[number];

export const STEP_TITLES: Record<WelcomeStep, string> = {
  hello: 'Bienvenue dans English Buddy',
  gemini: 'Ta clé Gemini, gratuite',
  groq: 'Une clé Groq, si tu veux',
  mic: 'Ton casque et ton micro',
  level: 'Ton niveau de départ',
  character: 'Ton premier personnage',
};

const KEY = 'english-buddy.welcome.v1';
type Store = Pick<Storage, 'getItem' | 'setItem'>;

export interface WelcomeState {
  /** The learner reached the last step and started. */
  done: boolean;
  /** When it was finished (epoch ms). */
  at?: number;
  /** The last step reached, to resume there next time. */
  step?: WelcomeStep;
}

export function loadWelcome(store: Store = localStorage): WelcomeState {
  try {
    const p = JSON.parse(store.getItem(KEY) ?? '{}') as Partial<WelcomeState>;
    return {
      done: p.done === true,
      ...(typeof p.at === 'number' ? { at: p.at } : {}),
      ...(WELCOME_STEPS.includes(p.step as WelcomeStep) ? { step: p.step } : {}),
    };
  } catch {
    return { done: false };
  }
}

export function saveWelcome(state: WelcomeState, store: Store = localStorage): void {
  store.setItem(KEY, JSON.stringify(state));
}

/**
 * Opens by itself only for someone new: not finished yet and no Gemini key.
 * Somebody who already pasted a key (phases 0–4) is not sent through it again;
 * they can reopen it from the settings.
 */
export function shouldOpenWelcome(state: WelcomeState, apiKey: string): boolean {
  return !state.done && !apiKey.trim();
}

/** Levels in plain French, as a learner would describe themselves. */
export const LEVEL_CHOICES: readonly { id: Level; title: string; line: string }[] = [
  {
    id: 'A2',
    title: 'Je débute à l’oral',
    line: 'Je comprends des phrases simples et lentes ; je parle avec des mots isolés.',
  },
  {
    id: 'B1',
    title: 'Je me débrouille',
    line: 'Je tiens une conversation simple sur ma vie, en cherchant souvent mes mots.',
  },
  {
    id: 'B2',
    title: 'Je suis à l’aise',
    line: 'Je discute de presque tout ; il me reste des fautes et je manque de naturel.',
  },
  {
    id: 'C1',
    title: 'J’ai un niveau avancé',
    line: 'Je parle facilement ; je veux sonner plus naturel et précis.',
  },
];

export interface KeyCheck {
  ok: boolean;
  /** What to tell the learner, in French. */
  french: string;
}

type Fetch = typeof fetch;

/**
 * Checks a Gemini key by listing one model: no tokens are used. Measured from
 * the build session (2026-11-10): CORS allows the `x-goog-api-key` header from
 * the Pages origin, and a wrong key answers 400 `API_KEY_INVALID`.
 */
export async function checkGeminiKey(key: string, f: Fetch = fetch): Promise<KeyCheck> {
  const k = key.trim();
  if (!k) return { ok: false, french: 'Colle d’abord ta clé dans la case.' };
  if (/\s/.test(k)) {
    return { ok: false, french: 'La clé contient un espace : recopie-la sans espace.' };
  }
  try {
    const r = await f('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', {
      headers: { 'x-goog-api-key': k },
    });
    if (r.ok) return { ok: true, french: 'Clé acceptée par Google ✓' };
    const body = await r.text().catch(() => '');
    if (/API_KEY_INVALID|API key not valid/i.test(body) || r.status === 400) {
      return {
        ok: false,
        french:
          'Google ne reconnaît pas cette clé. Recopie-la en entier avec le bouton de copie d’AI Studio.',
      };
    }
    if (r.status === 403) {
      return {
        ok: false,
        french:
          'Google refuse cette clé pour l’API Gemini (projet ou restriction). Crée une nouvelle clé sur la page des clés d’AI Studio.',
      };
    }
    if (r.status === 429) {
      return {
        ok: true,
        french:
          'Clé reconnue, mais Google dit que le quota gratuit est dépassé pour l’instant. Réessaie plus tard.',
      };
    }
    return {
      ok: false,
      french: `Google a répondu une erreur (${r.status}). Réessaie dans un instant.`,
    };
  } catch {
    return {
      ok: false,
      french: 'Impossible de joindre Google. Vérifie ta connexion internet, puis réessaie.',
    };
  }
}

/**
 * Checks a Groq key by listing its models (no audio sent). Measured: CORS
 * allows any origin, a wrong key answers 401 `invalid_api_key`.
 */
export async function checkGroqKey(key: string, f: Fetch = fetch): Promise<KeyCheck> {
  const k = key.trim();
  if (!k) return { ok: false, french: 'Colle d’abord ta clé Groq dans la case.' };
  try {
    const r = await f('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${k}` },
    });
    if (r.ok) return { ok: true, french: 'Clé acceptée par Groq ✓' };
    if (r.status === 401) {
      return {
        ok: false,
        french: 'Groq ne reconnaît pas cette clé. Recopie-la en entier (elle commence par gsk_).',
      };
    }
    if (r.status === 429) {
      return { ok: true, french: 'Clé reconnue, mais Groq limite les essais pour l’instant.' };
    }
    return {
      ok: false,
      french: `Groq a répondu une erreur (${r.status}). Réessaie dans un instant.`,
    };
  } catch {
    return {
      ok: false,
      french: 'Impossible de joindre Groq. Vérifie ta connexion internet, puis réessaie.',
    };
  }
}

/** A microphone in the list: its name, or a neutral one before permission. */
export function micLabel(d: Pick<MediaDeviceInfo, 'label' | 'deviceId'>, index: number): string {
  if (d.label) return d.label;
  return d.deviceId === 'default' ? 'Micro par défaut' : `Micro ${index + 1}`;
}

/** Words that suggest a headset (the character's voice won't loop into the mic). */
export const looksLikeHeadset = (label: string) =>
  /headset|casque|headphone|écouteur|airpods|buds|earphone|hands-free|mains libres/i.test(label);

/** Where the welcome opens: the step reached last time, unless it was finished. */
export function resumeStep(state: WelcomeState): WelcomeStep {
  return !state.done && state.step ? state.step : 'hello';
}
