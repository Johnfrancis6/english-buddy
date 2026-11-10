import { SOUND_IDS, type SoundId } from './types';

/**
 * The six sound families a French speaker most often gets wrong in English,
 * with a short French tip, and a spelling-based tagger that says which of
 * them a word contains. The tagger reads letters, not phonemes: it is a
 * guide for choosing sentences and grouping scores, not a phonetic
 * dictionary (silent letters and exceptions are only partly handled).
 */
export interface SoundInfo {
  id: SoundId;
  labelFr: string;
  /** Example words, shown next to the label. */
  examples: string;
  tipFr: string;
}

export const SOUNDS: Record<SoundId, SoundInfo> = {
  th: {
    id: 'th',
    labelFr: 'Le « th »',
    examples: 'think, this, three',
    tipFr:
      'Bout de la langue entre les dents, puis souffle : « think » sans voix, « this » avec la voix. Ni s, ni z, ni f, ni d.',
  },
  h: {
    id: 'h',
    labelFr: 'Le « h » soufflé',
    examples: 'happy, house, who',
    tipFr:
      'Souffle comme pour faire de la buée sur une vitre : « happy », « house ». Ne l’efface pas, et n’en ajoute pas devant une voyelle (« I », « every »).',
  },
  r: {
    id: 'r',
    labelFr: 'Le « r » anglais',
    examples: 'right, very, three',
    tipFr:
      'Le r anglais ne racle pas la gorge : langue recourbée vers l’arrière, sans toucher le palais, lèvres un peu arrondies.',
  },
  vowels: {
    id: 'vowels',
    labelFr: 'Voyelles courtes et longues',
    examples: 'ship / sheep, full / fool',
    tipFr:
      'Courte ou longue change le mot : « ship » court et détendu, « sheep » long et souriant ; « full » court, « fool » long.',
  },
  ed: {
    id: 'ed',
    labelFr: 'La fin en -ed',
    examples: 'worked, played, wanted',
    tipFr:
      'Trois façons : « t » après p, k, f, s, ch, sh (worked) ; « d » après les autres sons (played) ; « id » seulement après t ou d (wanted). Jamais « é-d » partout.',
  },
  stress: {
    id: 'stress',
    labelFr: 'L’accent du mot',
    examples: 'PHOtograph, deVElop',
    tipFr:
      'Une syllabe plus forte et plus longue par mot, souvent au début : COMfortable, VEGetable, deVElop. Le français met la force à la fin : résiste !',
  },
};

export const isSound = (x: unknown): x is SoundId => SOUND_IDS.includes(x as SoundId);

/** Words of a sentence as the learner sees them (keeps apostrophes: "I'd"). */
export function tokenize(sentence: string): string[] {
  return sentence.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g) ?? [];
}

/** Lower case, straight apostrophe: used to compare words. */
export const normWord = (w: string) =>
  w
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z']/g, '');

const SILENT_H = new Set(['hour', 'hours', 'honest', 'honestly', 'honour', 'honor', 'heir']);
const WH_H = new Set(['who', 'whom', 'whose', 'whole', 'wholly']);
/** Words ending in -ed that are not past forms (or not pronounced like one). */
const ED_NOT_PAST = new Set([
  'bed',
  'red',
  'fed',
  'led',
  'wed',
  'shed',
  'sled',
  'need',
  'seed',
  'feed',
  'weed',
  'deed',
  'reed',
  'speed',
  'breed',
  'greed',
  'bleed',
  'freed',
  'indeed',
  'proceed',
  'succeed',
  'exceed',
  'hundred',
  'naked',
  'wicked',
  'sacred',
  'shred',
]);
/** Minimal-pair words where short or long vowels change the meaning. */
const VOWEL_WORDS = new Set(
  `ship sheep sit seat live leave fill feel bit beat hit heat still steal will wheel did deed it eat is
  this these his he's full fool pull pool look luke good food book boot foot soon cook should could would
  sleep slip week wick feet fit rich reach chip cheap list least mill meal pick peak win wean ill eel
  kid keyed sick seek hill heel lip leap bin bean pitch peach fist feast dip deep tin teen grin green`.split(
    /\s+/,
  ),
);
/** Two-syllable words French speakers often stress on the wrong syllable. */
const STRESS_WORDS = new Set(
  `answer breakfast business country colleague coffee damage doctor enough event focus forward hotel
  language lettuce message moment morning mountain office other people pizza problem purpose record
  report result return support surprise today water weekend woman women children decide prefer
  between because police machine canal guitar`.split(/\s+/),
);

/** Rough syllable count from vowel groups (silent final e ignored). */
export function syllables(word: string): number {
  const w = normWord(word).replace(/'/g, '');
  if (!w) return 0;
  const trimmed = w.length > 3 ? w.replace(/(?:[^laeiouy]es|[^laeiouy]e)$/, '') : w;
  const groups = trimmed.match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

/** How the -ed ending sounds: "t", "d" or "id" (null if not a regular -ed form). */
export function edSound(word: string): 't' | 'd' | 'id' | null {
  const w = normWord(word);
  if (w.length < 4 || !w.endsWith('ed') || ED_NOT_PAST.has(w)) return null;
  const stem = w.slice(0, -2);
  // wanted, needed, decided (decide + d leaves "decid")
  if (/[td]$/.test(stem)) return 'id';
  // used, closed, raised: a single s after a vowel sounds like z
  if (/[aeiou]s$/.test(stem)) return 'd';
  // worked, stopped, laughed, missed, fixed, watched, washed, danced
  if (/(?:p|k|f|gh|s|x|ch|sh|c)$/.test(stem)) return 't';
  return 'd';
}

/** Hard sounds a word contains, by its spelling. */
export function soundsOf(word: string): SoundId[] {
  const w = normWord(word).replace(/'.*$/, '');
  if (!w) return [];
  const out: SoundId[] = [];
  if (w.includes('th') && !/^th(?:omas|ames)$/.test(w)) out.push('th');
  if ((w.startsWith('h') && !SILENT_H.has(w)) || WH_H.has(w)) out.push('h');
  // An "r" before a vowel is said in American and British English alike.
  if (/r[aeiouy]/.test(w) || w.startsWith('r') || w.startsWith('wr')) out.push('r');
  if (VOWEL_WORDS.has(w)) out.push('vowels');
  if (edSound(w)) out.push('ed');
  if (syllables(w) >= 3 || STRESS_WORDS.has(w)) out.push('stress');
  return out;
}

/** Distinct hard sounds of a sentence. */
export function sentenceSounds(sentence: string): SoundId[] {
  const set = new Set<SoundId>();
  for (const w of tokenize(sentence)) for (const s of soundsOf(w)) set.add(s);
  return SOUND_IDS.filter((s) => set.has(s));
}
