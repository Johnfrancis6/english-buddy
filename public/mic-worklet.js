// AudioWorklet: collects mono microphone samples and posts them to the main
// thread as 16-bit PCM chunks (~32 ms at 16 kHz). Nothing is stored.
class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.size = 512;
    this.buf = new Int16Array(this.size);
    this.n = 0;
    this.sumSq = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      const s = Math.max(-1, Math.min(1, ch[i]));
      this.sumSq += s * s;
      this.buf[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.n === this.size) {
        const out = this.buf;
        const rms = Math.sqrt(this.sumSq / this.size);
        this.port.postMessage({ pcm: out.buffer, rms }, [out.buffer]);
        this.buf = new Int16Array(this.size);
        this.n = 0;
        this.sumSq = 0;
      }
    }
    return true;
  }
}
registerProcessor('mic-processor', MicProcessor);
