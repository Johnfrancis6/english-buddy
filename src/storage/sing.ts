import type { Song } from '../singing/melody';
import type { SingResult } from '../singing/score';
import { run } from './db';

/**
 * Singing (phase 7), as text only: the songs written for the learner and
 * the score of each sung take. The voice itself is never stored.
 */
export interface SingAttempt {
  id: string;
  at: number;
  songId: string;
  title: string;
  /** How it was sung: with Maya's hum, alone, or in turns. */
  mode: string;
  result: SingResult;
}

export const MAX_SING_ATTEMPTS = 200;
export const MAX_OWN_SONGS = 8;

export async function listSingAttempts(): Promise<SingAttempt[]> {
  return (await run<SingAttempt[]>('sing', 'readonly', (s) => s.getAll())) ?? [];
}

export async function saveSingAttempt(a: SingAttempt): Promise<void> {
  await run('sing', 'readwrite', (s) => s.put(structuredClone(a)));
  const all = await listSingAttempts();
  if (all.length <= MAX_SING_ATTEMPTS) return;
  const old = all.sort((x, y) => y.at - x.at).slice(MAX_SING_ATTEMPTS);
  await run('sing', 'readwrite', (s) => {
    for (const x of old) s.delete(x.id);
  });
}

/** Songs written for the learner, newest first. */
export async function listOwnSongs(): Promise<Song[]> {
  const all = (await run<Song[]>('songs', 'readonly', (s) => s.getAll())) ?? [];
  return all.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export async function saveOwnSong(song: Song): Promise<void> {
  await run('songs', 'readwrite', (s) => s.put(structuredClone(song)));
  const all = await listOwnSongs();
  if (all.length <= MAX_OWN_SONGS) return;
  await run('songs', 'readwrite', (s) => {
    for (const x of all.slice(MAX_OWN_SONGS)) s.delete(x.id);
  });
}

export async function deleteOwnSong(id: string): Promise<void> {
  await run('songs', 'readwrite', (s) => s.delete(id));
}

export async function clearSinging(): Promise<void> {
  await run('sing', 'readwrite', (s) => s.clear());
  await run('songs', 'readwrite', (s) => s.clear());
}
