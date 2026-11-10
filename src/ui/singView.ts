import type { Lesson } from '../singing/compose';
import { buildTimeline, lineAt, wordAt, type Song, type Timeline } from '../singing/melody';
import type { SingResult, SungWord } from '../singing/score';
import { learnerLine, mayaLine, type Playback, type SingMode } from '../singing/synth';
import { SOUNDS } from '../pronunciation/sounds';
import type { Take } from '../pronunciation/recorder';
import type { SoundId } from '../pronunciation/types';
import { levelOf } from './pronunciationView';
import { skillRow } from './progressView';
import { el } from './dom';

/**
 * Karaoke with Maya (phase 7). The panel sits under the character: the
 * lyrics light up word by word on the song's clock, Maya hums and keeps the
 * beat, the learner sings; the take is scored per word (pronunciation and
 * rhythm) and forgotten. Only text and scores are kept.
 */
export const KIND_FR: Record<Song['kind'], string> = {
  public: 'Domaine public',
  platform: 'Écrite pour English Buddy',
  generated: 'Écrite pour toi',
};

export const MODES: { id: Exclude<SingMode, 'listen'>; label: string }[] = [
  { id: 'with', label: 'Avec Maya qui fredonne' },
  { id: 'turns', label: 'En alternance : Maya, puis moi' },
  { id: 'alone', label: 'Sans Maya (accompagnement seul)' },
];

export const TEMPOS = [
  { value: 1, label: 'Tempo normal' },
  { value: 0.8, label: 'Plus lent' },
] as const;

export interface SingHandlers {
  /** Starts the song (count-in included) and returns its clock. */
  play(song: Song, t: Timeline, mode: SingMode): Playback;
  /** The audio clock the playback runs on (seconds). */
  clock(): number;
  /** Records one take for at most `maxMs`; never stops on a silence. */
  record(onLevel: (rms: number) => void, maxMs: number): Take;
  /** Scores and saves the take; the audio is dropped by the caller after it. */
  score(
    song: Song,
    mode: SingMode,
    t: Timeline,
    wav: Uint8Array,
    takeStartSec: number,
  ): Promise<SingResult>;
  errorText(err: unknown): string;
  /** The beat of the song for the character's moves (null = stop). */
  beat(beat: number | null): void;
  /** The take was scored: the character reacts. */
  cheer(overall: number): void;
  /** Is a pronunciation scorer available (a key)? Otherwise only the rhythm is scored. */
  hasScorer(): boolean;
  /** Seconds one microphone chunk lasts (to place the take on the song's clock). */
  chunkSec: number;
}

type State = 'ready' | 'listening' | 'singing' | 'scoring';

const MARK = { good: '✓', ok: '~', weak: '✗' } as const;
const MARK_FR = { good: 'bien', ok: 'presque', weak: 'à travailler' } as const;

export class SingView {
  private song: Song | null = null;
  private timeline: Timeline | null = null;
  private mode: Exclude<SingMode, 'listen'> = 'with';
  private tempo = 1;
  private state: State = 'ready';
  private playback: Playback | null = null;
  private playMode: SingMode = 'with';
  private take: Take | null = null;
  private raf = 0;
  private shownLine = -1;
  private wordEls: HTMLElement[][] = [];
  private lit: HTMLElement | null = null;
  /** Bumped on every start and stop: late callbacks of an old run are ignored. */
  private run = 0;

  private readonly title = el('h2', { class: 'sing-title', lang: 'en', id: 'sing-title' });
  private readonly kind = el('span', { class: 'chip' });
  private readonly status = el('p', { class: 'sing-status', 'aria-live': 'polite' });
  private readonly count = el('p', { class: 'sing-count', 'aria-hidden': 'true' });
  private readonly lines = el('div', { class: 'sing-lines' });
  private readonly credit = el('p', { class: 'muted small sing-credit' });
  private readonly uses = el('p', { class: 'small sing-uses' });
  private readonly singBtn = el('button', { class: 'btn primary', type: 'button', id: 'sing-go' });
  private readonly listenBtn = el('button', {
    class: 'btn',
    type: 'button',
    id: 'sing-listen',
    text: 'Écouter Maya',
  });
  private readonly modeSel = el('select', { id: 'sing-mode' });
  private readonly tempoSel = el('select', { id: 'sing-tempo' });
  private readonly otherBtn = el('button', {
    class: 'btn quiet small',
    type: 'button',
    id: 'sing-other',
    text: 'Autre chanson',
  });
  private readonly quitBtn = el('button', {
    class: 'link',
    type: 'button',
    id: 'sing-quit',
    text: 'Quitter',
  });
  private readonly meter = el('span', { class: 'meter', 'aria-hidden': 'true' }, el('span'));
  private readonly note = el('p', { class: 'muted small sing-note' });

  constructor(
    private readonly root: HTMLElement,
    private readonly resultDialog: HTMLDialogElement,
    private readonly resultBody: HTMLElement,
    private readonly h: SingHandlers,
    private readonly nav: { other(): void; quit(): void },
  ) {
    for (const m of MODES) this.modeSel.append(el('option', { value: m.id, text: m.label }));
    for (const t of TEMPOS) {
      this.tempoSel.append(el('option', { value: String(t.value), text: t.label }));
    }
    this.meter.hidden = true;
    root.replaceChildren(
      el('div', { class: 'sing-head' }, this.title, this.kind),
      this.status,
      this.count,
      this.lines,
      this.uses,
      el(
        'div',
        { class: 'row tight sing-actions' },
        this.singBtn,
        this.listenBtn,
        this.meter,
        el(
          'label',
          { class: 'sing-pick' },
          el('span', { class: 'visually-hidden', text: 'Façon de chanter' }),
          this.modeSel,
        ),
        el(
          'label',
          { class: 'sing-pick' },
          el('span', { class: 'visually-hidden', text: 'Tempo' }),
          this.tempoSel,
        ),
      ),
      this.note,
      el('div', { class: 'row tight sing-foot' }, this.otherBtn, this.quitBtn, this.credit),
    );
    this.singBtn.addEventListener('click', () =>
      this.state === 'ready' ? this.sing() : this.halt(),
    );
    this.listenBtn.addEventListener('click', () => this.listen());
    this.modeSel.addEventListener('change', () => {
      this.mode = this.modeSel.value as Exclude<SingMode, 'listen'>;
      this.rebuild();
    });
    this.tempoSel.addEventListener('change', () => {
      this.tempo = Number(this.tempoSel.value) || 1;
      this.rebuild();
    });
    this.otherBtn.addEventListener('click', () => {
      this.halt();
      this.nav.other();
    });
    this.quitBtn.addEventListener('click', () => this.nav.quit());
  }

  get active(): boolean {
    return this.song !== null;
  }

  open(song: Song): void {
    this.halt();
    this.song = song;
    this.root.hidden = false;
    this.title.textContent = song.title;
    this.kind.textContent = KIND_FR[song.kind];
    this.credit.textContent = song.creditFr;
    this.uses.replaceChildren();
    if (song.uses?.length) {
      this.uses.append(
        'Avec : ',
        ...song.uses.flatMap((u, i) => [
          i ? ' · ' : '',
          el('span', { lang: 'en', class: 'sing-use', text: u }),
        ]),
      );
    }
    this.uses.hidden = !song.uses?.length;
    this.rebuild();
  }

  /** Leaves the karaoke: everything stops, the take (if any) is dropped. */
  close(): void {
    this.halt();
    this.song = null;
    this.root.hidden = true;
    if (this.resultDialog.open) this.resultDialog.close();
  }

  private rebuild(): void {
    if (!this.song) return;
    this.halt();
    this.timeline = buildTimeline(this.song, this.tempo);
    this.wordEls = this.timeline.lines.map((l) =>
      l.words.map((w) => el('span', { class: 'sing-word', text: w.text })),
    );
    this.shownLine = -1;
    this.showLine(0, this.mode);
    this.setState('ready');
  }

  private setState(s: State): void {
    this.state = s;
    this.root.dataset.state = s;
    const busy = s !== 'ready';
    this.singBtn.textContent = s === 'ready' ? 'Chanter' : 'Arrêter';
    this.singBtn.classList.toggle('live', busy);
    this.singBtn.disabled = s === 'scoring';
    this.listenBtn.disabled = busy;
    this.modeSel.disabled = busy;
    this.tempoSel.disabled = busy;
    this.meter.hidden = s !== 'singing';
    if (s === 'ready') {
      this.count.textContent = '';
      this.status.className = 'sing-status';
      this.status.textContent =
        'Clique sur « Chanter » : Maya compte, puis les mots s’allument au bon moment.';
      this.note.textContent = this.h.hasScorer()
        ? '🔒 Ta voix reste en mémoire le temps d’être notée, puis elle est oubliée. Casque conseillé.'
        : '🔒 Sans clé Gemini, seul ton rythme est noté (mesuré ici, dans ton navigateur). Ta voix n’est pas gardée.';
    }
  }

  /** Shows a line (and the next one, smaller); `mode` says who carries each line. */
  private showLine(i: number, mode: SingMode): void {
    const t = this.timeline;
    if (!t || i === this.shownLine) return;
    this.shownLine = i;
    const row = (k: number, cls: string) => {
      const p = el('p', { class: cls, lang: 'en' });
      if (mode === 'turns') {
        const label = mayaLine(mode, k) ? 'Maya' : 'Toi';
        p.append(el('span', { class: 'chip sing-who', lang: 'fr', text: label }), ' ');
      }
      this.wordEls[k].forEach((w, j) => p.append(j ? ' ' : '', w));
      return p;
    };
    this.lines.replaceChildren(row(i, 'sing-line current'));
    if (i + 1 < t.lines.length) this.lines.append(row(i + 1, 'sing-line next'));
    this.lines.dataset.line = String(i);
  }

  private light(word: HTMLElement | null): void {
    if (word === this.lit) return;
    this.lit?.classList.remove('now');
    this.lit?.classList.add('sung');
    word?.classList.add('now');
    this.lit = word;
  }

  private clearLights(): void {
    this.lit = null;
    for (const line of this.wordEls) for (const w of line) w.classList.remove('now', 'sung');
  }

  /** One frame of the song: the count-in, the line, the word, who is busy, the beat. */
  private frame = (): void => {
    const t = this.timeline;
    const p = this.playback;
    if (!t || !p) return;
    const sec = p.now();
    this.h.beat(sec / t.beatSec);
    if (sec < t.countInSec) {
      const left = Math.ceil((t.countInSec - Math.max(0, sec)) / t.beatSec);
      this.count.textContent = left <= 4 ? String(left) : '…';
      this.setStatus(this.playMode === 'listen' ? 'Maya compte…' : 'Maya compte… prépare-toi.');
    } else {
      this.count.textContent = '';
      const li = lineAt(t, sec);
      this.showLine(li, this.playMode);
      const w = wordAt(t, sec);
      this.light(w ? (this.wordEls[w.line][w.index] ?? null) : null);
      const mine = learnerLine(this.playMode, li);
      const hers = mayaLine(this.playMode, li);
      this.setStatus(
        this.playMode === 'listen'
          ? 'Maya fredonne l’air : écoute et suis les mots.'
          : mine && hers
            ? 'À toi : chante avec Maya qui fredonne.'
            : mine
              ? 'À toi : chante !'
              : 'Maya fredonne… tu chantes la ligne suivante.',
      );
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private setStatus(text: string, cls = ''): void {
    if (this.status.textContent !== text) this.status.textContent = text;
    this.status.className = `sing-status ${cls}`.trim();
  }

  private begin(mode: SingMode): Playback {
    this.clearLights();
    this.shownLine = -1;
    this.showLine(0, mode);
    this.playMode = mode;
    const p = this.h.play(this.song!, this.timeline!, mode);
    this.playback = p;
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.frame);
    return p;
  }

  private listen(): void {
    if (!this.song || !this.timeline || this.state !== 'ready') return;
    const run = ++this.run;
    this.setState('listening');
    void this.begin('listen').ended.then(() => {
      if (run === this.run) this.halt();
    });
  }

  private sing(): void {
    const song = this.song;
    const t = this.timeline;
    if (!song || !t || this.state !== 'ready') return;
    const run = ++this.run;
    const mode = this.mode;
    this.setState('singing');
    this.setStatus('Ouverture du micro…', 'busy');
    const fill = this.meter.firstElementChild as HTMLElement;
    let takeStartSec = 0;
    let started = false;
    const take = this.h.record(
      (rms) => {
        fill.style.width = `${Math.min(100, Math.round(rms * 600))}%`;
        fill.classList.toggle('voiced', rms > 0.02);
        if (started || run !== this.run) return;
        // First chunk: the microphone is open. The song starts now, and the
        // take's first sample is placed on the song's clock.
        started = true;
        const heardAt = this.h.clock() - this.h.chunkSec;
        const p = this.begin(mode);
        takeStartSec = heardAt - p.startAt;
        void p.ended.then(() => {
          if (run === this.run) take.finish();
        });
      },
      (t.endSec + 12) * 1000,
    );
    this.take = take;
    take.result.then(
      async (wav) => {
        if (run !== this.run) return;
        this.stopPlayback();
        this.take = null;
        if (!wav) {
          this.setState('ready');
          this.setStatus(
            'Je n’ai pas entendu ta voix. Vérifie le micro choisi dans les réglages et chante un peu plus fort.',
            'error-text',
          );
          return;
        }
        this.setState('scoring');
        this.setStatus(
          this.h.hasScorer() ? 'Maya écoute ta prise… (5 à 20 secondes)' : 'Mesure de ton rythme…',
          'busy',
        );
        try {
          const result = await this.h.score(song, mode, t, wav, takeStartSec);
          if (run !== this.run) return;
          this.setState('ready');
          this.h.cheer(result.overall);
          this.showResult(mode, result);
        } catch (err) {
          if (run !== this.run) return;
          this.setState('ready');
          this.setStatus(this.h.errorText(err), 'error-text');
        }
      },
      (err: unknown) => {
        if (run !== this.run) return;
        this.stopPlayback();
        this.take = null;
        this.setState('ready');
        this.setStatus(this.h.errorText(err), 'error-text');
      },
    );
  }

  private stopPlayback(): void {
    cancelAnimationFrame(this.raf);
    this.playback?.stop();
    this.playback = null;
    this.h.beat(null);
    this.count.textContent = '';
    this.light(null);
  }

  /** Stops the song and drops the take, whatever is going on. */
  halt(): void {
    this.run++;
    this.take?.cancel();
    this.take = null;
    this.stopPlayback();
    if (this.song && this.timeline) {
      this.clearLights();
      this.shownLine = -1;
      this.showLine(0, this.mode);
      this.setState('ready');
    }
  }

  /** Sings the same song again (from the result dialog). */
  again(): void {
    if (this.resultDialog.open) this.resultDialog.close();
    this.sing();
  }

  private showResult(mode: SingMode, r: SingResult): void {
    this.resultBody.replaceChildren(resultView(mode, r));
    if (!this.resultDialog.open) this.resultDialog.showModal();
    this.resultDialog.scrollTop = 0;
  }
}

function tile(w: SungWord): HTMLElement {
  const rl = levelOf(w.rhythm);
  const pl = w.pron === null ? null : w.missing ? 'weak' : levelOf(w.pron);
  const worst =
    pl === 'weak' || rl === 'weak' ? 'weak' : pl === 'ok' || rl === 'ok' ? 'ok' : 'good';
  const pronText =
    w.pron === null ? '' : w.missing ? 'pas chanté' : `${w.pron} sur 100, ${MARK_FR[pl!]}`;
  return el(
    'span',
    {
      class: 'pron-word sing-tile',
      'data-level': worst,
      role: 'listitem',
      title: `${w.word} : ${pronText ? `prononciation ${pronText} ; ` : ''}rythme ${w.rhythm} sur 100, ${MARK_FR[rl]}${w.offsetMs !== null && Math.abs(w.offsetMs) > 120 ? ` (${w.offsetMs > 0 ? 'en retard' : 'en avance'} de ${(Math.abs(w.offsetMs) / 1000).toFixed(1).replace('.', ',')} s)` : ''}${w.heard ? `, entendu comme « ${w.heard} »` : ''}`,
    },
    el('span', { class: 'pron-w', lang: 'en', text: w.word.replace(/[,.!?;:]+$/, '') }),
    pl
      ? el('span', {
          class: 'pron-s',
          'data-level': pl,
          text: `${MARK[pl]} ${w.missing ? '—' : w.pron}`,
        })
      : null,
    el('span', { class: 'pron-s sing-r', 'data-level': rl, text: `♪ ${MARK[rl]} ${w.rhythm}` }),
  );
}

/** The score of a take: overall, the two parts, one tile per word, what to work on. */
export function resultView(mode: SingMode, r: SingResult): HTMLElement {
  const box = el('div', { class: 'pron-result sing-result' });
  box.append(
    el(
      'p',
      { class: 'pron-overall' },
      'Ta note : ',
      el('strong', { text: `${r.overall}/100` }),
      ' ',
      el('span', { class: 'chip', text: 'estimation' }),
    ),
    el(
      'p',
      { class: 'sing-parts' },
      r.pron === null
        ? 'Prononciation : pas notée'
        : el('span', {}, 'Prononciation ', el('strong', { text: `${r.pron}` })),
      ' · ',
      el('span', {}, 'Rythme ', el('strong', { text: `${r.rhythm}` })),
    ),
  );
  if (r.pron === null) {
    box.append(
      el('p', {
        class: r.pronError ? 'error-text small' : 'muted small',
        text: r.pronError
          ? 'La prononciation n’a pas pu être notée cette fois (le service n’a pas répondu) : la note ne compte que ton rythme. Réessaie dans un instant.'
          : 'Seul le rythme est noté. Pour la prononciation mot par mot, ajoute ta clé Gemini gratuite dans « Réglages ».',
      }),
    );
  } else if (r.unreliable) {
    box.append(
      el('p', {
        class: 'error-text small',
        text: 'Le son n’était pas assez net pour bien noter la prononciation (bruit, voix trop basse ou autres paroles). Réessaie, micro près de la bouche.',
      }),
    );
  }
  const byLine = new Map<number, SungWord[]>();
  for (const w of r.words) byLine.set(w.line, [...(byLine.get(w.line) ?? []), w]);
  for (const [, words] of [...byLine.entries()].sort((a, b) => a[0] - b[0])) {
    box.append(
      el(
        'div',
        { class: 'pron-words', role: 'list', 'aria-label': 'Note de chaque mot' },
        ...words.map(tile),
      ),
    );
  }
  box.append(
    el('p', {
      class: 'muted small',
      text: `Sous chaque mot : ${r.pron === null ? '' : 'la prononciation, puis '}le rythme (♪). ✓ bien (80 et plus) · ~ presque (60 à 79) · ✗ à travailler. Survole un mot pour le détail.`,
    }),
  );
  if (mode === 'turns') {
    box.append(
      el('p', {
        class: 'muted small',
        text: 'En alternance, seules tes lignes sont notées.',
      }),
    );
  }
  // Sounds to work on: what the scorer flagged in the weak words.
  const sounds = new Map<SoundId, Set<string>>();
  for (const w of r.words) {
    if (w.pron === null || w.pron >= 70) continue;
    for (const s of w.issues) {
      sounds.set(
        s,
        (sounds.get(s) ?? new Set()).add(w.word.replace(/[,.!?;:]+$/, '').toLowerCase()),
      );
    }
  }
  if (sounds.size) {
    box.append(
      el('h3', { text: 'Sons à travailler' }),
      el(
        'ul',
        { class: 'pron-tips' },
        ...[...sounds.entries()]
          .sort((a, b) => b[1].size - a[1].size)
          .slice(0, 3)
          .map(([s, words]) =>
            el(
              'li',
              {},
              el('strong', { text: SOUNDS[s].labelFr }),
              ' — ',
              el('span', { lang: 'en', text: [...words].slice(0, 5).join(', ') }),
              el('br'),
              el('span', { class: 'small', text: SOUNDS[s].tipFr }),
            ),
          ),
      ),
    );
  }
  const late = r.words.filter((w) => w.rhythm < 60).map((w) => w.word.replace(/[,.!?;:]+$/, ''));
  if (late.length) {
    box.append(
      el('h3', { text: 'Rythme à reprendre' }),
      el(
        'p',
        { class: 'small' },
        'Ta voix n’était pas là au bon moment sur : ',
        el('span', { lang: 'en', text: [...new Set(late)].slice(0, 8).join(', ') }),
        '. Écoute Maya une fois, puis rechante (essaie « Plus lent »).',
      ),
    );
  }
  // A constant delay means something only when the voice followed the song.
  if (Math.abs(r.lagMs) >= 250 && r.rhythm >= 50) {
    box.append(
      el('p', {
        class: 'muted small',
        text: `Ta voix arrive en moyenne ${(Math.abs(r.lagMs) / 1000).toFixed(1).replace('.', ',')} s ${r.lagMs > 0 ? 'après' : 'avant'} la musique. Ce décalage constant est retiré avant de noter (un casque sans fil en ajoute souvent).`,
      }),
    );
  }
  if (r.feedbackFr) box.append(el('p', { class: 'pron-feedback', text: r.feedbackFr }));
  if (r.heardText) {
    box.append(
      el(
        'p',
        { class: 'muted small' },
        'La machine a entendu : ',
        el('span', { lang: 'en', text: `« ${r.heardText} »` }),
      ),
    );
  }
  box.append(
    el('p', {
      class: 'muted small',
      text:
        r.timing === 'voice+whisper'
          ? 'Rythme : mesuré sur ta voix dans ton navigateur, affiné par les horodatages de Groq Whisper.'
          : 'Rythme : mesuré sur ta voix, ici dans ton navigateur (présence de la voix au moment de chaque mot).',
    }),
  );
  return box;
}

export interface SongRow {
  song: Song;
  /** Best overall score so far, if any. */
  best: number | null;
}

export interface PickerHandlers {
  pick(song: Song): void;
  /** Writes today's song from the learner's lessons. */
  compose(): Promise<{ song: Song; by: 'gemini' | 'local'; used: Lesson[] }>;
  remove(song: Song): Promise<void>;
  errorText(err: unknown): string;
}

/** The songbook: the learner's own songs first, then the platform's and the public-domain ones. */
export function renderPicker(
  root: HTMLElement,
  own: readonly SongRow[],
  book: readonly SongRow[],
  lessons: readonly Lesson[],
  starter: boolean,
  h: PickerHandlers,
  refresh: (notice?: string) => void,
  notice = '',
): void {
  const row = (r: SongRow, removable: boolean): HTMLElement => {
    const go = el('button', { class: 'btn small', type: 'button', text: 'Chanter' });
    go.setAttribute('aria-label', `Chanter « ${r.song.title} »`);
    go.addEventListener('click', () => h.pick(r.song));
    const side = el('div', { class: 'row tight song-side' }, go);
    if (removable) {
      const del = el('button', { class: 'link danger', type: 'button', text: 'Effacer' });
      del.setAttribute('aria-label', `Effacer « ${r.song.title} »`);
      del.addEventListener('click', () => void h.remove(r.song).then(() => refresh()));
      side.append(del);
    }
    return el(
      'li',
      { class: 'song-row', 'data-id': r.song.id },
      el(
        'div',
        { class: 'song-text' },
        el('strong', { lang: 'en', text: r.song.title }),
        el(
          'span',
          { class: 'small muted' },
          el('span', { class: 'chip', text: KIND_FR[r.song.kind] }),
          ` ${r.song.focusFr}`,
          r.best !== null ? ` · meilleure note : ${r.best}/100` : '',
        ),
        removable && r.song.lines[0]
          ? el('span', {
              class: 'small',
              lang: 'en',
              text: `${r.song.lines[0].lyric.replace(/-/g, '')} …`,
            })
          : null,
      ),
      side,
    );
  };

  const status = el('p', { class: 'status small', 'aria-live': 'polite', text: notice });
  const write = el('button', {
    class: 'btn',
    type: 'button',
    id: 'song-write',
    text: own.length ? 'Écrire une nouvelle chanson' : 'Écrire ma chanson',
  });
  write.addEventListener('click', () => {
    write.disabled = true;
    status.className = 'status small busy';
    status.textContent = 'Écriture de ta chanson… (5 à 15 secondes)';
    h.compose().then(
      ({ song, by, used }) => {
        refresh(
          by === 'gemini'
            ? `« ${song.title} » est prête${used.length ? ` : elle contient ${used.length} de tes points à travailler` : ''}.`
            : `« ${song.title} » est prête (assemblée sans IA à partir de tes révisions).`,
        );
      },
      (err: unknown) => {
        write.disabled = false;
        status.className = 'status small error-text';
        status.textContent = h.errorText(err);
      },
    );
  });
  const mine = el(
    'section',
    { class: 'songs-own', 'aria-labelledby': 'songs-own-title' },
    el('h3', { id: 'songs-own-title', text: 'Ta chanson, écrite avec tes difficultés' }),
    el('p', {
      class: 'small muted',
      text: starter
        ? 'Tu n’as pas encore de révisions : la chanson partira de trois fautes classiques des francophones. Après tes premiers bilans, elle sera écrite avec tes propres fautes et tes mots du jour.'
        : 'Quatre lignes écrites avec les bonnes formes de tes fautes fréquentes et tes mots du jour, sur un air simple.',
    }),
    el(
      'ul',
      { class: 'song-lessons small' },
      ...lessons.map((l) =>
        el(
          'li',
          {},
          el('span', { class: 'chip', text: l.kind === 'mistake' ? 'Faute' : 'Mot' }),
          ' ',
          el('span', { lang: 'en', text: l.text }),
          el('span', { class: 'muted', text: ` — ${l.hintFr}` }),
        ),
      ),
    ),
    el('div', { class: 'row tight' }, write, status),
  );
  if (own.length) mine.append(el('ul', { class: 'song-list' }, ...own.map((r) => row(r, true))));
  root.replaceChildren(
    mine,
    el('h3', { text: 'Le carnet de chansons' }),
    el('ul', { class: 'song-list', id: 'song-book' }, ...book.map((r) => row(r, false))),
  );
}

/** "Mes progrès": what was sung, as two estimates (kept out of the level). */
export function singProgressSection(
  attempts: readonly { at: number; title: string; result: SingResult }[],
): HTMLElement | null {
  if (!attempts.length) return null;
  const recent = [...attempts].sort((a, b) => b.at - a.at).slice(0, 10);
  const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  const prons = recent.map((a) => a.result.pron).filter((p): p is number => p !== null);
  const songs = new Set(attempts.map((a) => a.title)).size;
  const bar = (label: string, value: number) =>
    skillRow(label, value, `${label} : ${value} sur 100 (estimation)`);
  const box = el(
    'section',
    { class: 'chart pron-progress sing-progress', 'aria-labelledby': 'sing-progress-title' },
    el(
      'h3',
      { id: 'sing-progress-title' },
      'Chansons ',
      el('span', { class: 'chip', text: 'estimation' }),
    ),
    el('p', {
      class: 'small muted',
      text: `${attempts.length} prise${attempts.length > 1 ? 's' : ''} chantée${attempts.length > 1 ? 's' : ''}, ${songs} chanson${songs > 1 ? 's' : ''}. ${recent.length > 1 ? `Moyenne des ${recent.length} dernières prises` : 'Note de cette prise'}, hors niveau estimé.`,
    }),
  );
  const list = el('div', { class: 'skills', role: 'list' });
  if (prons.length) list.append(bar('Prononciation chantée', avg(prons)));
  list.append(bar('Rythme', avg(recent.map((a) => a.result.rhythm))));
  box.append(list);
  return box;
}
