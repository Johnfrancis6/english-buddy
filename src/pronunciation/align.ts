import { normWord, soundsOf, tokenize, isSound } from './sounds';
import type { SoundId, WordScore } from './types';

/** One word as a scorer returned it, before it is matched to the sentence. */
export interface RawWord {
  word: string;
  score: number;
  issues?: readonly string[];
  heard?: string;
  tipFr?: string;
  missing?: boolean;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0)));

/**
 * Matches the scorer's words to the words of the sentence, in order. A
 * scorer may skip, merge or repeat a word: each sentence word takes the next
 * scorer word with the same spelling within a short look-ahead; a word left
 * without a match gets the mean of the others (it is not counted as wrong).
 */
export function alignWords(reference: string, raw: readonly RawWord[]): WordScore[] {
  const ref = tokenize(reference);
  const out: (WordScore | null)[] = [];
  let j = 0;
  for (const word of ref) {
    const target = normWord(word);
    let found = -1;
    for (let k = j; k < Math.min(raw.length, j + 4); k++) {
      if (normWord(raw[k].word) === target) {
        found = k;
        break;
      }
    }
    if (found < 0) {
      out.push(null);
      continue;
    }
    const r = raw[found];
    j = found + 1;
    const issues = [...new Set((r.issues ?? []).filter(isSound))] as SoundId[];
    const sounds = [...new Set([...soundsOf(word), ...issues])];
    out.push({
      word,
      score: r.missing ? 0 : clamp(r.score),
      sounds,
      issues,
      ...(r.heard && normWord(r.heard) !== target ? { heard: r.heard.slice(0, 40) } : {}),
      ...(r.tipFr ? { tipFr: r.tipFr.slice(0, 200) } : {}),
      ...(r.missing ? { missing: true } : {}),
    });
  }
  const matched = out.filter((w): w is WordScore => w !== null);
  const fill = matched.length
    ? Math.round(matched.reduce((n, w) => n + w.score, 0) / matched.length)
    : 0;
  return out.map(
    (w, i) => w ?? { word: ref[i], score: fill, sounds: soundsOf(ref[i]), issues: [] },
  );
}

/** Mean of the word scores, 0–100. */
export function overallOf(words: readonly WordScore[]): number {
  if (!words.length) return 0;
  return Math.round(words.reduce((n, w) => n + w.score, 0) / words.length);
}
