import { pcm16ToFloat32 } from './pcm';

/** Sample rate the Live API expects for microphone input. */
export const MIC_RATE = 16_000;
/** Samples per chunk posted by public/mic-worklet.js. */
export const MIC_CHUNK = 512;
export const MIC_CHUNK_MS = (MIC_CHUNK / MIC_RATE) * 1000;

/** Microphone capture as 16 kHz mono 16-bit PCM chunks. Nothing is recorded. */
export class Mic {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;

  async start(onChunk: (pcm: Uint8Array, rms: number) => void): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new DOMException('getUserMedia unavailable', 'NotFoundError');
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        // Echo safeguard: Franco uses a headset, but if someone plays Jake on
        // speakers the browser's canceller keeps Jake from hearing himself.
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    try {
      // Chrome resamples the device stream to the context rate for us.
      this.ctx = new AudioContext({ sampleRate: MIC_RATE, latencyHint: 'interactive' });
      await this.ctx.audioWorklet.addModule(`${import.meta.env.BASE_URL}mic-worklet.js`);
      const source = this.ctx.createMediaStreamSource(this.stream);
      const node = new AudioWorkletNode(this.ctx, 'mic-processor');
      node.port.onmessage = (e: MessageEvent<{ pcm: ArrayBuffer; rms: number }>) =>
        onChunk(new Uint8Array(e.data.pcm), e.data.rms);
      // A muted path to the destination keeps the graph pulling audio.
      const mute = this.ctx.createGain();
      mute.gain.value = 0;
      source.connect(node).connect(mute).connect(this.ctx.destination);
      await this.ctx.resume();
    } catch (err) {
      await this.stop();
      throw err;
    }
  }

  async stop(): Promise<void> {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx && ctx.state !== 'closed') await ctx.close().catch(() => {});
  }
}

/** Gapless playback of streamed PCM, with an analyser tap for the lip sync. */
export class PcmPlayer {
  readonly ctx: AudioContext;
  readonly analyser: AnalyserNode;
  private readonly sources = new Set<AudioBufferSourceNode>();
  private nextTime = 0;
  /** Called when the last queued chunk has finished playing. */
  onDrained: (() => void) | null = null;

  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.3;
    this.analyser.connect(this.ctx.destination);
  }

  resume(): Promise<void> {
    return this.ctx.state === 'suspended' ? this.ctx.resume() : Promise.resolve();
  }

  get playing(): boolean {
    return this.sources.size > 0;
  }

  enqueuePcm16(bytes: Uint8Array, sampleRate: number): void {
    this.enqueue(pcm16ToFloat32(bytes), sampleRate);
  }

  enqueue(samples: Float32Array, sampleRate: number): void {
    if (samples.length === 0) return;
    const buffer = this.ctx.createBuffer(1, samples.length, sampleRate);
    buffer.getChannelData(0).set(samples);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.analyser);
    const now = this.ctx.currentTime;
    // A small lead on the first chunk absorbs network jitter.
    if (this.nextTime < now + 0.02) this.nextTime = now + 0.04;
    src.start(this.nextTime);
    this.nextTime += buffer.duration;
    this.sources.add(src);
    src.onended = () => {
      this.sources.delete(src);
      if (this.sources.size === 0) this.onDrained?.();
    };
  }

  /** Drops everything queued: used when the learner interrupts. */
  flush(): void {
    for (const s of this.sources) {
      s.onended = null;
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear();
    this.nextTime = 0;
  }
}
