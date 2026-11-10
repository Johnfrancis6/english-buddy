import type { Settings, TranscriptSource } from '../settings';
import { GeminiAudioTranscriber } from './geminiAudio';
import { GroqWhisper, LEARNER_STYLE_PROMPT } from './groq';
import type { Transcriber } from './types';

/** The second recogniser for a source, or null for Gemini Live's own. */
export function makeTranscriber(source: TranscriptSource, s: Settings): Transcriber | null {
  switch (source) {
    case 'groq':
      return new GroqWhisper({ apiKey: s.groqKey });
    case 'groq-prompt':
      return new GroqWhisper({
        apiKey: s.groqKey,
        prompt: LEARNER_STYLE_PROMPT,
        id: 'groq-prompt',
        label: 'Groq Whisper + consigne',
      });
    case 'gemini-audio':
      return new GeminiAudioTranscriber(s.apiKey, s.analysisModel);
    default:
      return null;
  }
}
