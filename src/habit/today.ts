import { dueCards, type ReviewCard } from '../reviews/cards';
import type { SavedTalk } from '../storage/talks';
import type { MissionRecord } from './missions';
import { dayKey } from './streak';

/** Best result per mission, from the saved talks' debriefs. */
export function missionRecords(talks: readonly SavedTalk[]): Map<string, MissionRecord> {
  const out = new Map<string, MissionRecord>();
  for (const t of talks) {
    const id = t.plan?.missionId;
    const r = t.debrief?.mission;
    if (!id || !r) continue;
    const prev = out.get(id);
    out.set(id, {
      passed: (prev?.passed ?? false) || r.passed,
      bestScore: Math.max(prev?.bestScore ?? 0, r.score),
      tries: (prev?.tries ?? 0) + 1,
    });
  }
  return out;
}

/** Has today's daily challenge been played (a challenge talk today)? */
export function challengeDoneToday(talks: readonly SavedTalk[], now: number): boolean {
  return talks.some((t) => t.plan?.mode === 'challenge' && dayKey(t.startedAt) === dayKey(now));
}

/** When the next card is due, in French ("maintenant", "demain", "dans 3 jours", "le 12 déc."). */
export function nextDueFr(cards: readonly ReviewCard[], now: number): string {
  const active = cards.filter((c) => !c.suspended);
  if (!active.length) return 'aucune';
  if (dueCards(active, now).length) return 'maintenant';
  const next = Math.min(...active.map((c) => c.fsrs.dueAt));
  const days = Math.round(
    (new Date(dayKey(next) + 'T12:00:00').getTime() -
      new Date(dayKey(now) + 'T12:00:00').getTime()) /
      86_400_000,
  );
  if (days <= 0) return 'plus tard aujourd’hui';
  if (days === 1) return 'demain';
  if (days < 7) return `dans ${days} jours`;
  return `le ${new Date(next).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
}
