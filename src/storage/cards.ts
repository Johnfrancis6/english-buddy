import { newFsrs, reviewFsrs, type Grade } from '../reviews/fsrs';
import {
  FIRST_DELAY_MS,
  updatesFromTalk,
  type CardDraft,
  type CardUpdate,
  type ReviewCard,
} from '../reviews/cards';
import type { Debrief } from '../analysis/types';
import { run } from './db';

/** Review cards, as text, in this browser's IndexedDB. */
export async function listCards(): Promise<ReviewCard[]> {
  return (await run<ReviewCard[]>('cards', 'readonly', (s) => s.getAll())) ?? [];
}

export async function putCard(card: ReviewCard): Promise<void> {
  await run('cards', 'readwrite', (s) => s.put(structuredClone(card)));
}

/** Several cards in one transaction. */
export async function putCards(cards: readonly ReviewCard[]): Promise<void> {
  if (!cards.length) return;
  await run('cards', 'readwrite', (s) => {
    for (const c of cards) s.put(structuredClone(c));
  });
}

export async function clearCards(): Promise<void> {
  await run('cards', 'readwrite', (s) => s.clear());
}

/** One review of one card, at `now`. Returns the updated card. */
export async function gradeCard(
  card: ReviewCard,
  grade: Grade,
  now: number,
  via: 'self' | 'talk' | 'repeat' = 'self',
  talkId?: string,
): Promise<ReviewCard> {
  const next = await graded(card, grade, now, via, talkId);
  await putCard(next);
  return next;
}

async function graded(
  card: ReviewCard,
  grade: Grade,
  now: number,
  via: 'self' | 'talk' | 'repeat',
  talkId?: string,
): Promise<ReviewCard> {
  return {
    ...card,
    fsrs: await reviewFsrs(card.fsrs, grade, now),
    history: [...card.history, { at: now, grade, via, ...(talkId ? { talkId } : {}) }],
  };
}

/** Creates the cards that do not exist yet. Returns how many were added. */
export async function addDrafts(
  drafts: readonly CardDraft[],
  existing: readonly ReviewCard[],
): Promise<number> {
  const known = new Set(existing.map((c) => c.id));
  const fresh: ReviewCard[] = [];
  for (const d of drafts) {
    if (known.has(d.id)) continue;
    known.add(d.id);
    fresh.push({ ...d, fsrs: await newFsrs(d.createdAt + FIRST_DELAY_MS), history: [] });
  }
  await putCards(fresh);
  return fresh.length;
}

/** Applies a finished talk's grades (once per talk and card). */
export async function applyTalk(talkId: string, d: Debrief, now: number): Promise<CardUpdate[]> {
  const cards = await listCards();
  const updates = updatesFromTalk(cards, talkId, d);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const next: ReviewCard[] = [];
  for (const u of updates) next.push(await graded(byId.get(u.id)!, u.grade, now, u.via, talkId));
  await putCards(next);
  return updates;
}
