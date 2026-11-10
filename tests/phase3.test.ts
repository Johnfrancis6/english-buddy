import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { factToRow, mergeCloud, rowToFact, rowToTalk, talkToRow } from '../src/sync/rows';
import { SupabaseSync } from '../src/sync/supabaseSync';
import {
  deletedFacts,
  isProjectUrl,
  makeCloud,
  rememberDeleted,
  saveCloudConfig,
  syncOnce,
} from '../src/sync/config';
import {
  factsForAnalyzer,
  MAX_FACTS,
  memoryForPrompt,
  mergeFacts,
  type Fact,
} from '../src/memory/facts';
import { DEBRIEF_SCHEMA, parseDebrief } from '../src/analysis/schema';
import { debriefSystemPrompt } from '../src/analysis/prompts';
import { bandOf, estimateLevel } from '../src/progress/level';
import {
  buildProgress,
  frequentMistakes,
  sentences,
  talkStats,
  vocabWords,
  weekStart,
} from '../src/progress/stats';
import { buildLearnerProfile } from '../src/progress/profile';
import { buildSystemPrompt, CHARACTERS, DEFAULT_LEARNER } from '../src/teaching/persona';
import type { SavedTalk } from '../src/storage/talks';
import type { Debrief, Mistake, SkillScores } from '../src/analysis/types';

const DAY = 86_400_000;
const NOW = new Date('2026-11-10T12:00:00').getTime();

const fact = (id: string, text: string, extra: Partial<Fact> = {}): Fact => ({
  id,
  category: 'job',
  text,
  createdAt: NOW - DAY,
  updatedAt: NOW - DAY,
  byLearner: false,
  ...extra,
});

const mistake = (type: Mistake['type'], said: string, correct: string): Mistake => ({
  turn: 1,
  type,
  said,
  correct,
  explanationFr: '',
  recastByCharacter: false,
});

function talk(
  id: string,
  at: number,
  learner: string[],
  debrief: Partial<Debrief> | null = {},
  extra: Partial<SavedTalk> = {},
): SavedTalk {
  return {
    id,
    startedAt: at,
    durationMs: 60_000,
    label: '',
    character: 'jake',
    scene: 'cafe',
    turns: learner.map((text, i) => ({
      id: i + 1,
      who: 'you' as const,
      text,
      liveText: text,
      source: 'live' as const,
      interrupted: false,
    })),
    debrief: debrief && {
      summaryFr: '',
      strengthsFr: [],
      mistakes: [],
      vocabulary: [],
      nextFocusFr: '',
      model: 'm',
      ...debrief,
    },
    why: {},
    ...extra,
  };
}

const skills = (n: number): SkillScores => ({
  fluency: n,
  grammar: n,
  vocabulary: n,
  listening: n,
});

describe('character memory', () => {
  it('adds new facts, ignores duplicates, updates a replaced fact in place', () => {
    const facts = [fact('a', 'Travaille comme développeur.')];
    const out = mergeFacts(
      facts,
      [
        { category: 'job', text: 'travaille comme développeur', replaces: '' },
        { category: 'job', text: 'Travaille comme ingénieur de données.', replaces: 'a' },
        { category: 'plans', text: 'Part à Londres en mars.', replaces: '' },
      ],
      { now: NOW, talkId: 't1' },
    );
    expect(out).toHaveLength(2);
    expect(out.find((f) => f.id === 'a')?.text).toBe('Travaille comme ingénieur de données.');
    expect(out.find((f) => f.category === 'plans')?.talkId).toBe('t1');
  });

  it('never overwrites what the learner corrected: the new fact goes next to it', () => {
    const facts = [fact('a', 'Vit à Lyon.', { byLearner: true, category: 'life' })];
    const out = mergeFacts(facts, [{ category: 'life', text: 'Vit à Paris.', replaces: 'a' }], {
      now: NOW,
    });
    expect(out.map((f) => f.text)).toEqual(['Vit à Lyon.', 'Vit à Paris.']);
  });

  it('keeps one last-talk summary per character', () => {
    let out = mergeFacts([], [], { now: NOW, character: 'jake', lastTalk: 'Week-end au ski.' });
    out = mergeFacts(out, [], { now: NOW + 1, character: 'emma', lastTalk: 'Réunion lundi.' });
    out = mergeFacts(out, [], { now: NOW + 2, character: 'jake', lastTalk: 'Nouveau vélo.' });
    const last = out.filter((f) => f.category === 'last_talk');
    expect(last).toHaveLength(2);
    expect(last.find((f) => f.character === 'jake')?.text).toBe('Nouveau vélo.');
  });

  it('drops the oldest analyzer facts beyond the limit, learner facts last', () => {
    const many = Array.from({ length: MAX_FACTS }, (_, i) =>
      fact(`f${i}`, `Fait numéro ${i}.`, { updatedAt: NOW - (MAX_FACTS - i) * 1000 }),
    );
    many[0].byLearner = true; // the oldest, but the learner wrote it
    const out = mergeFacts(many, [{ category: 'likes', text: 'Aime le jazz.', replaces: '' }], {
      now: NOW,
    });
    expect(out).toHaveLength(MAX_FACTS);
    expect(out.some((f) => f.id === 'f0')).toBe(true);
    expect(out.some((f) => f.id === 'f1')).toBe(false);
  });

  it('gives the character the facts and its own last talk, with the rules to use them', () => {
    const facts = [
      fact('a', 'Travaille comme ingénieur.'),
      fact('b', 'Entretien vendredi.', { category: 'last_talk', character: 'emma' }),
      fact('c', 'Week-end au ski.', {
        category: 'last_talk',
        character: 'jake',
        updatedAt: NOW - 2 * DAY,
      }),
    ];
    const block = memoryForPrompt(facts, 'jake', NOW);
    expect(block).toContain('Travaille comme ingénieur.');
    expect(block).toContain('Your last talk with them (2 days ago): Week-end au ski.');
    expect(block).not.toContain('Entretien vendredi');
    expect(block).toMatch(/Never recite the list/);
    expect(memoryForPrompt([], 'jake', NOW)).toBe('');
  });

  it('lists known facts with their ids for the analyzer (not the last talks)', () => {
    const text = factsForAnalyzer([
      fact('a', 'Travaille comme ingénieur.'),
      fact('b', 'Ski.', { category: 'last_talk', character: 'jake' }),
    ]);
    expect(text).toBe('[a] (job) Travaille comme ingénieur.');
    expect(factsForAnalyzer([])).toBe('(nothing yet)');
  });
});

describe('debrief schema, phase 3', () => {
  it('asks for skill scores, memory facts and the talk summary', () => {
    const p = DEBRIEF_SCHEMA.properties;
    expect(DEBRIEF_SCHEMA.required).toEqual(
      expect.arrayContaining(['skill_scores', 'memory_facts', 'talk_memory_fr']),
    );
    expect(p.skill_scores.properties.grammar).toMatchObject({ minimum: 0, maximum: 100 });
    expect(p.memory_facts.items.properties.category.enum).toContain('family');
  });

  it('parses scores (clamped), facts and the summary; tolerates their absence', () => {
    const d = parseDebrief(
      JSON.stringify({
        summary_fr: 's',
        strengths_fr: [],
        mistakes: [],
        vocabulary: [],
        next_focus_fr: '',
        skill_scores: { fluency: 55.4, grammar: 140, vocabulary: -3, listening: 70 },
        memory_facts: [
          { category: 'family', fact_fr: 'A deux filles.', replaces: '' },
          { category: 'weird', fact_fr: 'Court le dimanche.', replaces: 'x' },
          { category: 'job', fact_fr: '  ', replaces: '' },
        ],
        talk_memory_fr: 'On a parlé de ses filles.',
      }),
      new Set([1]),
      'm',
    );
    expect(d.skills).toEqual({ fluency: 55, grammar: 100, vocabulary: 0, listening: 70 });
    expect(d.memory).toEqual([
      { category: 'family', text: 'A deux filles.', replaces: '' },
      { category: 'life', text: 'Court le dimanche.', replaces: 'x' },
    ]);
    expect(d.talkMemoryFr).toBe('On a parlé de ses filles.');
    const old = parseDebrief('{"summary_fr":"s"}', new Set(), 'm');
    expect(old.skills).toBeNull();
    expect(old.memory).toEqual([]);
  });

  it('gives the analyzer the scale, the known facts and the memory rules', () => {
    const prompt = debriefSystemPrompt({
      level: 'B2',
      characterName: 'Emma',
      transcriptSource: 'Gemini Live',
      knownFacts: '[a] (job) Travaille comme ingénieur.',
    });
    expect(prompt).toContain('level about B2');
    expect(prompt).toContain('40-59: B1');
    expect(prompt).toContain('[a] (job) Travaille comme ingénieur.');
    expect(prompt).toContain('"replaces"');
    expect(prompt).toMatch(/nothing sensitive/);
  });
});

describe('level estimate', () => {
  it('maps scores to bands', () => {
    expect([10, 40, 59, 60, 80, 100].map(bandOf)).toEqual(['A2', 'B1', 'B1', 'B2', 'C1', 'C1']);
  });
  it('averages the last five talks', () => {
    const e = estimateLevel([
      skills(70),
      skills(70),
      skills(60),
      skills(60),
      skills(65),
      skills(0),
    ]);
    expect(e?.overall).toBe(65);
    expect(e?.band).toBe('B2');
    expect(e?.talks).toBe(5);
    expect(estimateLevel([])).toBeNull();
  });
});

describe('progress figures', () => {
  it('counts words, sentences and vocabulary words', () => {
    expect(sentences('I went home. Then I slept! ok')).toHaveLength(3);
    expect(vocabWords("The colleague's meeting was awesome and I'm tired")).toEqual([
      'meeting',
      'awesome',
      'tired',
    ]);
  });

  it('uses the measured speaking time, or estimates it from words', () => {
    expect(
      talkStats(talk('a', NOW, ['one two three four'], null, { speakingMs: 9000 })),
    ).toMatchObject({ speakingMs: 9000, speakingEstimated: false, learnerWords: 4 });
    expect(talkStats(talk('b', NOW, ['one two three four'], null))).toMatchObject({
      speakingMs: 2000,
      speakingEstimated: true,
    });
  });

  it('weeks start on Monday', () => {
    const tue = new Date('2026-11-10T09:00:00').getTime();
    expect(new Date(weekStart(tue)).getDay()).toBe(1);
    expect(new Date(weekStart(tue)).getDate()).toBe(9);
  });

  it('builds week-by-week mistakes, speaking time, new words and sentence length', () => {
    const talks = [
      talk(
        'w1',
        NOW - 8 * DAY,
        ['Yesterday I go to the cinema with my colleague.'],
        { mistakes: [mistake('verb_tense', 'I go', 'I went')], skills: skills(50) },
        { speakingMs: 60_000 },
      ),
      talk(
        'w2',
        NOW - DAY,
        ['I went to the cinema. The movie was fantastic.'],
        {
          mistakes: [
            mistake('articles', 'the life', 'life'),
            mistake('articles', 'a advice', 'advice'),
          ],
          skills: skills(62),
        },
        { speakingMs: 120_000 },
      ),
    ];
    const p = buildProgress(talks, NOW, 4);
    expect(p.weeks).toHaveLength(4);
    const [last, prev] = [p.weeks[3], p.weeks[2]];
    expect(prev.mistakes).toEqual({ verb_tense: 1 });
    expect(last.mistakes).toEqual({ articles: 2 });
    expect(last.speakingMs).toBe(120_000);
    // "cinema" was already said the week before: not new again.
    expect(last.newWordSamples).toEqual(['went', 'movie', 'fantastic']);
    expect(last.avgSentence).toBe(4.5);
    expect(p.mistakeTypes).toEqual(['articles', 'verb_tense']);
    expect(p.level?.overall).toBe(56);
    expect(p.levelHistory.map((x) => x.overall)).toEqual([50, 62]);
    expect(p.totalSpeakingMs).toBe(180_000);
  });

  it('finds the most frequent recent mistakes (last 30 days), latest example first', () => {
    const talks = [
      talk('old', NOW - 40 * DAY, [], { mistakes: [mistake('register', 'x', 'y')] }),
      talk('a', NOW - 3 * DAY, [], {
        mistakes: [mistake('verb_tense', 'I go', 'I went'), mistake('articles', 'the', '')],
      }),
      talk('b', NOW - DAY, [], {
        mistakes: [mistake('verb_tense', 'he come', 'he came'), mistake('other', 'a', 'b')],
      }),
    ];
    const top = frequentMistakes(talks, NOW);
    expect(top.map((m) => [m.type, m.count, m.said])).toEqual([
      ['verb_tense', 2, 'he come'],
      ['articles', 1, 'the'],
    ]);
  });
});

describe('learner profile in the prompt', () => {
  it('replaces the fixed B1 with the estimate, frequent mistakes and memory', () => {
    const talks = [
      talk('a', NOW - DAY, ['hi'], {
        mistakes: [mistake('verb_tense', 'I go', 'I went')],
        skills: skills(66),
      }),
    ];
    const facts = [fact('f', 'Travaille comme infirmier.')];
    const profile = buildLearnerProfile(talks, facts, 'jake', NOW);
    expect(profile.level).toBe('B2');
    expect(profile.levelMeasured).toBe(true);
    const prompt = buildSystemPrompt(CHARACTERS.jake, profile, 'cafe');
    expect(prompt).toContain('at about B2 level (estimated from their recent talks)');
    expect(prompt).toContain('verb tenses, e.g. "I go" instead of "I went"');
    expect(prompt).toContain('Travaille comme infirmier.');
    expect(prompt).toContain('Speak at a natural but clear pace.');
  });

  it('without history: B1 first estimate, no mistakes or memory blocks', () => {
    const profile = buildLearnerProfile([], [], 'emma', NOW);
    expect(profile.level).toBe('B1');
    const prompt = buildSystemPrompt(CHARACTERS.emma, profile, 'office');
    expect(prompt).toContain('B1 level (a first estimate)');
    expect(prompt).not.toContain('most frequent mistakes');
    expect(prompt).not.toContain('What you remember');
    // The default profile (phase 1–2 callers) still works.
    expect(buildSystemPrompt(CHARACTERS.jake, DEFAULT_LEARNER, 'cafe')).toContain('B1');
  });
});

describe('optional account (Supabase), no server', () => {
  const memStore = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
  };

  it('is off until a project URL and key are given', () => {
    const store = memStore();
    expect(makeCloud('https://x/', store).configured).toBe(false);
    saveCloudConfig({ url: 'https://abc.supabase.co', key: 'sb_publishable_x' }, store);
    expect(makeCloud('https://x/', store).configured).toBe(true);
    expect(isProjectUrl('https://abc.supabase.co')).toBe(true);
    expect(isProjectUrl('https://evil.example.com')).toBe(false);
  });

  it('sends no transcript online and reads talks back without one', () => {
    const t = talk(
      'a',
      NOW,
      ['I go to the cinema. It was great.'],
      {
        summaryFr: 'privé',
        mistakes: [mistake('verb_tense', 'I go', 'I went')],
        skills: skills(50),
      },
      { speakingMs: 5000 },
    );
    const row = talkToRow(t, 'u1')!;
    expect(JSON.stringify(row)).not.toContain('cinema');
    expect(JSON.stringify(row)).not.toContain('privé');
    expect(row).toMatchObject({ user_id: 'u1', learner_words: 8, learner_sentences: 2 });
    expect(talkToRow(talk('b', NOW, ['x'], null), 'u1')).toBeNull();
    const back = rowToTalk(row);
    expect(back.turns).toEqual([]);
    expect(talkStats(back)).toMatchObject({ learnerWords: 8, sentences: 2, speakingMs: 5000 });
    const f = fact('f1', 'Aime le jazz.', { character: 'jake', category: 'last_talk' });
    expect(rowToFact(factToRow(f, 'u1'))).toEqual(f);
  });

  it('merges: newest fact wins, erased facts stay erased, local talks win', () => {
    const local = {
      facts: [fact('a', 'Vieux.', { updatedAt: 1 }), fact('b', 'Gardé.', { updatedAt: 5 })],
      talks: [talk('t1', NOW, ['local'])],
    };
    const remote = {
      facts: [
        fact('a', 'Récent.', { updatedAt: 9 }),
        fact('b', 'Plus vieux.', { updatedAt: 2 }),
        fact('c', 'Effacé ici.', { updatedAt: 9 }),
      ],
      talks: [talk('t1', NOW, []), talk('t2', NOW - DAY, [])],
    };
    const m = mergeCloud(local, remote, ['c']);
    expect(m.facts.map((f) => f.text).sort()).toEqual(['Gardé.', 'Récent.']);
    expect(m.talks.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(m.talks[0].turns).toHaveLength(1);
  });

  it('talks to Supabase with the documented calls, and deletes what was erased', async () => {
    const calls: string[] = [];
    const fake = {
      auth: {
        getSession: async () => ({
          data: { session: { user: { id: 'u1', email: 'a@b.c' } } },
          error: null,
        }),
        signInWithOtp: async (a: { email: string; options?: { emailRedirectTo?: string } }) => {
          calls.push(`otp ${a.email} ${a.options?.emailRedirectTo}`);
          return { error: null };
        },
        signOut: async () => ({ error: null }),
      },
      from: (table: string) => ({
        select: async () => {
          calls.push(`select ${table}`);
          return {
            data: table === 'learner_facts' ? [factToRow(fact('r', 'En ligne.'), 'u1')] : [],
            error: null,
          };
        },
        upsert: async (rows: object[]) => {
          calls.push(`upsert ${table} ${rows.length}`);
          return { error: null };
        },
        delete: () => ({
          in: async (_c: string, ids: readonly string[]) => {
            calls.push(`delete ${table} ${ids.join(',')}`);
            return { error: null };
          },
        }),
      }),
    };
    const cloud = new SupabaseSync(
      'https://abc.supabase.co',
      'k',
      'https://site/',
      async () => fake,
    );
    await cloud.sendMagicLink(' a@b.c ');
    const store = memStore();
    rememberDeleted(['gone'], store);
    const merged = await syncOnce(
      cloud,
      { facts: [fact('l', 'Local.')], talks: [talk('t', NOW, ['hi'], {})] },
      store,
    );
    expect(merged.facts.map((f) => f.id).sort()).toEqual(['l', 'r']);
    expect(calls).toEqual([
      'otp a@b.c https://site/',
      'select learner_facts',
      'select talk_summaries',
      'upsert learner_facts 2',
      'delete learner_facts gone',
      'upsert talk_summaries 1',
    ]);
    expect(deletedFacts(store)).toEqual([]);
  });

  it('the SQL file turns on Row Level Security with an owner policy for every operation', () => {
    const sql = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
    for (const table of ['learner_facts', 'talk_summaries']) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      for (const op of ['select', 'insert', 'update', 'delete']) {
        expect(sql).toMatch(new RegExp(`on public\\.${table} for ${op} to authenticated`));
      }
    }
    expect(sql).toContain('(select auth.uid()) = user_id');
    const code = sql
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n');
    expect(code).not.toMatch(/transcript|turns/i);
  });
});
