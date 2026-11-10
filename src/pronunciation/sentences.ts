import { dueCards, type ReviewCard } from '../reviews/cards';
import { sentenceSounds, tokenize } from './sounds';
import { SOUND_IDS, type SoundId } from './types';

/**
 * Sentences to read aloud. They come, in this order, from:
 * 1. due "sound" review cards (a word the learner said badly, in its sentence);
 * 2. the learner's own lessons: right forms of their mistakes and the example
 *    sentences of their words, keeping the ones with the most hard sounds;
 * 3. a small bank written for the platform, chosen for the weakest sounds.
 */
export interface Exercise {
  id: string;
  text: string;
  source: 'card' | 'mistake' | 'word' | 'bank';
  sounds: SoundId[];
  /** The review card this sentence reviews ("sound" cards), and its word. */
  cardId?: string;
  focusWord?: string;
}

/** Written for English Buddy (no third-party text), B1-friendly. */
export const BANK: Record<SoundId, readonly string[]> = {
  th: [
    'I think there are three things to do this Thursday.',
    'My brother thought the weather was better than that.',
    'Thank you, they both walked through the north gate.',
    'Is this the theatre that they told me about?',
  ],
  h: [
    'Hello, how have you been? I hope you had a happy holiday.',
    'He hurt his hand while he was helping at home.',
    'Who has the hotel’s phone number? I’d like to have it.',
    'Harry is hungry, so he is heading home.',
  ],
  r: [
    'The restaurant is right around the corner from the river.',
    'I’d rather read a really good report tomorrow morning.',
    'Rachel wrote three reasons on the red board.',
    'Remember to bring the bread before Friday.',
  ],
  vowels: [
    'I’d like to leave, but I still live near the beach.',
    'Fill the cup if you feel thirsty.',
    'This ship carries sheep across the sea.',
    'The food was good, so we stayed by the pool.',
  ],
  ed: [
    'I worked late, then I walked home and watched a film.',
    'We visited my aunt and played cards; she wanted us to stay.',
    'She asked a question, laughed, and decided to wait.',
    'They started, stopped, and waited for us.',
  ],
  stress: [
    'It is important to develop a comfortable routine.',
    'I bought vegetables at the supermarket this afternoon.',
    'My colleague is interested in photography and technology.',
    'The hotel is in a beautiful part of the country.',
  ],
};

/** How many sentences one session asks for. */
export const SESSION_SIZE = 5;
const MIN_WORDS = 3;
const MAX_WORDS = 16;

const usable = (s: string) => {
  const n = tokenize(s).length;
  return n >= MIN_WORDS && n <= MAX_WORDS;
};

/** Average score per sound so far (null when never measured). */
export type SoundLevels = Partial<Record<SoundId, number>>;

/**
 * Sounds in the order they should be practised: never measured first (so a
 * new learner meets all six), then the weakest.
 */
export function soundOrder(levels: SoundLevels): SoundId[] {
  return [...SOUND_IDS].sort((a, b) => (levels[a] ?? -1) - (levels[b] ?? -1));
}

/** A small deterministic shuffle key, so the bank rotates from day to day. */
const rotate = <T>(xs: readonly T[], seed: number): T[] => {
  if (!xs.length) return [];
  const k = Math.abs(seed) % xs.length;
  return [...xs.slice(k), ...xs.slice(0, k)];
};

export function buildExercises(
  cards: readonly ReviewCard[],
  levels: SoundLevels,
  now: number,
  size = SESSION_SIZE,
): Exercise[] {
  const out: Exercise[] = [];
  const seen = new Set<string>();
  const push = (e: Exercise) => {
    const key = e.text
      .toLowerCase()
      .replace(/[^a-z]+/g, ' ')
      .trim();
    if (out.length >= size || seen.has(key) || !usable(e.text)) return;
    seen.add(key);
    out.push(e);
  };
  // 1. due sound cards (at most 2, so there is room for new material)
  const dueSound = dueCards(cards, now).filter((c) => c.kind === 'sound');
  for (const c of dueSound.slice(0, 2)) {
    push({
      id: `card:${c.id}`,
      text: c.note || c.front,
      source: 'card',
      sounds: sentenceSounds(c.note || c.front),
      cardId: c.id,
      focusWord: c.front,
    });
  }
  // 2. the learner's lessons with the most hard sounds (at most 2)
  const weakest = soundOrder(levels).slice(0, 3);
  const weight = (s: SoundId[]) => s.length + s.filter((x) => weakest.includes(x)).length;
  const lessons = cards
    .filter((c) => !c.suspended && (c.kind === 'mistake' || c.kind === 'word'))
    .map((c) => {
      const text = c.kind === 'mistake' ? c.back : c.note;
      return { c, text, sounds: sentenceSounds(text) };
    })
    .filter((x) => x.text && usable(x.text) && x.sounds.length >= 2)
    .sort((a, b) => weight(b.sounds) - weight(a.sounds) || b.c.createdAt - a.c.createdAt);
  let mine = 0;
  for (const x of lessons) {
    if (mine >= 2) break;
    const before = out.length;
    push({
      id: `${x.c.kind}:${x.c.id}`,
      text: x.text,
      source: x.c.kind === 'mistake' ? 'mistake' : 'word',
      sounds: x.sounds,
    });
    if (out.length > before) mine++;
  }
  // 3. the bank, one sentence per sound, weakest sounds first
  const day = Math.floor(now / 86_400_000);
  for (let round = 0; out.length < size && round < 4; round++) {
    for (const s of soundOrder(levels)) {
      const pick = rotate(BANK[s], day + round)[0];
      push({ id: `bank:${s}:${pick}`, text: pick, source: 'bank', sounds: sentenceSounds(pick) });
    }
  }
  return out;
}
