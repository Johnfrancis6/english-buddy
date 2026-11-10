import type { SkillScores } from '../analysis/types';
import { memoryForPrompt, type Fact } from '../memory/facts';
import type { SavedTalk } from '../storage/talks';
import { DEFAULT_LEARNER, type CharacterId, type LearnerProfile } from '../teaching/persona';
import { estimateLevel } from './level';
import { frequentMistakes } from './stats';

/**
 * The learner profile given to a character before a talk: estimated level
 * (B1 until a debrief has scores), most frequent recent mistakes, and what
 * this character remembers.
 */
export function buildLearnerProfile(
  talks: readonly SavedTalk[],
  facts: readonly Fact[],
  character: CharacterId,
  now: number,
): LearnerProfile {
  const recent = [...talks]
    .sort((a, b) => b.startedAt - a.startedAt)
    .map((t) => t.debrief?.skills)
    .filter((k): k is SkillScores => Boolean(k));
  const level = estimateLevel(recent);
  return {
    ...DEFAULT_LEARNER,
    level: level?.band ?? DEFAULT_LEARNER.level,
    levelMeasured: level !== null,
    recentMistakes: frequentMistakes(talks, now).map((m) => ({
      type: m.type,
      said: m.said,
      correct: m.correct,
      count: m.count,
    })),
    memory: memoryForPrompt(facts, character, now),
  };
}
