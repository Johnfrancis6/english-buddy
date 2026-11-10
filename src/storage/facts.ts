import type { Fact } from '../memory/facts';
import { run } from './db';

/** What the characters remember, as text in this browser's IndexedDB. */
export async function listFacts(): Promise<Fact[]> {
  const all = (await run<Fact[]>('facts', 'readonly', (s) => s.getAll())) ?? [];
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Replaces the whole list (after a merge). */
export async function saveFacts(facts: readonly Fact[]): Promise<void> {
  await run('facts', 'readwrite', (s) => {
    s.clear();
    for (const f of facts) s.put(structuredClone(f));
  });
}

export async function putFact(fact: Fact): Promise<void> {
  await run('facts', 'readwrite', (s) => s.put(structuredClone(fact)));
}

export async function deleteFact(id: string): Promise<void> {
  await run('facts', 'readwrite', (s) => s.delete(id));
}

export async function clearFacts(): Promise<void> {
  await run('facts', 'readwrite', (s) => s.clear());
}
