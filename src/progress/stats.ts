import { MISTAKE_TYPES, type MistakeType, type SkillScores } from '../analysis/types';
import type { SavedTalk } from '../storage/talks';
import { estimateLevel, type LevelEstimate } from './level';

/**
 * Progress figures computed in the browser from the saved talks (text only).
 * Pure functions with an injected "now", so they are unit-tested.
 *
 * Measured from the text: words, sentences, new words, mistakes. Speaking
 * time is measured by the microphone's voice detection from phase 3 on;
 * older talks get an estimate from their word count.
 */

/** Average speaking rate used to estimate old talks (words per second). */
export const WORDS_PER_SECOND = 2;
const DAY = 86_400_000;

/** Very common words that say nothing about vocabulary growth. */
const COMMON = new Set(
  `the and you that was for are with his they this have from one had word but not what all were when your can said there use each which she how their will other about out many then them these some her would make like him into time has look two more write see number way could people than first been call who its now find long down day did get come made may part yes yeah okay ok hey hello well just really very know think going want got because also too here where why some any much our yourself myself`.split(
    /\s+/,
  ),
);

export function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? []).filter(Boolean);
}

/** Words that can count as "new vocabulary": 3+ letters, not in the common list. */
export function vocabWords(text: string): string[] {
  return words(text).filter((w) => w.length >= 3 && !w.includes("'") && !COMMON.has(w));
}

/** Sentences of the learner's text (punctuation from the recogniser; a turn is at least one). */
export function sentences(text: string): string[] {
  return text
    .split(/[.!?…]+/)
    .map((s) => s.trim())
    .filter((s) => words(s).length > 0);
}

export interface TalkStats {
  id: string;
  startedAt: number;
  character: string;
  learnerTurns: number;
  learnerWords: number;
  sentences: number;
  speakingMs: number;
  /** speakingMs comes from the word count, not from the microphone. */
  speakingEstimated: boolean;
  mistakes: Partial<Record<MistakeType, number>>;
  skills: SkillScores | null;
}

export function talkStats(t: SavedTalk): TalkStats {
  const mine = t.turns.filter((x) => x.who === 'you').map((x) => x.text);
  const learnerWords = t.cloudCounts?.words ?? mine.reduce((n, s) => n + words(s).length, 0);
  const mistakes: Partial<Record<MistakeType, number>> = {};
  for (const m of t.debrief?.mistakes ?? []) mistakes[m.type] = (mistakes[m.type] ?? 0) + 1;
  const measured = typeof t.speakingMs === 'number';
  return {
    id: t.id,
    startedAt: t.startedAt,
    character: t.character ?? 'jake',
    learnerTurns: mine.length,
    learnerWords,
    sentences: t.cloudCounts?.sentences ?? mine.reduce((n, s) => n + sentences(s).length, 0),
    speakingMs: measured ? (t.speakingMs as number) : (learnerWords / WORDS_PER_SECOND) * 1000,
    speakingEstimated: !measured,
    mistakes,
    skills: t.debrief?.skills ?? null,
  };
}

/** Monday 00:00 (local time) of the week of `ts`. */
export function weekStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export interface WeekStats {
  start: number;
  talks: number;
  speakingMs: number;
  speakingEstimated: boolean;
  learnerWords: number;
  /** Words per sentence, null without sentences. */
  avgSentence: number | null;
  newWords: number;
  /** Examples of the week's new words (at most 8). */
  newWordSamples: string[];
  mistakes: Partial<Record<MistakeType, number>>;
  mistakeTotal: number;
}

export interface Progress {
  weeks: WeekStats[];
  level: LevelEstimate | null;
  /** Overall score per talk with scores, oldest first, for the trend. */
  levelHistory: { at: number; overall: number }[];
  totalTalks: number;
  totalSpeakingMs: number;
  /** Mistake types seen in the shown weeks, most frequent first. */
  mistakeTypes: MistakeType[];
}

/**
 * Week-by-week figures for the last `weeks` weeks (oldest first). New words
 * are counted over the whole history: a word is new the first time the
 * learner says it, whatever the week.
 */
export function buildProgress(talks: readonly SavedTalk[], now: number, weeks = 8): Progress {
  const ordered = [...talks].sort((a, b) => a.startedAt - b.startedAt);
  const thisWeek = weekStart(now);
  const starts: number[] = [];
  for (let i = weeks - 1; i >= 0; i--) starts.push(weekStart(thisWeek - i * 7 * DAY + DAY));
  const byStart = new Map<number, WeekStats>(
    starts.map((s) => [
      s,
      {
        start: s,
        talks: 0,
        speakingMs: 0,
        speakingEstimated: false,
        learnerWords: 0,
        avgSentence: null,
        newWords: 0,
        newWordSamples: [],
        mistakes: {},
        mistakeTotal: 0,
      },
    ]),
  );
  const sentenceCount = new Map<number, number>();
  const seen = new Set<string>();
  const typeTotals = new Map<MistakeType, number>();
  let totalSpeakingMs = 0;
  const levelHistory: Progress['levelHistory'] = [];
  for (const t of ordered) {
    const s = talkStats(t);
    totalSpeakingMs += s.speakingMs;
    if (s.skills) {
      const k = s.skills;
      levelHistory.push({
        at: t.startedAt,
        overall: Math.round((k.fluency + k.grammar + k.vocabulary + k.listening) / 4),
      });
    }
    const fresh: string[] = [];
    for (const turn of t.turns) {
      if (turn.who !== 'you') continue;
      for (const w of vocabWords(turn.text)) {
        if (seen.has(w)) continue;
        seen.add(w);
        fresh.push(w);
      }
    }
    const week = byStart.get(weekStart(t.startedAt));
    if (!week) continue;
    week.talks++;
    week.speakingMs += s.speakingMs;
    week.speakingEstimated ||= s.speakingEstimated;
    week.learnerWords += s.learnerWords;
    sentenceCount.set(week.start, (sentenceCount.get(week.start) ?? 0) + s.sentences);
    week.newWords += fresh.length;
    for (const w of fresh) if (week.newWordSamples.length < 8) week.newWordSamples.push(w);
    for (const [type, n] of Object.entries(s.mistakes) as [MistakeType, number][]) {
      week.mistakes[type] = (week.mistakes[type] ?? 0) + n;
      week.mistakeTotal += n;
      typeTotals.set(type, (typeTotals.get(type) ?? 0) + n);
    }
  }
  for (const w of byStart.values()) {
    const n = sentenceCount.get(w.start) ?? 0;
    w.avgSentence = n ? Math.round((w.learnerWords / n) * 10) / 10 : null;
  }
  const recentSkills = [...ordered]
    .reverse()
    .map((t) => t.debrief?.skills)
    .filter((k): k is SkillScores => Boolean(k));
  return {
    weeks: starts.map((s) => byStart.get(s)!),
    level: estimateLevel(recentSkills),
    levelHistory,
    totalTalks: talks.length,
    totalSpeakingMs,
    mistakeTypes: [...typeTotals.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t),
  };
}

export interface FrequentMistake {
  type: MistakeType;
  labelFr: string;
  count: number;
  /** The latest example. */
  said: string;
  correct: string;
}

/**
 * The learner's most frequent mistake types lately (talks of the last 30
 * days, at most the last 10), with the latest example of each.
 */
export function frequentMistakes(
  talks: readonly SavedTalk[],
  now: number,
  top = 3,
): FrequentMistake[] {
  const recent = [...talks]
    .filter((t) => now - t.startedAt <= 30 * DAY && t.debrief)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 10);
  const found = new Map<MistakeType, FrequentMistake>();
  for (const t of recent) {
    for (const m of t.debrief!.mistakes) {
      if (m.type === 'other' || m.type === 'pronunciation') continue;
      const f = found.get(m.type);
      if (f) f.count++;
      else {
        found.set(m.type, {
          type: m.type,
          labelFr: MISTAKE_TYPES[m.type],
          count: 1,
          said: m.said,
          correct: m.correct,
        });
      }
    }
  }
  return [...found.values()].sort((a, b) => b.count - a.count).slice(0, top);
}
