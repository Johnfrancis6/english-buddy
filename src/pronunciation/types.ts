/**
 * Pronunciation scoring (phase 6), behind one small interface so the
 * provider can be swapped (docs/BRIEF.md §3: `PronunciationScorer`).
 *
 * The learner reads a known sentence; a scorer returns a score per word and
 * the sounds to work on. The audio is a WAV held in memory for the call and
 * then dropped: implementations must not keep it.
 */

/** The sounds that are hard for a French speaker, tracked over time. */
export const SOUND_IDS = ['th', 'h', 'r', 'vowels', 'ed', 'stress'] as const;
export type SoundId = (typeof SOUND_IDS)[number];

export interface WordScore {
  /** The word as written in the sentence. */
  word: string;
  /** 0–100: how close to a clear English pronunciation (an estimate). */
  score: number;
  /** Hard sounds this word contains or that the scorer found wrong. */
  sounds: SoundId[];
  /** Sounds the scorer judged wrong in this word (subset of what it heard). */
  issues: SoundId[];
  /** What it sounded like, if the scorer says so (e.g. "sink" for "think"). */
  heard?: string;
  /** Short French advice for this word, from the scorer. */
  tipFr?: string;
  /** The word was not said. */
  missing?: boolean;
  /** An independent recogniser (Whisper) did not find this word. */
  notRecognised?: boolean;
}

export interface PronunciationResult {
  /** Which scorer produced it ("gemini", "gemini+groq", "azure"). */
  scorer: string;
  /** Model or service detail, for the report. */
  model: string;
  /** 0–100, mean of the word scores (an estimate). */
  overall: number;
  words: WordScore[];
  /** What the scorer heard, if it says so. */
  heardText?: string;
  /** A sentence of French feedback, if the scorer gives one. */
  feedbackFr?: string;
  /** The recording was too quiet, cut or not English: the scores mean little. */
  unreliable?: boolean;
}

export interface ScoreInput {
  /** 16 kHz mono WAV, in memory only. */
  wav: Uint8Array;
  /** The sentence the learner was asked to read. */
  reference: string;
  signal?: AbortSignal;
}

export interface PronunciationScorer {
  readonly id: string;
  readonly label: string;
  score(input: ScoreInput): Promise<PronunciationResult>;
}
