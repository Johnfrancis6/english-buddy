import { concatBytes } from './wav';

export interface ClipOptions {
  /** Duration of one microphone chunk, in ms. */
  chunkMs: number;
  /** Audio kept before the first voiced chunk, so the first word is whole. */
  preRollMs?: number;
  /** A clip with less voiced audio than this is dropped (noise, a cough). */
  minVoicedMs?: number;
  /** Hard cap on a clip, so memory stays bounded if nobody cuts it. */
  maxMs?: number;
}

/**
 * Keeps the learner's current turn in memory so it can be transcribed by
 * another recogniser. The audio is never stored: a clip lives only until it
 * has been sent for transcription, then it is dropped.
 */
export class ClipRecorder {
  private readonly chunkMs: number;
  private readonly preRollChunks: number;
  private readonly minVoicedMs: number;
  private readonly maxChunks: number;
  private preRoll: Uint8Array[] = [];
  private chunks: Uint8Array[] = [];
  private voicedMs = 0;
  /** Index (in `chunks`) just after the last voiced chunk. */
  private lastVoicedEnd = 0;

  constructor(o: ClipOptions) {
    this.chunkMs = o.chunkMs;
    this.preRollChunks = Math.ceil((o.preRollMs ?? 300) / o.chunkMs);
    this.minVoicedMs = o.minVoicedMs ?? 200;
    this.maxChunks = Math.ceil((o.maxMs ?? 60_000) / o.chunkMs);
  }

  get recording(): boolean {
    return this.chunks.length > 0;
  }

  /** Feed every microphone chunk with the voice decision for it. */
  push(pcm: Uint8Array, voiced: boolean): void {
    if (!this.recording && !voiced) {
      this.preRoll.push(pcm);
      if (this.preRoll.length > this.preRollChunks) this.preRoll.shift();
      return;
    }
    if (!this.recording) {
      this.chunks = this.preRoll;
      this.preRoll = [];
    }
    if (this.chunks.length >= this.maxChunks) return;
    this.chunks.push(pcm);
    if (voiced) {
      this.voicedMs += this.chunkMs;
      this.lastVoicedEnd = this.chunks.length;
    }
  }

  /**
   * Ends the current clip and returns its PCM, trimmed to ~300 ms after the
   * last voiced chunk, or null when there was no real speech.
   */
  cut(): Uint8Array | null {
    const enough = this.voicedMs >= this.minVoicedMs;
    const end = Math.min(this.chunks.length, this.lastVoicedEnd + this.preRollChunks);
    const pcm = enough ? concatBytes(this.chunks.slice(0, end)) : null;
    this.reset();
    return pcm;
  }

  reset(): void {
    this.chunks = [];
    this.preRoll = [];
    this.voicedMs = 0;
    this.lastVoicedEnd = 0;
  }
}
