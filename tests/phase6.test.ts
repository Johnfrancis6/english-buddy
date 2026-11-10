import { describe, expect, it } from 'vitest';
import { alignWords, overallOf } from '../src/pronunciation/align';
import { assessmentHeader, azureUrl, parseAzure } from '../src/pronunciation/azure';
import { CARD_BELOW, gradeFromScore, pronUpdates, soundDrafts } from '../src/pronunciation/cards';
import { makeScorer } from '../src/pronunciation/factory';
import { parsePronJson, PRON_SCHEMA, pronPrompt } from '../src/pronunciation/gemini';
import { pronProgress, soundLevels, type PronAttempt } from '../src/pronunciation/progress';
import { TakeTracker } from '../src/pronunciation/recorder';
import { BANK, buildExercises, SESSION_SIZE, soundOrder } from '../src/pronunciation/sentences';
import {
  edSound,
  sentenceSounds,
  soundsOf,
  syllables,
  tokenize,
} from '../src/pronunciation/sounds';
import { SOUND_IDS, type PronunciationResult } from '../src/pronunciation/types';
import { applyRecognition, recognisedMask } from '../src/pronunciation/whisperCheck';
import { cardId, type ReviewCard } from '../src/reviews/cards';
import { newFsrs } from '../src/reviews/fsrs';
import { DEFAULTS, loadSettings, saveSettings } from '../src/settings';

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 12, 18, 0, 0).getTime();

const memStore = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => m.set(k, v),
  };
};

describe('hard sounds for French speakers', () => {
  it('tags words by spelling', () => {
    expect(soundsOf('think')).toContain('th');
    expect(soundsOf('this')).toEqual(expect.arrayContaining(['th', 'vowels']));
    expect(soundsOf('happy')).toContain('h');
    expect(soundsOf('hour')).not.toContain('h');
    expect(soundsOf('who')).toContain('h');
    expect(soundsOf('right')).toContain('r');
    expect(soundsOf('car')).not.toContain('r'); // not said in British English
    expect(soundsOf('sheep')).toContain('vowels');
    expect(soundsOf('worked')).toContain('ed');
    expect(soundsOf('need')).not.toContain('ed');
    expect(soundsOf('photography')).toContain('stress');
    expect(soundsOf('hotel')).toContain('stress');
    expect(soundsOf('cat')).toEqual([]);
  });

  it('knows how -ed sounds', () => {
    expect(edSound('wanted')).toBe('id');
    expect(edSound('decided')).toBe('id');
    expect(edSound('worked')).toBe('t');
    expect(edSound('watched')).toBe('t');
    expect(edSound('laughed')).toBe('t');
    expect(edSound('played')).toBe('d');
    expect(edSound('used')).toBe('d');
    expect(edSound('bed')).toBeNull();
  });

  it('counts syllables roughly and splits sentences', () => {
    expect(syllables('comfortable')).toBeGreaterThanOrEqual(3);
    expect(syllables('make')).toBe(1);
    expect(tokenize('I’d like that, isn’t it?')).toEqual(['I’d', 'like', 'that', 'isn’t', 'it']);
  });

  it('every bank sentence trains its own sound', () => {
    for (const s of SOUND_IDS) {
      expect(BANK[s].length).toBeGreaterThanOrEqual(4);
      for (const text of BANK[s]) expect(sentenceSounds(text)).toContain(s);
    }
  });
});

async function card(over: Partial<ReviewCard> & { id: string; kind: ReviewCard['kind'] }) {
  return {
    front: 'x',
    back: 'y',
    note: '',
    talkId: 't1',
    createdAt: NOW - 5 * DAY,
    fsrs: await newFsrs(NOW - DAY),
    history: [],
    ...over,
  } as ReviewCard;
}

describe('exercise sentences', () => {
  it('puts all six sounds first for a new learner', () => {
    expect(soundOrder({})).toEqual([...SOUND_IDS]);
    expect(soundOrder({ th: 40, h: 90, r: 70, vowels: 80, ed: 60, stress: 50 })[0]).toBe('th');
  });

  it('starts with due sound cards, then the learner’s own sentences, then the bank', async () => {
    const cards = [
      await card({
        id: cardId('sound', 'three'),
        kind: 'sound',
        front: 'three',
        note: 'I have three brothers and two sisters.',
      }),
      await card({
        id: cardId('mistake', 'Yesterday I went to the theatre with my brother'),
        kind: 'mistake',
        front: 'Yesterday I go to the theatre',
        back: 'Yesterday I went to the theatre with my brother.',
      }),
      await card({
        id: cardId('word', 'to look forward to'),
        kind: 'word',
        front: 'avoir hâte',
        back: 'to look forward to',
        note: 'I really look forward to hearing from her.',
      }),
    ];
    const ex = buildExercises(cards, {}, NOW);
    expect(ex).toHaveLength(SESSION_SIZE);
    expect(ex[0]).toMatchObject({ source: 'card', focusWord: 'three', cardId: 'sound:three' });
    expect(
      ex
        .slice(1, 3)
        .map((e) => e.source)
        .sort(),
    ).toEqual(['mistake', 'word']);
    expect(ex.slice(3).every((e) => e.source === 'bank')).toBe(true);
    expect(new Set(ex.map((e) => e.text)).size).toBe(ex.length);
  });

  it('a new learner without cards gets five bank sentences on five different sounds', () => {
    const ex = buildExercises([], {}, NOW);
    expect(ex).toHaveLength(5);
    expect(ex.map((e) => e.id.split(':')[1])).toEqual(['th', 'h', 'r', 'vowels', 'ed']);
  });
});

describe('scorers: Gemini JSON, alignment, Whisper check, Azure', () => {
  const ref = 'I think this is three.';

  it('asks for one entry per word with the six sounds in an enum', () => {
    const issues = PRON_SCHEMA.properties.words.items.properties.issues.items.enum;
    expect(issues).toEqual([...SOUND_IDS, 'other']);
    expect(pronPrompt(ref)).toContain('I | think | this | is | three');
    expect(pronPrompt(ref)).toContain('think (th)');
  });

  it('parses Gemini’s answer and matches words even if one is skipped', () => {
    const r = parsePronJson(
      JSON.stringify({
        audio_ok: true,
        heard: 'I sink this is tree',
        words: [
          { word: 'I', score: 95, missing: false, issues: [] },
          {
            word: 'think',
            score: 45,
            missing: false,
            issues: ['th', 'bogus'],
            heard_as: 'sink',
            tip_fr: 'Langue entre les dents.',
          },
          { word: 'is', score: 90, missing: false, issues: [] },
          { word: 'three', score: 150, missing: false, issues: ['th', 'r'] },
        ],
        feedback_fr: 'Bien lu !',
      }),
      ref,
      'gemini-3.8-flash',
    );
    expect(r.words.map((w) => w.word)).toEqual(['I', 'think', 'this', 'is', 'three']);
    expect(r.words[1]).toMatchObject({ score: 45, issues: ['th'], heard: 'sink' });
    expect(r.words[4].score).toBe(100); // clamped
    // "this" was skipped: it gets the mean of the others and no issue
    expect(r.words[2].issues).toEqual([]);
    expect(r.overall).toBe(overallOf(r.words));
    expect(r.unreliable).toBeUndefined();
  });

  it('marks unreliable audio and rejects bad JSON', () => {
    const r = parsePronJson(
      JSON.stringify({ audio_ok: false, heard: '', words: [], feedback_fr: '' }),
      ref,
      'm',
    );
    expect(r.unreliable).toBe(true);
    expect(() => parsePronJson('not json', ref, 'm')).toThrow();
    expect(() => parsePronJson('{"audio_ok":true}', ref, 'm')).toThrow();
  });

  it('aligns words with the longest common subsequence for Whisper', () => {
    expect(
      recognisedMask(['I', 'think', 'this', 'is', 'three'], ['I', 'sink', 'this', 'is', 'tree']),
    ).toEqual([true, false, true, true, false]);
    const base = alignWords(ref, [
      { word: 'I', score: 95 },
      { word: 'think', score: 80 },
      { word: 'this', score: 90 },
      { word: 'is', score: 90 },
      { word: 'three', score: 85 },
    ]);
    const r: PronunciationResult = {
      scorer: 'gemini',
      model: 'm',
      overall: overallOf(base),
      words: base,
    };
    const checked = applyRecognition(r, 'I sink this is three');
    expect(checked.words[1]).toMatchObject({ notRecognised: true, score: 55 });
    expect(checked.words[4].notRecognised).toBeUndefined();
    expect(checked.overall).toBeLessThan(r.overall);
  });

  it('builds the Azure header and reads phoneme scores', () => {
    const h = assessmentHeader('Good morning.');
    expect(JSON.parse(atob(h))).toMatchObject({
      ReferenceText: 'Good morning.',
      GradingSystem: 'HundredMark',
      Granularity: 'Phoneme',
      EnableMiscue: 'True',
    });
    expect(azureUrl('WestEurope')).toBe(
      'https://westeurope.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed',
    );
    const r = parseAzure(
      {
        RecognitionStatus: 'Success',
        NBest: [
          {
            Display: 'I sink this is three.',
            Words: [
              {
                Word: 'i',
                AccuracyScore: 98,
                ErrorType: 'None',
                Phonemes: [{ Phoneme: 'ay', AccuracyScore: 98 }],
              },
              {
                Word: 'think',
                AccuracyScore: 40,
                ErrorType: 'Mispronunciation',
                Phonemes: [
                  { Phoneme: 'th', AccuracyScore: 10 },
                  { Phoneme: 'ih', AccuracyScore: 90 },
                  { Phoneme: 'ng', AccuracyScore: 90 },
                  { Phoneme: 'k', AccuracyScore: 90 },
                ],
              },
              { Word: 'um', AccuracyScore: 0, ErrorType: 'Insertion' },
              { Word: 'this', AccuracyScore: 90, ErrorType: 'None' },
              { Word: 'is', AccuracyScore: 92, ErrorType: 'None' },
              { Word: 'three', AccuracyScore: 0, ErrorType: 'Omission' },
            ],
          },
        ],
      },
      ref,
    );
    expect(r.scorer).toBe('azure');
    expect(r.words[1]).toMatchObject({ word: 'think', score: 40, issues: ['th'] });
    expect(r.words[4]).toMatchObject({ word: 'three', score: 0, missing: true });
    expect(parseAzure({ RecognitionStatus: 'NoMatch' }, ref).unreliable).toBe(true);
  });

  it('chooses Azure, then Gemini (+ Groq), then nothing', () => {
    const base = { ...DEFAULTS };
    expect(makeScorer(base)).toBeNull();
    expect(makeScorer({ ...base, apiKey: 'k' })?.id).toBe('gemini');
    expect(makeScorer({ ...base, apiKey: 'k', groqKey: 'g' })?.id).toBe('gemini+groq');
    expect(makeScorer({ ...base, apiKey: 'k', azureKey: 'a' })?.id).toBe('azure');
  });

  it('keeps the Azure key and region in the settings, trimmed', () => {
    const store = memStore();
    saveSettings({ ...DEFAULTS, azureKey: '  az1  ', azureRegion: 'francecentral' }, store);
    expect(loadSettings(store)).toMatchObject({ azureKey: 'az1', azureRegion: 'francecentral' });
    store.setItem('english-buddy.settings.v1', JSON.stringify({ azureRegion: 'evil.com/x' }));
    expect(loadSettings(store).azureRegion).toBe('westeurope');
  });
});

const attempt = (
  over: Partial<PronAttempt> & { words: [string, number, string[]?][] },
): PronAttempt => {
  const words = over.words.map(([word, score, issues = []]) => ({
    word,
    score,
    sounds: [...new Set([...soundsOf(word), ...(issues as never[])])],
    issues: issues as never[],
  }));
  return {
    id: over.id ?? 'a1',
    at: over.at ?? NOW,
    sentence: over.sentence ?? over.words.map((w) => w[0]).join(' '),
    source: 'bank',
    result: {
      scorer: 'gemini',
      model: 'm',
      overall: overallOf(words),
      words,
      ...(over.result ?? {}),
    },
  };
};

describe('FSRS sound cards', () => {
  it('maps a score to a grade', () => {
    expect(gradeFromScore(95)).toBe('easy');
    expect(gradeFromScore(75)).toBe('good');
    expect(gradeFromScore(58)).toBe('hard');
    expect(gradeFromScore(30)).toBe('again');
  });

  it('turns badly said hard words into cards (at most 3, worst first)', () => {
    const a = attempt({
      words: [
        ['I', 95],
        ['think', 30, ['th']],
        ['three', 50, ['th']],
        ['cat', 20],
        ['hotel', 55],
        ['worked', 40, ['ed']],
      ],
    });
    const d = soundDrafts(a);
    expect(d.map((x) => x.front)).toEqual(['think', 'worked', 'three']);
    expect(d[0]).toMatchObject({
      kind: 'sound',
      id: 'sound:think',
      note: a.sentence,
      talkId: 'a1',
    });
    expect(d[0].back).toContain('« th »');
    expect(CARD_BELOW).toBe(60);
    expect(soundDrafts({ ...a, result: { ...a.result, unreliable: true } })).toEqual([]);
  });

  it('grades due cards from the score, once per attempt; a bad word not due goes back to again', async () => {
    const due = await card({ id: 'sound:think', kind: 'sound', fsrs: await newFsrs(NOW - DAY) });
    const later = await card({
      id: 'sound:three',
      kind: 'sound',
      fsrs: await newFsrs(NOW + 3 * DAY),
    });
    const fine = await card({
      id: 'sound:house',
      kind: 'sound',
      fsrs: await newFsrs(NOW + 3 * DAY),
    });
    const a = attempt({
      id: 'a2',
      words: [
        ['think', 82],
        ['three', 30],
        ['house', 90],
      ],
    });
    const u = pronUpdates([due, later, fine], a, NOW);
    expect(u).toEqual([
      { id: 'sound:think', grade: 'good', via: 'pron' },
      { id: 'sound:three', grade: 'again', via: 'repeat' },
    ]);
    const done = {
      ...due,
      history: [{ at: NOW, grade: 'good' as const, via: 'pron' as const, talkId: 'a2' }],
    };
    expect(pronUpdates([done], a, NOW)).toEqual([]);
  });
});

describe('pronunciation progress', () => {
  it('averages the last attempts and ranks sounds, weakest first', () => {
    const attempts = [
      attempt({
        id: 'x',
        at: NOW - DAY,
        words: [
          ['think', 40, ['th']],
          ['happy', 90],
        ],
      }),
      attempt({
        id: 'y',
        at: NOW,
        words: [
          ['three', 60, ['th']],
          ['house', 80],
        ],
      }),
      attempt({ id: 'old', at: NOW - 40 * DAY, words: [['right', 10]] }),
      attempt({ id: 'bad', at: NOW, words: [['the', 0]], result: { unreliable: true } as never }),
    ];
    const p = pronProgress(attempts, NOW);
    expect(p.total).toBe(3);
    expect(p.score).toBe(Math.round((65 + 70 + 10) / 3));
    expect(p.sounds[0].sound).toBe('th');
    expect(p.sounds[0]).toMatchObject({
      mean: 50,
      words: 2,
      issues: 2,
      examples: ['three', 'think'],
    });
    // the 40-day-old "right" is out of the 30-day sound window
    expect(p.sounds.find((s) => s.sound === 'r')?.words ?? 0).toBe(1);
    expect(soundLevels(p).th).toBe(50);
    expect(pronProgress([], NOW).score).toBeNull();
  });
});

describe('recording a take', () => {
  it('stops after speech then silence; gives up on silence', () => {
    const t = new TakeTracker({ endSilenceMs: 300, minVoicedMs: 100, noSpeechMs: 1000 });
    expect(t.push(0.001, 100)).toBe('waiting');
    expect(t.push(0.1, 100)).toBe('speaking');
    expect(t.push(0.001, 200)).toBe('speaking');
    expect(t.push(0.001, 100)).toBe('done');
    const s = new TakeTracker({ noSpeechMs: 300 });
    s.push(0, 200);
    expect(s.push(0, 200)).toBe('silent');
    const m = new TakeTracker({ maxMs: 200, minVoicedMs: 100 });
    m.push(0.2, 100);
    expect(m.push(0.2, 100)).toBe('done');
  });
});

describe('sound figures', () => {
  it('a word failed on "th" does not pull its "r" down', () => {
    const p = pronProgress([attempt({ words: [['theatre', 40, ['th']]] })], NOW);
    expect(p.sounds.find((s) => s.sound === 'th')?.mean).toBe(40);
    expect(p.sounds.find((s) => s.sound === 'r')?.mean).toBe(85);
  });
});
