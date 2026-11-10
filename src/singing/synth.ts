import { barRoots, freqOf, type Song, type TimedWord, type Timeline } from './melody';

/**
 * Plays a song with WebAudio: a count-in, a light accompaniment (bass and a
 * soft chord on each beat, harmonised from the tune), and Maya's hum — a
 * sawtooth through three vowel-like band-pass filters, with a little
 * vibrato. The hum goes through the lip-sync analyser so her mouth follows;
 * the accompaniment goes straight to the speakers. Nothing is downloaded.
 *
 * It is a hum, not a singing voice: no words (see docs/SINGING.md).
 */
export type SingMode = 'listen' | 'with' | 'alone' | 'turns';

/** Who carries a line in "turns": Maya hums the even lines (0, 2…), the learner sings the others. */
export const mayaLine = (mode: SingMode, line: number): boolean =>
  mode === 'listen' || mode === 'with' || (mode === 'turns' && line % 2 === 0);
export const learnerLine = (mode: SingMode, line: number): boolean =>
  mode === 'with' || mode === 'alone' || (mode === 'turns' && line % 2 === 1);

/** Formants (Hz) of a few sung vowels, for a light female voice. */
const VOWELS: Record<string, [number, number, number]> = {
  a: [850, 1250, 2900],
  e: [550, 1900, 2800],
  i: [330, 2500, 3100],
  o: [480, 880, 2800],
  u: [350, 750, 2700],
};

/** The vowel a syllable is hummed on, from the word's spelling (k-th group of vowels). */
export function vowelOf(word: string, syllable: number): keyof typeof VOWELS {
  const groups = word.toLowerCase().match(/[aeiouy]+/g) ?? ['a'];
  // "you", "yes": a leading y is a consonant.
  const g = groups[Math.min(syllable, groups.length - 1)].replace(/^y(?=.)/, '');
  const c = g[0] === 'y' ? 'i' : g[0];
  if (g.startsWith('oo') || g.startsWith('ou')) return 'u';
  if (g.startsWith('ee') || g.startsWith('ea')) return 'i';
  return (c in VOWELS ? c : 'a') as keyof typeof VOWELS;
}

export interface Playback {
  /** `ctx.currentTime` at which the timeline's second 0 plays. */
  startAt: number;
  /** Seconds since the start of playback (negative before it starts). */
  now(): number;
  stop(): void;
  /** Resolves when the song has been played to the end (not when stopped). */
  ended: Promise<void>;
}

export interface PlayOptions {
  mode: SingMode;
  /** Seconds from now to the timeline's second 0. */
  lead?: number;
}

export function playSong(
  ctx: AudioContext,
  /** Where the hum goes (the lip-sync analyser, itself connected to the speakers). */
  voiceOut: AudioNode,
  song: Song,
  t: Timeline,
  options: PlayOptions,
): Playback {
  const startAt = ctx.currentTime + (options.lead ?? 0.15);
  const master = ctx.createGain();
  master.gain.value = 1;
  const backing = ctx.createGain();
  backing.gain.value = 0.5;
  backing.connect(master).connect(ctx.destination);
  const voice = ctx.createGain();
  voice.gain.value = options.mode === 'with' ? 0.55 : 0.8;
  voice.connect(voiceOut);
  const stoppers: AudioScheduledSourceNode[] = [];

  const tone = (
    out: AudioNode,
    type: OscillatorType,
    freq: number,
    at: number,
    dur: number,
    gain: number,
  ) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + dur + 0.02);
    stoppers.push(osc);
  };

  // Count-in: one click per beat, higher on the first of each bar.
  for (let i = 0; i < t.countInBeats; i++) {
    const first = i % song.meter === 0;
    tone(backing, 'square', first ? 1320 : 880, startAt + i * t.beatSec, 0.06, first ? 0.5 : 0.3);
  }
  // Accompaniment: bass on each bar, a soft third-and-fifth pluck on the other beats.
  const roots = barRoots(song, t);
  const rootAt = (sec: number) => {
    let r = roots[0];
    for (const x of roots) if (x.at <= sec + 1e-6) r = x;
    return r;
  };
  for (const b of t.beats) {
    const r = rootAt(b.at);
    if (!r) break;
    const at = startAt + b.at;
    if (b.bar) tone(backing, 'triangle', freqOf(r.root), at, t.beatSec * 1.6, 0.55);
    else {
      tone(backing, 'triangle', freqOf(r.third + 12), at, t.beatSec * 0.7, 0.16);
      tone(backing, 'triangle', freqOf(r.root + 19), at, t.beatSec * 0.7, 0.16);
    }
  }

  // The hum: one voice per syllable of the lines Maya carries.
  const hum = (w: TimedWord) => {
    w.syllables.forEach((notes, si) => {
      const at = startAt + notes[0].start;
      const last = notes[notes.length - 1];
      const end = startAt + last.start + last.dur;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freqOf(notes[0].midi), at);
      for (const n of notes.slice(1)) {
        osc.frequency.setTargetAtTime(freqOf(n.midi), startAt + n.start, 0.02);
      }
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.2;
      const depth = ctx.createGain();
      depth.gain.value = freqOf(notes[0].midi) * 0.006;
      lfo.connect(depth).connect(osc.frequency);
      const env = ctx.createGain();
      const hold = Math.max(0.05, end - at - 0.06);
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(1, at + 0.04);
      env.gain.setValueAtTime(1, at + hold);
      env.gain.linearRampToValueAtTime(0, at + hold + 0.06);
      const formants = VOWELS[vowelOf(w.text, si)];
      formants.forEach((f, k) => {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = f;
        bp.Q.value = k === 0 ? 5 : 9;
        const g = ctx.createGain();
        g.gain.value = [1, 0.5, 0.2][k];
        osc.connect(bp).connect(g).connect(env);
      });
      env.connect(voice);
      osc.start(at);
      lfo.start(at);
      osc.stop(end + 0.05);
      lfo.stop(end + 0.05);
      stoppers.push(osc, lfo);
    });
  };
  t.lines.forEach((l, i) => {
    if (mayaLine(options.mode, i)) l.words.forEach(hum);
  });

  let stopped = false;
  let done: () => void = () => {};
  const ended = new Promise<void>((resolve) => (done = resolve));
  const timer = setTimeout(
    () => {
      if (!stopped) done();
    },
    (startAt - ctx.currentTime + t.endSec + 0.3) * 1000,
  );
  return {
    startAt,
    now: () => ctx.currentTime - startAt,
    stop: () => {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      const at = ctx.currentTime;
      master.gain.setTargetAtTime(0, at, 0.02);
      voice.gain.setTargetAtTime(0, at, 0.02);
      setTimeout(() => {
        for (const s of stoppers) {
          try {
            s.stop();
          } catch {
            /* already stopped */
          }
        }
        master.disconnect();
        voice.disconnect();
      }, 150);
    },
    ended,
  };
}
