import type { Debrief } from '../analysis/types';
import type { Turn } from '../talk/transcript';
import type { TalkPlan } from '../habit/plan';
import { run } from './db';

/**
 * Finished conversations, as text only, in this browser's IndexedDB. Nothing
 * here is ever sent to a server of ours; voice is never stored.
 */
export interface SavedTalk {
  id: string;
  startedAt: number;
  durationMs: number;
  label: string;
  /** Who and where (phase 2+); talks from phase 1 were with Jake at the café. */
  character?: string;
  scene?: string;
  turns: Pick<Turn, 'id' | 'who' | 'text' | 'liveText' | 'source' | 'interrupted'>[];
  debrief: Debrief | null;
  /** Explanations already fetched, by mistake index. */
  why: Record<number, string>;
  /**
   * Time the learner's microphone heard voice, in ms (phase 3+). Older talks
   * have none: the dashboard estimates it from their word count.
   */
  speakingMs?: number;
  /** Phase 4: the mission, expressions and review items of the talk. */
  plan?: TalkPlan;
  /** Talks pulled from the account have no transcript, only these counts. */
  cloudCounts?: { words: number; sentences: number };
}

/** Older talks are dropped beyond this many (text only, ~10–50 kB each). */
export const KEEP_TALKS = 300;

export async function listTalks(): Promise<SavedTalk[]> {
  const all = (await run<SavedTalk[]>('talks', 'readonly', (s) => s.getAll())) ?? [];
  return all.map(upgradeTalk).sort((a, b) => b.startedAt - a.startedAt);
}

/**
 * Talks saved in phase 1 used `who: 'jake'` and `recastByJake`; they are
 * read with the phase 2 names.
 */
export function upgradeTalk(t: SavedTalk): SavedTalk {
  const turns = t.turns.map((x) =>
    (x.who as string) === 'jake' ? { ...x, who: 'buddy' as const } : x,
  );
  const debrief = t.debrief && {
    ...t.debrief,
    mistakes: t.debrief.mistakes.map((m) => {
      const old = m as typeof m & { recastByJake?: boolean };
      return old.recastByCharacter === undefined
        ? { ...m, recastByCharacter: old.recastByJake === true }
        : m;
    }),
  };
  return { ...t, character: t.character ?? 'jake', scene: t.scene ?? 'cafe', turns, debrief };
}

export async function saveTalk(talk: SavedTalk): Promise<void> {
  await run('talks', 'readwrite', (s) => s.put(structuredClone(talk)));
  const all = await listTalks();
  for (const old of all.slice(KEEP_TALKS)) await run('talks', 'readwrite', (s) => s.delete(old.id));
}

export async function deleteTalk(id: string): Promise<void> {
  await run('talks', 'readwrite', (s) => s.delete(id));
}

export async function clearTalks(): Promise<void> {
  await run('talks', 'readwrite', (s) => s.clear());
}
