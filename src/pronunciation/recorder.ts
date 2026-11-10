import { Mic, MIC_CHUNK_MS, MIC_RATE } from '../voice/audio';
import { concatBytes, pcm16ToWav } from '../transcribe/wav';
import { HEARD_RMS } from '../onboarding/micTest';

/**
 * One take of one sentence. The microphone audio is kept in memory only,
 * turned into a WAV for the scorer, and dropped right after: nothing is
 * written to disk or storage.
 */
export interface TakeOptions {
  /** Silence after speech that ends the take. */
  endSilenceMs?: number;
  /** Hard limit (Azure accepts up to 30 s for pronunciation). */
  maxMs?: number;
  /** Speech needed for a usable take. */
  minVoicedMs?: number;
  /** Nobody speaks for this long: stop. */
  noSpeechMs?: number;
}

export type TakeState = 'waiting' | 'speaking' | 'done' | 'silent';

/** Decides when a take is over, from the level of each microphone chunk. */
export class TakeTracker {
  private readonly o: Required<TakeOptions>;
  private elapsed = 0;
  private voiced = 0;
  private quietFor = 0;
  state: TakeState = 'waiting';

  constructor(o: TakeOptions = {}) {
    this.o = {
      endSilenceMs: o.endSilenceMs ?? 1500,
      maxMs: o.maxMs ?? 20_000,
      minVoicedMs: o.minVoicedMs ?? 300,
      noSpeechMs: o.noSpeechMs ?? 8000,
    };
  }

  get voicedMs(): number {
    return this.voiced;
  }

  push(rms: number, ms: number): TakeState {
    if (this.state === 'done' || this.state === 'silent') return this.state;
    this.elapsed += ms;
    if (rms > HEARD_RMS) {
      this.voiced += ms;
      this.quietFor = 0;
      if (this.voiced >= this.o.minVoicedMs) this.state = 'speaking';
    } else {
      this.quietFor += ms;
    }
    if (this.state === 'speaking' && this.quietFor >= this.o.endSilenceMs) this.state = 'done';
    else if (this.state === 'waiting' && this.elapsed >= this.o.noSpeechMs) this.state = 'silent';
    if (this.elapsed >= this.o.maxMs) this.state = this.enough ? 'done' : 'silent';
    return this.state;
  }

  get enough(): boolean {
    return this.voiced >= this.o.minVoicedMs;
  }
}

export interface Take {
  /** Stops early (the learner clicked "J'ai fini"). */
  finish(): void;
  /** Cancels: the audio is dropped. */
  cancel(): void;
  /** WAV of the take, or null when no speech was heard (or cancelled). */
  result: Promise<Uint8Array | null>;
}

export function recordTake(
  deviceId: string,
  onLevel: (rms: number) => void,
  options: TakeOptions = {},
): Take {
  const mic = new Mic();
  const tracker = new TakeTracker(options);
  let chunks: Uint8Array[] = [];
  let ended = false;
  let end: (keep: boolean) => void = () => {};
  const result = new Promise<Uint8Array | null>((resolve, reject) => {
    end = (keep) => {
      if (ended) return;
      ended = true;
      const pcm = keep && tracker.enough ? concatBytes(chunks) : null;
      chunks = [];
      onLevel(0);
      void mic.stop().then(() => resolve(pcm ? pcm16ToWav(pcm, MIC_RATE) : null));
    };
    mic
      .start((pcm, rms) => {
        if (ended) return;
        chunks.push(pcm);
        onLevel(rms);
        const state = tracker.push(rms, MIC_CHUNK_MS);
        if (state === 'done') end(true);
        else if (state === 'silent') end(false);
      }, deviceId)
      .catch((err: unknown) => {
        ended = true;
        chunks = [];
        reject(err);
      });
  });
  return { finish: () => end(true), cancel: () => end(false), result };
}
