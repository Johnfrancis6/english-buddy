/**
 * Lip sync from the output audio: overall loudness opens the mouth, a simple
 * three-band split picks the mouth shape. Not phoneme-accurate (see
 * docs/DECISIONS.md), but cheap, in sync, and closed in silences.
 */
export interface VisemeWeights {
  aa: number;
  ih: number;
  ou: number;
  ee: number;
  oh: number;
}

export const VISEME_NAMES = ['aa', 'ih', 'ou', 'ee', 'oh'] as const;
export const SILENT: VisemeWeights = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };

/** Below this RMS the mouth is closed. */
export const SILENCE_GATE = 0.01;
const FULL_OPEN_RMS = 0.16;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * @param rms   loudness of the current output window (0..1)
 * @param low   energy in ~100–600 Hz (any consistent unit)
 * @param mid   energy in ~600–2200 Hz
 * @param high  energy in ~2200–7000 Hz
 */
export function computeVisemes(rms: number, low: number, mid: number, high: number): VisemeWeights {
  if (rms < SILENCE_GATE) return { ...SILENT };
  const open = clamp01((rms - SILENCE_GATE) / (FULL_OPEN_RMS - SILENCE_GATE)) ** 0.6;
  const total = low + mid + high;
  if (total <= 0) return { ...SILENT, aa: open };
  const fl = low / total;
  const fm = mid / total;
  const fh = high / total;
  // Open vowels carry mid energy, rounded vowels sit low, spread vowels and
  // fricatives push energy up.
  const raw = {
    aa: fm * 1.4 + 0.25,
    oh: fl * 0.9,
    ou: Math.max(0, fl - fm) * 0.9,
    ee: fh * 1.2,
    ih: fh * 0.6 + fm * 0.2,
  };
  const sum = raw.aa + raw.oh + raw.ou + raw.ee + raw.ih;
  const k = open / sum;
  return { aa: raw.aa * k, ih: raw.ih * k, ou: raw.ou * k, ee: raw.ee * k, oh: raw.oh * k };
}

/** Fast attack, slower release, so the mouth is lively but not jittery. */
export function smoothVisemes(
  prev: VisemeWeights,
  target: VisemeWeights,
  dtSec: number,
  attackSec = 0.035,
  releaseSec = 0.08,
): VisemeWeights {
  const out = { ...prev };
  for (const k of VISEME_NAMES) {
    const tau = target[k] > prev[k] ? attackSec : releaseSec;
    const a = 1 - Math.exp(-dtSec / tau);
    const v = prev[k] + (target[k] - prev[k]) * a;
    out[k] = v < 0.002 ? 0 : v;
  }
  return out;
}

/** Sums FFT magnitudes (0..255 bytes) into the three bands. */
export function bandEnergies(
  bins: Uint8Array,
  sampleRate: number,
): { low: number; mid: number; high: number } {
  const hzPerBin = sampleRate / 2 / bins.length;
  let low = 0;
  let mid = 0;
  let high = 0;
  for (let i = 0; i < bins.length; i++) {
    const hz = i * hzPerBin;
    if (hz < 100) continue;
    if (hz > 7000) break;
    const v = bins[i] / 255;
    if (hz < 600) low += v;
    else if (hz < 2200) mid += v;
    else high += v;
  }
  return { low, mid, high };
}
