import type { FriendlyError } from './errors';

export type VoiceState =
  'idle' | 'connecting' | 'listening' | 'speaking' | 'reconnecting' | 'error';

export interface VoiceEvents {
  onState(state: VoiceState): void;
  onError(error: FriendlyError): void;
  /** First audio chunk of a model turn; latencyMs is null if not measurable. */
  onModelTurnStart(latencyMs: number | null): void;
  onMicLevel(rms: number, voiced: boolean): void;
  /**
   * Every microphone chunk (16 kHz PCM) with the voice decision, for a second
   * recogniser. Kept in memory only for the current turn, never stored.
   */
  onMicAudio?(pcm: Uint8Array, voiced: boolean): void;
  /** A transcription chunk from the voice provider. */
  onTranscript(who: 'you' | 'buddy', text: string): void;
  /** The model finished its turn (interrupted = the learner cut it). */
  onTurnComplete(interrupted: boolean): void;
  onInfo(text: string): void;
}

/**
 * Provider-neutral contract for a real-time voice conversation, so a fallback
 * pipeline (speech-to-text + text model + text-to-speech) can replace Gemini
 * Live without touching the UI or the 3D scene.
 */
export interface VoiceSession {
  readonly state: VoiceState;
  /** Output audio tap used by the lip sync. */
  readonly outputAnalyser: AnalyserNode;
  start(): Promise<void>;
  stop(): Promise<void>;
}
