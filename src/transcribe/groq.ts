import { providerFetch } from '../net/providerError';
import type { Transcriber } from './types';

/**
 * Groq Whisper, called from the browser with the user's own key. API shape
 * checked on 2026-11-10 at https://console.groq.com/docs/speech-to-text
 * (OpenAI-compatible multipart endpoint). CORS measured from the build
 * session: the endpoint allows any origin with an Authorization header.
 */
export const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
export const GROQ_MODELS = ['whisper-large-v3', 'whisper-large-v3-turbo'] as const;

/**
 * Whisper copies the style of its prompt. A prompt written like a learner
 * (mistakes and hesitations included) may stop it from tidying the grammar.
 * Whether it helps is exactly what the transcription lab measures.
 */
export const LEARNER_STYLE_PROMPT =
  'Um, yesterday I go to the shop and they doesn’t have milk. I am agree, it depend of the weather.';

export interface GroqOptions {
  apiKey: string;
  model?: (typeof GROQ_MODELS)[number];
  prompt?: string;
  id?: string;
  label?: string;
}

export class GroqWhisper implements Transcriber {
  readonly id: string;
  readonly label: string;
  constructor(private readonly o: GroqOptions) {
    this.id = o.id ?? 'groq';
    this.label = o.label ?? 'Groq Whisper';
  }

  async transcribe(wav: Uint8Array, signal?: AbortSignal): Promise<string> {
    const form = new FormData();
    form.append('file', new Blob([wav as BlobPart], { type: 'audio/wav' }), 'turn.wav');
    form.append('model', this.o.model ?? GROQ_MODELS[0]);
    form.append('language', 'en');
    form.append('temperature', '0');
    form.append('response_format', 'json');
    if (this.o.prompt) form.append('prompt', this.o.prompt);
    const res = await providerFetch('groq', GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.o.apiKey.trim()}` },
      body: form,
      signal,
    });
    const json = (await res.json()) as { text?: string };
    return (json.text ?? '').trim();
  }
}
