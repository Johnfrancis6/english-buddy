/**
 * A short microphone test: the level is shown live, nothing is recorded or
 * sent anywhere. The stream is closed at the end.
 */
export interface MicTestResult {
  heard: boolean;
  /** Loudest level seen (RMS, 0–1). */
  peak: number;
  /** Label of the device the browser really opened. */
  label: string;
  deviceId: string;
}

/** Voice level above which we say "on t'entend". */
export const HEARD_RMS = 0.02;
/** Time above it before the test says the voice is heard (a word lasts longer). */
export const HEARD_MS = 150;

export function rmsOf(samples: Float32Array): number {
  let sum = 0;
  for (const v of samples) sum += v * v;
  return Math.sqrt(sum / Math.max(1, samples.length));
}

export async function testMicrophone(
  deviceId: string,
  onLevel: (rms: number) => void,
  durationMs = 5000,
): Promise<MicTestResult> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      ...(deviceId ? { deviceId: { ideal: deviceId } } : {}),
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  const track = stream.getAudioTracks()[0];
  const ctx = new AudioContext();
  try {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    await ctx.resume();
    const buf = new Float32Array(analyser.fftSize);
    let peak = 0;
    let voicedMs = 0;
    const start = performance.now();
    let last = start;
    // Timed on the clock: a busy page (3D rendering) may delay the timers.
    while (performance.now() - start < durationMs) {
      await new Promise((r) => setTimeout(r, 50));
      const now = performance.now();
      analyser.getFloatTimeDomainData(buf);
      const rms = rmsOf(buf);
      peak = Math.max(peak, rms);
      if (rms > HEARD_RMS) voicedMs += Math.min(200, now - last);
      last = now;
      onLevel(rms);
      if (voicedMs >= HEARD_MS && now - start >= 1500) break;
    }
    onLevel(0);
    return {
      heard: voicedMs >= HEARD_MS,
      peak,
      label: track?.label ?? '',
      deviceId: track?.getSettings().deviceId ?? deviceId,
    };
  } finally {
    stream.getTracks().forEach((x) => x.stop());
    await ctx.close().catch(() => {});
  }
}

/** Microphones of this computer (names appear once the permission is given). */
export async function listMicrophones(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter((d) => d.kind === 'audioinput');
}
