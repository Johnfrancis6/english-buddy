import type { StudyDoc } from '../documents/text';
import { run } from './db';

/** Imported documents, as text, in this browser's IndexedDB. */
export async function listDocs(): Promise<StudyDoc[]> {
  const all = (await run<StudyDoc[]>('docs', 'readonly', (s) => s.getAll())) ?? [];
  return all.sort((a, b) => b.addedAt - a.addedAt);
}

export async function getDoc(id: string): Promise<StudyDoc | undefined> {
  return run<StudyDoc>('docs', 'readonly', (s) => s.get(id));
}

export async function putDoc(doc: StudyDoc): Promise<void> {
  await run('docs', 'readwrite', (s) => s.put(structuredClone(doc)));
}

export async function deleteDoc(id: string): Promise<void> {
  await run('docs', 'readwrite', (s) => s.delete(id));
}
