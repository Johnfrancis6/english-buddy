import { describe, expect, it } from 'vitest';
import {
  barRoots,
  buildTimeline,
  countSyllables,
  fitGroups,
  fitsExactly,
  lineAt,
  midiOf,
  parseLyric,
  parseMelody,
  wordAt,
  type Song,
} from '../src/singing/melody';
import { SONGS, songById, TUNES } from '../src/singing/songs';
import {
  bestLag,
  HOP_SEC,
  loudness,
  onsetScores,
  rhythmOf,
  voicedMask,
  type Due,
} from '../src/singing/timing';
import { heardStarts, scoreSinging, sections, slicePcm } from '../src/singing/score';
import {
  lessonsIn,
  localSong,
  parseSong,
  pickLessons,
  songPrompt,
  STARTER_LESSONS,
  trimLine,
  tuneFor,
} from '../src/singing/compose';
import { learnerLine, mayaLine, vowelOf } from '../src/singing/synth';
import { dancePose, GESTURES, sampleGesture } from '../src/scene/gestures';
import { pronPrompt, SUNG_NOTE } from '../src/pronunciation/gemini';
import type { PronunciationResult, PronunciationScorer } from '../src/pronunciation/types';
import { alignWords, overallOf } from '../src/pronunciation/align';
import type { ReviewCard } from '../src/reviews/cards';

const RATE = 16_000;

/** A take where a 220 Hz "voice" sounds during each given stretch (seconds). */
function take(stretches: readonly Due[], seconds: number): Uint8Array {
  const out = new Uint8Array(Math.round(seconds * RATE) * 2);
  const view = new DataView(out.buffer);
  for (const s of stretches) {
    for (let i = Math.round(s.start * RATE); i < Math.round(s.end * RATE); i++) {
      if (i < 0 || i * 2 + 1 >= out.length) continue;
      view.setInt16(i * 2, Math.round(Math.sin((2 * Math.PI * 220 * i) / RATE) * 9000), true);
    }
  }
  return out;
}

const twinkle = songById('twinkle')!;

describe('songbook', () => {
  it('every built-in line has one note group per sung syllable', () => {
    for (const song of SONGS) {
      for (const line of song.lines) {
        expect(fitsExactly(line), `${song.id}: ${line.lyric}`).toBe(true);
      }
    }
  });

  it('only public-domain or platform songs, each with a credit', () => {
    expect(SONGS.length).toBeGreaterThanOrEqual(6);
    for (const song of SONGS) {
      expect(['public', 'platform']).toContain(song.kind);
      expect(song.creditFr).toMatch(/Domaine public|écrits pour English Buddy/);
    }
    expect(new Set(SONGS.map((s) => s.id)).size).toBe(SONGS.length);
  });

  it('every song is short enough to sing in one go', () => {
    for (const song of SONGS) {
      const t = buildTimeline(song);
      expect(t.endSec, song.id).toBeLessThan(45);
      // Bars are whole: the last line ends on a beat.
      expect(Math.abs(t.endSec - t.countInSec - t.beats.length * t.beatSec)).toBeLessThan(0.02);
    }
  });

  it('tunes for generated songs have four lines and their syllable counts', () => {
    for (const tune of TUNES) {
      expect(tune.melodies).toHaveLength(4);
      expect(tune.syllables.every((n) => n >= 5 && n <= 8)).toBe(true);
    }
    expect(TUNES.find((t) => t.id === 'twinkle')!.syllables).toEqual([7, 7, 7, 7]);
  });
});

describe('melody notation', () => {
  it('reads notes, rests and a syllable over two notes', () => {
    expect(midiOf('C4')).toBe(60);
    expect(midiOf('F#3')).toBe(54);
    expect(midiOf('Bb4')).toBe(70);
    const g = parseMelody('C4/1 R/2 B4/.5~G4/.5');
    expect(g[0]).toEqual({ rest: false, notes: [{ midi: 60, beats: 1 }] });
    expect(g[1]).toEqual({ rest: true, beats: 2 });
    expect(g[2]).toEqual({
      rest: false,
      notes: [
        { midi: 71, beats: 0.5 },
        { midi: 67, beats: 0.5 },
      ],
    });
    expect(() => parseMelody('H4/1')).toThrow();
  });

  it('counts sung syllables from spelling and from marks', () => {
    const cases: [string, number][] = [
      ['star', 1],
      ['little', 2],
      ['worked', 1],
      ['wanted', 2],
      ['yesterday', 3],
      ['make', 1],
      ['weather', 2],
      ['the', 1],
      ['I', 1],
    ];
    for (const [w, n] of cases) expect(countSyllables(w), w).toBe(n);
    expect(parseLyric('Twin-kle, twin-kle, lit-tle star,').map((w) => w.syllables)).toEqual([
      2, 2, 2, 1,
    ]);
    expect(parseLyric('a b', [3, 1]).map((w) => w.syllables)).toEqual([3, 1]);
    expect(parseLyric('Twin-kle star')[0].text).toBe('Twinkle');
  });

  it('fits a tune to more or fewer syllables without changing its length', () => {
    const tune = parseMelody('C4/1 C4/1 G4/1 G4/1 A4/1 A4/1 G4/2');
    const beats = (gs: ReturnType<typeof parseMelody>) =>
      gs.reduce((n, g) => n + (g.rest ? g.beats : g.notes.reduce((a, x) => a + x.beats, 0)), 0);
    for (const n of [4, 5, 6, 7, 8, 9, 10]) {
      const fitted = fitGroups(tune, n);
      expect(fitted.filter((g) => !g.rest)).toHaveLength(n);
      expect(beats(fitted)).toBeCloseTo(8);
    }
    // 8 syllables: the long last note is split in two.
    const eight = fitGroups(tune, 8).filter((g) => !g.rest);
    expect(eight.at(-1)).toEqual({ rest: false, notes: [{ midi: 67, beats: 1 }] });
  });
});

describe('timeline', () => {
  it('puts each word of Twinkle on the clock', () => {
    const t = buildTimeline(twinkle);
    const beat = 60 / twinkle.bpm;
    expect(t.countInBeats).toBe(4);
    expect(t.countInSec).toBeCloseTo(4 * beat);
    const [w0, w1, w2, w3] = t.lines[0].words;
    expect(w0.text).toBe('Twinkle,');
    expect(w0.start).toBeCloseTo(t.countInSec);
    expect(w0.end - w0.start).toBeCloseTo(2 * beat);
    expect(w1.start).toBeCloseTo(t.countInSec + 2 * beat);
    expect(w2.syllables).toHaveLength(2);
    expect(w3.text).toBe('star,');
    expect(w3.end - w3.start).toBeCloseTo(2 * beat);
    expect(t.lines[1].start).toBeCloseTo(t.countInSec + 8 * beat);
    expect(t.lines.map((l) => l.text)[1]).toBe('how I wonder what you are!');
    expect(wordAt(t, w1.start + 0.01)?.text).toBe('twinkle,');
    expect(wordAt(t, 0.1)).toBeNull();
    expect(lineAt(t, t.lines[2].start + 0.2)).toBe(2);
    // A slower tempo stretches everything.
    expect(buildTimeline(twinkle, 0.8).endSec).toBeCloseTo(t.endSec / 0.8);
  });

  it('counts in so that a pickup lands before the first bar', () => {
    const grace = songById('grace')!;
    const t = buildTimeline(grace);
    expect(t.countInBeats).toBe(5); // one bar of three, plus two beats before the pickup
    expect(t.beats[0].bar).toBe(false);
    expect(t.beats[1].bar).toBe(true);
    expect(t.beats[4].bar).toBe(true);
    // "amazing" is three syllables, the last one over two notes.
    const amazing = t.lines[0].words[0];
    expect(amazing.syllables.map((s) => s.length)).toEqual([1, 1, 2]);
  });

  it('harmonises each bar with the tonic, the fourth or the fifth', () => {
    const t = buildTimeline(twinkle);
    const roots = barRoots(twinkle, t).map((r) => r.root - twinkle.tonic);
    expect(roots).toHaveLength(12);
    expect(roots[0]).toBe(0); // C C G G → C major
    expect(roots[1]).toBe(5); // A A G → F major (A, C) beats C major (G)
    expect(roots.every((r) => [0, 5, 7].includes(r))).toBe(true);
  });

  it('fits generated words on a tune whatever their length', () => {
    const song: Song = {
      ...twinkle,
      id: 'gen',
      kind: 'generated',
      lines: [
        { lyric: 'I have lived here for two years now', melody: twinkle.lines[0].melody },
        { lyric: 'It depends', melody: twinkle.lines[1].melody },
      ],
    };
    const t = buildTimeline(song);
    expect(t.lines[0].words).toHaveLength(8);
    expect(t.lines[1].words).toHaveLength(2);
    expect(t.lines[1].end - t.lines[1].start).toBeCloseTo((8 * 60) / twinkle.bpm);
    for (const l of t.lines) {
      for (let i = 1; i < l.words.length; i++) {
        expect(l.words[i].start).toBeGreaterThanOrEqual(l.words[i - 1].end - 1e-9);
      }
    }
  });
});

describe('rhythm measured from the voice', () => {
  const t = buildTimeline(twinkle);
  const due: Due[] = t.lines[0].words.map((w) => ({ start: w.start, end: w.end }));
  const seconds = t.lines[0].end + 1;
  const sung = (shift: number, skip = -1, late = -1): Due[] =>
    due
      .map((w, i) => ({
        start: w.start + shift + (i === late ? 0.45 : 0),
        end: w.start + shift + (w.end - w.start) * 0.85,
      }))
      .filter((_, i) => i !== skip);
  const measure = (pcm: Uint8Array) => {
    const { mask } = voicedMask(loudness(pcm, RATE));
    const lag = bestLag(mask, due);
    return { lag, words: rhythmOf(mask, due, lag) };
  };

  it('gives full marks when the voice is on the beat', () => {
    const { lag, words } = measure(take(sung(0), seconds));
    expect(Math.abs(lag)).toBeLessThanOrEqual(0.03);
    expect(words.every((w) => w.score >= 95)).toBe(true);
    expect(words[0].offsetMs).not.toBeNull();
    expect(Math.abs(words[0].offsetMs!)).toBeLessThanOrEqual(40);
  });

  it('removes one constant delay (headset, or a steady lag)', () => {
    const { lag, words } = measure(take(sung(0.22), seconds));
    expect(lag).toBeGreaterThan(0.17);
    expect(lag).toBeLessThan(0.27);
    expect(words.every((w) => w.score >= 90)).toBe(true);
  });

  it('gives nothing to a word that was not sung', () => {
    const { words } = measure(take(sung(0, 2), seconds));
    expect(words[2].score).toBe(0);
    expect(words[0].score).toBeGreaterThanOrEqual(90);
    expect(words[3].score).toBeGreaterThanOrEqual(90);
  });

  it('lowers a word that starts late', () => {
    const { words } = measure(take(sung(0, -1, 3), seconds));
    expect(words[3].score).toBeLessThan(75);
    expect(words[1].score).toBeGreaterThanOrEqual(90);
  });

  it('a silent take scores zero everywhere', () => {
    const { words } = measure(take([], seconds));
    expect(words.every((w) => w.score === 0)).toBe(true);
  });

  it('loudness uses 10 ms steps', () => {
    const env = loudness(take([{ start: 0.5, end: 1 }], 2), RATE);
    expect(env).toHaveLength(Math.floor(2 / HOP_SEC));
    expect(env[10]).toBe(0);
    expect(env[70]).toBeGreaterThan(0.1);
  });

  it('scores word starts given by a recogniser, around their median delay', () => {
    const starts = due.map((w, i) => (i === 1 ? null : w.start + 0.2 + (i === 3 ? 0.5 : 0)));
    const { scores, lag } = onsetScores(due, starts);
    expect(lag).toBeCloseTo(0.2, 1);
    expect(scores[0]).toBe(100);
    expect(scores[1]).toBeNull();
    expect(scores[3]).toBeLessThan(50);
  });
});

/** A scorer that gives 40 to words with "th" or "wh", 90 to the others. */
const fakeScorer = (seen: { reference: string; sung?: boolean; bytes: number }[] = []) =>
  ({
    id: 'fake',
    label: 'fake',
    score: async ({ wav, reference, sung }) => {
      seen.push({ reference, sung, bytes: wav.length });
      const words = alignWords(
        reference,
        (reference.match(/[A-Za-z']+/g) ?? []).map((w) => ({
          word: w,
          score: /th|wh/i.test(w) ? 40 : 90,
          issues: /th/i.test(w) ? ['th'] : [],
        })),
      );
      return {
        scorer: 'gemini',
        model: 'fake-model',
        overall: overallOf(words),
        words,
        feedbackFr: 'Bien chanté.',
        heardText: reference,
      } satisfies PronunciationResult;
    },
  }) satisfies PronunciationScorer;

describe('score of a sung take', () => {
  const t = buildTimeline(twinkle);
  const everyWord = t.lines.flatMap((l) => l.words);
  const lead = 0.3;
  const pcm = take(
    everyWord.map((w) => ({
      start: w.start + lead,
      end: w.start + lead + (w.end - w.start) * 0.85,
    })),
    t.endSec + lead + 1,
  );

  it('joins pronunciation and rhythm per word, in sections short enough for a scorer', async () => {
    const seen: { reference: string; sung?: boolean; bytes: number }[] = [];
    const r = await scoreSinging({
      pcm,
      rate: RATE,
      lines: t.lines,
      takeStartSec: -lead,
      scorer: fakeScorer(seen),
    });
    expect(sections(t.lines).map((s) => s.length)).toEqual([4, 2]);
    expect(seen).toHaveLength(2);
    expect(seen[0].sung).toBe(true);
    expect(seen[0].reference).toContain('Twinkle, twinkle, little star, how I wonder');
    expect(seen[1].reference).toBe('Twinkle, twinkle, little star, how I wonder what you are!');
    // Each request carries only its section (under 30 s of 16 kHz audio).
    expect(Math.max(...seen.map((s) => s.bytes))).toBeLessThan(30 * RATE * 2);
    expect(r.words).toHaveLength(everyWord.length);
    expect(r.rhythm).toBeGreaterThanOrEqual(90);
    const the = r.words.find((w) => w.word === 'the')!;
    expect(the.pron).toBe(40);
    expect(the.issues).toEqual(['th']);
    expect(r.words[0].pron).toBe(90);
    expect(r.pron).toBeLessThan(90);
    expect(r.overall).toBe(Math.round(r.pron! * 0.6 + r.rhythm * 0.4));
    expect(r.timing).toBe('voice');
    expect(r.scorer).toBe('gemini');
    expect(r.feedbackFr).toBe('Bien chanté.');
  });

  it('scores the rhythm alone without a key', async () => {
    const r = await scoreSinging({
      pcm,
      rate: RATE,
      lines: t.lines,
      takeStartSec: -lead,
      scorer: null,
    });
    expect(r.pron).toBeNull();
    expect(r.scorer).toBeNull();
    expect(r.overall).toBe(r.rhythm);
    expect(r.words.every((w) => w.pron === null)).toBe(true);
  });

  it('keeps the rhythm when the pronunciation service fails', async () => {
    const r = await scoreSinging({
      pcm,
      rate: RATE,
      lines: t.lines.slice(0, 2),
      takeStartSec: -lead,
      scorer: {
        id: 'x',
        label: 'x',
        score: () => Promise.reject(new Error('quota')),
      },
    });
    expect(r.pron).toBeNull();
    expect(r.pronError).toBe('quota');
    expect(r.rhythm).toBeGreaterThanOrEqual(90);
  });

  it('uses Whisper word times when they are given', async () => {
    const lines = t.lines.slice(0, 1);
    const from = Math.max(0, lines[0].words[0].start + lead - 0.4);
    const r = await scoreSinging({
      pcm,
      rate: RATE,
      lines,
      takeStartSec: -lead,
      scorer: null,
      whisper: async () => ({
        text: 'twinkle twinkle little star',
        // Times are relative to the slice sent; "star" is heard 0.6 s late.
        words: lines[0].words.map((w, i) => ({
          word: w.text.replace(',', ''),
          start: w.start + lead - from + (i === 3 ? 0.6 : 0),
          end: w.end + lead - from,
        })),
      }),
    });
    expect(r.timing).toBe('voice+whisper');
    expect(r.words[0].rhythm).toBeGreaterThanOrEqual(95);
    expect(r.words[3].rhythm).toBeLessThan(80);
    expect(r.heardText).toContain('twinkle');
  });

  it('finds lyric words in what a recogniser heard, in order', () => {
    const heard = [
      { word: 'Twinkle', start: 0.5, end: 1 },
      { word: 'little', start: 2, end: 2.5 },
      { word: 'star', start: 3, end: 3.5 },
    ];
    expect(heardStarts(['Twinkle', 'twinkle', 'little', 'star'], heard)).toEqual([0.5, null, 2, 3]);
  });

  it('cuts PCM on sample boundaries', () => {
    const part = slicePcm(pcm, RATE, 1, 2);
    expect(part.length).toBe(RATE * 2);
    expect(slicePcm(pcm, RATE, -1, 0.5).length).toBe(RATE);
  });
});

const card = (over: Partial<ReviewCard>): ReviewCard => ({
  id: over.id ?? `c-${Math.random()}`,
  kind: 'mistake',
  front: 'I am agree',
  back: 'I agree with you.',
  note: '',
  talkId: 't',
  createdAt: 1000,
  fsrs: { dueAt: 0, lastReviewAt: null, reps: 0, lapses: 0, scheduledDays: 0 },
  history: [],
  ...over,
});

describe('songs written from the learner’s difficulties', () => {
  const NOW = 20_000 * 86_400_000;
  const cards: ReviewCard[] = [
    card({ id: 'a', back: 'I agree with you.', createdAt: 1 }),
    card({
      id: 'b',
      front: 'I have 30 years',
      back: 'I am thirty years old',
      createdAt: 2,
      history: [
        { at: 5, grade: 'again', via: 'self' },
        { at: 6, grade: 'again', via: 'talk' },
      ],
    }),
    card({ id: 'c', back: 'It depends on the weather', createdAt: 3 }),
    card({ id: 'd', back: 'She has been working here since 2019 and she likes it', createdAt: 9 }),
    card({ id: 'e', back: 'gone', suspended: true, createdAt: 10 }),
    card({ id: 'w1', kind: 'word', front: 'un rabais', back: 'a discount', createdAt: 4 }),
    card({
      id: 'w2',
      kind: 'word',
      front: 'se rendre compte',
      back: 'to realise',
      createdAt: NOW - 3_600_000,
    }),
    card({ id: 's', kind: 'sound', front: 'think', back: 'th', createdAt: 5 }),
  ];

  it('picks the most failed mistakes and the words of the day', () => {
    const lessons = pickLessons(cards, NOW);
    expect(lessons.map((l) => l.text)).toEqual([
      'I am thirty years old',
      'It depends on the weather',
      'I agree with you',
      'to realise',
      'a discount',
    ]);
    expect(lessons[0].hintFr).toBe('« I have 30 years »');
    expect(pickLessons([], NOW)).toEqual([]);
  });

  it('builds a singable verse without any model', () => {
    const tune = tuneFor(NOW);
    const song = localSong(pickLessons(cards, NOW), tune, NOW);
    expect(song.kind).toBe('generated');
    expect(song.lines).toHaveLength(4);
    expect(song.lines[0].lyric).toBe('I am thirty years old,');
    expect(song.lines[2].lyric).toBe('It depends on the weather,');
    expect(song.creditFr).toContain('assemblées');
    const t = buildTimeline(song);
    expect(t.lines.every((l) => l.words.length >= 3)).toBe(true);
    expect(lessonsIn(song, pickLessons(cards, NOW)).map((l) => l.text)).toEqual([
      'I am thirty years old',
      'It depends on the weather',
    ]);
    // A newcomer gets the classic mistakes of French speakers.
    expect(localSong([], tune, NOW).lines[0].lyric).toBe(`${STARTER_LESSONS[0].text},`);
    expect(trimLine('She has been working here since two thousand nineteen', 8)).toBe(
      'She has been working here since two',
    );
  });

  it('tells the model the syllables per line and the lessons, as data', () => {
    const tune = TUNES[0];
    const prompt = songPrompt(pickLessons(cards, NOW), tune);
    expect(prompt).toContain(`Sung syllables per line: ${tune.syllables.join(', ')}`);
    expect(prompt).toContain('- I am thirty years old');
    expect(prompt).toContain('- to realise');
  });

  it('reads the model’s verse and refuses what cannot be sung', () => {
    const tune = TUNES[0];
    const line = (...ws: [string, number][]) => ({ words: ws.map(([w, syl]) => ({ w, syl })) });
    const good = JSON.stringify({
      title: 'Thirty Years Old',
      lines: [
        line(['I', 1], ['am', 1], ['thirty', 2], ['years', 1], ['old,', 1]),
        line(['a', 1], ['discount', 2], ['makes', 1], ['me', 1], ['bold.', 1]),
        line(['It', 1], ['depends', 2], ['on', 1], ['the', 1], ['weather,', 9]),
        line(['we', 1], ['realise', 3], ['it', 1], ['together.', 3]),
      ],
    });
    const song = parseSong(good, tune, pickLessons(cards, NOW), NOW)!;
    expect(song.title).toBe('Thirty Years Old');
    expect(song.lines.map((l) => l.lyric)[0]).toBe('I am thirty years old,');
    // An absurd count from the model is replaced by the spelling-based one.
    expect(song.lines[2].syllables).toEqual([1, 2, 1, 1, 2]);
    expect(song.creditFr).toContain('Gemini');
    expect(buildTimeline(song).lines).toHaveLength(4);
    expect(parseSong('not json', tune, [], NOW)).toBeNull();
    expect(parseSong(JSON.stringify({ title: 'x', lines: [line(['a', 1])] }), tune, [], NOW)).toBe(
      null,
    );
    const odd = JSON.parse(good);
    odd.lines[1].words[0].w = '<script>';
    expect(parseSong(JSON.stringify(odd), tune, [], NOW)).toBeNull();
  });
});

describe('Maya keeps the beat', () => {
  it('hums the right lines in each way of singing', () => {
    expect([0, 1, 2, 3].map((i) => mayaLine('turns', i))).toEqual([true, false, true, false]);
    expect([0, 1, 2, 3].map((i) => learnerLine('turns', i))).toEqual([false, true, false, true]);
    expect(mayaLine('alone', 0)).toBe(false);
    expect(learnerLine('listen', 0)).toBe(false);
    expect(mayaLine('with', 1) && learnerLine('with', 1)).toBe(true);
    expect(vowelOf('star', 0)).toBe('a');
    expect(vowelOf('little', 0)).toBe('i');
    expect(vowelOf('you', 0)).toBe('u');
  });

  it('sways with the beat and stands still at weight zero', () => {
    const still = dancePose(1.3, 0);
    for (const e of Object.values(still.pose)) {
      expect(e!.every((x) => Math.abs(x) < 1e-9)).toBe(true);
    }
    expect(still.bob).toBeCloseTo(0);
    const a = dancePose(0.5, 1).pose.hips![2];
    const b = dancePose(1.5, 1).pose.hips![2];
    expect(a).toBeCloseTo(-b);
    // Sober: no joint moves more than about 55 degrees.
    for (const beat of [0, 0.25, 0.5, 1, 1.5]) {
      for (const e of Object.values(dancePose(beat, 1).pose)) {
        expect(Math.max(...e!.map(Math.abs))).toBeLessThan(1);
      }
    }
  });

  it('claps with both hands at the end of a song', () => {
    expect(GESTURES).toContain('clap');
    const f = sampleGesture('clap', 1, 1);
    expect(f.weight).toBe(1);
    expect(f.abs.leftLowerArm).toBeDefined();
    expect(f.abs.rightLowerArm).toBeDefined();
    expect(f.expressions.happy).toBeGreaterThan(0.5);
  });
});

describe('pronunciation scorer told about singing', () => {
  it('adds the singing note only for sung takes', () => {
    expect(pronPrompt('Twinkle, twinkle', true)).toContain(SUNG_NOTE);
    expect(pronPrompt('Twinkle, twinkle', true)).toContain('Target lyrics (sung by the speaker)');
    expect(pronPrompt('Twinkle, twinkle')).not.toContain('SINGING');
    expect(pronPrompt('Twinkle, twinkle')).toContain('Target sentence (read aloud by the speaker)');
  });
});
