import { describe, expect, it } from 'vitest';
import {
  checkGeminiKey,
  checkGroqKey,
  LEVEL_CHOICES,
  loadWelcome,
  looksLikeHeadset,
  micLabel,
  saveWelcome,
  shouldOpenWelcome,
  WELCOME_STEPS,
} from '../src/onboarding/welcome';
import { rmsOf } from '../src/onboarding/micTest';
import { loadSettings, saveSettings, DEFAULTS } from '../src/settings';
import { buildLearnerProfile } from '../src/progress/profile';

const memStore = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
};
const reply = (status: number, body = '') =>
  (async () => new Response(body, { status })) as unknown as typeof fetch;

describe('welcome', () => {
  it('has six steps in the planned order', () => {
    expect(WELCOME_STEPS).toEqual(['hello', 'gemini', 'groq', 'mic', 'level', 'character']);
  });

  it('opens by itself only for someone new without a key', () => {
    expect(shouldOpenWelcome({ done: false }, '')).toBe(true);
    expect(shouldOpenWelcome({ done: false }, 'AIzaOLD')).toBe(false);
    expect(shouldOpenWelcome({ done: true }, '')).toBe(false);
  });

  it('remembers that it was finished', () => {
    const s = memStore();
    expect(loadWelcome(s).done).toBe(false);
    saveWelcome({ done: true, at: 5 }, s);
    expect(loadWelcome(s)).toEqual({ done: true, at: 5 });
    s.setItem('english-buddy.welcome.v1', '{oops');
    expect(loadWelcome(s).done).toBe(false);
  });

  it('keeps the microphone and the starting level in the settings', () => {
    const s = memStore();
    expect(loadSettings(s).startLevel).toBe('B1');
    saveSettings({ ...DEFAULTS, micDeviceId: 'abc', startLevel: 'A2' }, s);
    expect(loadSettings(s)).toMatchObject({ micDeviceId: 'abc', startLevel: 'A2' });
    s.setItem('english-buddy.settings.v1', JSON.stringify({ startLevel: 'Z9' }));
    expect(loadSettings(s).startLevel).toBe('B1');
  });

  it('gives the four levels in plain French', () => {
    expect(LEVEL_CHOICES.map((l) => l.id)).toEqual(['A2', 'B1', 'B2', 'C1']);
    for (const l of LEVEL_CHOICES) expect(l.line.length).toBeGreaterThan(20);
  });

  it('uses the chosen level until debriefs measure one', () => {
    const p = buildLearnerProfile([], [], 'jake', Date.now(), 'A2');
    expect(p.level).toBe('A2');
    expect(p.levelMeasured).toBe(false);
  });
});

describe('key checks', () => {
  it('Gemini: accepted, wrong, refused, quota, offline', async () => {
    expect((await checkGeminiKey('', reply(200))).ok).toBe(false);
    expect((await checkGeminiKey('AIza x', reply(200))).french).toContain('espace');
    expect(await checkGeminiKey('AIzaGOOD', reply(200))).toMatchObject({ ok: true });
    const bad = await checkGeminiKey(
      'AIzaBAD',
      reply(400, '{"error":{"message":"API key not valid.","status":"INVALID_ARGUMENT"}}'),
    );
    expect(bad.ok).toBe(false);
    expect(bad.french).toContain('ne reconnaît pas');
    expect((await checkGeminiKey('k', reply(403))).french).toContain('refuse');
    expect((await checkGeminiKey('k', reply(429))).ok).toBe(true);
    const offline = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect((await checkGeminiKey('k', offline)).french).toContain('connexion');
  });

  it('sends the Gemini key in a header, never in the address', async () => {
    let seen: { url: string; headers: Record<string, string> } | null = null;
    const spy = (async (url: string, init: RequestInit) => {
      seen = { url, headers: init.headers as Record<string, string> };
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    await checkGeminiKey('AIzaSECRET', spy);
    expect(seen!.url).not.toContain('SECRET');
    expect(seen!.headers['x-goog-api-key']).toBe('AIzaSECRET');
  });

  it('Groq: accepted and wrong', async () => {
    expect((await checkGroqKey('gsk_ok', reply(200))).ok).toBe(true);
    expect((await checkGroqKey('gsk_bad', reply(401))).french).toContain('gsk_');
  });
});

describe('microphone', () => {
  it('names microphones and spots a headset', () => {
    expect(micLabel({ label: '', deviceId: 'default' }, 0)).toBe('Micro par défaut');
    expect(micLabel({ label: '', deviceId: 'x' }, 1)).toBe('Micro 2');
    expect(micLabel({ label: 'USB Headset', deviceId: 'x' }, 0)).toBe('USB Headset');
    expect(looksLikeHeadset('Casque Logitech H390')).toBe(true);
    expect(looksLikeHeadset('Microphone (Realtek Audio)')).toBe(false);
  });

  it('measures the level of a sound', () => {
    expect(rmsOf(new Float32Array(10))).toBe(0);
    expect(rmsOf(new Float32Array([0.5, -0.5, 0.5, -0.5]))).toBeCloseTo(0.5);
  });
});
