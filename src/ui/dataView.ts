import { DATA_GROUPS, type DataGroup } from '../storage/wipe';
import { el } from './dom';

/**
 * "Mes données" in the settings: one row per kind of data the app keeps
 * (with a count), each with its own "Effacer", plus the keys and one
 * "Tout effacer de ce navigateur". Every erase asks first.
 */
export interface DataHandlers {
  counts(): Promise<Record<DataGroup['id'], number>>;
  clear(id: DataGroup['id']): Promise<void>;
  /** Number of API keys saved (0–3). */
  keyCount(): number;
  forgetKeys(): void;
  /** Erases everything, keys included, then reloads the page. */
  wipe(): Promise<void>;
  confirm(question: string): boolean;
}

const UNITS: Record<DataGroup['id'], [string, string]> = {
  talks: ['élément', 'éléments'],
  facts: ['fait', 'faits'],
  cards: ['carte', 'cartes'],
  docs: ['document', 'documents'],
  pron: ['phrase notée', 'phrases notées'],
};

export function countFr(n: number, [one, many]: [string, string]): string {
  return n === 0 ? 'vide' : `${n} ${n === 1 ? one : many}`;
}

export async function renderData(
  list: HTMLElement,
  status: HTMLElement,
  h: DataHandlers,
): Promise<void> {
  const counts = await h.counts().catch(() => null);
  list.replaceChildren();
  const row = (label: string, what: string, count: string, action: HTMLElement | null) =>
    list.append(
      el(
        'li',
        { class: 'data-row' },
        el(
          'div',
          { class: 'data-text' },
          el('strong', { text: label }),
          el('span', { class: 'small muted', text: what }),
        ),
        el('span', { class: 'chip', text: count }),
        action,
      ),
    );
  const eraseBtn = (label: string, onClick: () => void) => {
    const b = el('button', {
      class: 'link danger',
      type: 'button',
      text: 'Effacer',
      'aria-label': `Effacer : ${label}`,
    });
    b.addEventListener('click', onClick);
    return b;
  };

  DATA_GROUPS.forEach((g) => {
    const n = counts?.[g.id] ?? 0;
    row(
      g.label,
      g.what,
      countFr(n, UNITS[g.id]),
      n
        ? eraseBtn(g.label, () => {
            if (!h.confirm(`Effacer « ${g.label} » de ce navigateur ? C’est définitif.`)) return;
            void h.clear(g.id).then(
              () => {
                status.textContent = `« ${g.label} » : effacé de ce navigateur.`;
                void renderData(list, status, h);
              },
              () => (status.textContent = 'Effacement impossible. Recharge la page et réessaie.'),
            );
          })
        : null,
    );
  });

  const keys = h.keyCount();
  const forget = keys
    ? eraseBtn('clés API', () => {
        if (!h.confirm('Effacer tes clés API de ce navigateur ?')) return;
        h.forgetKeys();
        status.textContent = 'Clés effacées de ce navigateur.';
        void renderData(list, status, h);
      })
    : null;
  if (forget) forget.id = 'forget-key';
  row(
    'Clés API',
    'Gemini, Groq, Azure : envoyées seulement à leur service',
    keys ? `${keys} clé${keys > 1 ? 's' : ''}` : 'aucune',
    forget,
  );

  const all = el('button', {
    id: 'wipe-all',
    class: 'link danger',
    type: 'button',
    text: 'Tout effacer de ce navigateur',
  });
  all.addEventListener('click', () => {
    if (
      !h.confirm(
        'Tout effacer : conversations, mémoire, révisions, documents, notes, réglages et clés. C’est définitif. Continuer ?',
      )
    )
      return;
    status.textContent = 'Effacement…';
    void h.wipe().catch(() => {
      status.textContent = 'Effacement impossible. Recharge la page et réessaie.';
    });
  });
  list.append(
    el(
      'li',
      { class: 'data-row last' },
      el(
        'p',
        { class: 'small muted' },
        'Ton compte en ligne, si tu l’as activé, garde sa copie : déconnecte-toi avant. ',
        all,
      ),
    ),
  );
}
