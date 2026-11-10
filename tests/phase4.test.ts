import { describe, expect, it } from 'vitest';
import { DEBRIEF_SCHEMA, debriefSchema, parseDebrief } from '../src/analysis/schema';
import { debriefSystemPrompt } from '../src/analysis/prompts';
import type { Debrief } from '../src/analysis/types';
import {
  expressionPattern,
  forbiddenFound,
  SCENE_EXPRESSIONS,
  usesExpression,
} from '../src/habit/expressions';
import { MISSIONS, missionById, unlockMap } from '../src/habit/missions';
import {
  buildChallenge,
  FREE_PLAN,
  missionPlan,
  planPrompt,
  type TalkPlan,
} from '../src/habit/plan';
import { computeStreak, DAY_GOAL_MS, dayKey, weekKey } from '../src/habit/streak';
import { challengeDoneToday, missionRecords, nextDueFr } from '../src/habit/today';
import {
  cardId,
  draftsFromDebrief,
  dueCards,
  FIRST_DELAY_MS,
  updatesFromTalk,
  type ReviewCard,
} from '../src/reviews/cards';
import { newFsrs, nextLocalDay, reviewFsrs } from '../src/reviews/fsrs';
import type { SavedTalk } from '../src/storage/talks';
import { buildSystemPrompt, JAKE } from '../src/teaching/persona';

const DAY = 86_400_000;
/** Thursday 12 November 2026, 18:00 local time. */
const NOW = new Date(2026, 10, 12, 18, 0, 0).getTime();
const at = (daysAgo: number, hour = 10) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
};
const min = (m: number) => m * 60_000;

describe('streak (≥ 3 min of real speech, one joker per week)', () => {
  it('counts consecutive days with at least 3 minutes, summed over the day', () => {
    const s = computeStreak(
      [
        { at: at(1), speakingMs: min(2) },
        { at: at(1, 20), speakingMs: min(1.5) },
        { at: at(2), speakingMs: min(4) },
        { at: at(3), speakingMs: min(3) },
      ],
      NOW,
    );
    expect(s.days).toBe(3);
    expect(s.todayDone).toBe(false);
    expect(s.todayMs).toBe(0);
  });

  it('today counts once it reaches 3 minutes, and does not break the streak before', () => {
    const talks = [
      { at: at(1), speakingMs: min(5) },
      { at: at(0, 9), speakingMs: min(2) },
    ];
    expect(computeStreak(talks, NOW).days).toBe(1);
    const more = [...talks, { at: at(0, 11), speakingMs: min(1) }];
    const s = computeStreak(more, NOW);
    expect(s.todayDone).toBe(true);
    expect(s.days).toBe(2);
    expect(s.todayMs).toBe(DAY_GOAL_MS);
  });

  it('a day under 3 minutes does not count', () => {
    expect(computeStreak([{ at: at(1), speakingMs: min(2.9) }], NOW).days).toBe(0);
  });

  it('one missed day per week is covered by the joker, without adding a day', () => {
    // Today Thursday: Wednesday done, Tuesday missed, Monday and Sunday done.
    const s = computeStreak(
      [
        { at: at(1), speakingMs: min(3) },
        { at: at(3), speakingMs: min(3) },
        { at: at(4), speakingMs: min(3) },
      ],
      NOW,
    );
    expect(s.days).toBe(3);
    expect(s.jokers).toEqual([dayKey(at(2))]);
    expect(s.jokerLeft).toBe(false);
  });

  it('two missed days in the same week break the streak', () => {
    expect(weekKey(at(2))).toBe(weekKey(at(3))); // Tuesday and Monday
    // Wednesday done, Tuesday and Monday missed: the streak stops at Wednesday.
    const s = computeStreak(
      [
        { at: at(1), speakingMs: min(3) },
        { at: at(4), speakingMs: min(3) },
      ],
      NOW,
    );
    expect(s.days).toBe(1);
    expect(s.jokers).toEqual([]);
    expect(s.jokerLeft).toBe(true);
  });

  it('missed days in two different weeks each use their week’s joker', () => {
    expect(weekKey(at(3))).not.toBe(weekKey(at(4))); // Monday and Sunday
    const s = computeStreak(
      [
        { at: at(1), speakingMs: min(3) },
        { at: at(2), speakingMs: min(3) },
        { at: at(5), speakingMs: min(3) },
      ],
      NOW,
    );
    expect(s.days).toBe(3);
    expect(s.jokers).toEqual([dayKey(at(3)), dayKey(at(4))]);
  });

  it('remembers the best streak', () => {
    const old = [10, 11, 12, 13].map((d) => ({ at: at(d), speakingMs: min(3) }));
    const s = computeStreak([...old, { at: at(1), speakingMs: min(3) }], NOW);
    expect(s.days).toBe(1);
    expect(s.best).toBe(4);
  });
});

describe('expressions to place', () => {
  it('matches regular forms and placeholders', () => {
    expect(usesExpression('We bumped into Sarah yesterday', { en: 'bump into someone' })).toBe(
      true,
    );
    expect(usesExpression('I am touching base with Tom', { en: 'touch base' })).toBe(true);
    expect(usesExpression("I'm swamped this week", { en: 'to be swamped' })).toBe(true);
    expect(usesExpression('we were really swamped', { en: 'to be swamped' })).toBe(true);
    expect(usesExpression('the ice is thin', { en: 'break the ice' })).toBe(false);
    expect(usesExpression('That broke the ice', { en: 'break the ice' })).toBe(false);
    expect(expressionPattern({ en: 'on the same page' }).test('we are on the same page')).toBe(
      true,
    );
  });

  it('uses the curated patterns for irregular forms', () => {
    const street = SCENE_EXPRESSIONS.street;
    const lost = street.find((e) => e.en === 'get lost')!;
    expect(usesExpression('I got a bit lost near the station', lost)).toBe(true);
    const cafe = SCENE_EXPRESSIONS.cafe;
    expect(
      usesExpression(
        'Don’t worry, it’s on me!',
        cafe.find((e) => e.en === "It's on me")!,
      ),
    ).toBe(true);
    expect(
      usesExpression(
        'We caught up last week',
        cafe.find((e) => e.en === 'catch up')!,
      ),
    ).toBe(true);
  });

  it('every curated pattern compiles and matches its own text', () => {
    const all = [
      ...Object.values(SCENE_EXPRESSIONS).flat(),
      ...MISSIONS.flatMap((m) => m.expressions),
    ];
    for (const e of all) {
      const sample = e.en.replace(/…|\?/g, ' something').replace(/^to /, '');
      expect(() => expressionPattern(e)).not.toThrow();
      if (!/someone|Tuesday/.test(e.en))
        expect(usesExpression(`Well, ${sample}`, e), e.en).toBe(true);
    }
  });

  it('finds forbidden words (and their plural) only as whole words', () => {
    expect(forbiddenFound('Can we get a table outside?', ['table'])).toEqual(['table']);
    expect(forbiddenFound('Two tables please', ['table'])).toEqual(['table']);
    expect(forbiddenFound('It was comfortable outside', ['table'])).toEqual([]);
    expect(forbiddenFound('It was a GOOD trip, very nice', ['good', 'nice'])).toEqual([
      'good',
      'nice',
    ]);
  });
});

const debrief = (over: Partial<Debrief> = {}): Debrief => ({
  summaryFr: '',
  strengthsFr: [],
  mistakes: [],
  vocabulary: [],
  nextFocusFr: '',
  model: 'm',
  ...over,
});
const mistake = (type: Debrief['mistakes'][number]['type'], said: string, correct: string) => ({
  turn: 1,
  type,
  said,
  correct,
  explanationFr: 'Règle.',
  recastByCharacter: false,
});

async function card(over: Partial<ReviewCard> & Pick<ReviewCard, 'id'>): Promise<ReviewCard> {
  return {
    kind: 'mistake',
    front: 'I go',
    back: 'I went',
    type: 'verb_tense',
    note: '',
    talkId: 'old',
    createdAt: NOW - 5 * DAY,
    fsrs: await newFsrs(NOW - 4 * DAY),
    history: [],
    ...over,
  };
}

describe('review cards', () => {
  it('turns a debrief into cards: one per right form, no pronunciation guesses', () => {
    const d = debrief({
      mistakes: [
        mistake('verb_tense', 'Yesterday I go', 'Yesterday I went'),
        mistake('verb_tense', 'yesterday i GO', 'Yesterday I went.'),
        mistake('pronunciation', 'tree', 'three'),
      ],
      vocabulary: [{ english: 'to be swamped', french: 'être débordé', example: "I'm swamped." }],
    });
    const drafts = draftsFromDebrief(d, 't1', 'jake', NOW);
    expect(drafts.map((c) => c.id)).toEqual([
      cardId('mistake', 'Yesterday I went'),
      cardId('word', 'to be swamped'),
    ]);
    expect(drafts[0]).toMatchObject({
      front: 'Yesterday I go',
      back: 'Yesterday I went',
      kind: 'mistake',
    });
    expect(drafts[1]).toMatchObject({
      front: 'être débordé',
      back: 'to be swamped',
      note: "I'm swamped.",
    });
  });

  it('FSRS (ts-fsrs 6): a new card is due when asked, good pushes it days away, again brings it back', async () => {
    const f = await newFsrs(NOW + FIRST_DELAY_MS);
    expect(f.dueAt).toBe(NOW + FIRST_DELAY_MS);
    expect(JSON.parse(JSON.stringify(f))).toEqual(f); // plain data for IndexedDB
    const good = await reviewFsrs(f, 'good', f.dueAt);
    expect(good.reps).toBe(1);
    expect(good.dueAt - f.dueAt).toBeGreaterThan(DAY);
    const good2 = await reviewFsrs(good, 'good', good.dueAt);
    expect(good2.dueAt - good.dueAt).toBeGreaterThan(good.dueAt - f.dueAt);
    const again = await reviewFsrs(good2, 'again', good2.dueAt);
    expect(again.lapses).toBe(1);
    expect(again.dueAt - good2.dueAt).toBeLessThanOrEqual(2 * DAY);
    // A failed new card comes back tomorrow, not within the same session.
    const failed = await reviewFsrs(f, 'again', NOW);
    expect(failed.dueAt).toBe(nextLocalDay(NOW));
    expect(dayKey(failed.dueAt)).toBe(dayKey(NOW + DAY));
    const easy = await reviewFsrs(f, 'easy', f.dueAt);
    expect(easy.dueAt).toBeGreaterThan(good.dueAt);
  });

  it('due cards: overdue first, removed cards never', async () => {
    const a = await card({ id: 'a', fsrs: await newFsrs(NOW - DAY) });
    const b = await card({ id: 'b', fsrs: await newFsrs(NOW - 3 * DAY) });
    const c = await card({ id: 'c', fsrs: await newFsrs(NOW + DAY) });
    const d = await card({ id: 'd', fsrs: await newFsrs(NOW - DAY), suspended: true });
    expect(dueCards([a, b, c, d], NOW).map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('grades from a talk: review results, expressions, repeated mistakes; once per talk', async () => {
    const went = await card({ id: cardId('mistake', 'I went') });
    const agree = await card({
      id: cardId('mistake', 'I agree'),
      front: 'I am agree',
      back: 'I agree',
    });
    const since = await card({ id: cardId('mistake', 'since Monday'), back: 'since Monday' });
    const swamped = await card({ id: cardId('word', 'to be swamped'), kind: 'word' });
    const fresh = await card({ id: cardId('mistake', 'the news is'), talkId: 'now' });
    const d = debrief({
      reviews: [
        { cardId: went.id, result: 'correct', quote: 'I went' },
        { cardId: agree.id, result: 'wrong', quote: 'I am agree' },
        { cardId: since.id, result: 'absent', quote: '' },
      ],
      expressions: [
        { en: 'to be swamped', used: true, natural: false, quote: '', cardId: swamped.id },
      ],
      mistakes: [
        mistake('verb_form', 'I am agree', 'I agree'),
        mistake('prepositions', 'from Monday', 'since Monday'),
        mistake('agreement', 'the news are', 'the news is'),
      ],
    });
    const cards = [went, agree, since, swamped, fresh];
    const u = updatesFromTalk(cards, 'now', d);
    expect(u).toEqual([
      { id: went.id, grade: 'good', via: 'talk' },
      { id: agree.id, grade: 'again', via: 'talk' },
      { id: swamped.id, grade: 'hard', via: 'talk' },
      // "since Monday" was absent as a review item but the same mistake came back.
      { id: since.id, grade: 'again', via: 'repeat' },
    ]);
    // Applying twice (debrief retried) changes nothing.
    went.history.push({ at: NOW, grade: 'good', via: 'talk', talkId: 'now' });
    expect(updatesFromTalk(cards, 'now', d).some((x) => x.id === went.id)).toBe(false);
  });
});

describe('daily challenge and missions', () => {
  it('builds the challenge from due cards, filled with the scene expressions', async () => {
    const cards = [
      ...(await Promise.all(
        [1, 2, 3, 4, 5].map((i) => card({ id: `m${i}`, front: `said ${i}`, back: `right ${i}` })),
      )),
      await card({ id: 'w1', kind: 'word', front: 'manger un morceau', back: 'grab a bite' }),
    ];
    const plan = buildChallenge(cards, 'cafe', NOW);
    expect(plan.mode).toBe('challenge');
    expect(plan.minutes).toBe(5);
    expect(plan.reviews).toHaveLength(4);
    expect(plan.expressions).toHaveLength(3);
    expect(plan.expressions[0]).toMatchObject({ en: 'grab a bite', cardId: 'w1' });
    // No duplicate of the card's expression from the scene list.
    expect(plan.expressions.filter((e) => e.en === 'grab a bite')).toHaveLength(1);
    const empty = buildChallenge([], 'office', NOW);
    expect(empty.reviews).toEqual([]);
    expect(empty.expressions).toHaveLength(3);
  });

  it('puts the plan in the character prompt', async () => {
    const c = await card({ id: 'm1', front: 'Yesterday I go', back: 'Yesterday I went' });
    const plan = buildChallenge([c], 'cafe', NOW);
    const text = planPrompt(plan, undefined);
    expect(text).toContain('daily challenge');
    expect(text).toContain('They said "Yesterday I go" instead of "Yesterday I went" (verb tense)');
    expect(text).toContain('Never say the right form before they try');
    expect(text).toContain('only time you comment on their English');
    const prompt = buildSystemPrompt(JAKE, undefined, 'cafe', text);
    expect(prompt).toContain('Review challenge');
    expect(prompt.indexOf('Review challenge')).toBeLessThan(prompt.indexOf('How you talk'));
    expect(planPrompt(FREE_PLAN, undefined)).toBe('');
  });

  it('mission prompts carry the role and the forbidden word, never the rule to the learner', () => {
    const m = missionById('cafe-terrace')!;
    const text = planPrompt(missionPlan(m), m);
    expect(text).toContain('must not say "table"');
    expect(text).toContain('never mention the rule');
    expect(text).toContain('Expressions to place');
    const prompt = buildSystemPrompt(JAKE, undefined, 'cafe', text, m.roleEn);
    expect(prompt).toContain('Scene: You are working as the host of the café today.');
    // The usual scene ("sitting at a table") would contradict the mission.
    expect(prompt).not.toContain('sitting at a table');
  });

  it('every scene has three missions, one per level', () => {
    for (const scene of ['cafe', 'office', 'street'] as const) {
      expect(
        MISSIONS.filter((m) => m.scene === scene)
          .map((m) => m.tier)
          .sort(),
      ).toEqual([1, 2, 3]);
    }
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
    for (const m of MISSIONS) expect(m.expressions.length).toBeGreaterThanOrEqual(3);
  });

  it('unlocks levels by passed missions or by the estimated level', () => {
    const none = unlockMap(new Map(), null);
    expect(none.filter((c) => c.unlocked).map((c) => c.mission.tier)).toEqual([1, 1, 1]);
    expect(none.find((c) => c.mission.tier === 2)!.lockFr).toContain(
      'Réussis 2 missions de niveau 1',
    );
    const two = new Map([
      ['cafe-order', { passed: true, bestScore: 80, tries: 1 }],
      ['street-way', { passed: true, bestScore: 70, tries: 2 }],
    ]);
    const m2 = unlockMap(two, null);
    expect(m2.filter((c) => c.unlocked)).toHaveLength(6);
    expect(unlockMap(new Map(), 50).filter((c) => c.unlocked)).toHaveLength(6);
    expect(unlockMap(new Map(), 65).every((c) => c.unlocked)).toBe(true);
  });

  it('mission records, challenge of the day, next review in French', async () => {
    const talk = (id: string, missionId: string, passed: boolean, score: number, ago = 1) =>
      ({
        id,
        startedAt: at(ago),
        plan: missionPlan(missionById(missionId)!),
        debrief: debrief({ mission: { passed, score, feedbackFr: '', forbiddenSaid: [] } }),
      }) as unknown as SavedTalk;
    const r = missionRecords([
      talk('a', 'cafe-order', false, 40),
      talk('b', 'cafe-order', true, 75),
    ]);
    expect(r.get('cafe-order')).toEqual({ passed: true, bestScore: 75, tries: 2 });
    const challenge = { id: 'c', startedAt: at(0, 9), plan: { mode: 'challenge' } } as SavedTalk;
    expect(challengeDoneToday([challenge], NOW)).toBe(true);
    expect(challengeDoneToday([{ ...challenge, startedAt: at(1) }], NOW)).toBe(false);
    expect(nextDueFr([], NOW)).toBe('aucune');
    expect(nextDueFr([await card({ id: 'x', fsrs: await newFsrs(NOW - DAY) })], NOW)).toBe(
      'maintenant',
    );
    expect(nextDueFr([await card({ id: 'x', fsrs: await newFsrs(NOW + DAY) })], NOW)).toBe(
      'demain',
    );
    expect(nextDueFr([await card({ id: 'x', fsrs: await newFsrs(NOW + 3 * DAY) })], NOW)).toBe(
      'dans 3 jours',
    );
  });
});

describe('debrief schema and parsing for plans (Analyzer)', () => {
  const challenge: TalkPlan = {
    mode: 'challenge',
    reviews: [{ cardId: 'mistake:i went', said: 'I go', correct: 'I went', type: 'verb_tense' }],
    expressions: [{ en: 'grab a bite', fr: 'manger un morceau' }],
    minutes: 5,
  };

  it('a free talk keeps the phase 3 schema', () => {
    expect(debriefSchema()).toBe(DEBRIEF_SCHEMA);
    expect(debriefSchema(FREE_PLAN)).toBe(DEBRIEF_SCHEMA);
  });

  it('adds mission, expressions and review results with exact enums', () => {
    const s = debriefSchema(challenge) as {
      properties: Record<string, { items?: { properties: Record<string, { enum?: string[] }> } }>;
      required: string[];
    };
    expect(s.required).toEqual(expect.arrayContaining(['expressions_used', 'review_results']));
    expect(s.required).not.toContain('mission');
    expect(s.properties.expressions_used.items!.properties.expression.enum).toEqual([
      'grab a bite',
    ]);
    expect(s.properties.review_results.items!.properties.item.enum).toEqual(['mistake:i went']);
    const m = debriefSchema(missionPlan(missionById('cafe-terrace')!)) as { required: string[] };
    expect(m.required).toContain('mission');
  });

  it('parses results; missing ones are "absent" / not used; forbidden words fail the mission', () => {
    const raw = JSON.stringify({
      summary_fr: 's',
      expressions_used: [
        { expression: 'GRAB A BITE', used: true, natural: true, quote: 'grab a bite' },
        { expression: 'unknown', used: true, natural: true, quote: '' },
      ],
      review_results: [],
    });
    const d = parseDebrief(raw, new Set([1]), 'm', challenge, 'I went to grab a bite');
    expect(d.expressions).toEqual([
      { en: 'grab a bite', used: true, natural: true, quote: 'grab a bite' },
    ]);
    expect(d.reviews).toEqual([{ cardId: 'mistake:i went', result: 'absent', quote: '' }]);
    // Found in the learner's text but missed by the model: used, not judged natural.
    const missed = parseDebrief(
      '{"expressions_used":[]}',
      new Set(),
      'm',
      challenge,
      'Shall we grab a bite?',
    );
    expect(missed.expressions![0]).toMatchObject({ used: true, natural: false });
    const terrace = missionPlan(missionById('cafe-terrace')!);
    const mission = (text: string) =>
      parseDebrief(
        JSON.stringify({ mission: { passed: true, score: 90, feedback_fr: 'Bravo.' } }),
        new Set(),
        'm',
        terrace,
        text,
      ).mission;
    expect(mission('Could we sit outside, three of us?')).toEqual({
      passed: true,
      score: 90,
      feedbackFr: 'Bravo.',
      forbiddenSaid: [],
    });
    expect(mission('Can I get a table outside?')).toMatchObject({
      passed: false,
      score: 40,
      forbiddenSaid: ['table'],
    });
  });

  it('tells the analyzer how to judge the plan', () => {
    const text = debriefSystemPrompt({
      level: 'B1',
      characterName: 'Jake',
      transcriptSource: 'Gemini Live',
      plan: { ...challenge, missionId: 'cafe-terrace', mode: 'mission' },
    });
    expect(text).toContain('not allowed to say "table"');
    expect(text).toContain('"expressions_used"');
    expect(text).toContain('item mistake:i went');
    expect(
      debriefSystemPrompt({ level: 'B1', characterName: 'Jake', transcriptSource: 'x' }),
    ).not.toContain('expressions_used');
  });
});
