import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_STORES } from '../src/storage/db';
import { appKeys, DATA_GROUPS, LOCAL_PREFIX } from '../src/storage/wipe';
import { countFr } from '../src/ui/dataView';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}
const SRC = files('src').map((p) => ({ p, text: readFileSync(p, 'utf8') }));

describe('phase 8: everything the app keeps can be erased', () => {
  it('every IndexedDB store belongs to exactly one erasable group', () => {
    const grouped = DATA_GROUPS.flatMap((g) => g.stores);
    expect([...grouped].sort()).toEqual([...ALL_STORES].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it('singing data goes with the talks', () => {
    const talks = DATA_GROUPS.find((g) => g.id === 'talks')!;
    expect(talks.stores).toEqual(expect.arrayContaining(['talks', 'sing', 'songs']));
  });

  it('every localStorage key of the app starts with the shared prefix', () => {
    const keys = SRC.flatMap(({ text }) =>
      [...text.matchAll(/(?:const KEY|const DELETED|CARDS_BACKFILLED) = [`']([^`']+)[`']/g)].map(
        (m) => m[1]!,
      ),
    ).filter((k) => !k.startsWith('${'));
    expect(keys.length).toBeGreaterThanOrEqual(3);
    for (const k of keys) expect(k.startsWith(LOCAL_PREFIX), k).toBe(true);
  });

  it('localStorage is only touched by the settings, onboarding, account and wipe modules', () => {
    const users = SRC.filter(({ text }) => /\blocalStorage\b/.test(text)).map(({ p }) => p);
    const allowed = [
      'src/settings.ts',
      'src/onboarding/welcome.ts',
      'src/sync/config.ts',
      'src/storage/wipe.ts',
      'src/main.ts',
    ];
    for (const p of users) expect(allowed, p).toContain(p.replaceAll('\\', '/'));
  });

  it('appKeys keeps only the app entries', () => {
    expect(
      appKeys(['english-buddy.settings.v1', 'sb-x-auth-token', 'english-buddy.welcome.v1', 'x']),
    ).toEqual(['english-buddy.settings.v1', 'english-buddy.welcome.v1']);
  });

  it('counts read naturally in French', () => {
    expect(countFr(0, ['carte', 'cartes'])).toBe('vide');
    expect(countFr(1, ['carte', 'cartes'])).toBe('1 carte');
    expect(countFr(12, ['carte', 'cartes'])).toBe('12 cartes');
  });
});

describe('phase 8: no key and no voice leaves the browser for our own storage', () => {
  it('no Blob, ArrayBuffer or audio is written to IndexedDB or the account', () => {
    const storage = SRC.filter(({ p }) => /src[\\/](storage|sync)[\\/]/.test(p));
    for (const { p, text } of storage) {
      expect(text, p).not.toMatch(/\b(Blob|ArrayBuffer|Float32Array|Int16Array|AudioBuffer)\b/);
    }
  });

  it('the account rows never carry a key', () => {
    const rows = readFileSync('src/sync/rows.ts', 'utf8');
    expect(rows).not.toMatch(/apiKey|groqKey|azureKey/);
  });

  it('API keys are never put in a URL', () => {
    for (const { p, text } of SRC) {
      expect(text, p).not.toMatch(/[?&]key=\$\{/);
    }
  });
});

describe('phase 8: errors in plain French, each with what to do', () => {
  it('every provider error says what to do next', async () => {
    const { ProviderError } = await import('../src/net/providerError');
    const kinds = [
      'bad-key',
      'quota',
      'busy',
      'model',
      'network',
      'blocked',
      'bad-output',
      'unknown',
    ] as const;
    for (const provider of ['gemini', 'groq', 'azure'] as const)
      for (const k of kinds) {
        const fr = new ProviderError(provider, k, 'x').french;
        expect(fr, `${provider} ${k}`).toMatch(/Vérifie|Réessaie|Choisis|Essaie/);
      }
  });

  it('a lazy chunk that fails to load asks for a reload, not a retry', async () => {
    const { friendlyFromUnknown } = await import('../src/voice/errors');
    const e = friendlyFromUnknown(
      new TypeError('Failed to fetch dynamically imported module: https://x/assets/web.js'),
    );
    expect(e.kind).toBe('load');
    expect(e.message).toContain('recharge la page');
    expect(e.canRetry).toBe(false);
  });

  it('a dropped talk does not name a character that may not be on stage', async () => {
    const { friendlyFromClose } = await import('../src/voice/errors');
    expect(friendlyFromClose(1006, '').message).not.toContain('Jake');
  });
});

describe('phase 8: the welcome resumes where it stopped', () => {
  it('keeps the step reached until it is finished', async () => {
    const { loadWelcome, saveWelcome, resumeStep } = await import('../src/onboarding/welcome');
    const m = new Map<string, string>();
    const store = {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
    };
    expect(resumeStep(loadWelcome(store))).toBe('hello');
    saveWelcome({ done: false, step: 'mic' }, store);
    expect(resumeStep(loadWelcome(store))).toBe('mic');
    saveWelcome({ done: true, at: 1, step: 'mic' }, store);
    expect(resumeStep(loadWelcome(store))).toBe('hello');
    m.set('english-buddy.welcome.v1', '{"step":"nope"}');
    expect(resumeStep(loadWelcome(store))).toBe('hello');
  });
});
