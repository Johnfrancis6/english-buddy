import {
  MISTAKE_TYPES,
  type Debrief,
  type Mistake,
  type MistakeType,
  type VocabItem,
} from './types';

/**
 * JSON Schema sent as `responseJsonSchema`. Only keywords listed as supported
 * in the Gemini structured-output docs (checked 2026-11-10) are used.
 */
export const DEBRIEF_SCHEMA = {
  type: 'object',
  properties: {
    summary_fr: {
      type: 'string',
      description: 'Two or three encouraging, honest sentences in French about the talk.',
    },
    strengths_fr: {
      type: 'array',
      maxItems: 3,
      items: { type: 'string', description: 'Something the learner did well, in French.' },
    },
    mistakes: {
      type: 'array',
      maxItems: 15,
      items: {
        type: 'object',
        properties: {
          turn: { type: 'integer', description: 'Id of the learner turn (the number in [#n]).' },
          type: { type: 'string', enum: Object.keys(MISTAKE_TYPES) },
          said: { type: 'string', description: 'The learner words, copied exactly from the turn.' },
          correct: { type: 'string', description: 'The same words in natural, correct English.' },
          explanation_fr: {
            type: 'string',
            description: 'One or two short sentences in French: the rule, simply.',
          },
          recast_by_jake: {
            type: 'boolean',
            description: 'True if Jake reused the correct form in his next turn.',
          },
        },
        required: ['turn', 'type', 'said', 'correct', 'explanation_fr', 'recast_by_jake'],
      },
    },
    vocabulary: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          english: { type: 'string' },
          french: { type: 'string' },
          example: { type: 'string', description: 'A short English example sentence.' },
        },
        required: ['english', 'french', 'example'],
      },
    },
    next_focus_fr: {
      type: 'string',
      description: 'The single most useful thing to work on next time, in French.',
    },
  },
  required: ['summary_fr', 'strengths_fr', 'mistakes', 'vocabulary', 'next_focus_fr'],
} as const;

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};

/**
 * Validates the model's answer. Constraints the API does not enforce
 * (lengths, known turn ids) are checked here; bad items are dropped rather
 * than failing the whole debrief.
 */
export function parseDebrief(
  raw: string,
  learnerTurnIds: ReadonlySet<number>,
  model: string,
): Debrief {
  const j = obj(JSON.parse(stripFences(raw)));
  const mistakes: Mistake[] = [];
  const seen = new Set<string>();
  for (const item of arr(j.mistakes)) {
    const m = obj(item);
    const said = str(m.said);
    const correct = str(m.correct);
    const turn = Number(m.turn);
    if (!said || !correct || said.toLowerCase() === correct.toLowerCase()) continue;
    const key = `${said.toLowerCase()}→${correct.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const type = (Object.hasOwn(MISTAKE_TYPES, str(m.type)) ? str(m.type) : 'other') as MistakeType;
    mistakes.push({
      turn: learnerTurnIds.has(turn) ? turn : -1,
      type,
      said,
      correct,
      explanationFr: str(m.explanation_fr),
      recastByJake: m.recast_by_jake === true,
    });
  }
  const vocabulary: VocabItem[] = arr(j.vocabulary)
    .map((v) => obj(v))
    .map((v) => ({ english: str(v.english), french: str(v.french), example: str(v.example) }))
    .filter((v) => v.english && v.french)
    .slice(0, 5);
  return {
    summaryFr: str(j.summary_fr),
    strengthsFr: arr(j.strengths_fr).map(str).filter(Boolean).slice(0, 3),
    mistakes,
    vocabulary,
    nextFocusFr: str(j.next_focus_fr),
    model,
  };
}

/** Some models wrap JSON in ```json fences even in JSON mode. */
export function stripFences(raw: string): string {
  const m = raw.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m ? m[1] : raw.trim();
}

/** Mistakes grouped by type, most frequent type first. */
export function groupByType(mistakes: readonly Mistake[]): [MistakeType, Mistake[]][] {
  const groups = new Map<MistakeType, Mistake[]>();
  for (const m of mistakes) groups.set(m.type, [...(groups.get(m.type) ?? []), m]);
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
}
