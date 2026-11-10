import type { Turn } from '../talk/transcript';
import { el } from './dom';

const WHO = { you: 'Toi', jake: 'Jake' } as const;

/** Live transcript on screen; one paragraph per turn, updated in place. */
export class TranscriptView {
  private readonly rows = new Map<number, HTMLElement>();
  constructor(private readonly root: HTMLElement) {}

  clear(): void {
    this.rows.clear();
    this.root.replaceChildren();
  }

  update(turn: Turn): void {
    let row = this.rows.get(turn.id);
    if (!row) {
      row = el('p', { class: turn.who, 'data-turn': String(turn.id) });
      row.append(el('span', { class: 'who', text: `${WHO[turn.who]} :` }), el('span'));
      this.root.append(row);
      this.rows.set(turn.id, row);
    }
    const text = turn.text.replace(/\s+/g, ' ').trim();
    row.hidden = !text && !turn.pending;
    row.lastElementChild!.textContent = text || '…';
    row.classList.toggle('pending', turn.pending);
    row.title = turn.pending ? 'Transcription en cours…' : '';
    const nearBottom = this.root.scrollHeight - this.root.scrollTop - this.root.clientHeight < 80;
    if (nearBottom) this.root.scrollTop = this.root.scrollHeight;
  }
}
