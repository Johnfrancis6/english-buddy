/**
 * Rhythm of a sung take, measured in the browser from the loudness of the
 * recording against the song's clock. No key, no model: for each word, was
 * the learner's voice there when the word was due, and did it start on time?
 *
 * What it is not: it does not know which word was sung (the pronunciation
 * scorer does that) and it cannot see word boundaries inside a held note.
 * One constant delay per take is removed first (headset and browser latency,
 * or a learner who is steadily late), so it judges the rhythm, not the lag.
 */
export const HOP_SEC = 0.01;

/** Loudness (RMS, 0–1) of 16-bit mono PCM, one value per 10 ms. */
export function loudness(pcm: Uint8Array, rate: number): Float32Array {
  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength - (pcm.byteLength % 2));
  const hop = Math.round(rate * HOP_SEC);
  const frames = Math.floor(view.byteLength / 2 / hop);
  const out = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let i = 0; i < hop; i++) {
      const s = view.getInt16((f * hop + i) * 2, true) / 32768;
      sum += s * s;
    }
    out[f] = Math.sqrt(sum / hop);
  }
  return out;
}

/** Frames where a voice is heard: above a share of the take's own loud level. */
export function voicedMask(env: Float32Array): { mask: Uint8Array; threshold: number } {
  const sorted = Float32Array.from(env).sort();
  const p90 = sorted.length ? sorted[Math.floor(sorted.length * 0.9)] : 0;
  const threshold = Math.max(0.006, p90 * 0.3);
  const mask = new Uint8Array(env.length);
  for (let i = 0; i < env.length; i++) mask[i] = env[i] > threshold ? 1 : 0;
  // Bridge gaps of up to 40 ms (consonants) so a word is one stretch of voice.
  let gap = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) {
      if (gap > 0 && gap <= 4 && i - gap - 1 >= 0 && mask[i - gap - 1]) {
        for (let k = i - gap; k < i; k++) mask[k] = 1;
      }
      gap = 0;
    } else gap++;
  }
  return { mask, threshold };
}

/** When a word is due, in seconds from the first sample of the take. */
export interface Due {
  start: number;
  end: number;
}

/** The part of a word's time where a voice is expected (the end of a note is often cut short). */
const sungPart = (w: Due): number => Math.max(0.12, (w.end - w.start) * 0.8);

/**
 * The one delay (seconds, > 0 = late) that best lines the voice up with the
 * words due: the shift where "voice / no voice" agrees most with "word /
 * no word". Searched from 150 ms early to 500 ms late.
 */
export function bestLag(mask: Uint8Array, words: readonly Due[], min = -0.15, max = 0.5): number {
  if (!words.length) return 0;
  const from = Math.max(0, Math.floor((words[0].start - 0.3) / HOP_SEC));
  const to = Math.ceil((words[words.length - 1].end + 0.3) / HOP_SEC);
  const due = new Uint8Array(Math.max(0, to - from));
  for (const w of words) {
    const a = Math.round(w.start / HOP_SEC) - from;
    const b = Math.round((w.start + sungPart(w)) / HOP_SEC) - from;
    for (let i = Math.max(0, a); i < Math.min(due.length, b); i++) due[i] = 1;
  }
  let best = 0;
  let bestScore = -1;
  for (let lag = Math.round(min / HOP_SEC); lag <= Math.round(max / HOP_SEC); lag++) {
    let agree = 0;
    for (let i = 0; i < due.length; i++) {
      const j = from + i + lag;
      const v = j >= 0 && j < mask.length ? mask[j] : 0;
      if (v === due[i]) agree++;
    }
    if (agree > bestScore || (agree === bestScore && Math.abs(lag) < Math.abs(best))) {
      bestScore = agree;
      best = lag;
    }
  }
  return best * HOP_SEC;
}

export interface WordRhythm {
  /** 0–100. */
  score: number;
  /** Share of the word's time with a voice (0–1). */
  coverage: number;
  /** Start of the voice against the word's due time, once the lag is removed (ms, > 0 = late); null when it cannot be seen. */
  offsetMs: number | null;
}

/** On time within this: no penalty. */
export const ON_TIME_SEC = 0.12;

export function rhythmOf(mask: Uint8Array, words: readonly Due[], lag: number): WordRhythm[] {
  const at = (sec: number) => Math.round((sec + lag) / HOP_SEC);
  const voiced = (i: number) => (i >= 0 && i < mask.length ? mask[i] : 0);
  return words.map((w, k) => {
    const a = at(w.start);
    const b = Math.max(a + 1, at(w.start + sungPart(w)));
    let on = 0;
    for (let i = a; i < b; i++) on += voiced(i);
    const coverage = on / (b - a);
    // The start can be seen only after a silence: the first word, or one that follows a rest.
    let offsetMs: number | null = null;
    const prevEnd = k > 0 ? words[k - 1].end : -Infinity;
    if (w.start - prevEnd >= 0.2) {
      const from = at(w.start - Math.min(0.35, (w.start - prevEnd) / 2));
      const to = at(w.start + 0.6);
      if (!voiced(from) && !voiced(from + 1)) {
        for (let i = from; i < to; i++) {
          if (voiced(i) && voiced(i + 1)) {
            offsetMs = Math.round((i - a) * HOP_SEC * 1000);
            break;
          }
        }
      }
    }
    // The beginning of the word matters most: a voice that comes in late loses up to half.
    const headEnd = Math.max(
      a + 1,
      Math.min(b, a + Math.round(Math.min(0.25, (b - a) * HOP_SEC * 0.5) / HOP_SEC)),
    );
    let head = 0;
    for (let i = a; i < headEnd; i++) head += voiced(i);
    const onTime = Math.min(1, head / (headEnd - a) / 0.5);
    let score = Math.min(1, coverage / 0.6) * 100 * (0.5 + 0.5 * onTime);
    if (offsetMs !== null) {
      const late = Math.abs(offsetMs) / 1000 - ON_TIME_SEC;
      if (late > 0) score -= Math.min(50, (late / 0.4) * 50);
    }
    return { score: Math.max(0, Math.round(score)), coverage, offsetMs };
  });
}

/** A word start measured by a recogniser (Groq Whisper), in take seconds; null = not found. */
export function onsetScores(
  due: readonly Due[],
  heardStarts: readonly (number | null)[],
): { scores: (number | null)[]; lag: number } {
  const devs = due
    .map((w, i) => (heardStarts[i] === null ? null : (heardStarts[i] as number) - w.start))
    .filter((d): d is number => d !== null && Math.abs(d) < 1.5)
    .sort((a, b) => a - b);
  const lag = devs.length ? devs[Math.floor(devs.length / 2)] : 0;
  const scores = due.map((w, i) => {
    const h = heardStarts[i];
    if (h === null) return null;
    const off = Math.abs(h - w.start - lag);
    if (off <= 0.15) return 100;
    return Math.max(0, Math.round(100 - ((off - 0.15) / 0.55) * 100));
  });
  return { scores, lag };
}

export const mean = (xs: readonly number[]): number =>
  xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;
