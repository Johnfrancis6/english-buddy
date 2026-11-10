import { FACT_CATEGORIES, LEARNER_CATEGORIES, type Fact, type FactCategory } from '../memory/facts';
import { el } from './dom';

export interface MemoryHandlers {
  /** Name of a character, for the last-talk lines. */
  characterName(id: string): string;
  save(fact: Fact): Promise<void>;
  remove(id: string): Promise<void>;
  add(category: FactCategory, text: string): Promise<void>;
}

const when = (ts: number) =>
  new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

/**
 * "Ce que les personnages savent de toi": every fact, grouped by category,
 * each one editable and erasable; a form to add one.
 */
export function renderMemory(root: HTMLElement, facts: readonly Fact[], h: MemoryHandlers): void {
  root.replaceChildren();
  if (!facts.length) {
    root.append(
      el('p', {
        class: 'empty muted',
        text: 'Les personnages ne savent encore rien de toi : parle avec l’un d’eux, et ce que tu lui racontes sur ta vie apparaîtra ici après le bilan.',
      }),
    );
  }
  const order = Object.keys(FACT_CATEGORIES) as FactCategory[];
  for (const cat of order) {
    const list = facts.filter((f) => f.category === cat);
    if (!list.length) continue;
    root.append(
      el(
        'section',
        { class: 'fact-group', 'data-category': cat },
        el('h3', { text: FACT_CATEGORIES[cat] }),
        el('ul', { class: 'facts' }, ...list.map((f) => factRow(f, h))),
      ),
    );
  }
  root.append(addForm(h));
}

function factRow(f: Fact, h: MemoryHandlers): HTMLElement {
  const li = el('li', { class: 'fact', 'data-id': f.id });
  const view = () => {
    const meta =
      f.category === 'last_talk'
        ? `avec ${h.characterName(f.character ?? '')} · ${when(f.updatedAt)}`
        : f.byLearner
          ? `écrit ou corrigé par toi · ${when(f.updatedAt)}`
          : `appris le ${when(f.updatedAt)}`;
    const edit = el('button', { class: 'btn quiet small', type: 'button', text: 'Corriger' });
    const del = el('button', { class: 'link danger small', type: 'button', text: 'Effacer' });
    edit.addEventListener('click', editMode);
    del.addEventListener('click', () => {
      del.disabled = true;
      void h.remove(f.id).then(() => li.remove());
    });
    li.replaceChildren(
      el('p', { class: 'fact-text', text: f.text }),
      el(
        'div',
        { class: 'fact-actions' },
        el('span', { class: 'muted small', text: meta }),
        edit,
        del,
      ),
    );
  };
  const editMode = () => {
    const id = `fact-edit-${f.id}`;
    const input = el('textarea', { id, rows: '2', maxlength: '200' });
    input.value = f.text;
    const save = el('button', { class: 'btn primary small', type: 'button', text: 'Enregistrer' });
    const cancel = el('button', { class: 'btn small', type: 'button', text: 'Annuler' });
    save.addEventListener('click', () => {
      const text = input.value.trim();
      if (!text) return;
      Object.assign(f, { text, byLearner: true, updatedAt: Date.now() });
      void h.save(f).then(view);
    });
    cancel.addEventListener('click', view);
    li.replaceChildren(
      el('label', { class: 'visually-hidden', for: id, text: 'Corrige cette phrase' }),
      input,
      el('div', { class: 'row tight' }, save, cancel),
    );
    input.focus();
  };
  view();
  return li;
}

function addForm(h: MemoryHandlers): HTMLElement {
  const select = el('select', { id: 'fact-category' });
  for (const c of LEARNER_CATEGORIES) select.add(new Option(FACT_CATEGORIES[c], c));
  const input = el('input', {
    id: 'fact-new',
    type: 'text',
    maxlength: '200',
    placeholder: 'Par exemple : Travaille comme ingénieur dans une banque.',
  });
  const add = el('button', { class: 'btn small', type: 'button', text: 'Ajouter' });
  add.addEventListener('click', () => {
    const text = input.value.trim();
    if (!text) return input.focus();
    add.disabled = true;
    void h.add(select.value as FactCategory, text).finally(() => (add.disabled = false));
  });
  return el(
    'details',
    { class: 'add-fact' },
    el('summary', { text: 'Ajouter quelque chose sur toi' }),
    el('label', { for: 'fact-category', text: 'Sujet' }),
    select,
    el('label', { for: 'fact-new', text: 'Une phrase courte, en français' }),
    input,
    el('div', { class: 'row tight' }, add),
  );
}
