/**
 * Measures what the learner feels: the time between the end of their speech
 * (last microphone frame above the voice threshold) and the first audio chunk
 * of the model's answer. Pure logic, driven by timestamps in milliseconds.
 */
export interface LatencyOptions {
  /** Absolute RMS floor below which a frame is never counted as voice. */
  minThreshold?: number;
  /** A frame is voice when its RMS exceeds noiseFloor * this factor. */
  noiseFactor?: number;
  /** Minimum voiced time before a turn counts as real speech. */
  minVoicedMs?: number;
  /**
   * Samples below this are discarded: the server waits at least 500 ms of
   * silence, so a shorter value means Jake started while the learner was
   * still making sound (overlap), not a real answer delay.
   */
  minSampleMs?: number;
  /** Samples above this are discarded (the learner simply stayed silent). */
  maxSampleMs?: number;
  window?: number;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export class LatencyTracker {
  private readonly minThreshold: number;
  private readonly noiseFactor: number;
  private readonly minVoicedMs: number;
  private readonly minSampleMs: number;
  private readonly maxSampleMs: number;
  private readonly window: number;
  /** Recent frame levels; their minimum estimates the background noise. */
  private readonly recent: number[] = [];
  private noiseFloor = 0;
  private voicedMs = 0;
  private lastVoiceAt: number | null = null;
  private samples: number[] = [];

  constructor(o: LatencyOptions = {}) {
    this.minThreshold = o.minThreshold ?? 0.012;
    this.noiseFactor = o.noiseFactor ?? 3;
    this.minVoicedMs = o.minVoicedMs ?? 200;
    this.minSampleMs = o.minSampleMs ?? 200;
    this.maxSampleMs = o.maxSampleMs ?? 10_000;
    this.window = o.window ?? 10;
  }

  get threshold(): number {
    // Capped, so a learner who talks without any pause is still heard.
    return Math.min(0.06, Math.max(this.minThreshold, this.noiseFloor * this.noiseFactor));
  }

  /** Feed every microphone frame. Returns true when the frame is voice. */
  onMicFrame(nowMs: number, rms: number, frameMs: number): boolean {
    // Speech always dips between words, steady noise does not: the minimum
    // over the last ~3 s follows the room, not the voice.
    this.recent.push(rms);
    if (this.recent.length > Math.ceil(3000 / frameMs)) this.recent.shift();
    this.noiseFloor = Math.min(...this.recent);
    const voiced = rms > this.threshold;
    if (voiced) {
      this.voicedMs += frameMs;
      this.lastVoiceAt = nowMs;
    }
    return voiced;
  }

  /**
   * Call when the first audio chunk of a new model turn arrives. Returns the
   * new sample in ms, or null when the turn was not preceded by real speech.
   */
  onModelAudioStart(nowMs: number): number | null {
    const { voicedMs, lastVoiceAt } = this;
    this.voicedMs = 0;
    this.lastVoiceAt = null;
    if (lastVoiceAt === null || voicedMs < this.minVoicedMs) return null;
    const sample = nowMs - lastVoiceAt;
    if (sample < this.minSampleMs || sample > this.maxSampleMs) return null;
    this.samples.push(sample);
    if (this.samples.length > this.window) this.samples.shift();
    return sample;
  }

  get count(): number {
    return this.samples.length;
  }
  get last(): number | null {
    return this.samples.length ? this.samples[this.samples.length - 1] : null;
  }
  get medianMs(): number | null {
    return median(this.samples);
  }
  reset(): void {
    this.samples = [];
    this.voicedMs = 0;
    this.lastVoiceAt = null;
  }
}
