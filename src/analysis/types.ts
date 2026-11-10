/** Mistake taxonomy (docs/BRIEF.md §5), with the French label shown. */
export const MISTAKE_TYPES = {
  verb_tense: 'Temps du verbe',
  verb_form: 'Forme du verbe',
  agreement: 'Accord',
  articles: 'Articles',
  prepositions: 'Prépositions',
  word_order: 'Ordre des mots',
  false_friend: 'Faux ami / calque du français',
  vocabulary: 'Choix du mot',
  register: 'Registre',
  pronunciation: 'Prononciation (probable)',
  other: 'Autre',
} as const;
export type MistakeType = keyof typeof MISTAKE_TYPES;

export interface Mistake {
  /** Id of the learner turn in the transcript. */
  turn: number;
  type: MistakeType;
  /** The learner's words, as transcribed. */
  said: string;
  correct: string;
  explanationFr: string;
  /** The character reused the correct form in their answer. */
  recastByCharacter: boolean;
}

export interface VocabItem {
  english: string;
  french: string;
  example: string;
}

export interface Debrief {
  summaryFr: string;
  strengthsFr: string[];
  mistakes: Mistake[];
  vocabulary: VocabItem[];
  /** One priority for the next talk, in French. */
  nextFocusFr: string;
  /** Model that produced it, for the report. */
  model: string;
}

/** One line of the conversation as given to the analyzer. */
export interface AnalysisTurn {
  id: number;
  who: 'you' | 'buddy';
  text: string;
  interrupted?: boolean;
}

export interface AnalysisContext {
  level: string;
  characterName: string;
  /** Who the learner talked with, in a few English words (persona.ts). */
  characterDescription?: string;
  /** Where the learner's text comes from, so recognition errors are expected. */
  transcriptSource: string;
}

/**
 * Turns a finished conversation into a structured debrief, and explains one
 * mistake in depth. Provider-neutral so another text model can replace Gemini.
 */
export interface Analyzer {
  analyze(turns: AnalysisTurn[], ctx: AnalysisContext, signal?: AbortSignal): Promise<Debrief>;
  explain(mistake: Mistake, turns: AnalysisTurn[], signal?: AbortSignal): Promise<string>;
}
