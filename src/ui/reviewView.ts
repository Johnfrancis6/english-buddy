import type { Grade } from '../reviews/fsrs';
import { cardLabelFr, type ReviewCard } from '../reviews/cards';
import { el } from './dom';

/**
 * Flash reviews, out loud: the card shows what the learner once said (or a
 * French meaning); they say the right sentence aloud, then reveal the answer
 * and grade themselves. No microphone, no key: it works anywhere, and the
 * grade goes to FSRS. The daily challenge reviews the same cards in a real
 * talk, graded by the debrief.
 */
export interface ReviewHandlers {
  grade(card: ReviewCard, grade: Grade): Promise<void>;
  remove(card: ReviewCard): Promise<void>;
  /** Called when the session ends (to refresh counts). */
  done(reviewed: number): void;
}

export const GRADES: readonly { grade: Grade; label: string; hint: string }[] = [
  { grade: 'again', label: 'Raté', hint: 'revient demain' },
  { grade: 'hard', label: 'Difficile', hint: 'revient bientôt' },
  { grade: 'good', label: 'Je l’avais', hint: 'revient plus tard' },
  { grade: 'easy', label: 'Facile', hint: 'revient bien plus tard' },
];

export function renderReviews(
  root: HTMLElement,
  due: readonly ReviewCard[],
  info: { total: number; nextDueFr: string },
  h: ReviewHandlers,
): void {
  let index = 0;
  let reviewed = 0;
  const show = () => {
    root.replaceChildren();
    if (index >= due.length) {
      root.append(endState(reviewed, info));
      if (reviewed) h.done(reviewed);
      return;
    }
    root.append(
      cardView(due[index], index, due.length, h, (advanced) => {
        if (advanced) reviewed++;
        index++;
        show();
      }),
    );
  };
  show();
}

function endState(reviewed: number, info: { total: number; nextDueFr: string }): HTMLElement {
  if (!info.total) {
    return el('p', {
      class: 'empty muted',
      text: 'Pas encore de cartes : elles naissent de tes bilans (tes propres fautes et les mots à retenir). Parle avec un personnage, puis reviens demain.',
    });
  }
  return el(
    'div',
    { class: 'review-end' },
    el('p', {
      class: 'summary',
      text: reviewed
        ? `Bravo : ${reviewed} carte${reviewed > 1 ? 's' : ''} révisée${reviewed > 1 ? 's' : ''} à voix haute.`
        : 'Rien à réviser pour l’instant 🎉',
    }),
    el('p', {
      class: 'muted small',
      text: `${info.total} carte${info.total > 1 ? 's' : ''} en tout. Prochaine révision : ${info.nextDueFr}. Les cartes reviennent au bon moment pour ne pas les oublier (méthode FSRS).`,
    }),
  );
}

function cardView(
  c: ReviewCard,
  i: number,
  n: number,
  h: ReviewHandlers,
  next: (advanced: boolean) => void,
): HTMLElement {
  const mistake = c.kind === 'mistake';
  const sound = c.kind === 'sound';
  const box = el('article', { class: 'review-card', 'data-kind': c.kind, 'data-id': c.id });
  box.append(
    el(
      'p',
      { class: 'review-top muted small' },
      `Carte ${i + 1} sur ${n} · `,
      el('span', { class: 'chip', text: cardLabelFr(c) }),
    ),
    el('p', {
      class: 'review-ask',
      text: sound
        ? 'Prononce ce mot à voix haute, puis la phrase :'
        : mistake
          ? 'Tu as dit :'
          : 'Comment dit-on en anglais :',
    }),
    el('p', {
      class: mistake ? 'review-front said' : 'review-front',
      lang: mistake || sound ? 'en' : 'fr',
      text: mistake || sound ? c.front : `« ${c.front} »`,
    }),
    el('p', {
      class: 'muted',
      lang: 'en',
      text: sound ? c.note : '',
      hidden: sound ? undefined : '',
    }),
    el('p', {
      class: 'muted small',
      text: sound
        ? 'Lentement, puis à vitesse normale. Pour être écouté et noté, utilise « Prononciation » sur l’accueil.'
        : mistake
          ? 'Dis la bonne phrase à voix haute, puis regarde la réponse.'
          : 'Dis-le à voix haute dans une phrase à toi, puis regarde la réponse.',
    }),
  );
  const answer = el(
    'div',
    { class: 'review-answer' },
    el('p', {
      class: sound ? 'explain' : 'correct',
      lang: sound ? 'fr' : 'en',
      text: c.back,
    }),
    c.note && !sound
      ? el('p', {
          class: mistake ? 'explain' : 'muted small',
          lang: mistake ? 'fr' : 'en',
          text: mistake ? c.note : `« ${c.note} »`,
        })
      : null,
  );
  answer.hidden = true;
  const reveal = el('button', { class: 'btn primary', type: 'button', text: 'Voir la réponse' });
  const grades = el('div', {
    class: 'row tight grades',
    role: 'group',
    'aria-label': 'Comment ça s’est passé ?',
  });
  grades.hidden = true;
  for (const g of GRADES) {
    const b = el(
      'button',
      { class: 'btn small', type: 'button', 'data-grade': g.grade, title: g.hint },
      g.label,
    );
    b.addEventListener('click', () => {
      for (const x of grades.querySelectorAll('button')) x.disabled = true;
      h.grade(c, g.grade).then(
        () => next(true),
        () => {
          for (const x of grades.querySelectorAll('button')) x.disabled = false;
        },
      );
    });
    grades.append(b);
  }
  const remove = el('button', {
    class: 'link danger',
    type: 'button',
    text: 'Retirer cette carte',
  });
  remove.addEventListener('click', () => {
    void h.remove(c).then(() => next(false));
  });
  reveal.addEventListener('click', () => {
    answer.hidden = false;
    grades.hidden = false;
    reveal.hidden = true;
    grades.querySelector<HTMLButtonElement>('[data-grade="good"]')?.focus();
  });
  box.append(answer, el('div', { class: 'row tight' }, reveal), grades, el('p', {}, remove));
  queueMicrotask(() => reveal.focus());
  return box;
}
