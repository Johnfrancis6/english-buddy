import { MISTAKE_TYPES, type MistakeType } from '../analysis/types';
import { dueCards, type ReviewCard } from '../reviews/cards';
import type { SceneId } from '../teaching/persona';
import { SCENE_EXPRESSIONS, type Expression } from './expressions';
import type { Mission } from './missions';

/**
 * What a talk is for, beyond chatting: a mission, expressions to place and,
 * in the daily challenge, the learner's own mistakes to produce correctly.
 * It goes into the character's prompt, the on-screen goals panel and the
 * debrief's JSON schema. Saved with the talk.
 */
export interface ReviewItem {
  cardId: string;
  said: string;
  correct: string;
  type: MistakeType;
}

export interface TalkPlan {
  mode: 'free' | 'mission' | 'challenge';
  missionId?: string;
  reviews: ReviewItem[];
  expressions: Expression[];
  /** Planned length (the daily challenge), in minutes. */
  minutes?: number;
}

export const FREE_PLAN: TalkPlan = { mode: 'free', reviews: [], expressions: [] };

/** The daily challenge lasts about five minutes. */
export const CHALLENGE_MINUTES = 5;
export const CHALLENGE_REVIEWS = 4;
export const CHALLENGE_EXPRESSIONS = 3;

/**
 * The daily challenge, from the cards that are due: up to four of the
 * learner's own mistakes to produce correctly, and three expressions to place
 * (due word cards first, then the scene's everyday expressions).
 */
export function buildChallenge(
  cards: readonly ReviewCard[],
  scene: SceneId,
  now: number,
): TalkPlan {
  const due = dueCards(cards, now);
  const reviews: ReviewItem[] = due
    .filter((c) => c.kind === 'mistake')
    .slice(0, CHALLENGE_REVIEWS)
    .map((c) => ({ cardId: c.id, said: c.front, correct: c.back, type: c.type ?? 'other' }));
  const expressions: Expression[] = due
    .filter((c) => c.kind === 'word')
    .slice(0, CHALLENGE_EXPRESSIONS)
    .map((c) => ({ en: c.back, fr: c.front, cardId: c.id }));
  // Fill with the scene's expressions, a different set each day.
  const pool = SCENE_EXPRESSIONS[scene];
  const offset = Math.floor(now / 86_400_000) % pool.length;
  for (let i = 0; i < pool.length && expressions.length < CHALLENGE_EXPRESSIONS; i++) {
    const e = pool[(offset + i) % pool.length];
    if (!expressions.some((x) => x.en.toLowerCase() === e.en.toLowerCase())) expressions.push(e);
  }
  return { mode: 'challenge', reviews, expressions, minutes: CHALLENGE_MINUTES };
}

export function missionPlan(m: Mission): TalkPlan {
  return { mode: 'mission', missionId: m.id, reviews: [], expressions: [...m.expressions] };
}

/**
 * The part of the character's prompt that describes the plan ('' for a free
 * talk). A mission's role (`roleEn`) goes in the scene line instead.
 */
export function planPrompt(plan: TalkPlan, mission: Mission | undefined): string {
  const blocks: string[] = [];
  if (plan.mode === 'challenge') {
    blocks.push(
      `This talk is the learner's short daily challenge: about ${plan.minutes ?? CHALLENGE_MINUTES} minutes. Keep the pace lively and give them plenty of chances to speak.`,
    );
  }
  if (mission) {
    const avoid = mission.forbidden.length
      ? ` They must not say ${mission.forbidden.map((w) => `"${w}"`).join(' or ')}: never say ${mission.forbidden.length > 1 ? 'these words' : 'this word'} yourself and never mention the rule.`
      : '';
    blocks.push(
      [
        `The learner's mission in this talk (they read it on screen, in French): ${mission.goalEn}${avoid}`,
        'Your part is described in the scene above.',
        'Make the mission possible but not trivial: let them do the work, never complete it for them, and do not hint at the solution. When the mission is clearly done, react naturally and keep chatting for a little while.',
      ].join('\n'),
    );
  }
  if (plan.reviews.length) {
    blocks.push(
      [
        'Review challenge: in past talks the learner made the mistakes below. Without telling them, create natural chances for them to produce the right form, one item at a time (a question that invites the structure, like a question about last weekend for a past tense). Never say the right form before they try. If they get it wrong, recast it as usual; if they get it right, just carry on.',
        ...plan.reviews.map(
          (r) => `- They said "${r.said}" instead of "${r.correct}" (${typeName(r.type)}).`,
        ),
      ].join('\n'),
    );
  }
  if (plan.expressions.length) {
    blocks.push(
      [
        `Expressions to place: the learner is trying to use these expressions naturally in the talk: ${plan.expressions.map((e) => `"${e.en}"`).join(', ')}. You may create openings where one would fit, but never say these expressions yourself before they do.`,
        'When they use one, notice it in your next line with a very short, warm reaction (for example "Ha, nice expression!" or "Ooh, love that one.") and carry on with the conversation. This is the only time you comment on their English.',
      ].join('\n'),
    );
  }
  return blocks.join('\n\n');
}

const typeName = (t: MistakeType) =>
  ({
    verb_tense: 'verb tense',
    verb_form: 'verb form',
    agreement: 'agreement',
    articles: 'article',
    prepositions: 'preposition',
    word_order: 'word order',
    false_friend: 'French structure or false friend',
    vocabulary: 'word choice',
    register: 'register',
    pronunciation: 'pronunciation',
    other: 'other',
  })[t];

/** The French type label of a review item. */
export const reviewTypeFr = (r: ReviewItem) => MISTAKE_TYPES[r.type];
