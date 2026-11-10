/**
 * Thin wrapper over ts-fsrs 6 (FSRS-7 model by default). API checked in the
 * package's own README and types on 2026-11-10: `await DefaultScheduler(cfg)`,
 * `scheduler.newCard({ now })`, `scheduler.review({ card, grade, now })`
 * returning `{ card, revlog }` without mutating the input; cards carry
 * `dueAt` / `lastReviewAt` as Date objects.
 *
 * Loaded lazily (about 70 kB). Short-term learning steps are off: every interval is counted in days, so a
 * card comes back at most once a day, which fits a daily speaking habit.
 */
export type Grade = 'again' | 'hard' | 'good' | 'easy';
/** ts-fsrs `Rating` values (Again 1, Hard 2, Good 3, Easy 4). */
const RATING = { again: 1, hard: 2, good: 3, easy: 4 } as const satisfies Record<Grade, number>;

/** The part of the ts-fsrs scheduler used here (its own types are a union of models). */
interface Scheduler {
  newCard(input: { now: Date }): FsrsCard;
  review(input: { card: FsrsCard; grade: number; now: Date }): { card: FsrsCard };
}
type FsrsCard = Record<string, unknown> & {
  dueAt: Date;
  lastReviewAt: Date | null;
  reps: number;
  lapses: number;
  scheduledDays: number;
};

/** What is kept in IndexedDB: the ts-fsrs card with dates as epoch ms. */
export interface StoredFsrs {
  dueAt: number;
  lastReviewAt: number | null;
  reps: number;
  lapses: number;
  /** Days until the next review, as scheduled. */
  scheduledDays: number;
  /** The other ts-fsrs fields (stability, difficulty, state…), kept as they are. */
  [field: string]: unknown;
}

let scheduler: Promise<Scheduler> | null = null;

export function getScheduler(): Promise<Scheduler> {
  // Loaded on first use: the page starts without it.
  scheduler ??= import('ts-fsrs').then(({ DefaultScheduler }) =>
    (DefaultScheduler as unknown as (cfg: object) => Promise<Scheduler>)({
      desiredRetention: 0.9,
      enableShortTerm: false,
      enableFuzz: false,
      maximumInterval: 365,
    }),
  );
  return scheduler;
}

const toStored = (c: FsrsCard): StoredFsrs => ({
  ...c,
  reps: c.reps,
  lapses: c.lapses,
  scheduledDays: c.scheduledDays,
  dueAt: c.dueAt.getTime(),
  lastReviewAt: c.lastReviewAt ? c.lastReviewAt.getTime() : null,
});
const fromStored = (c: StoredFsrs): FsrsCard =>
  ({
    ...c,
    dueAt: new Date(c.dueAt),
    lastReviewAt: c.lastReviewAt === null ? null : new Date(c.lastReviewAt),
  }) as FsrsCard;

/** A new card, first due at `dueAt`. */
export async function newFsrs(dueAt: number): Promise<StoredFsrs> {
  const s = await getScheduler();
  return toStored(s.newCard({ now: new Date(dueAt) }));
}

/** One review at `now`; returns the next state (the input is not changed). */
export async function reviewFsrs(card: StoredFsrs, grade: Grade, now: number): Promise<StoredFsrs> {
  const s = await getScheduler();
  const next = toStored(
    s.review({ card: fromStored(card), grade: RATING[grade], now: new Date(now) }).card,
  );
  // FSRS-7 brings a failed card back within seconds or hours; in a daily
  // habit it comes back tomorrow (the memory state itself is unchanged).
  return { ...next, dueAt: Math.max(next.dueAt, nextLocalDay(now)) };
}

/** Local midnight after `ts`. */
export function nextLocalDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}
