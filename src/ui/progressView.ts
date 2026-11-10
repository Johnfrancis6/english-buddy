import { MISTAKE_TYPES, SKILLS, type SkillScores } from '../analysis/types';
import { BANDS } from '../progress/level';
import type { Progress, WeekStats } from '../progress/stats';
import { el } from './dom';

/**
 * "Mes progrès": level estimate and sub-scores, then week-by-week figures
 * (mistakes by type as a table with tinted cells, speaking time as bars,
 * new words and sentence length as small numbers). Plain HTML: every number
 * is also written as text, so nothing relies on colour alone.
 */
export interface TalkRow {
  id: string;
  label: string;
  mistakes: number | null;
}

const weekLabel = (w: WeekStats) =>
  new Date(w.start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const minutes = (ms: number) => {
  const m = ms / 60_000;
  return m < 1 && m > 0 ? '< 1 min' : `${Math.round(m)} min`;
};
const decimal = (n: number) => String(n).replace('.', ',');

export function renderProgress(
  root: HTMLElement,
  p: Progress,
  talks: readonly TalkRow[],
  openTalk: (id: string) => void,
): void {
  root.replaceChildren();
  if (!p.totalTalks) {
    root.append(
      el('p', {
        class: 'empty muted',
        text: 'Pas encore de progrès à montrer : parle avec un personnage, tes chiffres arriveront après le bilan.',
      }),
    );
    return;
  }
  root.append(
    levelSection(p),
    tiles(p),
    mistakesTable(p),
    speakingBars(p),
    talkList(talks, openTalk),
  );
}

function levelSection(p: Progress): HTMLElement {
  const box = el('section', { class: 'level-box', 'aria-labelledby': 'level-title' });
  const lv = p.level;
  box.append(
    el(
      'h3',
      { id: 'level-title' },
      'Niveau estimé : ',
      el('strong', { class: 'level-band', text: lv ? lv.band : '—' }),
      el('span', { class: 'chip', text: 'estimation' }),
    ),
  );
  if (!lv) {
    box.append(
      el('p', {
        class: 'muted small',
        text: 'Pas encore de note par compétence : elle arrive avec le prochain bilan. En attendant, les personnages te parlent comme à un niveau B1.',
      }),
    );
    return box;
  }
  box.append(
    el('p', {
      class: 'muted small',
      text: `Moyenne de tes ${lv.talks} dernier${lv.talks > 1 ? 's' : ''} bilan${lv.talks > 1 ? 's' : ''}, notée par l’IA sur 100 à partir du texte de tes phrases. Ce n’est pas un examen : une indication qui bouge d’une conversation à l’autre.`,
    }),
  );
  const list = el('div', { class: 'skills', role: 'list' });
  for (const k of Object.keys(SKILLS) as (keyof SkillScores)[]) {
    const v = lv.skills[k];
    const bar = el('span', { class: 'skill-bar' }, el('span', { class: 'skill-fill' }));
    (bar.firstChild as HTMLElement).style.width = `${v}%`;
    for (const b of BANDS.slice(1)) {
      const tick = el('span', { class: 'band-tick', 'data-band': b.band });
      tick.style.left = `${b.from}%`;
      bar.append(tick);
    }
    list.append(
      el(
        'div',
        { class: 'skill', role: 'listitem', title: `${SKILLS[k]} : ${v} sur 100` },
        el('span', { class: 'skill-name', text: SKILLS[k] }),
        bar,
        el('span', { class: 'skill-value', text: String(v) }),
      ),
    );
  }
  list.append(
    el(
      'div',
      { class: 'skill scale', 'aria-hidden': 'true' },
      el('span'),
      el('span', { class: 'skill-scale' }, ...BANDS.map((b) => scaleMark(b.band, b.from))),
      el('span'),
    ),
  );
  box.append(list);
  return box;
}

function scaleMark(band: string, from: number): HTMLElement {
  const s = el('span', { text: band });
  s.style.left = `${from}%`;
  return s;
}

function tiles(p: Progress): HTMLElement {
  const thisWeek = p.weeks[p.weeks.length - 1];
  const withSentences = [...p.weeks].reverse().find((w) => w.avgSentence !== null);
  const tile = (value: string, label: string, note?: string) =>
    el(
      'div',
      { class: 'tile' },
      el('strong', { class: 'tile-value', text: value }),
      el('span', { class: 'tile-label', text: label }),
      note ? el('span', { class: 'muted small', text: note }) : null,
    );
  return el(
    'section',
    { class: 'tiles', 'aria-label': 'Chiffres clés' },
    tile(String(p.totalTalks), p.totalTalks > 1 ? 'conversations' : 'conversation'),
    tile(minutes(p.totalSpeakingMs), 'de parole en tout'),
    tile(
      String(thisWeek.newWords),
      'mots nouveaux cette semaine',
      thisWeek.newWordSamples.slice(0, 4).join(', ') || undefined,
    ),
    tile(
      withSentences?.avgSentence != null ? decimal(withSentences.avgSentence) : '—',
      'mots par phrase en moyenne',
      withSentences && withSentences !== thisWeek
        ? `semaine du ${weekLabel(withSentences)}`
        : undefined,
    ),
  );
}

/** Mistakes by type (rows) and week (columns): a table, cells tinted by count. */
function mistakesTable(p: Progress): HTMLElement {
  const section = el(
    'section',
    { class: 'chart' },
    el('h3', { text: 'Fautes par type, semaine après semaine' }),
  );
  if (!p.mistakeTypes.length) {
    section.append(
      el('p', { class: 'muted small', text: 'Aucune faute repérée sur ces semaines.' }),
    );
    return section;
  }
  const max = Math.max(1, ...p.weeks.flatMap((w) => Object.values(w.mistakes)));
  const head = el(
    'tr',
    {},
    el('th', { scope: 'col', text: 'Type' }),
    ...p.weeks.map((w) => el('th', { scope: 'col', text: weekLabel(w) })),
  );
  const rows = p.mistakeTypes.map((type) =>
    el(
      'tr',
      {},
      el('th', { scope: 'row', text: MISTAKE_TYPES[type] }),
      ...p.weeks.map((w) => {
        const n = w.mistakes[type] ?? 0;
        const td = el('td', {
          class: n ? `heat h${Math.min(4, Math.ceil((n / max) * 4))}` : 'heat h0',
          text: n ? String(n) : '·',
          title: `${MISTAKE_TYPES[type]}, semaine du ${weekLabel(w)} : ${n} faute${n > 1 ? 's' : ''}`,
        });
        return td;
      }),
    ),
  );
  const total = el(
    'tr',
    { class: 'total' },
    el('th', { scope: 'row', text: 'Total' }),
    ...p.weeks.map((w) => el('td', { text: w.talks ? String(w.mistakeTotal) : '—' })),
  );
  section.append(
    el(
      'div',
      { class: 'table-scroll' },
      el('table', { class: 'heat-table' }, el('thead', {}, head), el('tbody', {}, ...rows, total)),
    ),
    el('p', {
      class: 'muted small',
      text: 'Chaque case compte les fautes de la semaine (début le lundi) ; plus la case est foncée, plus il y en a. « — » : pas de conversation cette semaine. Moins de fautes compte surtout si tu parles autant.',
    }),
  );
  return section;
}

function speakingBars(p: Progress): HTMLElement {
  const max = Math.max(60_000, ...p.weeks.map((w) => w.speakingMs));
  const estimated = p.weeks.some((w) => w.speakingEstimated && w.talks);
  const bars = p.weeks.map((w) => {
    const fill = el('span', { class: 'bar-fill' });
    fill.style.height = `${Math.round((w.speakingMs / max) * 100)}%`;
    return el(
      'div',
      {
        class: 'bar',
        role: 'listitem',
        title: `Semaine du ${weekLabel(w)} : ${minutes(w.speakingMs)} de parole, ${w.talks} conversation${w.talks > 1 ? 's' : ''}, ${w.newWords} mots nouveaux${w.avgSentence !== null ? `, ${decimal(w.avgSentence)} mots par phrase` : ''}`,
      },
      el('span', { class: 'bar-value', text: w.talks ? minutes(w.speakingMs) : '' }),
      el('span', { class: 'bar-track' }, fill),
      el('span', { class: 'bar-label', text: weekLabel(w) }),
    );
  });
  return el(
    'section',
    { class: 'chart' },
    el('h3', { text: 'Ton temps de parole par semaine' }),
    el('div', { class: 'bars', role: 'list' }, ...bars),
    el('p', {
      class: 'muted small',
      text: `Temps où ton micro a entendu ta voix.${estimated ? ' Pour les conversations d’avant la phase 3, il est estimé d’après le nombre de mots.' : ''} Survole une barre pour voir les mots nouveaux et la longueur des phrases.`,
    }),
  );
}

function talkList(talks: readonly TalkRow[], openTalk: (id: string) => void): HTMLElement {
  return el(
    'section',
    { class: 'chart' },
    el('h3', { text: 'Toutes tes conversations' }),
    el(
      'ul',
      { class: 'talk-list' },
      ...talks.map((t) => {
        const b = el('button', { class: 'btn quiet small', type: 'button', text: 'Voir le bilan' });
        b.addEventListener('click', () => openTalk(t.id));
        return el(
          'li',
          {},
          el('span', { text: t.label }),
          el('span', {
            class: 'muted small',
            text:
              t.mistakes === null
                ? 'sans bilan'
                : `${t.mistakes} faute${t.mistakes > 1 ? 's' : ''}`,
          }),
          b,
        );
      }),
    ),
  );
}
