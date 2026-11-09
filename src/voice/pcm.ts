/** Small PCM helpers shared by microphone capture and playback. */

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    bin += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Little-endian 16-bit PCM bytes → float samples in [-1, 1). */
export function pcm16ToFloat32(bytes: Uint8Array): Float32Array {
  const n = bytes.length >> 1;
  const view = new DataView(bytes.buffer, bytes.byteOffset, n * 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = view.getInt16(i * 2, true) / 0x8000;
  return out;
}

/** Reads the sample rate from a mime type such as "audio/pcm;rate=24000". */
export function sampleRateFromMime(mime: string | undefined, fallback: number): number {
  const m = /rate=(\d+)/.exec(mime ?? '');
  return m ? Number(m[1]) : fallback;
}
