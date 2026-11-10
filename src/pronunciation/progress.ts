import { SOUND_IDS, type PronunciationResult, type SoundId } from './types';

/**
 * Pronunciation attempts, as text only (the sentence, the scores, the
 * scorer): what "Mes progrès" and the FSRS cards are built from. The audio
 * is never part of it.
 */
export interface PronAttempt {
  id: string;
  at: number;
  sentence: string;
  /** Where the sentence came from (card, mistake, word, bank). */
  source: string;
  result: PronunciationResult;
}

/** How many recent attempts the pronunciation estimate averages. */
export const PRON_WINDOW = 20;
/** Score given to a sound the scorer did not flag in a word it flagged for another sound. */
export const SOUND_OK = 85;
/** Sound figures look at this many days. */
export const SOUND_DAYS = 30;

export interface SoundStat {
  sound: SoundId;
  /** Mean score of the words containing this sound. */
  mean: number;
  /** Words measured. */
  words: number;
  /** Words where the scorer reported this sound as wrong. */
  issues: number;
  /** Up to 3 recent words with this issue. */
  examples: string[];
}

export interface PronProgress {
  /** Mean overall of the last attempts (estimation), null without any. */
  score: number | null;
  /** Attempts the score is based on. */
  attempts: number;
  total: number;
  /** Sounds measured in the last 30 days, weakest first. */
  sounds: SoundStat[];
  lastScorer: string | null;
}

/** Attempts the scorer itself flagged (silence, noise) do not count. */
const counts = (a: PronAttempt) => !a.result.unreliable;

export function pronProgress(attempts: readonly PronAttempt[], now: number): PronProgress {
  const valid = attempts.filter(counts).sort((a, b) => b.at - a.at);
  const used = valid.slice(0, PRON_WINDOW);
  const score = used.length
    ? Math.round(used.reduce((n, a) => n + a.result.overall, 0) / used.length)
    : null;
  const since = now - SOUND_DAYS * 86_400_000;
  const acc = new Map<SoundId, { sum: number; n: number; issues: number; examples: string[] }>();
  for (const a of valid) {
    if (a.at < since) continue;
    for (const w of a.result.words) {
      for (const s of w.sounds) {
        const x = acc.get(s) ?? { sum: 0, n: 0, issues: 0, examples: [] };
        // A word that failed on another sound says little about this one: when
        // the scorer named the problems and this sound is not among them, it
        // counts as fine (SOUND_OK) rather than with the word's low score.
        x.sum += w.issues.length && !w.issues.includes(s) ? Math.max(w.score, SOUND_OK) : w.score;
        x.n++;
        if (w.issues.includes(s)) {
          x.issues++;
          const lw = w.word.toLowerCase();
          if (x.examples.length < 3 && !x.examples.includes(lw)) x.examples.push(lw);
        }
        acc.set(s, x);
      }
    }
  }
  const sounds = SOUND_IDS.filter((s) => acc.has(s))
    .map((s) => {
      const x = acc.get(s)!;
      return {
        sound: s,
        mean: Math.round(x.sum / x.n),
        words: x.n,
        issues: x.issues,
        examples: x.examples,
      };
    })
    .sort((a, b) => a.mean - b.mean);
  return {
    score,
    attempts: used.length,
    total: valid.length,
    sounds,
    lastScorer: valid[0]?.result.scorer ?? null,
  };
}

/** Mean score per sound, for choosing the next sentences. */
export function soundLevels(p: PronProgress): Partial<Record<SoundId, number>> {
  return Object.fromEntries(p.sounds.map((s) => [s.sound, s.mean]));
}
