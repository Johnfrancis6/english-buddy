/**
 * The one IndexedDB database of this browser. Version 1 (phase 1) had the
 * `talks` store; version 2 (phase 3) adds `facts` (what the characters
 * remember about the learner); version 3 (phase 4) adds `cards` (review
 * cards scheduled by FSRS). Text only: voice is never stored.
 */
const DB = 'english-buddy';
const VERSION = 3;
export type StoreName = 'talks' | 'facts' | 'cards';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of ['talks', 'facts', 'cards'] as const) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function run<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await open();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
