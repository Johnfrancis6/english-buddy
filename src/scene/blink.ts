/** Random blinking: closed for ~130 ms every 2–6 s, sometimes twice. */
export class Blinker {
  private timeToNext: number;
  private phase = -1; // -1 = eyes open, otherwise seconds into the blink
  private pendingDouble = false;
  static readonly DURATION = 0.13;

  constructor(private readonly rng: () => number = Math.random) {
    this.timeToNext = this.nextInterval();
  }

  private nextInterval(): number {
    return 2 + this.rng() * 4;
  }

  /** Advances by dt seconds and returns the blink weight (0 open, 1 closed). */
  update(dt: number): number {
    if (this.phase < 0) {
      this.timeToNext -= dt;
      if (this.timeToNext > 0) return 0;
      this.phase = 0;
      this.pendingDouble = !this.pendingDouble && this.rng() < 0.15;
    } else {
      this.phase += dt;
    }
    if (this.phase >= Blinker.DURATION) {
      this.phase = -1;
      this.timeToNext = this.pendingDouble ? 0.12 : this.nextInterval();
      return 0;
    }
    return Math.sin((this.phase / Blinker.DURATION) * Math.PI);
  }
}
