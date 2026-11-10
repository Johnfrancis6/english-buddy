import type { SkillScores } from '../analysis/types';

/**
 * The 0–100 skill scale and its CEFR bands. The analyzer is given the same
 * anchors, so a score means the same thing in the debrief and on the
 * dashboard. It is an estimate from one transcript, never an exam result.
 */
export type Band = 'A2' | 'B1' | 'B2' | 'C1';
export const BANDS: readonly { band: Band; from: number }[] = [
  { band: 'A2', from: 0 },
  { band: 'B1', from: 40 },
  { band: 'B2', from: 60 },
  { band: 'C1', from: 80 },
];

export const SCALE_TEXT =
  '0-39: below B1 (A2 or lower); 40-59: B1; 60-79: B2; 80-100: C1 or above. Inside a band, a higher number means closer to the next band.';

export function bandOf(score: number): Band {
  let out: Band = 'A2';
  for (const b of BANDS) if (score >= b.from) out = b.band;
  return out;
}

/** How many talks with scores the estimate averages. */
export const LEVEL_WINDOW = 5;

export interface LevelEstimate {
  /** Mean of each skill over the last talks. */
  skills: SkillScores;
  overall: number;
  band: Band;
  /** Number of talks it is based on (≤ LEVEL_WINDOW). */
  talks: number;
}

/**
 * Averages the most recent skill scores (newest first in `recent`). Null
 * when no talk has scores yet: the prompt then keeps B1, the brief's
 * starting estimate.
 */
export function estimateLevel(recent: readonly SkillScores[]): LevelEstimate | null {
  const used = recent.slice(0, LEVEL_WINDOW);
  if (!used.length) return null;
  const mean = (k: keyof SkillScores) =>
    Math.round(used.reduce((sum, s) => sum + s[k], 0) / used.length);
  const skills: SkillScores = {
    fluency: mean('fluency'),
    grammar: mean('grammar'),
    vocabulary: mean('vocabulary'),
    listening: mean('listening'),
  };
  const overall = Math.round(
    (skills.fluency + skills.grammar + skills.vocabulary + skills.listening) / 4,
  );
  return { skills, overall, band: bandOf(overall), talks: used.length };
}
