import type { Debrief, SkillScores } from '../analysis/types';
import type { Fact } from '../memory/facts';
import { sentences, words } from '../progress/stats';
import type { SavedTalk } from '../storage/talks';
import type { CloudData } from './types';

/**
 * Rows of the Supabase tables (supabase/schema.sql) and the merge rules.
 * Pure functions, unit-tested without a server.
 */
export interface FactRow {
  id: string;
  user_id: string;
  category: string;
  text: string;
  character: string | null;
  by_learner: boolean;
  talk_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TalkRow {
  id: string;
  user_id: string;
  started_at: string;
  duration_ms: number;
  character: string;
  scene: string;
  speaking_ms: number | null;
  learner_words: number;
  learner_sentences: number;
  /** Debrief without the summary texts: mistakes, words, scores, model. */
  debrief: Pick<Debrief, 'mistakes' | 'vocabulary' | 'model' | 'nextFocusFr'> & {
    skills: SkillScores | null;
  };
  updated_at: string;
}

const iso = (ms: number) => new Date(ms).toISOString();
const ms = (s: string) => new Date(s).getTime();

export function factToRow(f: Fact, userId: string): FactRow {
  return {
    id: f.id,
    user_id: userId,
    category: f.category,
    text: f.text,
    character: f.character ?? null,
    by_learner: f.byLearner,
    talk_id: f.talkId ?? null,
    created_at: iso(f.createdAt),
    updated_at: iso(f.updatedAt),
  };
}

export function rowToFact(r: FactRow): Fact {
  return {
    id: r.id,
    category: r.category as Fact['category'],
    text: r.text,
    ...(r.character ? { character: r.character as Fact['character'] } : {}),
    byLearner: r.by_learner,
    ...(r.talk_id ? { talkId: r.talk_id } : {}),
    createdAt: ms(r.created_at),
    updatedAt: ms(r.updated_at),
  };
}

/** Only talks with a debrief go online, without their transcript. */
export function talkToRow(t: SavedTalk, userId: string): TalkRow | null {
  if (!t.debrief) return null;
  const mine = t.turns.filter((x) => x.who === 'you').map((x) => x.text);
  return {
    id: t.id,
    user_id: userId,
    started_at: iso(t.startedAt),
    duration_ms: Math.round(t.durationMs),
    character: t.character ?? 'jake',
    scene: t.scene ?? 'cafe',
    speaking_ms: t.speakingMs ?? null,
    learner_words: t.cloudCounts?.words ?? mine.reduce((n, s) => n + words(s).length, 0),
    learner_sentences:
      t.cloudCounts?.sentences ?? mine.reduce((n, s) => n + sentences(s).length, 0),
    debrief: {
      mistakes: t.debrief.mistakes,
      vocabulary: t.debrief.vocabulary,
      model: t.debrief.model,
      nextFocusFr: t.debrief.nextFocusFr,
      skills: t.debrief.skills ?? null,
    },
    updated_at: iso(t.startedAt + t.durationMs),
  };
}

/** A talk from another computer: no transcript, only its figures. */
export function rowToTalk(r: TalkRow): SavedTalk {
  return {
    id: r.id,
    startedAt: ms(r.started_at),
    durationMs: r.duration_ms,
    label: 'synchronisée depuis ton compte',
    character: r.character,
    scene: r.scene,
    turns: [],
    debrief: {
      summaryFr: '',
      strengthsFr: [],
      mistakes: r.debrief.mistakes ?? [],
      vocabulary: r.debrief.vocabulary ?? [],
      nextFocusFr: r.debrief.nextFocusFr ?? '',
      model: r.debrief.model ?? '',
      skills: r.debrief.skills ?? null,
    },
    why: {},
    ...(r.speaking_ms !== null ? { speakingMs: r.speaking_ms } : {}),
    cloudCounts: { words: r.learner_words, sentences: r.learner_sentences },
  };
}

/**
 * Local + online → what this browser keeps. Facts: newest `updatedAt` wins,
 * facts erased here stay erased. Talks: the local copy wins (it has the
 * transcript); online-only talks are added.
 */
export function mergeCloud(
  local: CloudData,
  remote: CloudData,
  deletedFactIds: readonly string[],
): CloudData {
  const deleted = new Set(deletedFactIds);
  const facts = new Map(local.facts.map((f) => [f.id, f]));
  for (const f of remote.facts) {
    if (deleted.has(f.id)) continue;
    const mine = facts.get(f.id);
    if (!mine || f.updatedAt > mine.updatedAt) facts.set(f.id, f);
  }
  const talks = new Map(local.talks.map((t) => [t.id, t]));
  for (const t of remote.talks) if (!talks.has(t.id)) talks.set(t.id, t);
  return {
    facts: [...facts.values()].sort((a, b) => b.updatedAt - a.updatedAt),
    talks: [...talks.values()].sort((a, b) => b.startedAt - a.startedAt),
  };
}
