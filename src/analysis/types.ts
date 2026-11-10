import type { FactUpdate } from '../memory/facts';
import type { TalkPlan } from '../habit/plan';

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

/** Sub-scores, 0–100 on a scale anchored on CEFR bands (see SKILL_BANDS). */
export interface SkillScores {
  fluency: number;
  grammar: number;
  vocabulary: number;
  listening: number;
}
export const SKILLS = {
  fluency: 'Aisance',
  grammar: 'Grammaire',
  vocabulary: 'Vocabulaire',
  listening: 'Compréhension',
} as const satisfies Record<keyof SkillScores, string>;

export interface Debrief {
  summaryFr: string;
  strengthsFr: string[];
  mistakes: Mistake[];
  vocabulary: VocabItem[];
  /** One priority for the next talk, in French. */
  nextFocusFr: string;
  /** Model that produced it, for the report. */
  model: string;
  /** Phase 3+: one estimate per skill for this talk (null if the model gave none). */
  skills?: SkillScores | null;
  /** Phase 3+: new or changed facts about the learner. */
  memory?: FactUpdate[];
  /** Phase 3+: what the talk was about, for the character's memory (French). */
  talkMemoryFr?: string;
  /** Phase 4: result of the talk's mission, when it had one. */
  mission?: MissionResult;
  /** Phase 4: the expressions to place, and whether they were used. */
  expressions?: ExpressionResult[];
  /** Phase 4: the review items of a daily challenge, as judged in the talk. */
  reviews?: ReviewResult[];
}

export interface MissionResult {
  passed: boolean;
  /** 0–100. */
  score: number;
  feedbackFr: string;
  /** Forbidden words the learner said (found in the transcript by the page). */
  forbiddenSaid: string[];
}

export interface ExpressionResult {
  en: string;
  used: boolean;
  /** Used in a natural, correct way. */
  natural: boolean;
  /** The learner's words where it was used ('' if not used). */
  quote: string;
  cardId?: string;
}

export interface ReviewResult {
  cardId: string;
  result: 'correct' | 'wrong' | 'absent';
  /** The learner's words that show it ('' if absent). */
  quote: string;
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
  /** What is already known about the learner, with ids (memory/facts.ts). */
  knownFacts?: string;
  /** Phase 4: the mission, expressions and review items of this talk. */
  plan?: TalkPlan;
}

/**
 * Turns a finished conversation into a structured debrief, and explains one
 * mistake in depth. Provider-neutral so another text model can replace Gemini.
 */
export interface Analyzer {
  analyze(turns: AnalysisTurn[], ctx: AnalysisContext, signal?: AbortSignal): Promise<Debrief>;
  explain(mistake: Mistake, turns: AnalysisTurn[], signal?: AbortSignal): Promise<string>;
}
