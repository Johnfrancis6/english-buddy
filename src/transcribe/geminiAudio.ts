import { bytesToBase64 } from '../voice/pcm';
import { generateText } from '../net/gemini';
import type { Transcriber } from './types';

const VERBATIM_PROMPT = `Transcribe this English audio exactly as spoken by a French learner of English.
Write every word the speaker actually says, in the order they say it.
Keep all grammar mistakes, wrong verb forms, missing or extra words, and wrong word choices exactly as spoken. Never correct, complete or improve the sentence.
Leave out filler sounds like "um" and "uh".
Output only the transcript, on one line, with no quotes and no comments.`;

/** A Gemini text model asked for a verbatim transcript of one turn. */
export class GeminiAudioTranscriber implements Transcriber {
  readonly id = 'gemini-audio';
  readonly label = 'Gemini Flash (mot à mot)';
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async transcribe(wav: Uint8Array, signal?: AbortSignal): Promise<string> {
    const text = await generateText({
      apiKey: this.apiKey,
      model: this.model,
      temperature: 0,
      parts: [
        { text: VERBATIM_PROMPT },
        { inlineData: { mimeType: 'audio/wav', data: bytesToBase64(wav) } },
      ],
      signal,
    });
    return text.replace(/\s+/g, ' ').trim();
  }
}
