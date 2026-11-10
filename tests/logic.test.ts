import { describe, expect, it } from 'vitest';
import { Blinker } from '../src/scene/blink';
import {
  bandEnergies,
  computeVisemes,
  SILENT,
  smoothVisemes,
  VISEME_NAMES,
  type VisemeWeights,
} from '../src/lipsync/visemes';
import { DEFAULTS, loadSettings, maskKey, saveSettings } from '../src/settings';
import { classify, friendlyFromClose, friendlyFromUnknown } from '../src/voice/errors';
import { LatencyTracker, median } from '../src/voice/latency';
import { base64ToBytes, bytesToBase64, pcm16ToFloat32, sampleRateFromMime } from '../src/voice/pcm';

const total = (v: VisemeWeights) => VISEME_NAMES.reduce((s, k) => s + v[k], 0);

describe('pcm', () => {
  it('round-trips base64', () => {
    const bytes = new Uint8Array(70_000).map((_, i) => i % 251);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });
  it('decodes little-endian 16-bit samples', () => {
    const f = pcm16ToFloat32(new Uint8Array([0x00, 0x00, 0xff, 0x7f, 0x00, 0x80]));
    expect(f[0]).toBe(0);
    expect(f[1]).toBeCloseTo(1, 3);
    expect(f[2]).toBe(-1);
  });
  it('reads the sample rate from the mime type', () => {
    expect(sampleRateFromMime('audio/pcm;rate=24000', 1)).toBe(24000);
    expect(sampleRateFromMime(undefined, 24000)).toBe(24000);
  });
});

describe('latency', () => {
  it('computes medians', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });

  const speak = (t: LatencyTracker, from: number, ms: number, rms = 0.1) => {
    for (let x = from; x < from + ms; x += 32) t.onMicFrame(x, rms, 32);
    return from + Math.floor((ms - 1) / 32) * 32; // time of the last voiced frame
  };

  it('measures from the last voiced frame to the first model audio', () => {
    const t = new LatencyTracker();
    const lastVoice = speak(t, 1000, 800);
    speak(t, lastVoice + 32, 600, 0.001); // silence
    expect(t.onModelAudioStart(lastVoice + 900)).toBe(900);
    expect(t.medianMs).toBe(900);
  });

  it('ignores model turns that do not follow real speech', () => {
    const t = new LatencyTracker();
    expect(t.onModelAudioStart(500)).toBeNull();
    speak(t, 1000, 64); // a click, not speech
    expect(t.onModelAudioStart(1500)).toBeNull();
    speak(t, 2000, 600, 0.001); // only silence
    expect(t.onModelAudioStart(3000)).toBeNull();
    expect(t.count).toBe(0);
  });

  it('discards impossible delays caused by overlapping speech', () => {
    const t = new LatencyTracker();
    const last = speak(t, 1000, 800);
    expect(t.onModelAudioStart(last + 30)).toBeNull();
    expect(t.count).toBe(0);
    expect(t.overlaps).toBe(1);
  });

  it('keeps the last 10 samples only', () => {
    const t = new LatencyTracker();
    let now = 0;
    for (let i = 1; i <= 12; i++) {
      const last = speak(t, now, 400);
      t.onModelAudioStart(last + i * 100);
      now = last + 5000;
    }
    expect(t.count).toBe(10);
    expect(t.medianMs).toBe(750); // samples 300..1200
    expect(t.last).toBe(1200);
  });

  it('raises the threshold in a noisy room', () => {
    const t = new LatencyTracker();
    for (let i = 0; i < 400; i++) t.onMicFrame(i * 32, 0.02, 32);
    expect(t.threshold).toBeGreaterThan(0.05);
    expect(t.onMicFrame(99_999, 0.03, 32)).toBe(false);
  });
});

describe('visemes', () => {
  it('closes the mouth in silence', () => {
    expect(computeVisemes(0, 0, 0, 0)).toEqual(SILENT);
    expect(computeVisemes(0.005, 5, 5, 5)).toEqual(SILENT);
  });
  it('opens with loudness and never exceeds 1 in total', () => {
    const quiet = total(computeVisemes(0.03, 3, 4, 1));
    const loud = total(computeVisemes(0.3, 3, 4, 1));
    expect(quiet).toBeGreaterThan(0);
    expect(loud).toBeGreaterThan(quiet);
    expect(loud).toBeLessThanOrEqual(1.0001);
  });
  it('picks a shape from the spectrum', () => {
    const open = computeVisemes(0.2, 1, 8, 1);
    const round = computeVisemes(0.2, 8, 1, 0.5);
    const spread = computeVisemes(0.2, 1, 1, 8);
    expect(open.aa).toBeGreaterThan(open.ee);
    expect(round.oh + round.ou).toBeGreaterThan(open.oh + open.ou);
    expect(spread.ee).toBeGreaterThan(open.ee);
  });
  it('smoothing returns to fully closed', () => {
    let v = computeVisemes(0.3, 3, 4, 1);
    for (let i = 0; i < 60; i++) v = smoothVisemes(v, SILENT, 1 / 60);
    expect(total(v)).toBe(0);
  });
  it('splits FFT bins into bands', () => {
    const bins = new Uint8Array(512);
    const hzPerBin = 24000 / 512;
    bins[Math.round(300 / hzPerBin)] = 255;
    bins[Math.round(3000 / hzPerBin)] = 128;
    const e = bandEnergies(bins, 48000);
    expect(e.low).toBeCloseTo(1);
    expect(e.mid).toBe(0);
    expect(e.high).toBeCloseTo(128 / 255);
  });
});

describe('blink', () => {
  it('blinks at random intervals and reopens', () => {
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const b = new Blinker(rng);
    let blinks = 0;
    let closed = false;
    let maxWeight = 0;
    for (let i = 0; i < 60 * 60; i++) {
      const w = b.update(1 / 60);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(1);
      maxWeight = Math.max(maxWeight, w);
      if (w > 0.5 && !closed) blinks++;
      closed = w > 0.5;
    }
    expect(maxWeight).toBeGreaterThan(0.9);
    expect(blinks).toBeGreaterThanOrEqual(10); // one minute: every 2–6 s
    expect(blinks).toBeLessThanOrEqual(40);
  });
});

describe('errors', () => {
  it('classifies the common failures', () => {
    expect(classify('API key not valid. Please pass a valid API key.')).toBe('bad-key');
    expect(classify('You exceeded your current quota')).toBe('quota');
    expect(classify('RESOURCE_EXHAUSTED')).toBe('quota');
    expect(classify('models/x is not found for API version')).toBe('model');
    expect(classify('Permission denied', 'NotAllowedError')).toBe('mic-denied');
    expect(classify('Requested device not found', 'NotFoundError')).toBe('mic-missing');
    expect(classify('Failed to fetch')).toBe('network');
  });
  it('treats an unexplained close as a drop that can be retried', () => {
    const e = friendlyFromClose(1006, '');
    expect(e.kind).toBe('dropped');
    expect(e.canRetry).toBe(true);
    expect(e.detail).toContain('1006');
  });
  it('keeps the cause when the close gives one', () => {
    expect(friendlyFromClose(1007, 'API key not valid').kind).toBe('bad-key');
    expect(friendlyFromClose(1011, 'Quota exceeded for metric').kind).toBe('quota');
  });
  it('writes French messages', () => {
    const e = friendlyFromUnknown(new DOMException('Permission denied', 'NotAllowedError'));
    expect(e.message).toMatch(/micro/i);
    expect(e.canRetry).toBe(false);
  });
});

describe('settings', () => {
  const memory = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
    };
  };
  it('remembers the key, trimmed', () => {
    const store = memory();
    expect(loadSettings(store)).toEqual(DEFAULTS);
    saveSettings({ ...DEFAULTS, apiKey: '  AIzaTESTKEY1234  ' }, store);
    expect(loadSettings(store).apiKey).toBe('AIzaTESTKEY1234');
  });
  it('falls back to defaults on unknown or corrupt values', () => {
    const store = memory();
    saveSettings(
      { ...DEFAULTS, apiKey: 'k', model: 'old-model', voice: 'Nobody', pauseMs: 123 },
      store,
    );
    expect(loadSettings(store)).toEqual({ ...DEFAULTS, apiKey: 'k' });
    store.setItem('english-buddy.settings.v1', '{broken');
    expect(loadSettings(store)).toEqual(DEFAULTS);
  });
  it('remembers the chosen speaking pace', () => {
    const store = memory();
    saveSettings({ ...DEFAULTS, pauseMs: 1500 }, store);
    expect(loadSettings(store).pauseMs).toBe(1500);
  });
  it('masks the key', () => {
    expect(maskKey('AIzaSyD-1234567890abcd')).toBe('AIza…abcd');
    expect(maskKey('')).toBe('');
  });
});
