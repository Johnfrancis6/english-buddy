import { LEARNER_CATEGORIES, type FactUpdate } from '../memory/facts';
import { SCALE_TEXT } from '../progress/level';
import {
  MISTAKE_TYPES,
  type SkillScores,
  type Debrief,
  type Mistake,
  type MistakeType,
  type VocabItem,
} from './types';

const score = (what: string) => ({
  type: 'integer',
  minimum: 0,
  maximum: 100,
  description: `${what} Scale: ${SCALE_TEXT}`,
});

/**
 * JSON Schema sent as `responseJsonSchema`. Only keywords listed as supported
 * in the Gemini structured-output docs are used (checked again 2026-11-10:
 * minimum/maximum, enum, minItems/maxItems are enforced; string lengths are
 * not, so they are re-checked in code).
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
          recast_by_character: {
            type: 'boolean',
            description: 'True if the character reused the correct form in their next turn.',
          },
        },
        required: ['turn', 'type', 'said', 'correct', 'explanation_fr', 'recast_by_character'],
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
    skill_scores: {
      type: 'object',
      description: 'Estimates from this transcript only.',
      properties: {
        fluency: score('Fluency: length and flow of turns, hesitations, ability to keep talking.'),
        grammar: score('Grammar: accuracy and range of structures.'),
        vocabulary: score('Vocabulary: range and precision of words and expressions.'),
        listening: score(
          'Listening: did the learner understand the character (relevant answers, few requests to repeat)?',
        ),
      },
      required: ['fluency', 'grammar', 'vocabulary', 'listening'],
    },
    memory_facts: {
      type: 'array',
      maxItems: 8,
      description:
        'Lasting facts the learner told about their own life, new or changed since the known facts.',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: [...LEARNER_CATEGORIES] },
          fact_fr: {
            type: 'string',
            description: 'One short sentence in French, in the third person.',
          },
          replaces: {
            type: 'string',
            description: 'Id of the known fact this one updates, or an empty string.',
          },
        },
        required: ['category', 'fact_fr', 'replaces'],
      },
    },
    talk_memory_fr: {
      type: 'string',
      description:
        'One or two sentences in French: what the talk was about and anything to follow up next time.',
    },
  },
  required: [
    'summary_fr',
    'strengths_fr',
    'mistakes',
    'vocabulary',
    'next_focus_fr',
    'skill_scores',
    'memory_facts',
    'talk_memory_fr',
  ],
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
      recastByCharacter: m.recast_by_character === true,
    });
  }
  const vocabulary: VocabItem[] = arr(j.vocabulary)
    .map((v) => obj(v))
    .map((v) => ({ english: str(v.english), french: str(v.french), example: str(v.example) }))
    .filter((v) => v.english && v.french)
    .slice(0, 5);
  return {
    skills: parseSkills(j.skill_scores),
    memory: parseMemory(j.memory_facts),
    talkMemoryFr: str(j.talk_memory_fr).slice(0, 400),
    summaryFr: str(j.summary_fr),
    strengthsFr: arr(j.strengths_fr).map(str).filter(Boolean).slice(0, 3),
    mistakes,
    vocabulary,
    nextFocusFr: str(j.next_focus_fr),
    model,
  };
}

function parseSkills(v: unknown): SkillScores | null {
  const o = obj(v);
  const keys = ['fluency', 'grammar', 'vocabulary', 'listening'] as const;
  if (!keys.every((k) => typeof o[k] === 'number' && Number.isFinite(o[k]))) return null;
  const clamp = (n: unknown) => Math.max(0, Math.min(100, Math.round(n as number)));
  return {
    fluency: clamp(o.fluency),
    grammar: clamp(o.grammar),
    vocabulary: clamp(o.vocabulary),
    listening: clamp(o.listening),
  };
}

function parseMemory(v: unknown): FactUpdate[] {
  const cats: readonly string[] = LEARNER_CATEGORIES;
  return arr(v)
    .map(obj)
    .map((f) => ({
      category: (cats.includes(str(f.category))
        ? str(f.category)
        : 'life') as FactUpdate['category'],
      text: str(f.fact_fr).slice(0, 200),
      replaces: str(f.replaces),
    }))
    .filter((f) => f.text)
    .slice(0, 8);
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
