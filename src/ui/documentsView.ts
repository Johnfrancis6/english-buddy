import { looksScanned, latinShare, type HardWord, type StudyDoc } from '../documents/text';
import { el } from './dom';
import { paragraphs } from './goalsView';

export interface DocumentsDeps {
  list: () => Promise<StudyDoc[]>;
  save: (doc: StudyDoc) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Imports a PDF file; returns the new document or a French error. */
  importPdf: (file: File) => Promise<StudyDoc | string>;
  /** Opens a web link; returns the new document or a French error. */
  importLink: (raw: string) => Promise<StudyDoc | string>;
  /** Hard words of a passage (Gemini); throws a French message. */
  hardWords: (passage: string) => Promise<HardWord[]>;
  hasKey: () => boolean;
  /** Ids of the word cards that already exist. */
  knownWords: () => Promise<Set<string>>;
  wordId: (english: string) => string;
  /** Adds one word to the reviews; false if it was already there. */
  addWord: (w: HardWord, doc: StudyDoc) => Promise<boolean>;
  characterName: () => string;
  /** Study a passage with the current character. */
  study: (doc: StudyDoc, passage: number) => void;
  /** Opens the welcome at the key step. */
  askKey: () => void;
  log: (text: string) => void;
}

const dateFr = (t: number) =>
  new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
const nf = new Intl.NumberFormat('fr-FR');

/**
 * "Mes documents": import a PDF or a web link, read it passage by passage,
 * find the hard words, add words to the reviews, study a passage with a
 * character. Everything is text in this browser.
 */
export class DocumentsView {
  private doc: StudyDoc | null = null;
  private passage = 0;
  private busy = false;

  constructor(
    private readonly dialog: HTMLDialogElement,
    private readonly body: HTMLElement,
    private readonly meta: HTMLElement,
    private readonly actions: HTMLElement,
    private readonly deps: DocumentsDeps,
  ) {}

  async open(): Promise<void> {
    this.doc = null;
    await this.renderList();
    if (!this.dialog.open) this.dialog.showModal();
    this.dialog.querySelector<HTMLElement>('h2')?.focus();
  }

  private closeBtn(primary: boolean): HTMLButtonElement {
    const b = el('button', {
      class: primary ? 'btn primary' : 'btn',
      type: 'button',
      id: 'documents-close',
      text: 'Fermer',
    });
    b.addEventListener('click', () => this.dialog.close());
    return b;
  }

  // ------------------------------------------------------------------ list
  private async renderList(status = ''): Promise<void> {
    const docs = await this.deps.list().catch(() => [] as StudyDoc[]);
    this.dialog.dataset.view = 'list';
    this.meta.textContent = docs.length
      ? `${docs.length} document${docs.length > 1 ? 's' : ''}`
      : '';
    const statusP = el('p', {
      id: 'documents-status',
      class: 'small',
      'aria-live': 'polite',
      text: status,
    });
    const setStatus = (text: string, kind: '' | 'busy' | 'error' | 'ok' = '') => {
      statusP.textContent = text;
      statusP.className = `small ${kind === 'busy' ? 'status busy' : kind === 'error' ? 'error-text' : kind === 'ok' ? 'ok-text' : ''}`;
    };

    const file = el('input', {
      id: 'doc-file',
      type: 'file',
      accept: 'application/pdf,.pdf',
      class: 'visually-hidden',
      tabindex: '-1',
    });
    const pick = el('button', {
      class: 'btn',
      type: 'button',
      id: 'doc-pick',
      text: 'Importer un PDF',
    });
    pick.addEventListener('click', () => file.click());
    file.addEventListener('change', () => {
      const f = file.files?.[0];
      file.value = '';
      if (!f || this.busy) return;
      void this.run(setStatus, `Lecture de « ${f.name} »…`, () => this.deps.importPdf(f));
    });

    const link = el('input', {
      id: 'doc-link',
      type: 'url',
      spellcheck: 'false',
      placeholder: 'https://…',
    });
    const go = el('button', {
      class: 'btn small',
      type: 'button',
      id: 'doc-link-go',
      text: 'Ouvrir le lien',
    });
    const openLink = () => {
      if (this.busy || !link.value.trim()) return;
      void this.run(setStatus, 'Ouverture du lien…', () => this.deps.importLink(link.value));
    };
    go.addEventListener('click', openLink);
    link.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        openLink();
      }
    });

    const items = docs.map((d) => {
      const openB = el('button', { class: 'btn small', type: 'button', text: 'Ouvrir' });
      openB.addEventListener('click', () => this.openDoc(d, d.lastPassage ?? 0));
      const del = el('button', { class: 'link danger', type: 'button', text: 'Effacer' });
      del.addEventListener('click', () => {
        void this.deps.remove(d.id).then(() => {
          this.deps.log(`Document effacé : ${d.title}`);
          void this.renderList('Document effacé de ce navigateur.');
        });
      });
      return el(
        'li',
        { class: 'doc-item', 'data-id': d.id },
        el(
          'div',
          { class: 'doc-text' },
          el('strong', { text: d.title }),
          el('span', {
            class: 'small muted',
            text: `${d.kind === 'pdf' ? 'PDF' : 'Lien web'} · ${d.pages ? `${d.pages} page${d.pages > 1 ? 's' : ''} · ` : ''}${nf.format(d.words)} mots · ${d.passages.length} passage${d.passages.length > 1 ? 's' : ''} · ajouté le ${dateFr(d.addedAt)}`,
          }),
        ),
        el('div', { class: 'row tight' }, openB, del),
      );
    });

    this.body.replaceChildren(
      el(
        'p',
        { class: 'muted small' },
        'Importe un document en anglais (cours, article, document de travail) et étudie-le à voix haute avec un personnage : il t’explique les mots difficiles et te pose des questions. Le texte reste dans ce navigateur ; seul le passage étudié est envoyé à Google.',
      ),
      el('div', { class: 'row tight' }, pick, file),
      el('label', { for: 'doc-link', text: 'Ou un lien web (page ou PDF)' }),
      el('div', { class: 'link-row' }, link, go),
      el('p', {
        class: 'muted small',
        text: 'Un lien ne marche que si le site l’autorise. Sinon, enregistre la page en PDF et importe-la.',
      }),
      statusP,
      el('h3', { text: 'Mes documents' }),
      items.length
        ? el('ul', { class: 'doc-list' }, ...items)
        : el('p', {
            class: 'muted small empty',
            text: 'Pas encore de document : importe un PDF pour commencer.',
          }),
    );
    this.actions.replaceChildren(this.closeBtn(true));
  }

  /** Runs an import and opens the new document, or shows the French error. */
  private async run(
    setStatus: (t: string, k?: '' | 'busy' | 'error' | 'ok') => void,
    waiting: string,
    job: () => Promise<StudyDoc | string>,
  ): Promise<void> {
    this.busy = true;
    setStatus(waiting, 'busy');
    try {
      const r = await job();
      if (typeof r === 'string') {
        setStatus(r, 'error');
        return;
      }
      await this.deps.save(r);
      this.deps.log(
        `Document importé : ${r.title} (${r.words} mots, ${r.passages.length} passages)`,
      );
      this.openDoc(r, 0, this.warning(r));
    } catch (err) {
      setStatus('Ce document n’a pas pu être lu. Essaie un autre fichier.', 'error');
      this.deps.log(`Import impossible : ${String(err)}`);
    } finally {
      this.busy = false;
    }
  }

  private warning(d: StudyDoc): string {
    if (looksScanned(d.words, d.pages)) {
      return 'Peu de texte trouvé : ce PDF est peut-être une image scannée. Seul le texte sélectionnable peut être lu.';
    }
    if (latinShare(d.passages.join(' ')) < 0.9) {
      return 'Ce document ne semble pas être en anglais : les personnages l’étudieront en anglais quand même.';
    }
    return '';
  }

  // ---------------------------------------------------------------- reader
  private openDoc(d: StudyDoc, passage: number, note = ''): void {
    this.doc = d;
    this.passage = Math.max(0, Math.min(passage, d.passages.length - 1));
    if (!d.passages.length) {
      void this.renderList('Aucun texte n’a été trouvé dans ce document (image scannée ?).');
      return;
    }
    void this.renderReader(note);
  }

  private async renderReader(note = ''): Promise<void> {
    const d = this.doc!;
    const i = this.passage;
    if (d.lastPassage !== i) {
      d.lastPassage = i;
      void this.deps.save(d);
    }
    this.dialog.dataset.view = 'reader';
    this.meta.textContent = '';
    const back = el('button', {
      class: 'link',
      type: 'button',
      id: 'doc-back',
      text: '← Mes documents',
    });
    back.addEventListener('click', () => void this.renderList());
    const prev = el('button', {
      class: 'btn quiet small',
      type: 'button',
      id: 'doc-prev',
      text: '← Passage précédent',
    });
    const next = el('button', {
      class: 'btn quiet small',
      type: 'button',
      id: 'doc-next',
      text: 'Passage suivant →',
    });
    prev.disabled = i === 0;
    next.disabled = i >= d.passages.length - 1;
    prev.addEventListener('click', () => this.go(-1));
    next.addEventListener('click', () => this.go(1));

    const text = el(
      'div',
      { class: 'passage-text doc-passage', lang: 'en', tabindex: '0' },
      ...paragraphs(d.passages[i]),
    );
    text.setAttribute('aria-label', `Passage ${i + 1}`);

    // Manual add, prefilled from a selection in the passage.
    const en = el('input', { id: 'doc-word-en', type: 'text', lang: 'en', spellcheck: 'false' });
    const fr = el('input', { id: 'doc-word-fr', type: 'text' });
    const manualStatus = el('p', { class: 'small', 'aria-live': 'polite' });
    const addManual = el('button', {
      class: 'btn small',
      type: 'button',
      id: 'doc-word-add',
      text: 'Ajouter aux révisions',
    });
    const manual = el(
      'details',
      { class: 'doc-manual' },
      el('summary', { text: 'Ajouter un mot moi-même' }),
      el('p', {
        class: 'muted small',
        text: 'Astuce : sélectionne un mot dans le texte, il se met dans la case.',
      }),
      el('label', { for: 'doc-word-en', text: 'Mot ou expression en anglais' }),
      en,
      el('label', { for: 'doc-word-fr', text: 'Son sens en français' }),
      fr,
      el('div', { class: 'row tight' }, addManual),
      manualStatus,
    );
    text.addEventListener('mouseup', () => {
      const sel = window.getSelection()?.toString().replace(/\s+/g, ' ').trim() ?? '';
      if (!sel || sel.split(' ').length > 5) return;
      en.value = sel.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
      manual.open = true;
      fr.focus();
    });
    addManual.addEventListener('click', () => {
      const w: HardWord = {
        english: en.value.trim(),
        french: fr.value.trim(),
        example: sentenceWith(d.passages[i], en.value.trim()),
      };
      if (!w.english || !w.french) {
        manualStatus.className = 'small error-text';
        manualStatus.textContent = 'Écris le mot en anglais et son sens en français.';
        return;
      }
      void this.deps.addWord(w, d).then((added) => {
        manualStatus.className = 'small ok-text';
        manualStatus.textContent = added
          ? `« ${w.english} » ajouté à tes révisions ✓`
          : `« ${w.english} » est déjà dans tes révisions.`;
        en.value = '';
        fr.value = '';
        void this.renderWords(wordsBox);
      });
    });

    const wordsBox = el('div', { id: 'doc-words' });
    await this.renderWords(wordsBox);

    const name = this.deps.characterName();
    const studyBtn = el('button', {
      class: 'btn primary',
      type: 'button',
      id: 'doc-study',
      text: `Étudier ce passage avec ${name}`,
    });
    studyBtn.addEventListener('click', () => {
      this.dialog.close();
      this.deps.study(d, i);
    });

    this.body.replaceChildren(
      back,
      el('p', { class: 'doc-title' }, el('strong', { text: d.title })),
      el(
        'div',
        { class: 'row tight doc-nav' },
        prev,
        el('span', {
          class: 'chip',
          id: 'doc-passage-chip',
          text: `Passage ${i + 1} sur ${d.passages.length}`,
        }),
        next,
      ),
      note ? el('p', { class: 'small error-text', role: 'alert', text: note }) : '',
      text,
      el('h3', { text: 'Mots difficiles' }),
      wordsBox,
      manual,
    );
    this.actions.replaceChildren(studyBtn, this.closeBtn(false));
  }

  private go(delta: number): void {
    this.passage += delta;
    void this.renderReader().then(() => {
      this.dialog.querySelector<HTMLElement>('.doc-passage')?.scrollTo(0, 0);
    });
  }

  private async renderWords(box: HTMLElement): Promise<void> {
    const d = this.doc!;
    const i = this.passage;
    const words = d.hardWords?.[i];
    const status = el('p', { class: 'small', id: 'doc-words-status', 'aria-live': 'polite' });
    if (!words) {
      const find = el('button', {
        class: 'btn small',
        type: 'button',
        id: 'doc-find-words',
        text: 'Trouver les mots difficiles',
      });
      find.addEventListener('click', () => {
        if (!this.deps.hasKey()) {
          this.dialog.close();
          this.deps.askKey();
          return;
        }
        find.disabled = true;
        status.className = 'small status busy';
        status.textContent = 'Je cherche les mots difficiles… (5 à 15 secondes)';
        this.deps.hardWords(d.passages[i]).then(
          async (found) => {
            d.hardWords = { ...(d.hardWords ?? {}), [i]: found };
            await this.deps.save(d);
            this.deps.log(`Mots difficiles du passage ${i + 1} : ${found.length}`);
            await this.renderWords(box);
          },
          (err: unknown) => {
            find.disabled = false;
            status.className = 'small error-text';
            status.textContent = err instanceof Error ? err.message : String(err);
          },
        );
      });
      box.replaceChildren(
        el('p', {
          class: 'muted small',
          text: this.deps.hasKey()
            ? 'L’IA repère les mots utiles et difficiles de ce passage, avec leur sens en français. Tu choisis ceux à réviser.'
            : 'Il faut ta clé Gemini pour repérer les mots difficiles. Tu peux aussi ajouter des mots toi-même, plus bas.',
        }),
        el('div', { class: 'row tight' }, find),
        status,
      );
      return;
    }
    if (!words.length) {
      box.replaceChildren(
        el('p', { class: 'muted small', text: 'Aucun mot difficile trouvé dans ce passage.' }),
      );
      return;
    }
    const known = await this.deps.knownWords().catch(() => new Set<string>());
    box.replaceChildren(
      el(
        'ul',
        { class: 'doc-words' },
        ...words.map((w) => {
          const inReviews = known.has(this.deps.wordId(w.english));
          const add = el('button', {
            class: 'btn small',
            type: 'button',
            text: 'Ajouter aux révisions',
          });
          const done = el('span', { class: 'chip ok', text: 'dans tes révisions ✓' });
          add.hidden = inReviews;
          done.hidden = !inReviews;
          add.addEventListener('click', () => {
            add.disabled = true;
            void this.deps.addWord(w, d).then(() => {
              add.hidden = true;
              done.hidden = false;
            });
          });
          return el(
            'li',
            { 'data-word': w.english },
            el(
              'div',
              { class: 'doc-text' },
              el('span', {}, el('strong', { lang: 'en', text: w.english }), ` — ${w.french}`),
              w.example ? el('span', { class: 'small muted', lang: 'en', text: w.example }) : '',
            ),
            add,
            done,
          );
        }),
      ),
    );
  }
}

/** The sentence of the passage that contains the word ('' if none). */
export function sentenceWith(passage: string, word: string): string {
  if (!word) return '';
  const w = word.toLowerCase();
  const s = (passage.match(/[^.!?\n]+[.!?]?/g) ?? []).find((x) => x.toLowerCase().includes(w));
  return (s ?? '').trim().slice(0, 240);
}
