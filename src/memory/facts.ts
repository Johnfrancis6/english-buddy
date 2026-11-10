import type { CharacterId } from '../teaching/persona';

/**
 * What the characters remember about the learner (docs/BRIEF.md §2,
 * "Character memory"). Facts are written in French so the learner can read
 * and correct them; the characters get them as notes in their prompt.
 *
 * Facts are shared by every character (one learner, one life), except the
 * summary of the last talk, which each character keeps for itself.
 */
export const FACT_CATEGORIES = {
  job: 'Travail et études',
  family: 'Famille et proches',
  plans: 'Projets',
  likes: 'Goûts et loisirs',
  life: 'Vie quotidienne',
  last_talk: 'Dernière conversation',
} as const;
export type FactCategory = keyof typeof FACT_CATEGORIES;
/** Categories the analyzer may write (last_talk comes from its own field). */
export const LEARNER_CATEGORIES = ['job', 'family', 'plans', 'likes', 'life'] as const;

export interface Fact {
  id: string;
  category: FactCategory;
  /** One short sentence in French, about the learner ("Tu…" is avoided: third person). */
  text: string;
  /** For last_talk: the character it belongs to. */
  character?: CharacterId;
  createdAt: number;
  updatedAt: number;
  /** The learner wrote or corrected it: the analyzer must not silently undo it. */
  byLearner: boolean;
  /** Talk it comes from, if any. */
  talkId?: string;
}

/** A change proposed by the analyzer after a talk. */
export interface FactUpdate {
  category: (typeof LEARNER_CATEGORIES)[number];
  text: string;
  /** Id of the fact this one replaces (it changed or got more precise), or ''. */
  replaces: string;
}

/** Most facts kept (not counting one last_talk per character). */
export const MAX_FACTS = 40;
/** Facts given to a character in its prompt. */
export const PROMPT_FACTS = 15;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

let seq = 0;
export const newFactId = (now: number) => `f${now.toString(36)}${(seq++).toString(36)}`;

/**
 * Applies the analyzer's updates and the new last-talk summary. Pure: returns
 * the new list. Rules:
 * - a duplicate (same words) is ignored;
 * - `replaces` updates that fact in place, unless the learner wrote it
 *   (then the new fact is added next to it, and the learner decides);
 * - beyond MAX_FACTS, the oldest facts written by the analyzer go first.
 */
export function mergeFacts(
  facts: readonly Fact[],
  updates: readonly FactUpdate[],
  opts: { now: number; talkId?: string; character?: CharacterId; lastTalk?: string },
): Fact[] {
  const out = facts.map((f) => ({ ...f }));
  const known = new Set(out.map((f) => norm(f.text)));
  for (const u of updates) {
    const text = u.text.trim();
    if (!text || known.has(norm(text))) continue;
    const target = u.replaces ? out.find((f) => f.id === u.replaces) : undefined;
    if (target && target.category !== 'last_talk' && !target.byLearner) {
      known.delete(norm(target.text));
      Object.assign(target, {
        text,
        category: u.category,
        updatedAt: opts.now,
        talkId: opts.talkId,
      });
    } else {
      out.push({
        id: newFactId(opts.now),
        category: u.category,
        text,
        createdAt: opts.now,
        updatedAt: opts.now,
        byLearner: false,
        talkId: opts.talkId,
      });
    }
    known.add(norm(text));
  }
  if (opts.character && opts.lastTalk?.trim()) {
    const text = opts.lastTalk.trim();
    const prev = out.find((f) => f.category === 'last_talk' && f.character === opts.character);
    if (prev)
      Object.assign(prev, { text, updatedAt: opts.now, talkId: opts.talkId, byLearner: false });
    else {
      out.push({
        id: newFactId(opts.now),
        category: 'last_talk',
        character: opts.character,
        text,
        createdAt: opts.now,
        updatedAt: opts.now,
        byLearner: false,
        talkId: opts.talkId,
      });
    }
  }
  return trimFacts(out);
}

function trimFacts(facts: Fact[]): Fact[] {
  const about = facts.filter((f) => f.category !== 'last_talk');
  if (about.length <= MAX_FACTS) return facts;
  // Drop the oldest analyzer facts first, then the oldest learner facts.
  const drop = new Set(
    [...about]
      .sort((a, b) => Number(a.byLearner) - Number(b.byLearner) || a.updatedAt - b.updatedAt)
      .slice(0, about.length - MAX_FACTS)
      .map((f) => f.id),
  );
  return facts.filter((f) => !drop.has(f.id));
}

/** Facts for the analyzer, with their ids, so it can say which one changed. */
export function factsForAnalyzer(facts: readonly Fact[]): string {
  const about = facts.filter((f) => f.category !== 'last_talk');
  if (!about.length) return '(nothing yet)';
  return about.map((f) => `[${f.id}] (${f.category}) ${f.text}`).join('\n');
}

const ago = (ms: number): string => {
  const days = Math.round(ms / 86_400_000);
  if (days <= 0) return 'earlier today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  return `${Math.round(days / 7)} weeks ago`;
};

/**
 * The memory block of a character's prompt: the latest facts (most recently
 * updated first) and this character's own last talk, or '' if nothing is
 * known yet.
 */
export function memoryForPrompt(
  facts: readonly Fact[],
  character: CharacterId,
  now: number,
): string {
  const about = facts
    .filter((f) => f.category !== 'last_talk')
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, PROMPT_FACTS);
  const last = facts.find((f) => f.category === 'last_talk' && f.character === character);
  if (!about.length && !last) return '';
  const lines = [
    'What you remember about them from earlier talks (your own memory; the notes are written in French, but you always speak English):',
    ...about.map((f) => `- ${f.text}`),
  ];
  if (last) lines.push(`Your last talk with them (${ago(now - last.updatedAt)}): ${last.text}`);
  lines.push(
    `How to use this memory: you know these things the way a friend does. In the first minutes, bring up one of them naturally (for example ask how something they told you about went), then follow the conversation. Never recite the list, never mention notes, a file or a memory, and never bring up more than one or two of them in a talk unless they do. If something seems out of date or they say otherwise, believe them.`,
  );
  return lines.join('\n');
}
