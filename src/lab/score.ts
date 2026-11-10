import type { LabSentence } from './sentences';

/** Lower case, straight apostrophes, no punctuation, single spaces. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const words = (t: string) => (t ? normalise(t).split(' ').filter(Boolean) : []);

/** Word error rate of `heard` against `said` (0 = identical). */
export function wordErrorRate(said: string, heard: string): number {
  const a = words(said);
  const b = words(heard);
  if (a.length === 0) return b.length ? 1 : 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length] / a.length;
}

const containsPhrase = (haystack: string, phrase: string) =>
  ` ${normalise(haystack)} `.includes(` ${normalise(phrase)} `);

export type MistakeFate = 'kept' | 'fixed' | 'lost';

/**
 * kept: the wrong form is in the transcript (what we want);
 * fixed: the recogniser wrote the correct form instead (mistake hidden);
 * lost: neither (the words were misheard or dropped).
 */
export function mistakeFates(sentence: LabSentence, heard: string): MistakeFate[] {
  return sentence.mistakes.map((m) => {
    if (m.wrong.some((w) => containsPhrase(heard, w))) return 'kept';
    if (m.right.some((r) => containsPhrase(heard, r))) return 'fixed';
    return 'lost';
  });
}

export interface SourceTally {
  source: string;
  sentences: number;
  mistakes: number;
  kept: number;
  fixed: number;
  lost: number;
  /** Mean word error rate against the sentence as read. */
  wer: number;
}

export interface LabResult {
  sentence: LabSentence;
  /** Transcript per source id; null when the source failed or was skipped. */
  heard: Record<string, string | null>;
}

export function tally(results: readonly LabResult[], sources: readonly string[]): SourceTally[] {
  return sources.map((source) => {
    const t: SourceTally = {
      source,
      sentences: 0,
      mistakes: 0,
      kept: 0,
      fixed: 0,
      lost: 0,
      wer: 0,
    };
    let werSum = 0;
    for (const r of results) {
      const heard = r.heard[source];
      if (heard === null || heard === undefined) continue;
      t.sentences++;
      werSum += wordErrorRate(r.sentence.say, heard);
      for (const fate of mistakeFates(r.sentence, heard)) {
        t.mistakes++;
        t[fate]++;
      }
    }
    t.wer = t.sentences ? werSum / t.sentences : 0;
    return t;
  });
}

/** Minimum planted mistakes before a source can be recommended. */
export const MIN_MISTAKES = 8;

/**
 * Picks the source that keeps the most mistakes (rate), then the lowest word
 * error rate. Returns null while no source has enough data.
 */
export function recommend(tallies: readonly SourceTally[]): SourceTally | null {
  const ready = tallies.filter((t) => t.mistakes >= MIN_MISTAKES);
  if (ready.length === 0) return null;
  return [...ready].sort((a, b) => {
    const byKept = b.kept / b.mistakes - a.kept / a.mistakes;
    // Rates within 5 points are a tie: the cleaner transcript wins.
    if (Math.abs(byKept) > 0.05) return byKept;
    return a.wer - b.wer;
  })[0];
}
