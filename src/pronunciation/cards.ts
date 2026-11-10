import type { Grade } from '../reviews/fsrs';
import { cardId, isDue, type CardDraft, type CardUpdate, type ReviewCard } from '../reviews/cards';
import { SOUNDS } from './sounds';
import type { PronAttempt } from './progress';
import type { WordScore } from './types';

/**
 * Pronunciation in the FSRS reviews: a word said badly (below 60) becomes a
 * "sound" card (the word, its sentence, the French tip). When the word comes
 * back in a later exercise, the scorer grades the card: no self-grading.
 */
export const CARD_BELOW = 60;
const MAX_NEW = 3;

export function gradeFromScore(score: number): Grade {
  if (score >= 90) return 'easy';
  if (score >= 70) return 'good';
  if (score >= 55) return 'hard';
  return 'again';
}

/** French advice for a word: the scorer's own tip, else the tip of its first sound. */
export function tipFor(w: WordScore): string {
  if (w.tipFr) return w.tipFr;
  const s = w.issues[0] ?? w.sounds[0];
  return s ? `${SOUNDS[s].labelFr} : ${SOUNDS[s].tipFr}` : 'Écoute le modèle et répète lentement.';
}

/** The back of a sound card: the sound's name, then the advice. */
export function cardTip(w: WordScore): string {
  const s = w.issues[0] ?? w.sounds[0];
  if (!s) return tipFor(w);
  return `${SOUNDS[s].labelFr} : ${w.tipFr ?? SOUNDS[s].tipFr}`;
}

export function soundDrafts(a: PronAttempt): CardDraft[] {
  if (a.result.unreliable) return [];
  const out = new Map<string, CardDraft>();
  const weak = a.result.words
    .filter((w) => !w.missing && w.score < CARD_BELOW && (w.issues.length || w.sounds.length))
    .sort((x, y) => x.score - y.score);
  for (const w of weak) {
    if (out.size >= MAX_NEW) break;
    const id = cardId('sound', w.word);
    if (out.has(id)) continue;
    out.set(id, {
      id,
      kind: 'sound',
      front: w.word.toLowerCase(),
      back: cardTip(w),
      note: a.sentence,
      talkId: a.id,
      createdAt: a.at,
    });
  }
  return [...out.values()];
}

/**
 * Grades for existing sound cards whose word was said in this attempt:
 * due cards get the grade of their score; a card not due yet that is said
 * badly again goes back to "again". Once per attempt and card.
 */
export function pronUpdates(
  cards: readonly ReviewCard[],
  a: PronAttempt,
  now: number,
): CardUpdate[] {
  if (a.result.unreliable) return [];
  const byId = new Map(cards.filter((c) => c.kind === 'sound').map((c) => [c.id, c]));
  const out = new Map<string, CardUpdate>();
  for (const w of a.result.words) {
    if (w.missing) continue;
    const c = byId.get(cardId('sound', w.word));
    if (!c || c.suspended || out.has(c.id) || c.talkId === a.id) continue;
    if (c.history.some((h) => h.talkId === a.id)) continue;
    if (isDue(c, now)) out.set(c.id, { id: c.id, grade: gradeFromScore(w.score), via: 'pron' });
    else if (w.score < CARD_BELOW - 5) out.set(c.id, { id: c.id, grade: 'again', via: 'repeat' });
  }
  return [...out.values()];
}
