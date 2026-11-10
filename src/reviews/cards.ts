import { MISTAKE_TYPES, type Debrief, type MistakeType } from '../analysis/types';
import type { Grade, StoredFsrs } from './fsrs';

/**
 * Review cards (docs/BRIEF.md §2, spaced repetition with FSRS): the learner's
 * own mistakes ("what you said" → find the right form) and the words and
 * expressions of their debriefs. Created after each debrief, scheduled by
 * ts-fsrs, reviewed out loud (self-graded) or inside the daily challenge
 * (graded by the debrief). Text only, kept in this browser.
 */
export type CardKind = 'mistake' | 'word';

export interface ReviewCard {
  id: string;
  kind: CardKind;
  /** mistake: what the learner said; word: the French meaning. */
  front: string;
  /** mistake: the right form; word: the English word or expression. */
  back: string;
  /** mistake: its type. */
  type?: MistakeType;
  /** mistake: the French explanation; word: an English example. */
  note: string;
  talkId: string;
  character?: string;
  createdAt: number;
  fsrs: StoredFsrs;
  history: CardReview[];
  /** The learner removed it from their reviews. */
  suspended?: boolean;
}

export interface CardReview {
  at: number;
  grade: Grade;
  /** self: flash review; talk: judged in a talk; repeat: the same mistake came back. */
  via: 'self' | 'talk' | 'repeat';
  talkId?: string;
}

/** A card before it gets its FSRS state. */
export type CardDraft = Omit<ReviewCard, 'fsrs' | 'history'>;

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * One card per lesson: a mistake is identified by its right form (the same
 * correction learnt from two different sentences is one card), a word by its
 * English form.
 */
export function cardId(kind: CardKind, back: string): string {
  return `${kind}:${norm(back)}`;
}

/** Mistakes that make poor cards: guesses from the recogniser, or too long. */
const SKIP_TYPES: ReadonlySet<MistakeType> = new Set(['pronunciation']);
const MAX_LEN = 140;

export function draftsFromDebrief(
  d: Debrief,
  talkId: string,
  character: string | undefined,
  now: number,
): CardDraft[] {
  const out = new Map<string, CardDraft>();
  for (const m of d.mistakes) {
    if (SKIP_TYPES.has(m.type) || m.said.length > MAX_LEN || m.correct.length > MAX_LEN) continue;
    const id = cardId('mistake', m.correct);
    if (!norm(m.correct) || out.has(id)) continue;
    out.set(id, {
      id,
      kind: 'mistake',
      front: m.said,
      back: m.correct,
      type: m.type,
      note: m.explanationFr,
      talkId,
      character,
      createdAt: now,
    });
  }
  for (const v of d.vocabulary) {
    const id = cardId('word', v.english);
    if (!norm(v.english) || out.has(id)) continue;
    out.set(id, {
      id,
      kind: 'word',
      front: v.french,
      back: v.english,
      note: v.example,
      talkId,
      character,
      createdAt: now,
    });
  }
  return [...out.values()];
}

/** New cards wait until the next day: the debrief has just explained them. */
export const FIRST_DELAY_MS = 20 * 3_600_000;

export const isDue = (c: ReviewCard, now: number) => !c.suspended && c.fsrs.dueAt <= now;

/** Due cards, most overdue first. */
export function dueCards(cards: readonly ReviewCard[], now: number): ReviewCard[] {
  return cards.filter((c) => isDue(c, now)).sort((a, b) => a.fsrs.dueAt - b.fsrs.dueAt);
}

/** A grade to apply to a card, from a talk. */
export interface CardUpdate {
  id: string;
  grade: Grade;
  via: CardReview['via'];
}

/** What the debrief said about one review item of a challenge. */
export type ReviewOutcome = 'correct' | 'wrong' | 'absent';

/**
 * Grades from a finished talk, once per talk and card:
 * - a review item the learner produced correctly → good; wrongly → again;
 *   not attempted → nothing (the card stays due);
 * - an expression from a word card used naturally → good; used awkwardly → hard;
 * - a mistake of this debrief that already has a card (made again in real
 *   speech) → again, unless it was a review item of this talk.
 */
export function updatesFromTalk(
  cards: readonly ReviewCard[],
  talkId: string,
  d: Debrief,
): CardUpdate[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const out = new Map<string, CardUpdate>();
  const add = (u: CardUpdate) => {
    const c = byId.get(u.id);
    if (!c || c.suspended || out.has(u.id)) return;
    if (c.history.some((h) => h.talkId === talkId)) return; // already applied
    out.set(u.id, u);
  };
  for (const r of d.reviews ?? []) {
    if (r.result === 'correct') add({ id: r.cardId, grade: 'good', via: 'talk' });
    else if (r.result === 'wrong') add({ id: r.cardId, grade: 'again', via: 'talk' });
  }
  for (const e of d.expressions ?? []) {
    if (!e.cardId || !e.used) continue;
    add({ id: e.cardId, grade: e.natural ? 'good' : 'hard', via: 'talk' });
  }
  // A review item already judged in this talk is not graded twice.
  const reviewed = new Set(
    (d.reviews ?? []).filter((r) => r.result !== 'absent').map((r) => r.cardId),
  );
  for (const m of d.mistakes) {
    const id = cardId('mistake', m.correct);
    if (reviewed.has(id)) continue;
    const c = byId.get(id);
    // A card born from this very talk is not a repeat.
    if (c && c.talkId !== talkId) add({ id, grade: 'again', via: 'repeat' });
  }
  return [...out.values()];
}

/** French label of a card, for lists. */
export function cardLabelFr(c: ReviewCard): string {
  return c.kind === 'mistake' && c.type ? MISTAKE_TYPES[c.type] : 'Mot ou expression';
}
