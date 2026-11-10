import type { CharacterId, SceneId } from '../teaching/persona';
import type { Expression } from './expressions';

/**
 * Missions inside a scene (docs/BRIEF.md §2): a concrete goal the learner
 * reaches by talking, passed or failed with a score given by the debrief.
 * Three levels per scene make the scene map: level 1 is open, higher levels
 * unlock as the learner's results grow (see `unlockMap`).
 */
export type Tier = 1 | 2 | 3;

export interface Mission {
  id: string;
  scene: SceneId;
  /** Character proposed for it (the learner may pick another one). */
  host: CharacterId;
  tier: Tier;
  titleFr: string;
  /** What the learner must do, in French (on screen). */
  goalFr: string;
  /** The same goal, in English, for the character and the analyzer. */
  goalEn: string;
  /** The character's part, in English. */
  roleEn: string;
  /** First line asked of the character. */
  greetingEn: string;
  /** Words the learner must not say (checked in the transcript too). */
  forbidden: string[];
  /** Expressions to place during this mission. */
  expressions: Expression[];
}

export const MISSIONS: readonly Mission[] = [
  {
    id: 'cafe-order',
    scene: 'cafe',
    host: 'jake',
    tier: 1,
    titleFr: 'Commander pour deux',
    goalFr:
      'Commande une boisson et quelque chose à manger pour toi et un ami absent, et demande combien ça coûte.',
    goalEn:
      'Order a drink and something to eat for themselves and for a friend who is not here yet, and ask how much it costs.',
    roleEn:
      'Today you are covering a shift as the waiter at the café. Take the order like a friendly waiter: ask what they would like, suggest the muffin or the iced tea, and give the total (in dollars) only when they ask for it.',
    greetingEn:
      'You are the waiter today. Greet the learner warmly in one short sentence and ask what you can get them.',
    forbidden: [],
    expressions: [
      {
        en: "I'm starving",
        fr: 'j’ai une faim de loup',
        match: "\\bi(?:'m| am) (?:absolutely )?starving\\b",
      },
      {
        en: 'I could do with…',
        fr: '… me ferait du bien',
        match: '\\b(?:i|we) could (?:really )?do with\\b',
      },
      {
        en: 'grab a bite',
        fr: 'manger un morceau',
        match: '\\bgrab(?:s|bed|bing)? (?:a )?(?:quick )?bite\\b',
      },
    ],
  },
  {
    id: 'cafe-terrace',
    scene: 'cafe',
    host: 'jake',
    tier: 2,
    titleFr: 'Une place en terrasse sans dire « table »',
    goalFr:
      'Obtiens une place dehors, en terrasse, pour trois personnes, sans jamais dire le mot « table ».',
    goalEn:
      'Get seats outside on the terrace for three people, without ever saying the word "table".',
    roleEn:
      'You are working as the host of the café today. The terrace is almost full: do not offer it until they clearly ask for seats outside, and ask a follow-up question (how many people, for when) before you agree. Never say the word "table" yourself.',
    greetingEn:
      'You are the host of the café today. Welcome the learner at the door in one short sentence and ask how you can help.',
    forbidden: ['table'],
    expressions: [
      {
        en: 'Would it be possible to…?',
        fr: 'serait-il possible de… ?',
        match: '\\bwould it be possible\\b',
      },
      { en: 'for three', fr: 'pour trois personnes', match: '\\bfor (?:three|3)\\b' },
      { en: 'No worries', fr: 'pas de souci', match: '\\bno worries\\b' },
    ],
  },
  {
    id: 'cafe-complaint',
    scene: 'cafe',
    host: 'jake',
    tier: 3,
    titleFr: 'Réclamer poliment',
    goalFr:
      'On t’a servi la mauvaise commande, froide en plus. Fais-la changer poliment, sans être sec, et obtiens un petit geste.',
    goalEn:
      'Their order is wrong and cold. Get it replaced politely and firmly, without being rude, and get a small gesture (a discount or a free drink).',
    roleEn:
      'You are the waiter today and you just brought the wrong order. Be a little defensive at first ("I think that is what you ordered?"), then apologise and fix it once they explain clearly and politely. Offer a free cookie only if they ask for something.',
    greetingEn:
      'You are the waiter and you have just served the learner. Say "Here you go!" cheerfully in one short sentence and ask if everything looks good.',
    forbidden: [],
    expressions: [
      { en: "I'm afraid…", fr: 'je crains que…', match: "\\bi(?:'m| am) afraid\\b" },
      {
        en: "I'd appreciate it if…",
        fr: 'je te serais reconnaissant si…',
        match: "\\bi(?:'d| would) (?:really )?appreciate\\b",
      },
      { en: 'It happens', fr: 'ça arrive', match: '\\b(?:it|these things) happens?\\b' },
    ],
  },
  {
    id: 'office-intro',
    scene: 'office',
    host: 'emma',
    tier: 1,
    titleFr: 'Te présenter à l’équipe',
    goalFr:
      'Présente-toi : ton poste, ton parcours en deux étapes, et une chose que tu aimes dans ton travail.',
    goalEn:
      'Introduce themselves: their job, two steps of their career, and one thing they enjoy in their work.',
    roleEn:
      'You are preparing the team meeting and want to introduce the learner to the team: ask about their role, their background and what they enjoy, one question at a time.',
    greetingEn:
      'Welcome the learner in one short sentence and ask them to introduce themselves before the team meeting.',
    forbidden: [],
    expressions: [
      {
        en: "I've been working as…",
        fr: 'je travaille comme… depuis',
        match: "\\bi(?:'ve| have) been working\\b",
      },
      {
        en: 'What I enjoy most is…',
        fr: 'ce que je préfère, c’est…',
        match: '\\bwhat i (?:enjoy|like|love) (?:the )?most\\b',
      },
      { en: 'on the same page', fr: 'sur la même longueur d’onde' },
    ],
  },
  {
    id: 'office-deadline',
    scene: 'office',
    host: 'emma',
    tier: 2,
    titleFr: 'Demander un délai',
    goalFr:
      'Ton rapport est pour vendredi. Obtiens deux jours de plus en donnant de vraies raisons et une nouvelle date.',
    goalEn:
      'Their report is due on Friday. Get two more days from the manager by giving real reasons and proposing a new date.',
    roleEn:
      'You are the manager. The report matters for a client, so you are reluctant: ask why, ask what is already done, and agree only if they give reasons and a precise new date. You may propose one extra day instead of two first.',
    greetingEn:
      'You have a short one-to-one with the learner. Greet them in one short sentence and ask how the report is going.',
    forbidden: [],
    expressions: [
      {
        en: 'be swamped',
        fr: 'être débordé',
        match:
          "\\b(?:am|'m|is|'s|are|'re|was|were|been|be|feel|felt) (?:a bit |really |totally )?swamped\\b",
      },
      {
        en: 'Would it be OK if…?',
        fr: 'est-ce que ça irait si… ?',
        match: '\\bwould it be (?:ok|okay|alright|all right|fine)\\b',
      },
      {
        en: 'by Tuesday',
        fr: 'd’ici mardi',
        match: '\\bby (?:monday|tuesday|wednesday|thursday|friday|next week)\\b',
      },
    ],
  },
  {
    id: 'office-interview',
    scene: 'office',
    host: 'emma',
    tier: 3,
    titleFr: 'Entretien d’embauche',
    goalFr:
      'Réponds à trois questions d’entretien avec un exemple concret à chaque fois, puis pose toi-même une bonne question.',
    goalEn:
      'Answer three job interview questions, each with a concrete example from their experience, then ask the interviewer one good question.',
    roleEn:
      'You run a realistic job interview for a role in your team. Ask three classic questions one at a time (a challenge they solved, a strength, why this job). Ask for an example when an answer stays vague. At the end, ask if they have a question for you.',
    greetingEn:
      'You are starting a job interview with the learner. Welcome them politely in one short sentence and ask them to take a seat and tell you a little about themselves.',
    forbidden: [],
    expressions: [
      { en: 'For instance', fr: 'par exemple', match: '\\bfor (?:instance|example)\\b' },
      {
        en: "I'm good at…",
        fr: 'je suis doué pour…',
        match: "\\bi(?:'m| am) (?:really |quite |pretty )?good at\\b",
      },
      {
        en: 'That’s a great question',
        fr: 'c’est une très bonne question',
        match: "\\b(?:that'?s|that is) a (?:great|good) question\\b",
      },
    ],
  },
  {
    id: 'street-way',
    scene: 'street',
    host: 'maya',
    tier: 1,
    titleFr: 'Demander ton chemin',
    goalFr:
      'Trouve le chemin de la gare, puis répète l’itinéraire pour vérifier que tu as bien compris.',
    goalEn:
      'Find the way to the train station, then repeat the directions back to check they understood.',
    roleEn:
      'You know the area well. Give directions to the station in two or three steps (straight on, second left, past the park, about ten minutes on foot), clearly but at a natural pace. If they repeat them wrongly, correct the step kindly.',
    greetingEn:
      'The learner looks a little lost. Ask them in one short, friendly sentence if they need help.',
    forbidden: [],
    expressions: [
      {
        en: 'get lost',
        fr: 'se perdre',
        match: '\\b(?:get(?:s|ting)?|got|gotten) (?:a (?:bit|little) )?lost\\b',
      },
      { en: 'around the corner', fr: 'tout près, au coin de la rue' },
      {
        en: 'So if I got it right…',
        fr: 'donc si j’ai bien compris…',
        match: '\\bif i (?:got|get|understood|understand) (?:it|you|that) right\\b',
      },
    ],
  },
  {
    id: 'street-invite',
    scene: 'street',
    host: 'maya',
    tier: 2,
    titleFr: 'Proposer une sortie',
    goalFr:
      'Invite Maya à un concert ce week-end et mettez-vous d’accord sur le jour, l’heure et le lieu de rendez-vous.',
    goalEn:
      'Invite the character to a concert this weekend and agree on the day, the time and where to meet.',
    roleEn:
      'You like the idea but you are busy on Saturday: make them propose another moment, and ask where and when exactly to meet. Agree once day, time and place are clear.',
    greetingEn:
      'You bump into the learner again. Say hi in one short, happy sentence and ask what they are up to this weekend.',
    forbidden: [],
    expressions: [
      { en: 'Are you up for it?', fr: 'ça te tente ?', match: '\\bup for (?:it|that|a|some)\\b' },
      { en: 'How about…?', fr: 'et si… ?', match: '\\bhow about\\b' },
      {
        en: 'hang out',
        fr: 'passer du temps ensemble',
        match: '\\b(?:hang(?:s|ing)?|hung) out\\b',
      },
    ],
  },
  {
    id: 'street-story',
    scene: 'street',
    host: 'maya',
    tier: 3,
    titleFr: 'Raconter un voyage sans dire « good » ni « nice »',
    goalFr:
      'Raconte ton meilleur voyage au passé, avec des détails, sans jamais dire « good » ni « nice ».',
    goalEn:
      'Tell the story of their best trip in the past tense, with details, without ever saying "good" or "nice".',
    roleEn:
      'You love travel stories: ask follow-up questions about places, food, people and what went wrong. Never say "good" or "nice" yourself, so you do not tempt them.',
    greetingEn:
      'You are chatting with the learner on the street. Ask them in one short, curious sentence about the best trip they have ever taken.',
    forbidden: ['good', 'nice'],
    expressions: [
      {
        en: "It's a long story",
        fr: 'c’est une longue histoire',
        match: "\\b(?:it'?s|it is|it was) a long story\\b",
      },
      { en: 'breathtaking', fr: 'à couper le souffle' },
      { en: 'I ended up…', fr: 'j’ai fini par…', match: '\\bend(?:ed|s)? up\\b' },
    ],
  },
];

export const missionById = (id: string | undefined): Mission | undefined =>
  MISSIONS.find((m) => m.id === id);

/** Best result of each mission so far. */
export interface MissionRecord {
  passed: boolean;
  bestScore: number;
  tries: number;
}

/** What unlocks each level of the map. */
export const UNLOCK = {
  2: { passed: 2, overall: 50 },
  3: { passed: 2, overall: 65 },
} as const;

export interface MapCell {
  mission: Mission;
  unlocked: boolean;
  /** Why it is locked, in French ('' when open). */
  lockFr: string;
  record: MissionRecord | null;
}

/**
 * Level 1 is open. Level N opens when the learner passed `UNLOCK[N].passed`
 * missions of level N-1, or when their estimated level (0–100, mean of the
 * last debriefs) reaches `UNLOCK[N].overall`.
 */
export function unlockMap(
  records: ReadonlyMap<string, MissionRecord>,
  overall: number | null,
): MapCell[] {
  const passedAt = (tier: Tier) =>
    MISSIONS.filter((m) => m.tier === tier && records.get(m.id)?.passed).length;
  const open: Record<Tier, boolean> = { 1: true, 2: false, 3: false };
  for (const tier of [2, 3] as const) {
    const rule = UNLOCK[tier];
    open[tier] = passedAt((tier - 1) as Tier) >= rule.passed || (overall ?? 0) >= rule.overall;
  }
  return MISSIONS.map((mission) => {
    const unlocked = open[mission.tier];
    const rule = mission.tier > 1 ? UNLOCK[mission.tier as 2 | 3] : null;
    return {
      mission,
      unlocked,
      lockFr:
        unlocked || !rule
          ? ''
          : `Réussis ${rule.passed} missions de niveau ${mission.tier - 1} (ou atteins ${rule.overall}/100 en niveau estimé).`,
      record: records.get(mission.id) ?? null,
    };
  });
}
