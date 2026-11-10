import { groupByType } from '../analysis/schema';
import {
  MISTAKE_TYPES,
  SKILLS,
  type Debrief,
  type Mistake,
  type SkillScores,
} from '../analysis/types';
import { bandOf } from '../progress/level';
import { el } from './dom';

export interface DebriefHandlers {
  /** Fetches the deeper explanation of one mistake (index in debrief.mistakes). */
  why(index: number, mistake: Mistake): Promise<string>;
  /** Explanations already known, by index. */
  known: Record<number, string>;
  /** The character the learner talked with. */
  characterName: string;
  /** Opens the memory screen (phase 3). */
  openMemory?: () => void;
}

/** Renders the French debrief: summary, mistakes by type, vocabulary. */
export function renderDebrief(root: HTMLElement, d: Debrief, h: DebriefHandlers): void {
  root.replaceChildren();
  if (d.summaryFr) root.append(el('p', { class: 'summary', text: d.summaryFr }));
  if (d.strengthsFr.length) {
    root.append(
      el('h3', { text: 'Ce qui était bien' }),
      el('ul', { class: 'strengths' }, ...d.strengthsFr.map((s) => el('li', { text: s }))),
    );
  }

  root.append(
    el('h3', {
      text: d.mistakes.length
        ? `Tes fautes (${d.mistakes.length}), par type`
        : 'Aucune faute repérée dans cette conversation 🎉',
    }),
  );
  for (const [type, list] of groupByType(d.mistakes)) {
    const section = el('section', { class: 'mistake-group' });
    section.append(el('h4', { text: `${MISTAKE_TYPES[type]} · ${list.length}` }));
    for (const m of list) section.append(mistakeCard(d.mistakes.indexOf(m), m, h));
    root.append(section);
  }

  if (d.vocabulary.length) {
    root.append(
      el('h3', { text: 'Mots et expressions à retenir' }),
      el(
        'ul',
        { class: 'vocab' },
        ...d.vocabulary.map((v) =>
          el(
            'li',
            {},
            el('strong', { text: v.english }),
            ` — ${v.french}`,
            v.example ? el('div', { class: 'muted small', text: `« ${v.example} »` }) : null,
          ),
        ),
      ),
    );
  }
  if (d.nextFocusFr) {
    root.append(el('h3', { text: 'Pour la prochaine fois' }), el('p', { text: d.nextFocusFr }));
  }
  if (d.skills) root.append(skillsLine(d.skills));
  if (d.memory?.length || d.talkMemoryFr) root.append(memorySection(d, h));
}

function skillsLine(k: SkillScores): HTMLElement {
  const parts = (Object.keys(SKILLS) as (keyof SkillScores)[]).map(
    (key) => `${SKILLS[key]} ${k[key]}`,
  );
  const overall = Math.round((k.fluency + k.grammar + k.vocabulary + k.listening) / 4);
  return el(
    'p',
    { class: 'skills-line muted small' },
    `Estimation sur cette conversation (sur 100) : ${parts.join(' · ')} — autour de ${bandOf(overall)}. `,
    'Ton niveau estimé, sur plusieurs conversations, est dans « Mes progrès ».',
  );
}

function memorySection(d: Debrief, h: DebriefHandlers): HTMLElement {
  const section = el(
    'section',
    { class: 'memory-note' },
    el('h3', { text: `Ce que ${h.characterName} retient de toi` }),
  );
  if (d.memory?.length) {
    section.append(el('ul', {}, ...d.memory.map((f) => el('li', { text: f.text }))));
  }
  if (d.talkMemoryFr) {
    section.append(
      el('p', { class: 'muted small', text: `Pour la prochaine fois : ${d.talkMemoryFr}` }),
    );
  }
  if (h.openMemory) {
    const b = el('button', {
      class: 'btn quiet small',
      type: 'button',
      text: 'Voir, corriger ou effacer',
    });
    b.addEventListener('click', h.openMemory);
    section.append(b);
  }
  return section;
}

function mistakeCard(index: number, m: Mistake, h: DebriefHandlers): HTMLElement {
  const why = el('div', { class: 'why', 'aria-live': 'polite' });
  why.hidden = true;
  const button = el('button', { class: 'btn quiet small', type: 'button', text: 'Pourquoi ?' });
  const show = (text: string) => {
    why.textContent = text;
    why.hidden = false;
    button.textContent = 'Masquer';
  };
  button.addEventListener('click', () => {
    if (!why.hidden) {
      why.hidden = true;
      button.textContent = 'Pourquoi ?';
      return;
    }
    if (h.known[index]) return show(h.known[index]);
    button.disabled = true;
    button.textContent = 'Explication…';
    h.why(index, m).then(
      (text) => {
        h.known[index] = text;
        button.disabled = false;
        show(text);
      },
      (err: unknown) => {
        button.disabled = false;
        button.textContent = 'Pourquoi ?';
        why.textContent = String(
          (err as { french?: string }).french ?? 'Explication impossible pour l’instant. Réessaie.',
        );
        why.hidden = false;
      },
    );
  });
  return el(
    'article',
    { class: 'mistake', 'data-type': m.type },
    el(
      'p',
      { class: 'pair' },
      el('span', { class: 'said', text: m.said }),
      ' → ',
      el('span', { class: 'correct', text: m.correct }),
    ),
    el('p', { class: 'explain', text: m.explanationFr }),
    m.recastByCharacter
      ? el('p', {
          class: 'muted small',
          text: `${h.characterName} l’a reformulé pendant la conversation.`,
        })
      : null,
    button,
    why,
  );
}

/** Plain-text version of the debrief, to copy into a message. */
export function debriefText(d: Debrief): string {
  const lines = ['Bilan English Buddy', '', d.summaryFr, ''];
  if (d.strengthsFr.length)
    lines.push('Ce qui était bien :', ...d.strengthsFr.map((s) => `- ${s}`), '');
  lines.push(`Fautes (${d.mistakes.length}) :`);
  for (const [type, list] of groupByType(d.mistakes)) {
    lines.push(`[${MISTAKE_TYPES[type]}]`);
    for (const m of list) lines.push(`- « ${m.said} » → « ${m.correct} » : ${m.explanationFr}`);
  }
  if (d.vocabulary.length) {
    lines.push('', 'À retenir :', ...d.vocabulary.map((v) => `- ${v.english} — ${v.french}`));
  }
  if (d.nextFocusFr) lines.push('', `Prochaine fois : ${d.nextFocusFr}`);
  lines.push('', `(modèle : ${d.model})`);
  return lines.join('\n');
}
