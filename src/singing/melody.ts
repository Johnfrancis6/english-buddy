/**
 * Songs as data (phase 7). A song is a list of lines; each line has its
 * lyric and its melody in a small text notation. One clock (beats → seconds)
 * drives everything: the accompaniment, the highlighted word, Maya's moves
 * and the time at which each word is expected from the learner.
 *
 * Melody notation, one token per sung syllable, separated by spaces:
 *   `C4/1`        a note (name, octave) held for 1 beat
 *   `B4/.5~G4/.5` one syllable sung over two notes
 *   `R/1`         a rest of 1 beat
 * Lyric notation: words separated by spaces, syllables by `-`
 * (`Twin-kle twin-kle lit-tle star`). Punctuation stays on the word.
 */
export type SongKind = 'public' | 'platform' | 'generated';

export interface SongLineSpec {
  lyric: string;
  melody: string;
  /** Sung syllables per word, when the lyric has no `-` marks (generated songs). */
  syllables?: number[];
}

export interface Song {
  id: string;
  title: string;
  kind: SongKind;
  /** Where the words and the tune come from (shown to the learner, logged in ASSETS.md). */
  creditFr: string;
  /** What it trains, in a few French words. */
  focusFr: string;
  /** Beats per minute. */
  bpm: number;
  /** Beats per bar (4, 3 or 2). */
  meter: number;
  /** Beats before the first full bar (0 when the song starts on beat 1). */
  pickup: number;
  /** Tonic of the key, as a MIDI note in the bass octave (48 = C3). */
  tonic: number;
  lines: SongLineSpec[];
  /** Generated songs: the lessons the words were built from. */
  uses?: string[];
  createdAt?: number;
}

export interface NoteSpec {
  midi: number;
  beats: number;
}
/** One sung syllable (one or more notes) or a rest. */
export type Group = { rest: true; beats: number } | { rest: false; notes: NoteSpec[] };

const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** `C4` → 60, `F#3` → 54, `Bb4` → 70. */
export function midiOf(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note "${name}"`);
  return STEP[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
}

export const freqOf = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

const beatsOf = (g: Group): number => (g.rest ? g.beats : g.notes.reduce((n, x) => n + x.beats, 0));

export function parseMelody(text: string): Group[] {
  return text
    .trim()
    .split(/\s+/)
    .map((token): Group => {
      const notes = token.split('~').map((part) => {
        const [name, len] = part.split('/');
        const beats = Number(len);
        if (!(beats > 0)) throw new Error(`bad length in "${token}"`);
        return { name, beats };
      });
      if (notes[0].name === 'R') return { rest: true, beats: notes[0].beats };
      return { rest: false, notes: notes.map((n) => ({ midi: midiOf(n.name), beats: n.beats })) };
    });
}

/**
 * Sung syllables of an English word, from its spelling (a guide: silent
 * letters and exceptions are only partly handled). Used when the lyric
 * writer gave no count.
 */
export function countSyllables(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 1;
  if (w.length <= 3) {
    // "are", "one", "use": the final e is silent.
    const groups = (w.match(/[aeiouy]+/g) ?? []).length;
    return Math.max(1, groups - (groups > 1 && /[^aeiouy]e$/.test(w) ? 1 : 0));
  }
  // Silent endings: "-e" (make), "-es" (makes), "-ed" (worked) except after t/d.
  if (/[^aeiou]le$/.test(w)) w = w.slice(0, -2) + 'ul';
  else if (/[^td]ed$/.test(w) && !/[aeiou]ed$/.test(w)) w = w.slice(0, -2);
  else if (/[^aeiousxz]es$/.test(w) && !/(ch|sh)es$/.test(w)) w = w.slice(0, -2);
  else if (/[^aeiou]e$/.test(w)) w = w.slice(0, -1);
  return Math.max(1, (w.match(/[aeiouy]+/g) ?? []).length);
}

export interface LyricWord {
  /** The word as shown (no syllable marks). */
  text: string;
  syllables: number;
}

/** Words of a lyric line with their sung syllables. */
export function parseLyric(lyric: string, syllables?: readonly number[]): LyricWord[] {
  return lyric
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((raw, i) => {
      const marked = raw.split('-').filter(Boolean).length;
      const given = syllables?.[i];
      return {
        text: raw.replace(/-/g, ''),
        syllables:
          given && given >= 1 && given <= 6
            ? Math.round(given)
            : marked > 1
              ? marked
              : countSyllables(raw),
      };
    });
}

/** The line as shown and as sent to the scorer. */
export const lineText = (lyric: string): string => lyric.replace(/-/g, '').trim();

/**
 * Makes a melody line carry exactly `n` syllables: with too few notes the
 * longest one is split in two (same pitch); with too many, the two shortest
 * neighbours are sung on one syllable. Rests stay where they are.
 */
export function fitGroups(groups: readonly Group[], n: number): Group[] {
  const out: Group[] = groups.map((g) =>
    g.rest ? { ...g } : { rest: false, notes: [...g.notes] },
  );
  const sung = () => out.filter((g) => !g.rest).length;
  let guard = 64;
  while (sung() < n && guard-- > 0) {
    let best = -1;
    for (let i = 0; i < out.length; i++) {
      if (out[i].rest) continue;
      if (best < 0 || beatsOf(out[i]) >= beatsOf(out[best])) best = i;
    }
    if (best < 0) break;
    const g = out[best] as Extract<Group, { rest: false }>;
    if (g.notes.length > 1) {
      // A syllable sung over several notes gives one note to a new syllable.
      const cut = Math.ceil(g.notes.length / 2);
      out.splice(
        best,
        1,
        { rest: false, notes: g.notes.slice(0, cut) },
        { rest: false, notes: g.notes.slice(cut) },
      );
    } else {
      const half = g.notes[0].beats / 2;
      const note = { midi: g.notes[0].midi, beats: half };
      out.splice(best, 1, { rest: false, notes: [note] }, { rest: false, notes: [{ ...note }] });
    }
  }
  guard = 64;
  while (sung() > n && n > 0 && guard-- > 0) {
    let best = -1;
    let bestBeats = Infinity;
    for (let i = 0; i + 1 < out.length; i++) {
      if (out[i].rest || out[i + 1].rest) continue;
      const b = beatsOf(out[i]) + beatsOf(out[i + 1]);
      if (b <= bestBeats) {
        best = i;
        bestBeats = b;
      }
    }
    if (best < 0) {
      // Only isolated notes are left: the last one becomes a rest.
      const last = out.map((g) => !g.rest).lastIndexOf(true);
      out[last] = { rest: true, beats: beatsOf(out[last]) };
      continue;
    }
    const a = out[best] as Extract<Group, { rest: false }>;
    const b = out[best + 1] as Extract<Group, { rest: false }>;
    out.splice(best, 2, { rest: false, notes: [...a.notes, ...b.notes] });
  }
  return out;
}

export interface TimedNote {
  midi: number;
  /** Seconds from the start of playback (count-in included). */
  start: number;
  dur: number;
}

export interface TimedWord {
  text: string;
  line: number;
  /** Index in the line. */
  index: number;
  start: number;
  end: number;
  /** One entry per sung syllable. */
  syllables: TimedNote[][];
}

export interface TimedLine {
  text: string;
  start: number;
  end: number;
  words: TimedWord[];
}

export interface Timeline {
  beatSec: number;
  /** Seconds of count-in before the first note or rest. */
  countInSec: number;
  countInBeats: number;
  lines: TimedLine[];
  /** End of the last line, in seconds from the start of playback. */
  endSec: number;
  /** Every beat of the song body (seconds), with whether it opens a bar. */
  beats: { at: number; bar: boolean; index: number }[];
}

/** True when the lyric fits its melody without any fitting (checked for built-in songs). */
export function fitsExactly(line: SongLineSpec): boolean {
  const need = parseLyric(line.lyric, line.syllables).reduce((n, w) => n + w.syllables, 0);
  return parseMelody(line.melody).filter((g) => !g.rest).length === need;
}

/** Song → seconds. `tempo` scales the speed (0.8 = slower). */
export function buildTimeline(song: Song, tempo = 1): Timeline {
  const beatSec = 60 / (song.bpm * tempo);
  // One full bar of count-in, or two when the bar is short; the pickup is taken out of it.
  const bars = song.meter <= 2 ? 2 : 1;
  const countInBeats = song.meter * bars + (song.pickup ? song.meter - song.pickup : 0);
  const countInSec = countInBeats * beatSec;
  let beat = 0;
  const lines: TimedLine[] = song.lines.map((spec, li) => {
    const words = parseLyric(spec.lyric, spec.syllables);
    const need = words.reduce((n, w) => n + w.syllables, 0);
    const groups = fitGroups(parseMelody(spec.melody), need);
    const lineStart = beat;
    const sung: TimedNote[][] = [];
    for (const g of groups) {
      if (g.rest) {
        beat += g.beats;
        continue;
      }
      const notes: TimedNote[] = [];
      for (const n of g.notes) {
        notes.push({ midi: n.midi, start: countInSec + beat * beatSec, dur: n.beats * beatSec });
        beat += n.beats;
      }
      sung.push(notes);
    }
    let at = 0;
    const timed: TimedWord[] = [];
    words.forEach((w, wi) => {
      const syllables = sung.slice(at, at + w.syllables);
      at += w.syllables;
      if (!syllables.length) return; // more syllables than the tune could carry
      const first = syllables[0][0];
      const last = syllables[syllables.length - 1].at(-1)!;
      timed.push({
        text: w.text,
        line: li,
        index: wi,
        start: first.start,
        end: last.start + last.dur,
        syllables,
      });
    });
    return {
      text: lineText(spec.lyric),
      start: timed[0]?.start ?? countInSec + lineStart * beatSec,
      end: countInSec + beat * beatSec,
      words: timed,
    };
  });
  const total = Math.ceil(beat - 1e-6);
  const beats = Array.from({ length: total }, (_, i) => ({
    at: countInSec + i * beatSec,
    index: i,
    bar: (((i - song.pickup) % song.meter) + song.meter) % song.meter === 0,
  }));
  return { beatSec, countInSec, countInBeats, lines, endSec: countInSec + beat * beatSec, beats };
}

/** Root (MIDI, bass octave) of the chord that suits each bar: I, IV or V. */
export function barRoots(song: Song, t: Timeline): { at: number; root: number; third: number }[] {
  const chords = [
    { root: 0, tones: [0, 4, 7] },
    { root: 5, tones: [5, 9, 0] },
    { root: 7, tones: [7, 11, 2] },
  ];
  const notes = t.lines.flatMap((l) => l.words.flatMap((w) => w.syllables.flat()));
  const barSec = song.meter * t.beatSec;
  const first = t.countInSec + song.pickup * t.beatSec;
  const out: { at: number; root: number; third: number }[] = [];
  for (let at = first; at < t.endSec - 1e-6; at += barSec) {
    const weight = [0, 0, 0];
    for (const n of notes) {
      const overlap = Math.min(n.start + n.dur, at + barSec) - Math.max(n.start, at);
      if (overlap <= 0) continue;
      const pc = (((n.midi - song.tonic) % 12) + 12) % 12;
      // The note that opens the bar counts more: it is the one the ear hangs the chord on.
      const w = overlap * (n.start < at + t.beatSec - 1e-6 && n.start >= at - 1e-6 ? 1.5 : 1);
      chords.forEach((c, i) => {
        if (c.tones.includes(pc)) weight[i] += w;
      });
    }
    // Ties go to the tonic, then the dominant.
    const order = [0, 2, 1];
    const best = order.reduce((a, b) => (weight[b] > weight[a] + 1e-9 ? b : a));
    out.push({
      at,
      root: song.tonic + chords[best].root,
      third: song.tonic + chords[best].root + 4,
    });
  }
  return out;
}

/** Which word is being sung at time `sec` (null between words and before the song). */
export function wordAt(t: Timeline, sec: number): TimedWord | null {
  for (const l of t.lines) {
    if (sec < l.start || sec > l.end) continue;
    for (const w of l.words) if (sec >= w.start && sec < w.end) return w;
  }
  return null;
}

/** Index of the line to show at time `sec` (the next one to sing, shown a little early). */
export function lineAt(t: Timeline, sec: number): number {
  let i = 0;
  while (i + 1 < t.lines.length && sec >= t.lines[i].end - 0.05) i++;
  return i;
}
