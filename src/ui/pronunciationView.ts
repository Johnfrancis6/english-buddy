import type { Exercise } from '../pronunciation/sentences';
import { SOUNDS, tokenize, soundsOf } from '../pronunciation/sounds';
import type { Take } from '../pronunciation/recorder';
import type { PronunciationResult, SoundId, WordScore } from '../pronunciation/types';
import { el } from './dom';

/**
 * "Prononciation": one sentence at a time. The learner reads it aloud, the
 * take is scored (per word, sounds to work on), then forgotten. Scores are
 * always labelled as estimates. Text only is kept (the sentence and scores).
 */
export interface PronHandlers {
  /** Starts recording one take (level callback for the meter). */
  record(onLevel: (rms: number) => void): Take;
  /** Scores and saves the take; the audio is dropped by the caller after it. */
  score(
    e: Exercise,
    wav: Uint8Array,
  ): Promise<{ result: PronunciationResult; added: number; graded: number; check?: string }>;
  /** French error text for a failure. */
  errorText(err: unknown): string;
  /** Reads the sentence with the browser's own voice (null if unavailable). */
  speak: ((text: string) => void) | null;
  /** Called when the session ends (to refresh counts). */
  done(scored: number): void;
}

const SOURCE_FR: Record<Exercise['source'], string> = {
  card: 'Révision',
  mistake: 'Tirée de tes fautes',
  word: 'Avec tes mots',
  bank: 'Sons difficiles',
};

export const levelOf = (score: number): 'good' | 'ok' | 'weak' =>
  score >= 80 ? 'good' : score >= 60 ? 'ok' : 'weak';
const MARK = { good: '✓', ok: '~', weak: '✗' } as const;
const MARK_FR = { good: 'bien', ok: 'presque', weak: 'à travailler' } as const;

/** The sentence with its hard-sound words underlined. */
function sentenceView(text: string, focus?: string): HTMLElement {
  const p = el('p', { class: 'pron-sentence', lang: 'en' });
  const tokens = tokenize(text);
  let rest = text;
  for (const t of tokens) {
    const at = rest.indexOf(t);
    if (at < 0) continue;
    if (at > 0) p.append(rest.slice(0, at));
    const sounds = soundsOf(t);
    const isFocus = focus && t.toLowerCase() === focus.toLowerCase();
    p.append(
      sounds.length || isFocus
        ? el('span', {
            class: isFocus ? 'pron-hard focus' : 'pron-hard',
            title: sounds.map((s) => SOUNDS[s].labelFr).join(', '),
            text: t,
          })
        : t,
    );
    rest = rest.slice(at + t.length);
  }
  if (rest) p.append(rest);
  return p;
}

function wordView(w: WordScore): HTMLElement {
  const level = w.missing ? 'weak' : levelOf(w.score);
  const label = w.missing ? 'pas dit' : `${w.score}`;
  return el(
    'span',
    {
      class: 'pron-word',
      'data-level': level,
      role: 'listitem',
      title: `${w.word} : ${w.missing ? 'mot pas entendu' : `${w.score} sur 100, ${MARK_FR[level]}`}${w.heard ? `, entendu comme « ${w.heard} »` : ''}${w.notRecognised ? ', pas reconnu par Whisper' : ''}`,
    },
    el('span', { class: 'pron-w', lang: 'en', text: w.word }),
    el('span', { class: 'pron-s', text: `${MARK[level]} ${label}` }),
  );
}

/** Sounds to work on in this result: issues first, then weak words' sounds. */
export function soundsToWork(r: PronunciationResult): { sound: SoundId; words: string[] }[] {
  const map = new Map<SoundId, Set<string>>();
  for (const w of r.words) {
    const weak = w.missing || w.score < 70;
    const list = w.issues.length ? w.issues : weak ? w.sounds : [];
    for (const s of list) {
      if (!map.has(s)) map.set(s, new Set());
      map.get(s)!.add(w.word.toLowerCase());
    }
  }
  return [...map.entries()]
    .map(([sound, words]) => ({ sound, words: [...words] }))
    .sort((a, b) => b.words.length - a.words.length)
    .slice(0, 3);
}

export function resultView(r: PronunciationResult): HTMLElement {
  const box = el('div', { class: 'pron-result' });
  box.append(
    el(
      'p',
      { class: 'pron-overall' },
      'Ta note : ',
      el('strong', { text: `${r.overall}/100` }),
      ' ',
      el('span', { class: 'chip', text: 'estimation' }),
    ),
  );
  if (r.unreliable) {
    box.append(
      el('p', {
        class: 'error-text small',
        text: 'Le son n’était pas assez net pour bien noter (silence, bruit ou autre phrase). Cette note ne compte pas : réessaie, micro près de la bouche.',
      }),
    );
  }
  box.append(
    el(
      'div',
      { class: 'pron-words', role: 'list', 'aria-label': 'Note de chaque mot' },
      ...r.words.map(wordView),
    ),
    el('p', {
      class: 'muted small',
      text: '✓ bien (80 et plus) · ~ presque (60 à 79) · ✗ à travailler (moins de 60). Survole un mot pour le détail.',
    }),
  );
  const work = soundsToWork(r);
  if (work.length) {
    const list = el('ul', { class: 'pron-tips' });
    for (const x of work) {
      list.append(
        el(
          'li',
          {},
          el('strong', { text: SOUNDS[x.sound].labelFr }),
          ' — ',
          el('span', { lang: 'en', text: x.words.join(', ') }),
          el('br'),
          el('span', { class: 'small', text: SOUNDS[x.sound].tipFr }),
        ),
      );
    }
    box.append(el('h3', { text: 'Sons à travailler' }), list);
  }
  // The scorer's own tips, one line per distinct tip (words grouped).
  const byTip = new Map<string, string[]>();
  for (const w of r.words) {
    if (!w.tipFr || (!w.missing && w.score >= 70)) continue;
    byTip.set(w.tipFr, [...(byTip.get(w.tipFr) ?? []), w.word]);
  }
  if (byTip.size) {
    box.append(
      el(
        'ul',
        { class: 'pron-word-tips small' },
        ...[...byTip.entries()]
          .slice(0, 3)
          .map(([tip, ws]) =>
            el(
              'li',
              {},
              el('strong', { lang: 'en', text: [...new Set(ws)].join(', ') }),
              ` : ${tip}`,
            ),
          ),
      ),
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
  return box;
}

export class PronunciationView {
  private items: readonly Exercise[] = [];
  private index = 0;
  private scored: number[] = [];
  private take: Take | null = null;
  private allSounds = new Map<SoundId, Set<string>>();

  constructor(
    private readonly root: HTMLElement,
    private readonly meta: HTMLElement,
    private readonly h: PronHandlers,
    private readonly scorerLabel: () => string,
  ) {}

  start(items: readonly Exercise[]): void {
    this.items = items;
    this.index = 0;
    this.scored = [];
    this.allSounds.clear();
    this.show();
  }

  /** Stops any recording (dialog closed): the take is dropped. */
  stop(): void {
    this.take?.cancel();
    this.take = null;
  }

  private show(): void {
    this.root.replaceChildren();
    if (this.index >= this.items.length) {
      this.end();
      return;
    }
    const e = this.items[this.index];
    this.meta.textContent = `Phrase ${this.index + 1} sur ${this.items.length} · notée par ${this.scorerLabel()}`;
    const card = el('article', { class: 'pron-card', 'data-source': e.source });
    card.append(
      el(
        'p',
        { class: 'review-top muted small' },
        el('span', { class: 'chip', text: SOURCE_FR[e.source] }),
        ...e.sounds.slice(0, 3).map((s) => el('span', { class: 'chip', text: SOUNDS[s].labelFr })),
      ),
      el('p', {
        class: 'review-ask',
        text: e.focusWord
          ? `Lis cette phrase à voix haute, en soignant « ${e.focusWord} » :`
          : 'Lis cette phrase à voix haute :',
      }),
      sentenceView(e.text, e.focusWord),
    );
    const status = el('p', { class: 'status small', 'aria-live': 'polite' });
    const meter = el('span', { class: 'meter', 'aria-hidden': 'true' }, el('span'));
    meter.hidden = true;
    const record = el('button', { class: 'btn primary', type: 'button', text: 'Enregistrer' });
    const actions = el('div', { class: 'row tight' }, record);
    if (this.h.speak) {
      const listen = el('button', { class: 'btn', type: 'button', text: 'Écouter le modèle' });
      listen.title = 'Lu par la voix de ton navigateur : un repère, pas une référence parfaite.';
      listen.addEventListener('click', () => this.h.speak?.(e.text));
      actions.append(listen);
    }
    const skip = el('button', { class: 'link', type: 'button', text: 'Passer cette phrase' });
    skip.addEventListener('click', () => {
      this.stop();
      this.index++;
      this.show();
    });
    const result = el('div', { class: 'pron-out' });
    card.append(
      actions,
      el('p', { class: 'pron-live' }, meter, ' ', status),
      result,
      el('p', {}, skip),
    );
    this.root.append(card);
    record.addEventListener('click', () =>
      this.recordOnce(e, record, meter, status, result, actions),
    );
    queueMicrotask(() => record.focus());
  }

  private recordOnce(
    e: Exercise,
    btn: HTMLButtonElement,
    meter: HTMLElement,
    status: HTMLElement,
    out: HTMLElement,
    actions: HTMLElement,
  ): void {
    if (this.take) {
      this.take.finish();
      return;
    }
    out.replaceChildren();
    actions.querySelector('.pron-next')?.remove();
    btn.className = 'btn primary';
    status.className = 'status small';
    status.textContent = 'Je t’écoute… lis la phrase, puis tais-toi une seconde.';
    btn.textContent = 'J’ai fini';
    meter.hidden = false;
    const fill = meter.firstElementChild as HTMLElement;
    const take = this.h.record((rms) => {
      fill.style.width = `${Math.min(100, Math.round(rms * 600))}%`;
      fill.classList.toggle('voiced', rms > 0.02);
    });
    this.take = take;
    for (const b of actions.querySelectorAll('button')) if (b !== btn) b.disabled = true;
    const reset = () => {
      this.take = null;
      meter.hidden = true;
      btn.disabled = false;
      for (const b of actions.querySelectorAll('button')) b.disabled = false;
    };
    take.result.then(
      async (wav) => {
        reset();
        if (!wav) {
          btn.textContent = 'Enregistrer';
          status.className = 'status small error-text';
          status.textContent =
            'Je n’ai pas entendu ta voix. Vérifie le micro choisi dans les réglages et parle un peu plus fort.';
          return;
        }
        btn.disabled = true;
        status.className = 'status small busy';
        status.textContent = 'Notation de ta prononciation… (2 à 10 secondes)';
        try {
          const r = await this.h.score(e, wav);
          status.className = 'status small';
          status.textContent = r.result.unreliable ? '' : this.summary(r.added, r.graded);
          out.replaceChildren(resultView(r.result));
          if (!r.result.unreliable) {
            this.scored.push(r.result.overall);
            for (const x of soundsToWork(r.result)) {
              const set = this.allSounds.get(x.sound) ?? new Set<string>();
              x.words.forEach((w) => set.add(w));
              this.allSounds.set(x.sound, set);
            }
          }
          btn.disabled = false;
          btn.textContent = 'Réessayer';
          btn.className = 'btn';
          const next = el('button', {
            class: 'btn primary pron-next',
            type: 'button',
            text: this.index + 1 < this.items.length ? 'Phrase suivante' : 'Voir le résumé',
          });
          next.addEventListener('click', () => {
            this.index++;
            this.show();
          });
          actions.prepend(next);
          queueMicrotask(() => next.focus());
        } catch (err) {
          btn.disabled = false;
          btn.textContent = 'Réessayer';
          status.className = 'status small error-text';
          status.textContent = this.h.errorText(err);
        }
      },
      (err: unknown) => {
        reset();
        btn.textContent = 'Enregistrer';
        status.className = 'status small error-text';
        status.textContent = this.h.errorText(err);
      },
    );
  }

  private summary(added: number, graded: number): string {
    const parts: string[] = [];
    if (graded)
      parts.push(`${graded} révision${graded > 1 ? 's' : ''} notée${graded > 1 ? 's' : ''}`);
    if (added)
      parts.push(
        `${added} mot${added > 1 ? 's' : ''} ajouté${added > 1 ? 's' : ''} à tes révisions`,
      );
    return parts.length ? `${parts.join(' · ')} ✓` : '';
  }

  private end(): void {
    this.meta.textContent = '';
    const n = this.scored.length;
    const box = el('div', { class: 'review-end' });
    if (!n) {
      box.append(
        el('p', {
          class: 'summary',
          text: 'Aucune phrase notée cette fois. Reviens quand tu veux : quelques minutes suffisent.',
        }),
      );
    } else {
      const mean = Math.round(this.scored.reduce((a, b) => a + b, 0) / n);
      box.append(
        el(
          'p',
          { class: 'summary' },
          `Bravo : ${n} phrase${n > 1 ? 's' : ''} lue${n > 1 ? 's' : ''}, moyenne `,
          el('strong', { text: `${mean}/100` }),
          ' ',
          el('span', { class: 'chip', text: 'estimation' }),
        ),
      );
      const sounds = [...this.allSounds.entries()]
        .sort((a, b) => b[1].size - a[1].size)
        .slice(0, 3);
      if (sounds.length) {
        box.append(
          el('h3', { text: 'À travailler en priorité' }),
          el(
            'ul',
            { class: 'pron-tips' },
            ...sounds.map(([s, words]) =>
              el(
                'li',
                {},
                el('strong', { text: SOUNDS[s].labelFr }),
                ' — ',
                el('span', { lang: 'en', text: [...words].slice(0, 4).join(', ') }),
              ),
            ),
          ),
        );
      }
      box.append(
        el('p', {
          class: 'muted small',
          text: 'Les mots difficiles reviennent dans tes révisions au bon moment (méthode FSRS). Ta note de prononciation apparaît dans « Mes progrès ».',
        }),
      );
    }
    this.root.append(box);
    this.h.done(n);
  }
}
