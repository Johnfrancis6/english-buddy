import type { Debrief } from '../analysis/types';
import type { Turn } from '../talk/transcript';

/**
 * Finished conversations, as text only, in this browser's IndexedDB. Nothing
 * here is ever sent to a server of ours; voice is never stored.
 */
export interface SavedTalk {
  id: string;
  startedAt: number;
  durationMs: number;
  label: string;
  /** Who and where (phase 2+); talks from phase 1 were with Jake at the café. */
  character?: string;
  scene?: string;
  turns: Pick<Turn, 'id' | 'who' | 'text' | 'liveText' | 'source' | 'interrupted'>[];
  debrief: Debrief | null;
  /** Explanations already fetched, by mistake index. */
  why: Record<number, string>;
}

const DB = 'english-buddy';
const STORE = 'talks';
/** Older talks are dropped beyond this many. */
export const KEEP_TALKS = 30;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await open();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function listTalks(): Promise<SavedTalk[]> {
  const all = (await run<SavedTalk[]>('readonly', (s) => s.getAll())) ?? [];
  return all.map(upgradeTalk).sort((a, b) => b.startedAt - a.startedAt);
}

/**
 * Talks saved in phase 1 used `who: 'jake'` and `recastByJake`; they are
 * read with the phase 2 names.
 */
export function upgradeTalk(t: SavedTalk): SavedTalk {
  const turns = t.turns.map((x) =>
    (x.who as string) === 'jake' ? { ...x, who: 'buddy' as const } : x,
  );
  const debrief = t.debrief && {
    ...t.debrief,
    mistakes: t.debrief.mistakes.map((m) => {
      const old = m as typeof m & { recastByJake?: boolean };
      return old.recastByCharacter === undefined
        ? { ...m, recastByCharacter: old.recastByJake === true }
        : m;
    }),
  };
  return { ...t, character: t.character ?? 'jake', scene: t.scene ?? 'cafe', turns, debrief };
}

export async function saveTalk(talk: SavedTalk): Promise<void> {
  await run('readwrite', (s) => s.put(structuredClone(talk)));
  const all = await listTalks();
  for (const old of all.slice(KEEP_TALKS)) await run('readwrite', (s) => s.delete(old.id));
}

export async function clearTalks(): Promise<void> {
  await run('readwrite', (s) => s.clear());
}
