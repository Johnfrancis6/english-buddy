import type { Song } from './melody';

/**
 * The songbook. Only songs in the public domain (words and tune, sources in
 * docs/ASSETS.md) or written for this platform (words and tune). No
 * recording is shipped: every tune is a few notes of text, played by
 * WebAudio. No copyrighted song, ever.
 */
export const SONGS: readonly Song[] = [
  {
    id: 'twinkle',
    title: 'Twinkle, Twinkle, Little Star',
    kind: 'public',
    creditFr:
      'Domaine public : paroles de Jane Taylor (1806), air « Ah ! vous dirai-je, maman » (1761).',
    focusFr: 'Voyelles longues et courtes, « th », « w »',
    bpm: 92,
    meter: 4,
    pickup: 0,
    tonic: 48,
    lines: [
      { lyric: 'Twin-kle, twin-kle, lit-tle star,', melody: 'C4/1 C4/1 G4/1 G4/1 A4/1 A4/1 G4/2' },
      { lyric: 'how I won-der what you are!', melody: 'F4/1 F4/1 E4/1 E4/1 D4/1 D4/1 C4/2' },
      { lyric: 'Up a-bove the world so high,', melody: 'G4/1 G4/1 F4/1 F4/1 E4/1 E4/1 D4/2' },
      { lyric: 'like a dia-mond in the sky.', melody: 'G4/1 G4/1 F4/1 F4/1 E4/1 E4/1 D4/2' },
      { lyric: 'Twin-kle, twin-kle, lit-tle star,', melody: 'C4/1 C4/1 G4/1 G4/1 A4/1 A4/1 G4/2' },
      { lyric: 'how I won-der what you are!', melody: 'F4/1 F4/1 E4/1 E4/1 D4/1 D4/1 C4/2' },
    ],
  },
  {
    id: 'sleeping',
    title: 'Are You Sleeping? (Brother John)',
    kind: 'public',
    creditFr: 'Domaine public : version anglaise traditionnelle de « Frère Jacques ».',
    focusFr: '« th » de « brother », fin en « -ing », « r » anglais',
    bpm: 100,
    meter: 4,
    pickup: 0,
    tonic: 48,
    lines: [
      {
        lyric: 'Are you sleep-ing, are you sleep-ing,',
        melody: 'C4/1 D4/1 E4/1 C4/1 C4/1 D4/1 E4/1 C4/1',
      },
      { lyric: 'Bro-ther John, Bro-ther John?', melody: 'E4/1 F4/1 G4/2 E4/1 F4/1 G4/2' },
      {
        lyric: 'Morn-ing bells are ring-ing, morn-ing bells are ring-ing,',
        melody: 'G4/.5 A4/.5 G4/.5 F4/.5 E4/1 C4/1 G4/.5 A4/.5 G4/.5 F4/.5 E4/1 C4/1',
      },
      { lyric: 'ding, dang, dong, ding, dang, dong.', melody: 'C4/1 G3/1 C4/2 C4/1 G3/1 C4/2' },
    ],
  },
  {
    id: 'mary',
    title: 'Mary Had a Little Lamb',
    kind: 'public',
    creditFr:
      'Domaine public : paroles de Sarah Josepha Hale (1830), air traditionnel (Lowell Mason, 1831).',
    focusFr: 'Voyelles courtes (« little », « its »), « h » de « had », « w »',
    bpm: 100,
    meter: 4,
    pickup: 0,
    tonic: 48,
    lines: [
      { lyric: 'Ma-ry had a lit-tle lamb,', melody: 'E4/1 D4/1 C4/1 D4/1 E4/1 E4/1 E4/2' },
      { lyric: 'lit-tle lamb, lit-tle lamb,', melody: 'D4/1 D4/1 D4/2 E4/1 G4/1 G4/2' },
      { lyric: 'Ma-ry had a lit-tle lamb,', melody: 'E4/1 D4/1 C4/1 D4/1 E4/1 E4/1 E4/1' },
      { lyric: 'its fleece was white as snow.', melody: 'E4/1 D4/1 D4/1 E4/1 D4/1 C4/4' },
    ],
  },
  {
    id: 'row',
    title: 'Row, Row, Row Your Boat',
    kind: 'public',
    creditFr: 'Domaine public : chanson traditionnelle américaine (paroles 1852, air de 1881).',
    focusFr: '« r » anglais, rythme rapide de « merrily »',
    bpm: 60,
    meter: 2,
    pickup: 0,
    tonic: 48,
    lines: [
      { lyric: 'Row, row, row your boat,', melody: 'C4/1 C4/1 C4/.6667 D4/.3333 E4/1' },
      { lyric: 'gent-ly down the stream.', melody: 'E4/.6667 D4/.3333 E4/.6667 F4/.3333 G4/2' },
      {
        lyric: 'Mer-ri-ly, mer-ri-ly, mer-ri-ly, mer-ri-ly,',
        melody:
          'C5/.3333 C5/.3333 C5/.3334 G4/.3333 G4/.3333 G4/.3334 E4/.3333 E4/.3333 E4/.3334 C4/.3333 C4/.3333 C4/.3334',
      },
      { lyric: 'life is but a dream.', melody: 'G4/.6667 F4/.3333 E4/.6667 D4/.3333 C4/2' },
    ],
  },
  {
    id: 'grace',
    title: 'Amazing Grace',
    kind: 'public',
    creditFr: 'Domaine public : paroles de John Newton (1779), air « New Britain » (1829).',
    focusFr: 'Chant lent : voyelles longues, « th », « r », fins de mots',
    bpm: 84,
    meter: 3,
    pickup: 1,
    tonic: 43,
    lines: [
      {
        lyric: 'A-ma-zing grace, how sweet the sound,',
        melody: 'D4/1 G4/2 B4/.5~G4/.5 B4/2 A4/1 G4/2 E4/1 D4/2',
      },
      {
        lyric: 'that saved a wretch like me!',
        melody: 'D4/1 G4/2 B4/.5~G4/.5 B4/2 A4/1 D5/3 R/2',
      },
      {
        lyric: 'I once was lost, but now am found,',
        melody: 'B4/1 D5/1.5~B4/.5 D5/.5~B4/.5 G4/2 D4/1 E4/1.5~G4/.5 G4/.5~E4/.5 D4/2',
      },
      {
        lyric: 'was blind, but now I see.',
        melody: 'D4/1 G4/2 B4/.5~G4/.5 B4/2 A4/1 G4/3',
      },
    ],
  },
  {
    id: 'three-thin-things',
    title: 'Three Thin Things',
    kind: 'platform',
    creditFr: 'Paroles et air écrits pour English Buddy.',
    focusFr: 'Le « th » : think, three, this, that, thank',
    bpm: 96,
    meter: 4,
    pickup: 0,
    tonic: 48,
    lines: [
      { lyric: 'I think of three thin things,', melody: 'C4/1 E4/1 G4/1 G4/1 A4/1 G4/2 R/1' },
      { lyric: 'this and that and those.', melody: 'F4/1 F4/1 E4/1 E4/1 D4/2 R/2' },
      {
        lyric: 'Thank you for the thought, my friend,',
        melody: 'C4/1 E4/1 G4/1 G4/1 A4/1 A4/1 G4/2',
      },
      { lyric: 'that is how it goes.', melody: 'F4/1 E4/1 D4/1 D4/1 C4/2 R/2' },
    ],
  },
  {
    id: 'happy-harry',
    title: 'Happy Harry',
    kind: 'platform',
    creditFr: 'Paroles et air écrits pour English Buddy.',
    focusFr: 'Le « h » soufflé : happy, has, hat, hall, hello',
    bpm: 100,
    meter: 4,
    pickup: 0,
    tonic: 48,
    lines: [
      { lyric: 'Hap-py Har-ry has a hat,', melody: 'G4/1 G4/1 E4/1 E4/1 G4/1 G4/1 C5/2' },
      { lyric: 'he hangs it in the hall.', melody: 'A4/1 A4/1 G4/1 E4/1 D4/1 C4/2 R/1' },
      { lyric: 'Hel-lo, hel-lo, how are you?', melody: 'G4/1 G4/1 E4/1 E4/1 G4/1 G4/1 C5/2' },
      { lyric: 'He’s hap-py af-ter all.', melody: 'A4/1 G4/1 F4/1 D4/1 B3/1 C4/2 R/1' },
    ],
  },
  {
    id: 'worked-all-day',
    title: 'I Worked All Day',
    kind: 'platform',
    creditFr: 'Paroles et air écrits pour English Buddy.',
    focusFr: 'La fin en -ed : worked, walked, looked, played, wanted',
    bpm: 96,
    meter: 4,
    pickup: 0,
    tonic: 48,
    lines: [
      { lyric: 'Yes-ter-day I worked all day,', melody: 'C4/1 E4/1 E4/1 G4/1 G4/1 E4/1 D4/2' },
      { lyric: 'then I walked a-long the bay.', melody: 'D4/1 F4/1 F4/1 A4/1 A4/1 F4/1 E4/2' },
      {
        lyric: 'I looked, I laughed, I talked, I played,',
        melody: 'E4/1 G4/1 E4/1 G4/1 F4/1 A4/1 G4/1 E4/1',
      },
      { lyric: 'and I want-ed to stay.', melody: 'D4/1 E4/1 F4/1 D4/1 B3/1 C4/2 R/1' },
    ],
  },
];

export const songById = (id: string): Song | undefined => SONGS.find((s) => s.id === id);

/**
 * Tunes a generated song can be set to: four lines each, original (written
 * for the platform) or public domain. The words are fitted to the notes by
 * `fitGroups`, so a line of 5 to 9 syllables always sings.
 */
export interface Tune {
  id: string;
  labelFr: string;
  bpm: number;
  meter: number;
  tonic: number;
  melodies: string[];
  /** Sung syllables each line carries without fitting. */
  syllables: number[];
}

const tuneFrom = (id: string, labelFr: string, lines = 4): Tune => {
  const s = songById(id)!;
  const melodies = s.lines.slice(0, lines).map((l) => l.melody);
  return {
    id,
    labelFr,
    bpm: s.bpm,
    meter: s.meter,
    tonic: s.tonic,
    melodies,
    syllables: melodies.map((m) => m.split(/\s+/).filter((t) => !t.startsWith('R/')).length),
  };
};

export const TUNES: readonly Tune[] = [
  tuneFrom('three-thin-things', 'air original « Three Thin Things »'),
  tuneFrom('twinkle', 'air de « Twinkle, Twinkle » (domaine public)'),
  tuneFrom('happy-harry', 'air original « Happy Harry »'),
  tuneFrom('worked-all-day', 'air original « I Worked All Day »'),
];
