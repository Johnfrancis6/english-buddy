import { CHARACTERS, type Character, type CharacterId, type SceneId } from './teaching/persona';

/**
 * What the interface needs to show the cast and the scenes. Prompts live in
 * teaching/persona.ts; model files and their licences in docs/ASSETS.md.
 */
export interface CastMember {
  id: CharacterId;
  character: Character;
  /** VRM file in public/models. */
  model: string;
  /** Gemini prebuilt voice (names from aistudio.google.com/docs/speech-generation#voices). */
  voice: string;
  /** Name colour (docs/DESIGN.md §1). */
  colour: string;
  ageFr: string;
  accentFr: string;
  blurbFr: string;
  /** Three or four words for the home card. */
  roleFr: string;
  homeScene: SceneId;
  /** Does a fist bump fit this character? (Jake's signature move.) */
  fistBump: boolean;
}

export const CAST: readonly CastMember[] = [
  {
    id: 'jake',
    character: CHARACTERS.jake,
    model: 'jake.vrm',
    voice: 'Puck',
    colour: '#b34a17',
    ageFr: '28 ans',
    accentFr: 'américain',
    blurbFr: 'Ancien serveur devenu ton ami. Blagueur, détendu, argot de tous les jours.',
    roleFr: 'Ami blagueur',
    homeScene: 'cafe',
    fistBump: true,
  },
  {
    id: 'emma',
    character: CHARACTERS.emma,
    model: 'emma.vrm',
    voice: 'Kore',
    colour: '#2f5d8a',
    ageFr: '35 ans',
    accentFr: 'britannique',
    blurbFr: 'Ta responsable d’équipe. Polie, exigeante, bienveillante : réunions, entretiens.',
    roleFr: 'Responsable d’équipe',
    homeScene: 'office',
    fistBump: false,
  },
  {
    id: 'maya',
    character: CHARACTERS.maya,
    model: 'maya.vrm',
    voice: 'Aoede',
    colour: '#8a3b8f',
    ageFr: '24 ans',
    accentFr: 'américain',
    blurbFr: 'Étudiante en musique, curieuse et bavarde. Rencontres, demander son chemin.',
    roleFr: 'Étudiante en musique',
    homeScene: 'street',
    fistBump: false,
  },
  {
    id: 'ollie',
    character: CHARACTERS.ollie,
    model: 'ollie.vrm',
    voice: 'Orus',
    colour: '#2e6b4f',
    ageFr: '31 ans',
    accentFr: 'britannique',
    blurbFr: 'Graphiste de Manchester, toujours en veste. Décontracté, un brin ironique.',
    roleFr: 'Graphiste en veste',
    homeScene: 'street',
    fistBump: true,
  },
  {
    id: 'lily',
    character: CHARACTERS.lily,
    model: 'lily.vrm',
    voice: 'Leda',
    colour: '#9a5b00',
    ageFr: '9 ans',
    accentFr: 'américain',
    blurbFr: 'La fille d’amis de la famille. Phrases simples, mille questions, son chien Biscuit.',
    roleFr: 'Petite curieuse',
    homeScene: 'street',
    fistBump: true,
  },
];

export interface SceneInfo {
  id: SceneId;
  labelFr: string;
  blurbFr: string;
  /** Character proposed first when this scene is picked. */
  host: CharacterId;
}

export const SCENES: readonly SceneInfo[] = [
  { id: 'cafe', labelFr: 'Le café', blurbFr: 'Discuter entre amis.', host: 'jake' },
  {
    id: 'office',
    labelFr: 'Le bureau',
    blurbFr: 'Réunion, entretien.',
    host: 'emma',
  },
  {
    id: 'street',
    labelFr: 'La rue',
    blurbFr: 'Rencontres, chemin.',
    host: 'maya',
  },
];

export const castMember = (id: string): CastMember => CAST.find((c) => c.id === id) ?? CAST[0];
export const sceneInfo = (id: string): SceneInfo => SCENES.find((s) => s.id === id) ?? SCENES[0];
