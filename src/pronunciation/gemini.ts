import { generateText, withModelFallback } from '../net/gemini';
import { ProviderError } from '../net/providerError';
import { alignWords, overallOf, type RawWord } from './align';
import { soundsOf, tokenize } from './sounds';
import {
  SOUND_IDS,
  type PronunciationResult,
  type PronunciationScorer,
  type ScoreInput,
} from './types';

/**
 * Default scorer: a Gemini text model listens to the recording (inline WAV,
 * 32 tokens per second according to aistudio.google.com/docs/audio) and
 * judges each word of the known sentence, as structured JSON. No extra
 * account: it uses the learner's Gemini key. It is a model's judgement, not
 * an acoustic measure: shown as an estimate.
 */
export const PRON_SCHEMA = {
  type: 'object',
  properties: {
    audio_ok: {
      type: 'boolean',
      description:
        'False if the recording is silent, cut, very noisy, or not the target sentence at all.',
    },
    heard: { type: 'string', description: 'What the speaker actually said, word for word.' },
    words: {
      type: 'array',
      description: 'One entry per word of the target sentence, in order.',
      items: {
        type: 'object',
        properties: {
          word: { type: 'string', description: 'The target word, as written.' },
          score: { type: 'integer', minimum: 0, maximum: 100 },
          missing: { type: 'boolean' },
          issues: {
            type: 'array',
            items: { type: 'string', enum: [...SOUND_IDS, 'other'] },
          },
          heard_as: {
            type: 'string',
            description: 'What the word sounded like, only if it was wrong (e.g. "sink").',
          },
          tip_fr: {
            type: 'string',
            description: 'Only if score < 70: one short tip in French for this word.',
          },
        },
        required: ['word', 'score', 'missing', 'issues'],
      },
    },
    feedback_fr: {
      type: 'string',
      description: 'One or two short encouraging sentences in French (tutoiement).',
    },
  },
  required: ['audio_ok', 'heard', 'words', 'feedback_fr'],
} as const;

export function pronPrompt(reference: string): string {
  const words = tokenize(reference);
  const hints = words
    .map((w) => [w, soundsOf(w)] as const)
    .filter(([, s]) => s.length)
    .map(([w, s]) => `${w} (${s.join(', ')})`)
    .join('; ');
  return `Target sentence (read aloud by the speaker): "${reference}"
Target words, in order (${words.length}): ${words.join(' | ')}
Words with sounds that are often hard for French speakers: ${hints || 'none'}`;
}

export const PRON_SYSTEM = `You are a careful English pronunciation assessor. The speaker is a French-speaking adult learning English. You receive a short recording and the sentence they were asked to read.

For every word of the target sentence, in order, give a score from 0 to 100 for how clearly and correctly it was pronounced:
- 90-100: clear, as a native speaker would say it (American or British: both are fine).
- 70-89: understandable, with a light accent; small things a listener barely notices.
- 50-69: a sound is clearly wrong (for example "sink" for "think", "ouse" for "house", "ship" for "sheep", "work-ed" with an extra syllable, stress on the wrong syllable), but the word can still be guessed.
- 1-49: the word is hard to recognise or sounds like another word.
- 0 and "missing": true: the word was not said.

Issues (only for problems you really hear, never by default):
- "th": th said as s, z, f, t or d.
- "h": h dropped where it should be heard (happy, house, who), or added where it should not be.
- "r": French (uvular) r instead of the English r.
- "vowels": short and long vowels mixed up (ship/sheep, live/leave, full/fool) or another clearly wrong vowel.
- "ed": the -ed ending wrong (extra syllable "work-ed", or ending dropped).
- "stress": stress on the wrong syllable of the word.
- "other": any other clear problem.

Rules:
- Judge the sounds, not the accent: a French accent with correct sounds scores 75 or more.
- Do not invent problems: if a word sounds fine, give no issue. Unclear audio is not a pronunciation problem: set "audio_ok" to false instead.
- "heard" is what was really said; if the speaker said other words, score the missing target words 0.
- "tip_fr": short, concrete, in French (tutoiement), only for words below 70.
- "feedback_fr": first what went well, then the one sound to practise.`;

interface PronJson {
  audio_ok?: boolean;
  heard?: string;
  words?: {
    word?: string;
    score?: number;
    missing?: boolean;
    issues?: string[];
    heard_as?: string;
    tip_fr?: string;
  }[];
  feedback_fr?: string;
}

/** Turns Gemini's JSON into a result matched to the sentence. */
export function parsePronJson(
  text: string,
  reference: string,
  model: string,
  scorer = 'gemini',
): PronunciationResult {
  let json: PronJson;
  try {
    json = JSON.parse(text) as PronJson;
  } catch {
    throw new ProviderError('gemini', 'bad-output', 'pronunciation JSON could not be parsed');
  }
  if (!Array.isArray(json.words)) {
    throw new ProviderError('gemini', 'bad-output', 'pronunciation JSON without words');
  }
  const raw: RawWord[] = json.words.map((w) => ({
    word: String(w.word ?? ''),
    score: Number(w.score ?? 0),
    issues: Array.isArray(w.issues) ? w.issues : [],
    heard: typeof w.heard_as === 'string' ? w.heard_as : undefined,
    tipFr: typeof w.tip_fr === 'string' ? w.tip_fr : undefined,
    missing: w.missing === true,
  }));
  const words = alignWords(reference, raw);
  return {
    scorer,
    model,
    overall: overallOf(words),
    words,
    heardText: typeof json.heard === 'string' ? json.heard.slice(0, 300) : undefined,
    feedbackFr: typeof json.feedback_fr === 'string' ? json.feedback_fr.slice(0, 400) : undefined,
    ...(json.audio_ok === false ? { unreliable: true } : {}),
  };
}

const toBase64 = (bytes: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
};

export class GeminiScorer implements PronunciationScorer {
  readonly id = 'gemini';
  readonly label = 'Gemini (écoute et jugement par l’IA)';
  constructor(
    private readonly apiKey: string,
    private readonly models: readonly string[],
  ) {}

  async score(input: ScoreInput): Promise<PronunciationResult> {
    const { value, model } = await withModelFallback(this.models, (model) =>
      generateText({
        apiKey: this.apiKey,
        model,
        system: PRON_SYSTEM,
        parts: [
          { text: pronPrompt(input.reference) },
          { inlineData: { mimeType: 'audio/wav', data: toBase64(input.wav) } },
        ],
        jsonSchema: PRON_SCHEMA,
        temperature: 0,
        signal: input.signal,
      }),
    );
    return parsePronJson(value, input.reference, model);
  }
}
