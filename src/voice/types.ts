import type { FriendlyError } from './errors';

export type VoiceState =
  'idle' | 'connecting' | 'listening' | 'speaking' | 'reconnecting' | 'error';

export interface VoiceEvents {
  onState(state: VoiceState): void;
  onError(error: FriendlyError): void;
  /** First audio chunk of a model turn; latencyMs is null if not measurable. */
  onModelTurnStart(latencyMs: number | null): void;
  onMicLevel(rms: number, voiced: boolean): void;
  onTranscript(who: 'you' | 'jake', text: string, turnDone: boolean): void;
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
