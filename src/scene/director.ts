import type { GestureName } from './gestures';

/**
 * Decides when the character moves, from what happens in the talk: wave at
 * the start and at the end, nod while the learner speaks, think after a long
 * learner turn, laugh at a joke, fist bump on a win (characters that do it).
 * Pure logic with an injected clock (seconds), so it is unit-tested.
 */
export interface DirectorOptions {
  /** Does this character fist-bump? */
  fistBump: boolean;
  /** Pseudo-random source in [0, 1), injectable for tests. */
  random?: () => number;
}

/** The character laughs: "haha", "ha ha", "lol", "hilarious". */
export const LAUGH_RE = /\b(?:ha[\s,!.-]*){2,}|\bhehe\b|\blol\b|hilarious|cracks me up/i;
/** A small win or an agreement worth a fist bump. */
export const FIST_RE =
  /\bfist[- ]?bump|\bhigh[- ]?five|\bup top\b|\bnailed it\b|\byou got this\b|\bdeal\b[!.]|\blet'?s go\b/i;
/** Strong agreement: a nod while the character speaks. */
export const AGREE_RE = /\b(?:exactly|absolutely|totally|of course|that'?s right|good point)\b/i;
/** The learner says goodbye. */
export const BYE_RE = /\b(?:bye|goodbye|see you|gotta go|have to go)\b/i;

export class GestureDirector {
  private readonly random: () => number;
  private lastBody = -Infinity;
  private lastNod = -Infinity;
  private lastLaugh = -Infinity;
  private lastFist = -Infinity;
  private lastThink = -Infinity;
  private nextNodAt = Infinity;
  /** Learner speech: start of the current stretch, last voiced frame. */
  private speechStart: number | null = null;
  private lastVoiced = -Infinity;
  private buddyText = '';
  private learnerText = '';
  private laughedThisTurn = false;
  private fistThisTurn = false;
  private agreedThisTurn = false;
  private buddySpeaking = false;
  private thinkArmed = false;

  constructor(
    private readonly opts: DirectorOptions,
    private readonly play: (g: GestureName) => void,
  ) {
    this.random = opts.random ?? Math.random;
  }

  private body(g: GestureName, now: number, minGap = 2.5): boolean {
    if (now - this.lastBody < minGap) return false;
    this.lastBody = now;
    this.play(g);
    return true;
  }

  /** The talk starts (the character has reached their spot). */
  talkStarted(now: number): void {
    this.lastBody = -Infinity;
    this.body('wave', now);
  }

  talkStopped(now: number): void {
    this.lastBody = -Infinity;
    this.body('wave', now);
  }

  /** Every microphone frame with the voice decision. */
  learnerFrame(now: number, voiced: boolean): void {
    if (voiced) {
      if (this.speechStart === null || now - this.lastVoiced > 0.7) {
        this.speechStart = now;
        this.nextNodAt = now + 1.6 + this.random() * 1.2;
      }
      this.lastVoiced = now;
      if (!this.buddySpeaking && now >= this.nextNodAt && now - this.lastNod > 3) {
        this.lastNod = now;
        this.nextNodAt = now + 3 + this.random() * 3;
        this.play('nod');
      }
      // A long turn (≥ 4 s of speech) may end in a "let me think" look.
      if (now - this.speechStart >= 4) this.thinkArmed = true;
      return;
    }
    // About 0.35 s of silence after a long turn: the character ponders.
    if (
      this.thinkArmed &&
      !this.buddySpeaking &&
      now - this.lastVoiced >= 0.35 &&
      now - this.lastThink > 20
    ) {
      this.thinkArmed = false;
      if (this.random() < 0.5 && this.body('think', now)) this.lastThink = now;
    }
  }

  /** First audio of the character's answer. */
  buddyStarts(): void {
    this.buddySpeaking = true;
    this.thinkArmed = false;
    this.buddyText = '';
    this.laughedThisTurn = false;
    this.fistThisTurn = false;
    this.agreedThisTurn = false;
  }

  buddyDone(): void {
    this.buddySpeaking = false;
  }

  /** A chunk of the character's transcript. */
  buddySays(chunk: string, now: number): void {
    this.buddyText += chunk;
    const text = this.buddyText;
    if (!this.laughedThisTurn && LAUGH_RE.test(text) && now - this.lastLaugh > 8) {
      // A laugh may cut a gesture that started a moment ago (think).
      if (this.body('laugh', now, 0.4)) {
        this.laughedThisTurn = true;
        this.lastLaugh = now;
      }
      return;
    }
    if (
      this.opts.fistBump &&
      !this.fistThisTurn &&
      FIST_RE.test(text) &&
      now - this.lastFist > 45
    ) {
      if (this.body('fistBump', now, 1.5)) {
        this.fistThisTurn = true;
        this.lastFist = now;
      }
      return;
    }
    if (!this.agreedThisTurn && AGREE_RE.test(text) && now - this.lastNod > 3) {
      this.agreedThisTurn = true;
      this.lastNod = now;
      this.play('nod');
    }
  }

  /** A chunk of the learner's transcript. */
  learnerSays(chunk: string, now: number): void {
    const before = this.learnerText;
    this.learnerText = (before + chunk).slice(-200);
    if (LAUGH_RE.test(this.learnerText) && !LAUGH_RE.test(before) && now - this.lastLaugh > 8) {
      if (this.body('laugh', now, 1)) this.lastLaugh = now;
    } else if (BYE_RE.test(this.learnerText) && !BYE_RE.test(before)) {
      this.body('wave', now, 4);
    }
  }

  /** The learner's turn ended (the character answers): forget their text. */
  learnerTurnOver(): void {
    this.learnerText = '';
  }
}
