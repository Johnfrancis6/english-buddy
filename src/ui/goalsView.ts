import { forbiddenFound, usesExpression } from '../habit/expressions';
import type { Mission } from '../habit/missions';
import { reviewTypeFr, type TalkPlan } from '../habit/plan';
import { DAY_GOAL_MS } from '../habit/streak';
import { el } from './dom';

/**
 * The goals panel during a talk (top right): the mission, the mistakes to
 * produce correctly, the expressions to place (ticked as soon as the
 * learner's transcript contains them), the challenge timer and today's
 * speaking time towards the streak. The debrief gives the final verdict.
 */
export class GoalsView {
  private readonly placed = new Set<number>();
  private forbidden: string[] = [];
  private exprItems: HTMLElement[] = [];
  private alert: HTMLElement | null = null;
  private speech: HTMLElement | null = null;
  /** Called the first time an expression is detected. */
  onPlaced: ((en: string) => void) | null = null;

  constructor(
    private readonly panel: HTMLElement,
    private readonly body: HTMLElement,
    private readonly title: HTMLElement,
    private readonly timer: HTMLElement,
  ) {}

  show(plan: TalkPlan, mission: Mission | undefined, characterName: string): void {
    this.placed.clear();
    this.forbidden = [];
    this.body.replaceChildren();
    this.exprItems = [];
    this.alert = null;
    this.timer.hidden = plan.mode !== 'challenge';
    this.panel.hidden = plan.mode === 'free';
    this.panel.dataset.mode = plan.mode;
    if (plan.mode === 'free') return;
    this.title.textContent = plan.mode === 'challenge' ? 'Défi du jour' : 'Ta mission';
    if (mission) {
      this.body.append(
        el('p', { class: 'goal-title', text: mission.titleFr }),
        el('p', { class: 'small', text: mission.goalFr }),
      );
      if (mission.forbidden.length) {
        this.body.append(
          el('p', {
            class: 'small muted',
            text: `Mot${mission.forbidden.length > 1 ? 's' : ''} interdit${mission.forbidden.length > 1 ? 's' : ''} : ${mission.forbidden.map((w) => `« ${w} »`).join(', ')}`,
          }),
        );
        this.alert = el('p', { class: 'small error-text', role: 'alert' });
        this.alert.hidden = true;
        this.body.append(this.alert);
      }
    }
    if (plan.mode === 'challenge') {
      this.body.append(
        el('p', {
          class: 'small',
          text: `Environ ${plan.minutes ?? 5} minutes avec ${characterName}. Réponds à ses questions : il va te tendre des perches.`,
        }),
      );
    }
    if (plan.reviews.length) {
      this.body.append(
        el('h3', { text: 'Tes fautes à ne plus faire' }),
        el(
          'ul',
          { class: 'goal-list' },
          ...plan.reviews.map((r) =>
            el(
              'li',
              {},
              'Tu avais dit ',
              el('span', { class: 'said', lang: 'en', text: `« ${r.said} »` }),
              el('span', { class: 'muted small', text: ` · ${reviewTypeFr(r)}` }),
            ),
          ),
        ),
        el('p', {
          class: 'muted small',
          text: 'Place la bonne forme quand l’occasion se présente.',
        }),
      );
    }
    if (plan.expressions.length) {
      this.exprItems = plan.expressions.map((e) =>
        el(
          'li',
          { 'data-placed': 'false' },
          el('span', { class: 'tick', 'aria-hidden': 'true', text: '○' }),
          el('strong', { lang: 'en', text: e.en }),
          el('span', { class: 'muted small', text: ` — ${e.fr}` }),
          el('span', { class: 'visually-hidden state', text: ' (pas encore placée)' }),
        ),
      );
      this.body.append(
        el('h3', { text: 'Expressions à placer' }),
        el('ul', { class: 'goal-list expressions' }, ...this.exprItems),
      );
    }
    this.speech = el('p', { class: 'muted small speech-today' });
    this.body.append(this.speech);
    this.plan = plan;
  }

  private plan: TalkPlan | null = null;

  /** The learner's text so far (all their turns). */
  learnerText(text: string, mission: Mission | undefined): void {
    if (!this.plan) return;
    this.plan.expressions.forEach((e, i) => {
      if (this.placed.has(i) || !usesExpression(text, e)) return;
      this.placed.add(i);
      const li = this.exprItems[i];
      li.dataset.placed = 'true';
      li.querySelector('.tick')!.textContent = '✓';
      li.querySelector('.state')!.textContent = ' (placée)';
      this.onPlaced?.(e.en);
    });
    if (mission?.forbidden.length && this.alert) {
      const found = forbiddenFound(text, mission.forbidden);
      if (found.length && found.length !== this.forbidden.length) {
        this.forbidden = found;
        this.alert.textContent = `Oups : tu as dit ${found.map((w) => `« ${w} »`).join(', ')}. La mission est ratée, mais continue à t’entraîner !`;
        this.alert.hidden = false;
      }
    }
  }

  get placedCount(): number {
    return this.placed.size;
  }

  /** Remaining challenge time and today's speaking time, every second. */
  tick(remainingMs: number | null, todayMs: number): void {
    if (remainingMs !== null) {
      this.timer.hidden = false;
      this.timer.textContent = remainingMs > 0 ? clock(remainingMs) : 'Défi fini : tu peux arrêter';
      this.timer.classList.toggle('over', remainingMs <= 0);
    }
    if (this.speech) {
      this.speech.textContent =
        todayMs >= DAY_GOAL_MS
          ? `Parole aujourd’hui : ${clock(todayMs)} — ta journée compte pour la série ✓`
          : `Parole aujourd’hui : ${clock(todayMs)} sur 3:00 pour que la journée compte`;
    }
  }

  hide(): void {
    this.panel.hidden = true;
    this.plan = null;
  }
}

export function clock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
