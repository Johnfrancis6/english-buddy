import type { PronAttempt } from '../pronunciation/progress';
import { run } from './db';

/** Pronunciation attempts (text and scores only), in this browser's IndexedDB. */
export const MAX_ATTEMPTS = 500;

export async function listAttempts(): Promise<PronAttempt[]> {
  return (await run<PronAttempt[]>('pron', 'readonly', (s) => s.getAll())) ?? [];
}

/** Saves one attempt and keeps only the most recent MAX_ATTEMPTS. */
export async function saveAttempt(a: PronAttempt): Promise<void> {
  await run('pron', 'readwrite', (s) => s.put(structuredClone(a)));
  const all = await listAttempts();
  if (all.length <= MAX_ATTEMPTS) return;
  const old = all.sort((x, y) => y.at - x.at).slice(MAX_ATTEMPTS);
  await run('pron', 'readwrite', (s) => {
    for (const x of old) s.delete(x.id);
  });
}

export async function clearAttempts(): Promise<void> {
  await run('pron', 'readwrite', (s) => s.clear());
}
