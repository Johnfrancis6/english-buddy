import { providerFetch } from '../net/providerError';
import { GROQ_URL } from '../transcribe/groq';
import { overallOf } from './align';
import { normWord, tokenize } from './sounds';
import type { PronunciationResult, PronunciationScorer, ScoreInput, WordScore } from './types';

/**
 * A second, independent opinion: Groq Whisper writes what it heard (with
 * word timestamps, `verbose_json` + `timestamp_granularities[]=word`, shape
 * from console.groq.com/docs/speech-to-text, read 2026-11-10). Whisper gives
 * no confidence per word, so the only signal is "was the word recognised?".
 * It is not told the target sentence, so it cannot simply agree with it;
 * but its language model can still guess a badly said word from context:
 * a recognised word is not proof of a good pronunciation.
 */

/** A word Whisper did not find cannot score above this. */
export const NOT_RECOGNISED_CAP = 55;

/** Words of the reference found, in order, in what Whisper wrote (longest common subsequence). */
export function recognisedMask(reference: readonly string[], heard: readonly string[]): boolean[] {
  const a = reference.map(normWord);
  const b = heard.map(normWord);
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const mask = new Array<boolean>(n).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      mask[i] = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return mask;
}

/** Caps the words Whisper did not recognise and marks them. */
export function applyRecognition(r: PronunciationResult, heard: string): PronunciationResult {
  const mask = recognisedMask(
    r.words.map((w) => w.word),
    tokenize(heard),
  );
  const words: WordScore[] = r.words.map((w, i) =>
    mask[i] || w.missing
      ? w
      : { ...w, notRecognised: true, score: Math.min(w.score, NOT_RECOGNISED_CAP) },
  );
  return { ...r, words, overall: overallOf(words) };
}

/** One word as Whisper wrote it, with its times in the recording (seconds). */
export interface HeardWord {
  word: string;
  start: number;
  end: number;
}

/** Whisper's words with their timestamps (empty when it returns text only). */
export async function whisperWords(
  wav: Uint8Array,
  groqKey: string,
  signal?: AbortSignal,
): Promise<{ text: string; words: HeardWord[] }> {
  const form = new FormData();
  form.append('file', new Blob([wav as BlobPart], { type: 'audio/wav' }), 'sentence.wav');
  form.append('model', 'whisper-large-v3');
  form.append('language', 'en');
  form.append('temperature', '0');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  const res = await providerFetch('groq', GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey.trim()}` },
    body: form,
    signal,
  });
  const json = (await res.json()) as {
    text?: string;
    words?: { word?: string; start?: number; end?: number }[];
  };
  const words = (Array.isArray(json.words) ? json.words : [])
    .map((w) => ({
      word: String(w.word ?? '').trim(),
      start: Number(w.start ?? NaN),
      end: Number(w.end ?? NaN),
    }))
    .filter((w) => w.word);
  return { text: (json.text ?? '').trim(), words };
}

export async function whisperHeard(
  wav: Uint8Array,
  groqKey: string,
  signal?: AbortSignal,
): Promise<string> {
  const { text, words } = await whisperWords(wav, groqKey, signal);
  return words.length ? words.map((w) => w.word).join(' ') : text;
}

/** The main scorer, cross-checked by Whisper when a Groq key is present. */
export class WhisperCheckedScorer implements PronunciationScorer {
  readonly id: string;
  readonly label: string;
  /** Set after each call: Whisper's text, or why the check was skipped. */
  lastCheck = '';
  constructor(
    private readonly main: PronunciationScorer,
    private readonly groqKey: string,
  ) {
    this.id = `${main.id}+groq`;
    this.label = `${main.label} + contrôle Groq Whisper`;
  }

  async score(input: ScoreInput): Promise<PronunciationResult> {
    const [main, heard] = await Promise.all([
      this.main.score(input),
      whisperHeard(input.wav, this.groqKey, input.signal).catch((err: unknown) => {
        this.lastCheck = `contrôle Groq impossible : ${String((err as Error)?.message ?? err)}`;
        return null;
      }),
    ]);
    if (heard === null) return main;
    this.lastCheck = `Whisper a entendu : « ${heard} »`;
    return { ...applyRecognition(main, heard), scorer: this.id };
  }
}
