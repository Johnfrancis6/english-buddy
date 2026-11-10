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
  return all.sort((a, b) => b.startedAt - a.startedAt);
}

export async function saveTalk(talk: SavedTalk): Promise<void> {
  await run('readwrite', (s) => s.put(structuredClone(talk)));
  const all = await listTalks();
  for (const old of all.slice(KEEP_TALKS)) await run('readwrite', (s) => s.delete(old.id));
}

export async function clearTalks(): Promise<void> {
  await run('readwrite', (s) => s.clear());
}
