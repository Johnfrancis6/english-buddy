import { forbiddenFound, usesExpression } from '../habit/expressions';
import { missionById } from '../habit/missions';
import type { TalkPlan } from '../habit/plan';
import { LEARNER_CATEGORIES, type FactUpdate } from '../memory/facts';
import { SCALE_TEXT } from '../progress/level';
import {
  MISTAKE_TYPES,
  type SkillScores,
  type Debrief,
  type ExpressionResult,
  type Mistake,
  type MissionResult,
  type ReviewResult,
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

/**
 * The schema for one talk: the base debrief, plus (phase 4) the mission
 * result, the expressions to place and the review items when the talk had
 * them. Enums carry the exact expressions and card ids, so the model can only
 * answer about what was planned.
 */
export function debriefSchema(plan?: TalkPlan): object {
  if (!plan || plan.mode === 'free') return DEBRIEF_SCHEMA;
  const properties: Record<string, object> = { ...DEBRIEF_SCHEMA.properties };
  const required: string[] = [...DEBRIEF_SCHEMA.required];
  if (plan.missionId) {
    properties.mission = {
      type: 'object',
      properties: {
        passed: { type: 'boolean', description: 'True if the learner clearly reached the goal.' },
        score: {
          type: 'integer',
          minimum: 0,
          maximum: 100,
          description:
            'How well the mission was done: goal reached, clarity, politeness and naturalness of the English.',
        },
        feedback_fr: {
          type: 'string',
          description: 'One or two sentences in French: what worked and what to do better.',
        },
      },
      required: ['passed', 'score', 'feedback_fr'],
    };
    required.push('mission');
  }
  if (plan.expressions.length) {
    properties.expressions_used = {
      type: 'array',
      maxItems: plan.expressions.length,
      items: {
        type: 'object',
        properties: {
          expression: { type: 'string', enum: plan.expressions.map((e) => e.en) },
          used: { type: 'boolean', description: 'The learner said it (or a correct form of it).' },
          natural: {
            type: 'boolean',
            description: 'Used correctly and in a fitting context.',
          },
          quote: { type: 'string', description: 'The learner words where it appears, or "".' },
        },
        required: ['expression', 'used', 'natural', 'quote'],
      },
    };
    required.push('expressions_used');
  }
  if (plan.reviews.length) {
    properties.review_results = {
      type: 'array',
      maxItems: plan.reviews.length,
      items: {
        type: 'object',
        properties: {
          item: { type: 'string', enum: plan.reviews.map((r) => r.cardId) },
          result: {
            type: 'string',
            enum: ['correct', 'wrong', 'absent'],
            description:
              'correct: the learner produced the right form; wrong: they made the same mistake again; absent: the structure did not come up.',
          },
          quote: { type: 'string', description: 'The learner words that show it, or "".' },
        },
        required: ['item', 'result', 'quote'],
      },
    };
    required.push('review_results');
  }
  return { ...DEBRIEF_SCHEMA, properties, required };
}

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
  plan?: TalkPlan,
  learnerText = '',
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
  const extra: Partial<Debrief> = {};
  if (plan && plan.mode !== 'free') {
    const mission = parseMission(j.mission, plan, learnerText);
    if (mission) extra.mission = mission;
    if (plan.expressions.length) {
      extra.expressions = parseExpressions(j.expressions_used, plan, learnerText);
    }
    if (plan.reviews.length) extra.reviews = parseReviews(j.review_results, plan);
  }
  return {
    ...extra,
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

/**
 * The mission result. A forbidden word found in the learner's own text fails
 * the mission whatever the model says (score capped at 40).
 */
export function parseMission(
  v: unknown,
  plan: TalkPlan,
  learnerText: string,
): MissionResult | null {
  const mission = missionById(plan.missionId);
  if (!mission) return null;
  const o = obj(v);
  const forbiddenSaid = forbiddenFound(learnerText, mission.forbidden);
  const score = typeof o.score === 'number' && Number.isFinite(o.score) ? o.score : 0;
  let passed = o.passed === true;
  let clamped = Math.max(0, Math.min(100, Math.round(score)));
  if (forbiddenSaid.length) {
    passed = false;
    clamped = Math.min(clamped, 40);
  }
  return { passed, score: clamped, feedbackFr: str(o.feedback_fr), forbiddenSaid };
}

/**
 * One result per planned expression, in the plan's order; missing ones count
 * as not used. An expression the page found in the learner's own text (the
 * tick seen during the talk) counts as used even if the model missed it; only
 * "natural" is left to the model.
 */
export function parseExpressions(v: unknown, plan: TalkPlan, learnerText = ''): ExpressionResult[] {
  const given = new Map(
    arr(v)
      .map(obj)
      .map((x) => [str(x.expression).toLowerCase(), x] as const),
  );
  return plan.expressions.map((e) => {
    const x = given.get(e.en.toLowerCase()) ?? {};
    const seen = learnerText ? usesExpression(learnerText, e) : false;
    const used = x.used === true || seen;
    return {
      en: e.en,
      used,
      natural: used && x.natural === true,
      quote: used ? str(x.quote).slice(0, 200) : '',
      ...(e.cardId ? { cardId: e.cardId } : {}),
    };
  });
}

/** One result per review item, in the plan's order; missing ones are "absent". */
export function parseReviews(v: unknown, plan: TalkPlan): ReviewResult[] {
  const given = new Map(
    arr(v)
      .map(obj)
      .map((x) => [str(x.item), x] as const),
  );
  return plan.reviews.map((r) => {
    const x = given.get(r.cardId) ?? {};
    const result =
      (['correct', 'wrong', 'absent'] as const).find((k) => k === x.result) ?? 'absent';
    return {
      cardId: r.cardId,
      result,
      quote: result === 'absent' ? '' : str(x.quote).slice(0, 200),
    };
  });
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
