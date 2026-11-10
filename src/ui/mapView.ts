import { sceneInfo, SCENES } from '../cast';
import type { MapCell, Mission, Tier } from '../habit/missions';
import { el } from './dom';

/**
 * The scene map: one column per place, one row per level. Locked missions
 * say what opens them; each mission shows its best result.
 */
export function renderMap(
  root: HTMLElement,
  cells: readonly MapCell[],
  current: string | undefined,
  pick: (m: Mission) => void,
): void {
  const grid = el('div', { class: 'map-grid', role: 'list' });
  for (const s of SCENES) {
    const col = el(
      'section',
      { class: 'map-col', role: 'listitem', 'aria-label': s.labelFr },
      el('h3', { text: s.labelFr }),
    );
    for (const tier of [1, 2, 3] as Tier[]) {
      const cell = cells.find((c) => c.mission.scene === s.id && c.mission.tier === tier);
      if (cell) col.append(missionCard(cell, cell.mission.id === current, pick));
    }
    grid.append(col);
  }
  root.replaceChildren(grid);
}

export function recordFr(cell: MapCell): string {
  const r = cell.record;
  if (!cell.unlocked) return cell.lockFr;
  if (!r) return 'Pas encore essayée';
  return `${r.passed ? 'Réussie' : 'Pas encore réussie'} · meilleur score ${r.bestScore}/100 · ${r.tries} essai${r.tries > 1 ? 's' : ''}`;
}

function missionCard(cell: MapCell, selected: boolean, pick: (m: Mission) => void): HTMLElement {
  const m = cell.mission;
  const state = !cell.unlocked ? 'locked' : cell.record?.passed ? 'passed' : 'open';
  const button = el(
    'button',
    {
      class: 'card mission',
      type: 'button',
      'data-id': m.id,
      'data-state': state,
      'aria-pressed': String(selected),
    },
    el(
      'span',
      { class: 'mission-top' },
      el('span', { class: 'chip', text: `Niveau ${m.tier}` }),
      state === 'passed' ? el('span', { class: 'chip ok', text: 'réussie ✓' }) : null,
      state === 'locked' ? el('span', { class: 'chip', text: 'verrouillée 🔒' }) : null,
    ),
    el('strong', { text: m.titleFr }),
    el('span', { class: 'small muted', text: cell.unlocked ? m.goalFr : '' }),
    el('span', { class: 'small mission-record', text: recordFr(cell) }),
  );
  if (!cell.unlocked) button.disabled = true;
  else button.addEventListener('click', () => pick(m));
  button.setAttribute(
    'aria-label',
    `${m.titleFr}, ${sceneInfo(m.scene).labelFr}, niveau ${m.tier}. ${recordFr(cell)}`,
  );
  return button;
}
