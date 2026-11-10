/**
 * A speech-to-text provider used on one learner turn at a time. The audio is
 * a WAV file held in memory; implementations must not keep it.
 */
export interface Transcriber {
  readonly id: string;
  readonly label: string;
  transcribe(wav: Uint8Array, signal?: AbortSignal): Promise<string>;
}
