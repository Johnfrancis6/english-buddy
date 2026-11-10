import { ProviderError, providerFetch } from '../net/providerError';
import { alignWords, overallOf, type RawWord } from './align';
import { edSound } from './sounds';
import type { PronunciationResult, PronunciationScorer, ScoreInput, SoundId } from './types';

/**
 * Optional scorer: Azure Speech "Pronunciation Assessment", the only option
 * compared in phase 6 that measures each phoneme acoustically. It needs an
 * Azure account and a Speech resource (free F0 tier: 5 audio hours a month).
 *
 * REST API for short audio (≤ 30 s for pronunciation assessment), shape from
 * learn.microsoft.com/azure/ai-services/speech-service/rest-speech-to-text-short
 * (read 2026-11-10): `Pronunciation-Assessment` header = base64 of a JSON
 * object; key in `Ocp-Apim-Subscription-Key`. Measured from the build
 * session: the regional endpoint answers CORS preflight with
 * `access-control-allow-origin: *` and allows that header; a fake key gets 401.
 */
export const AZURE_REGIONS = [
  'westeurope',
  'francecentral',
  'northeurope',
  'uksouth',
  'eastus',
  'westus2',
] as const;

export const azureUrl = (region: string) =>
  `https://${encodeURIComponent(region.trim().toLowerCase())}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`;

export function assessmentHeader(reference: string): string {
  const json = JSON.stringify({
    ReferenceText: reference,
    GradingSystem: 'HundredMark',
    Granularity: 'Phoneme',
    Dimension: 'Comprehensive',
    EnableMiscue: 'True',
  });
  const bytes = new TextEncoder().encode(json);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** SAPI (default for en-US) and IPA phoneme names → our sound families. */
const PHONEME_SOUND: Record<string, SoundId> = {
  th: 'th',
  dh: 'th',
  θ: 'th',
  ð: 'th',
  hh: 'h',
  h: 'h',
  r: 'r',
  ɹ: 'r',
  iy: 'vowels',
  ih: 'vowels',
  uw: 'vowels',
  uh: 'vowels',
  i: 'vowels',
  ɪ: 'vowels',
  u: 'vowels',
  ʊ: 'vowels',
  iː: 'vowels',
  uː: 'vowels',
};
/** A phoneme below this is counted as an issue. */
const PHONEME_OK = 60;

interface AzurePhoneme {
  Phoneme?: string;
  AccuracyScore?: number;
  PronunciationAssessment?: { AccuracyScore?: number };
}
interface AzureWord {
  Word?: string;
  AccuracyScore?: number;
  ErrorType?: string;
  Phonemes?: AzurePhoneme[];
  PronunciationAssessment?: { AccuracyScore?: number; ErrorType?: string };
}
interface AzureResponse {
  RecognitionStatus?: string;
  DisplayText?: string;
  NBest?: {
    Display?: string;
    AccuracyScore?: number;
    PronScore?: number;
    Words?: AzureWord[];
    PronunciationAssessment?: { AccuracyScore?: number };
  }[];
}

const acc = (x: { AccuracyScore?: number; PronunciationAssessment?: { AccuracyScore?: number } }) =>
  Number(x.AccuracyScore ?? x.PronunciationAssessment?.AccuracyScore ?? 0);

export function parseAzure(json: AzureResponse, reference: string): PronunciationResult {
  if (json.RecognitionStatus && json.RecognitionStatus !== 'Success') {
    return {
      scorer: 'azure',
      model: 'Azure Pronunciation Assessment',
      overall: 0,
      words: alignWords(reference, []).map((w) => ({ ...w, score: 0 })),
      unreliable: true,
      feedbackFr:
        'Microsoft n’a pas entendu de phrase en anglais. Rapproche le micro et recommence.',
    };
  }
  const best = json.NBest?.[0];
  if (!best) throw new ProviderError('azure', 'bad-output', 'no NBest in the answer');
  const raw: RawWord[] = [];
  for (const w of best.Words ?? []) {
    const type = w.ErrorType ?? w.PronunciationAssessment?.ErrorType ?? 'None';
    if (type === 'Insertion') continue; // said but not in the sentence
    const issues = new Set<SoundId>();
    const phonemes = w.Phonemes ?? [];
    for (const p of phonemes) {
      const sound = PHONEME_SOUND[String(p.Phoneme ?? '').toLowerCase()];
      if (sound && acc(p) < PHONEME_OK) issues.add(sound);
    }
    // The -ed ending: the last phoneme(s) of a regular past form.
    const word = String(w.Word ?? '');
    if (edSound(word) && phonemes.length && acc(phonemes[phonemes.length - 1]) < PHONEME_OK) {
      issues.add('ed');
    }
    raw.push({
      word,
      score: acc(w),
      issues: [...issues],
      missing: type === 'Omission',
    });
  }
  const words = alignWords(reference, raw);
  return {
    scorer: 'azure',
    model: 'Azure Pronunciation Assessment',
    overall: overallOf(words),
    words,
    heardText: best.Display ?? json.DisplayText,
  };
}

export class AzureScorer implements PronunciationScorer {
  readonly id = 'azure';
  readonly label = 'Azure Speech (mesure par son)';
  constructor(
    private readonly key: string,
    private readonly region: string,
  ) {}

  async score(input: ScoreInput): Promise<PronunciationResult> {
    const res = await providerFetch('azure', azureUrl(this.region), {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.key.trim(),
        'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
        Accept: 'application/json',
        'Pronunciation-Assessment': assessmentHeader(input.reference),
      },
      body: input.wav as BlobPart,
      signal: input.signal,
    });
    return parseAzure((await res.json()) as AzureResponse, input.reference);
  }
}
