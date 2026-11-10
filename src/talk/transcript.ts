import type { TranscriptSource } from '../settings';

export type Speaker = 'you' | 'buddy';

export interface Turn {
  id: number;
  who: Speaker;
  /** The text used for display and for the debrief. */
  text: string;
  /** What the voice provider's own recogniser wrote. */
  liveText: string;
  /** What the second recogniser wrote (learner turns), once it answered. */
  clipText: string | null;
  /** Where `text` comes from. */
  source: TranscriptSource;
  /**
   * open: still receiving text; cut: the character started answering (late chunks
   * still accepted); closed: finished.
   */
  state: 'open' | 'cut' | 'closed';
  /** A second recogniser is still working on this learner turn. */
  pending: boolean;
  /** The character was cut off by the learner. */
  interrupted: boolean;
  /** ms since the start of the talk. */
  at: number;
}

/**
 * The full conversation as text. Learner turns can get their text from a
 * second recogniser (Groq, Gemini Flash) after the fact; until then the Live
 * text is shown. Kept in memory and in this browser only.
 */
export class Transcript {
  readonly turns: Turn[] = [];
  private nextId = 1;
  private readonly t0: number;
  onChange: ((turn: Turn) => void) | null = null;

  constructor(
    private readonly learnerSource: TranscriptSource,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.t0 = now();
  }

  private lastActive(who: Speaker): Turn | undefined {
    for (let i = this.turns.length - 1; i >= 0; i--) {
      const t = this.turns[i];
      if (t.who === who && t.state !== 'closed') return t;
    }
    return undefined;
  }

  private create(who: Speaker, state: Turn['state']): Turn {
    const turn: Turn = {
      id: this.nextId++,
      who,
      text: '',
      liveText: '',
      clipText: null,
      source: who === 'you' ? this.learnerSource : 'live',
      state,
      pending: false,
      interrupted: false,
      at: this.now() - this.t0,
    };
    this.turns.push(turn);
    return turn;
  }

  /** A transcription chunk from the voice provider. */
  addLive(who: Speaker, chunk: string): void {
    if (!chunk) return;
    const turn = this.lastActive(who) ?? this.create(who, 'open');
    turn.liveText += chunk;
    // Learner text from another recogniser replaces the Live text once it
    // arrives; until then (or if it fails) the Live text is what we have.
    if (turn.clipText === null) turn.text = turn.liveText;
    this.onChange?.(turn);
  }

  /**
   * The character starts answering: the learner's turn ends. Returns the turn a clip
   * of the learner's audio belongs to (created if the Live text lags behind),
   * or null when the learner said nothing.
   */
  cutLearner(hasClip: boolean): Turn | null {
    const open = this.lastActive('you');
    if (open && open.state === 'open') {
      open.state = 'cut';
      if (hasClip && open.source !== 'live') open.pending = true;
      return open;
    }
    if (!hasClip) return null;
    const turn = this.create('you', 'cut');
    turn.pending = turn.source !== 'live';
    this.onChange?.(turn);
    return turn;
  }

  /** The character's turn is over (finished or interrupted). */
  completeModelTurn(interrupted: boolean): void {
    const buddy = this.lastActive('buddy');
    if (buddy) {
      buddy.state = 'closed';
      buddy.interrupted = interrupted;
      this.onChange?.(buddy);
    }
    // A learner turn that the character already answered is over too; one that is
    // still open (the learner talking over the character) carries on.
    for (const t of this.turns) if (t.who === 'you' && t.state === 'cut') t.state = 'closed';
  }

  /** Text from the second recogniser; null when it failed. */
  setLearnerText(turnId: number, text: string | null): void {
    const turn = this.turns.find((t) => t.id === turnId);
    if (!turn) return;
    turn.pending = false;
    if (text !== null && text.trim()) {
      turn.clipText = text.trim();
      turn.text = turn.clipText;
    } else {
      // Keep what the Live recogniser heard rather than lose the turn.
      turn.source = 'live';
      turn.text = turn.liveText;
    }
    this.onChange?.(turn);
  }

  get pendingCount(): number {
    return this.turns.filter((t) => t.pending).length;
  }

  /** Turns that carry text, in order, with whitespace tidied. */
  finished(): Turn[] {
    return this.turns
      .map((t) => ({ ...t, text: t.text.replace(/\s+/g, ' ').trim() }))
      .filter((t) => t.text);
  }

  /** Words the learner said, for the end-of-talk summary. */
  get learnerWordCount(): number {
    return this.finished()
      .filter((t) => t.who === 'you')
      .reduce((n, t) => n + t.text.split(' ').length, 0);
  }
}
