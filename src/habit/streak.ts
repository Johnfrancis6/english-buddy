/**
 * Streak of days (docs/BRIEF.md §2): a day counts only when the learner
 * really spoke for at least 3 minutes (their own voice, measured by the
 * microphone's voice detection, summed over the day's talks). One missed day
 * per week (Monday to Sunday) is covered by a "joker" automatically. Today
 * never breaks the streak while it is still going on.
 *
 * Pure, with local days and an injected "now", so it is unit-tested.
 */
export const DAY_GOAL_MS = 3 * 60_000;
const DAY = 86_400_000;

/** Local calendar day "YYYY-MM-DD" of a timestamp. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Noon of the previous local day (noon avoids daylight-saving surprises). */
function previousDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(12, 0, 0, 0);
  return d.getTime() - DAY;
}

/** Monday of the local week of `ts`, as a day key. */
export function weekKey(ts: number): string {
  const d = new Date(ts);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(d.getTime());
}

export interface SpeakingDay {
  at: number;
  speakingMs: number;
}

export interface Streak {
  /** Days in a row that count (jokers keep the streak but do not add to it). */
  days: number;
  /** Today's speaking time so far (ms). */
  todayMs: number;
  todayDone: boolean;
  /** Days covered by a joker, as day keys, newest first. */
  jokers: string[];
  /** Is this week's joker still unused? */
  jokerLeft: boolean;
  /** Best streak ever. */
  best: number;
}

/** Speaking time per local day. */
export function speakingByDay(talks: readonly SpeakingDay[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of talks) out.set(dayKey(t.at), (out.get(dayKey(t.at)) ?? 0) + t.speakingMs);
  return out;
}

export function computeStreak(talks: readonly SpeakingDay[], now: number): Streak {
  const byDay = speakingByDay(talks);
  const done = (ts: number) => (byDay.get(dayKey(ts)) ?? 0) >= DAY_GOAL_MS;
  const todayMs = byDay.get(dayKey(now)) ?? 0;
  const todayDone = todayMs >= DAY_GOAL_MS;
  const { days, jokers } = walk(now, todayDone ? now : previousDay(now), done);
  const thisWeek = weekKey(now);
  return {
    days,
    todayMs,
    todayDone,
    jokers,
    jokerLeft: !jokers.some((k) => weekKey(new Date(`${k}T12:00:00`).getTime()) === thisWeek),
    best: Math.max(days, bestStreak(byDay)),
  };
}

/** Walks back from `start` while days count or a weekly joker covers them. */
function walk(
  now: number,
  start: number,
  done: (ts: number) => boolean,
): { days: number; jokers: string[] } {
  let days = 0;
  const jokers: string[] = [];
  const usedWeeks = new Set<string>();
  // A joker only matters if a counted day comes before it: they are confirmed
  // when the walk reaches one.
  let pending: { key: string; week: string }[] = [];
  let ts = start;
  for (let i = 0; i < 3660; i++) {
    if (done(ts)) {
      days++;
      for (const p of pending) {
        jokers.push(p.key);
        usedWeeks.add(p.week);
      }
      pending = [];
    } else {
      const week = weekKey(ts);
      const weekTaken = usedWeeks.has(week) || pending.some((p) => p.week === week);
      if (weekTaken || ts > now) break;
      pending.push({ key: dayKey(ts), week });
    }
    ts = previousDay(ts);
  }
  return { days, jokers };
}

/** Longest run in the history, with the same joker rule. */
function bestStreak(byDay: ReadonlyMap<string, number>): number {
  const counted = [...byDay.entries()].filter(([, ms]) => ms >= DAY_GOAL_MS).map(([k]) => k);
  let best = 0;
  for (const k of counted) {
    const ts = new Date(`${k}T12:00:00`).getTime();
    const next = dayKey(ts + DAY);
    // Only start from the last day of a run.
    if ((byDay.get(next) ?? 0) >= DAY_GOAL_MS) continue;
    const done = (t: number) => (byDay.get(dayKey(t)) ?? 0) >= DAY_GOAL_MS;
    best = Math.max(best, walk(ts, ts, done).days);
  }
  return best;
}
