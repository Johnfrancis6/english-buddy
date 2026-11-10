import { pcm16ToWav } from '../transcribe/wav';
import { normWord, tokenize } from '../pronunciation/sounds';
import type { PronunciationScorer, SoundId, WordScore } from '../pronunciation/types';
import { recognisedMask, type HeardWord } from '../pronunciation/whisperCheck';
import type { TimedLine, TimedWord } from './melody';
import { bestLag, loudness, mean, onsetScores, rhythmOf, voicedMask, type Due } from './timing';

/**
 * Score of a sung take: per word, the pronunciation (phase 6
 * `PronunciationScorer`, told that the words are sung) and the rhythm
 * (measured here from the take's loudness, refined by Whisper's word
 * timestamps when a Groq key is present). The audio is cut into sections in
 * memory, sent once, and never kept.
 */
export interface SungWord {
  word: string;
  line: number;
  /** 0–100, null when no pronunciation scorer answered for this word. */
  pron: number | null;
  /** 0–100. */
  rhythm: number;
  /** Start of the voice against the beat (ms, > 0 late), when it can be seen. */
  offsetMs: number | null;
  issues: SoundId[];
  heard?: string;
  tipFr?: string;
  missing?: boolean;
}

export interface SingResult {
  /** 0–100: 60 % pronunciation + 40 % rhythm (rhythm alone without a scorer). */
  overall: number;
  pron: number | null;
  rhythm: number;
  /** Constant delay removed before judging the rhythm (ms, > 0 = late). */
  lagMs: number;
  words: SungWord[];
  /** Pronunciation scorer id, or null when only the rhythm was measured. */
  scorer: string | null;
  model: string;
  /** How the rhythm was measured. */
  timing: 'voice' | 'voice+whisper';
  feedbackFr?: string;
  heardText?: string;
  /** The scorer said the audio was not usable for pronunciation. */
  unreliable?: boolean;
  /** Why the pronunciation is missing (provider error), for the log. */
  pronError?: string;
}

export const PRON_SHARE = 0.6;

/** Longest stretch sent to a scorer in one request (Azure accepts 30 s). */
export const MAX_SECTION_SEC = 24;

/** Groups of lines the learner sings, each short enough for one request. */
export function sections(lines: readonly TimedLine[]): TimedLine[][] {
  const out: TimedLine[][] = [];
  for (const l of lines) {
    if (!l.words.length) continue;
    const cur = out[out.length - 1];
    if (cur && l.end - cur[0].start <= MAX_SECTION_SEC) cur.push(l);
    else out.push([l]);
  }
  return out;
}

/** Bytes of 16-bit mono PCM between two times (seconds). */
export function slicePcm(pcm: Uint8Array, rate: number, from: number, to: number): Uint8Array {
  const a = Math.max(0, Math.floor(from * rate)) * 2;
  const b = Math.min(pcm.length - (pcm.length % 2), Math.ceil(to * rate) * 2);
  return pcm.subarray(a, Math.max(a, b));
}

/** Start time of each lyric word in what Whisper heard (null = not found), by order. */
export function heardStarts(
  words: readonly string[],
  heard: readonly HeardWord[],
): (number | null)[] {
  const mask = recognisedMask(
    words,
    heard.map((h) => h.word),
  );
  const out: (number | null)[] = [];
  let j = 0;
  words.forEach((w, i) => {
    if (!mask[i]) {
      out.push(null);
      return;
    }
    while (j < heard.length && normWord(heard[j].word) !== normWord(w)) j++;
    out.push(j < heard.length && Number.isFinite(heard[j].start) ? heard[j].start : null);
    j++;
  });
  return out;
}

export interface SingInput {
  /** The take: 16-bit mono PCM, in memory only. */
  pcm: Uint8Array;
  rate: number;
  /** Lines the learner was asked to sing, on the song's clock. */
  lines: readonly TimedLine[];
  /** Song time (seconds) of the first sample of the take. */
  takeStartSec: number;
  scorer: PronunciationScorer | null;
  /** Whisper word timestamps for a WAV (present with a Groq key). */
  whisper?: (wav: Uint8Array) => Promise<{ text: string; words: HeardWord[] }>;
}

export async function scoreSinging(input: SingInput): Promise<SingResult> {
  const { pcm, rate, takeStartSec } = input;
  const toTake = (w: TimedWord): Due => ({
    start: w.start - takeStartSec,
    end: w.end - takeStartSec,
  });
  const all = input.lines.flatMap((l) => l.words);
  const due = all.map(toTake);

  // Rhythm from the voice itself: always available, no key.
  const { mask } = voicedMask(loudness(pcm, rate));
  const lag = bestLag(mask, due);
  const voice = rhythmOf(mask, due, lag);

  const pronWords: (WordScore | null)[] = all.map(() => null);
  const whisperStart: (number | null)[] = all.map(() => null);
  let usedWhisper = false;
  let scorerId: string | null = null;
  let model = '';
  let unreliable = false;
  let pronError: string | undefined;
  const feedback: string[] = [];
  const heardParts: string[] = [];

  if (input.scorer || input.whisper) {
    let at = 0;
    for (const group of sections(input.lines)) {
      const words = group.flatMap((l) => l.words);
      const from = Math.max(0, words[0].start - takeStartSec - 0.4);
      const to = words[words.length - 1].end - takeStartSec + 0.8;
      const wav = pcm16ToWav(slicePcm(pcm, rate, from, to), rate);
      const reference = group.map((l) => l.text).join(' ');
      const [pron, heard] = await Promise.all([
        input.scorer
          ? input.scorer.score({ wav, reference, sung: true }).catch((err: unknown) => {
              pronError = String((err as Error)?.message ?? err).slice(0, 200);
              return null;
            })
          : null,
        input.whisper ? input.whisper(wav).catch(() => null) : null,
      ]);
      if (pron) {
        scorerId = pron.scorer;
        model = pron.model;
        if (pron.unreliable) unreliable = true;
        if (pron.feedbackFr) feedback.push(pron.feedbackFr);
        if (pron.heardText) heardParts.push(pron.heardText);
        // The scorer aligned its words to the reference's tokens: same order as ours.
        const tokens = tokenize(reference);
        let k = 0;
        words.forEach((w, i) => {
          const n = Math.max(1, tokenize(w.text).length);
          const part = pron.words.slice(k, k + n);
          k += n;
          if (part.length && tokens.length) {
            pronWords[at + i] = {
              ...part[0],
              word: w.text,
              score: mean(part.map((p) => p.score)),
              issues: [...new Set(part.flatMap((p) => p.issues))],
              missing: part.every((p) => p.missing) || undefined,
            };
          }
        });
      }
      if (heard?.words.length) {
        usedWhisper = true;
        if (!pron) heardParts.push(heard.words.map((h) => h.word).join(' '));
        // Whisper sees the lyric as tokens; a lyric word is found when its first token is.
        const first = words.map((w) => tokenize(w.text)[0] ?? w.text);
        heardStarts(first, heard.words).forEach((s, i) => {
          whisperStart[at + i] = s === null ? null : s + from;
        });
      }
      at += words.length;
    }
  }

  const onset = usedWhisper ? onsetScores(due, whisperStart) : null;
  const words: SungWord[] = all.map((w, i) => {
    const p = pronWords[i];
    const o = onset?.scores[i] ?? null;
    const rhythm = o === null ? voice[i].score : Math.round((voice[i].score + o) / 2);
    return {
      word: w.text,
      line: w.line,
      pron: p ? p.score : null,
      rhythm,
      offsetMs: voice[i].offsetMs,
      issues: p?.issues ?? [],
      ...(p?.heard ? { heard: p.heard } : {}),
      ...(p?.tipFr ? { tipFr: p.tipFr } : {}),
      ...(p?.missing ? { missing: true } : {}),
    };
  });
  const scored = words.filter((w) => w.pron !== null);
  const pron = scored.length ? mean(scored.map((w) => w.pron as number)) : null;
  const rhythm = mean(words.map((w) => w.rhythm));
  return {
    overall: pron === null ? rhythm : Math.round(pron * PRON_SHARE + rhythm * (1 - PRON_SHARE)),
    pron,
    rhythm,
    lagMs: Math.round(lag * 1000),
    words,
    scorer: scorerId,
    model,
    timing: usedWhisper ? 'voice+whisper' : 'voice',
    ...(feedback.length ? { feedbackFr: feedback[0] } : {}),
    ...(heardParts.length ? { heardText: heardParts.join(' / ').slice(0, 400) } : {}),
    ...(unreliable ? { unreliable: true } : {}),
    ...(pronError ? { pronError } : {}),
  };
}
