import type { SceneId } from '../teaching/persona';

/**
 * "Expressions to place" (docs/BRIEF.md §2): 3 to 5 expressions the learner
 * tries to use naturally in a talk. The character is told to notice them; the
 * page ticks them as soon as the learner's transcript contains them, and the
 * debrief (analyzer) gives the final word.
 */
export interface Expression {
  /** As shown and as given to the character, in English. */
  en: string;
  /** Meaning in French, shown to the learner. */
  fr: string;
  /**
   * Regular expression source (case-insensitive) for irregular forms
   * ("got lost", "caught up"). Without it, one is built from `en`.
   */
  match?: string;
  /** The review card this expression comes from, if any. */
  cardId?: string;
}

/** Everyday expressions per scene, B1 → B2, used when no review card is due. */
export const SCENE_EXPRESSIONS: Record<SceneId, readonly Expression[]> = {
  cafe: [
    {
      en: "I'm starving",
      fr: 'j’ai une faim de loup',
      match: "\\bi(?:'m| am) (?:absolutely )?starving\\b",
    },
    {
      en: "It's on me",
      fr: 'c’est moi qui invite',
      match: "\\b(?:it'?s|it is|this one'?s|this is) on me\\b",
    },
    {
      en: 'grab a bite',
      fr: 'manger un morceau',
      match: '\\bgrab(?:s|bed|bing)? (?:a )?(?:quick )?bite\\b',
    },
    { en: 'catch up', fr: 'prendre des nouvelles', match: '\\b(?:catch(?:es|ing)?|caught) up\\b' },
    {
      en: 'I could do with…',
      fr: '… me ferait du bien',
      match: '\\b(?:i|we) could (?:really )?do with\\b',
    },
    { en: 'No worries', fr: 'pas de souci', match: '\\bno worries\\b' },
  ],
  office: [
    { en: 'touch base', fr: 'faire un point rapide', match: '\\btouch(?:es|ed|ing)? base\\b' },
    { en: 'on the same page', fr: 'sur la même longueur d’onde' },
    {
      en: 'be swamped',
      fr: 'être débordé',
      match:
        "\\b(?:am|'m|is|'s|are|'re|was|were|been|be|feel|felt) (?:a bit |really |totally )?swamped\\b",
    },
    { en: 'follow up on', fr: 'assurer le suivi de', match: '\\bfollow(?:s|ed|ing)?[ -]up on\\b' },
    {
      en: "That's a fair point",
      fr: 'c’est juste',
      match: "\\b(?:that'?s|that is) a (?:fair|good) point\\b",
    },
    {
      en: 'run late',
      fr: 'être en retard',
      match: '\\b(?:run(?:s|ning)?|ran) (?:a (?:bit|little) )?late\\b',
    },
  ],
  street: [
    {
      en: 'get lost',
      fr: 'se perdre',
      match: '\\b(?:get(?:s|ting)?|got|gotten) (?:a (?:bit|little) )?lost\\b',
    },
    { en: 'around the corner', fr: 'tout près, au coin de la rue' },
    { en: 'hang out', fr: 'passer du temps ensemble', match: '\\b(?:hang(?:s|ing)?|hung) out\\b' },
    { en: 'Are you up for it?', fr: 'ça te tente ?', match: '\\bup for (?:it|that|a|some)\\b' },
    { en: 'bump into someone', fr: 'tomber sur quelqu’un', match: '\\bbump(?:s|ed|ing)? into\\b' },
    {
      en: "It's a long story",
      fr: 'c’est une longue histoire',
      match: "\\b(?:it'?s|it is) a long story\\b",
    },
  ],
};

/** Lower case, curly apostrophes made straight, spaces tidied. */
export function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PLACEHOLDER = /^(?:someone|something|somebody|sb|sth|…|\.\.\.)$/;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A regular expression for an expression without its own `match`: each word
 * may take a regular ending (s, es, ed, d, ing), a leading "to" is dropped, a
 * leading "be" accepts its forms ("I'm swamped" for "to be swamped") and
 * placeholders (someone, something, …) accept up to three words.
 */
export function expressionPattern(e: Pick<Expression, 'en' | 'match'>): RegExp {
  if (e.match) return new RegExp(e.match, 'i');
  const words = normalizeSpeech(e.en.replace(/…|\.\.\./g, ' … '))
    .split(' ')
    .filter(Boolean);
  if (words[0] === 'to' && words.length > 1) words.shift();
  const parts = words.map((w, i) =>
    PLACEHOLDER.test(w)
      ? "(?:[a-z']+ ){0,3}"
      : i === 0 && w === 'be'
        ? `(?:be|being|been|am|is|are|was|were|'m|'s|'re) (?:(?:so|really|a bit|totally) )?`
        : `${escape(w)}(?:s|es|ed|d|ing)? `,
  );
  // Placeholders swallow their own space; trim the trailing one of the last word.
  const source = parts
    .join('')
    .replace(/ $/, '')
    .replace(/\(\?:\[a-z'\]\+ \)\{0,3\}$/, '');
  return new RegExp(`\\b${source}\\b`, 'i');
}

/** Has the learner used this expression in `text`? */
export function usesExpression(text: string, e: Pick<Expression, 'en' | 'match'>): boolean {
  return expressionPattern(e).test(normalizeSpeech(text));
}

/** Forbidden words (missions "without saying…") found in the learner's text. */
export function forbiddenFound(text: string, forbidden: readonly string[]): string[] {
  const t = normalizeSpeech(text);
  return forbidden.filter((w) => new RegExp(`\\b${escape(w.toLowerCase())}s?\\b`).test(t));
}
