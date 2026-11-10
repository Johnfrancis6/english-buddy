import { ANALYSIS_MODELS, type Settings } from '../settings';
import { AzureScorer } from './azure';
import { GeminiScorer } from './gemini';
import type { PronunciationScorer } from './types';
import { WhisperCheckedScorer } from './whisperCheck';

/**
 * Which scorer the exercise uses, from the keys present:
 * - an Azure Speech key → Azure (phoneme scores, the most precise option);
 * - otherwise the Gemini key → Gemini, cross-checked by Groq Whisper when a
 *   Groq key is present;
 * - no key → null (the exercise explains how to get a free Gemini key).
 */
export function makeScorer(
  s: Pick<Settings, 'apiKey' | 'groqKey' | 'azureKey' | 'azureRegion' | 'analysisModel'>,
): PronunciationScorer | null {
  const main = makeMainScorer(s);
  if (!main || main instanceof AzureScorer) return main;
  return s.groqKey.trim() ? new WhisperCheckedScorer(main, s.groqKey) : main;
}

/** The scorer without the Whisper cross-check (the karaoke calls Whisper itself, for the timing). */
export function makeMainScorer(
  s: Pick<Settings, 'apiKey' | 'azureKey' | 'azureRegion' | 'analysisModel'>,
): PronunciationScorer | null {
  if (s.azureKey.trim()) return new AzureScorer(s.azureKey, s.azureRegion);
  if (!s.apiKey.trim()) return null;
  const models = [s.analysisModel, ...ANALYSIS_MODELS.map((m) => m.id)].filter(
    (m, i, all) => all.indexOf(m) === i,
  );
  return new GeminiScorer(s.apiKey, models);
}

/** French name of a scorer id, for the screen and the progress page. */
export function scorerNameFr(id: string): string {
  if (id === 'azure') return 'Azure Speech';
  if (id === 'gemini+groq') return 'Gemini + contrôle Groq';
  if (id === 'gemini') return 'Gemini';
  return id;
}
