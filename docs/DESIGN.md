# Design — English Buddy

One look for every screen (home, talk, settings, debrief, lab, and the
screens of later phases). The tokens below exist once, as CSS variables in
`src/styles/tokens.css`; components are in `src/styles/components.css`. A new
screen uses them and adds no new colour, size or radius without updating this
file first.

Mood: a warm, friendly café rather than a school. Soft cream backgrounds,
one warm accent, rounded shapes, plenty of air. The 3D scene is the star;
the interface stays light and gets out of the way during a talk.

## 1. Colours

All pairs used for text meet WCAG AA (4.5:1 for body text), measured with the
WCAG formula on 2026-11-10.

| Token | Value | Use | Contrast |
|---|---|---|---|
| `--bg` | `#f6ead9` | Page background (cream) | — |
| `--surface` | `rgba(255, 250, 243, 0.94)` | Panels floating over the 3D scene | — |
| `--surface-solid` | `#fffaf3` | Dialogs, cards, pages without a scene | — |
| `--surface-raised` | `#ffffff` | Inputs, items inside a panel (mistake cards, lab rows) | — |
| `--ink` | `#2b2118` | Main text | 13.3 on `--bg` |
| `--ink-soft` | `#6f5f50` | Secondary text, hints, labels of measures | 5.9 on `--surface-solid`, 5.2 on `--bg` |
| `--line` | `rgba(60, 40, 20, 0.14)` | Borders and separators | — |
| `--accent` | `#b34a17` | Primary buttons, links, the selected card | white text 5.4 |
| `--accent-soft` | `rgba(179, 74, 23, 0.12)` | Selected card background, focus halo | — |
| `--success` | `#2e7d32` | Correct form, "kept", delay on target | 5.1 on white |
| `--danger` | `#a32d1c` | Errors, the learner's wrong form, destructive links | 6.9 |
| `--info` | `#2f5d8a` | The learner's name in transcripts, "Pourquoi ?" box tint | 6.6 |
| `--heat-1` … `--heat-4` | `#f3dccf`, `#e4b49c`, `#c67751`, `#b34a17` | Sequential steps of the accent for counts (progress table). The number is always written in the cell | `--ink` on 1–3 (≥ 4.7), white on 4 (5.4) |

Character colours (name in the transcript, card ribbon): Jake `#b34a17`, Emma
`#2f5d8a`, Maya `#8a3b8f`, Ollie `#2e6b4f`, Lily `#9a5b00`. Each one is
≥ 4.5:1 on `--surface-solid`.

Never use colour alone to carry meaning: a wrong form is also struck through,
a correct one is also bold, a state also has a word.

## 2. Typography

- Family: the system UI stack (`system-ui, "Segoe UI", Roboto, sans-serif`).
  No web font: nothing to download, crisp on Windows.
- Sizes (`--text-xs` … `--text-xl`): 12, 14, 16, 20, 28 px. Body text is 16 px
  in dialogs and pages, 14 px in panels over the scene.
- Weights: 400 body, 600 labels and buttons, 700 titles only.
- Line height 1.45 for paragraphs, 1.2 for titles.
- Numbers that change (delays, timers, FPS) use `font-variant-numeric:
  tabular-nums` so they do not jump.
- English sentences shown to the learner carry `lang="en"`.

## 3. Spacing, radius, shadow

- Spacing scale (`--space-1` … `--space-6`): 4, 8, 12, 16, 24, 32 px. Panels
  pad 16 px (24 px in dialogs); items in a list are 8 px apart.
- Radius: `--radius-sm` 8 px (inputs, rows), `--radius` 14 px (panels,
  cards, dialogs), `--radius-pill` 999 px (buttons, chips).
- One shadow, `--shadow`: `0 6px 24px rgba(60, 40, 20, 0.12)`. Panels over the
  scene also blur what is behind them (6 px).

## 4. Components

### Buttons

| Kind | Class | When |
|---|---|---|
| Primary | `.btn.primary` | The one main action of a screen ("Démarrer", "Entrer dans la scène", "Enregistrer"). At most one per screen or dialog. |
| Secondary | `.btn` | Other actions ("Réglages", "Copier le bilan"). |
| Quiet | `.btn.quiet` | Small actions inside panels ("Masquer", "Pourquoi ?"). |
| Link | `.link` / `.link.danger` | Rare or destructive actions ("Effacer mes conversations"). |

- Pill shaped, 600 weight, minimum 40 px high (32 px for `.small`), label is a
  verb in French ("Démarrer", not "OK").
- The big talk button (`.btn.primary.big`) switches to dark (`.live`) while a
  talk runs and reads "Arrêter".
- A link styled as a button uses the same classes (`a.btn`).
- Disabled: 50 % opacity, no pointer.

### Panels

`.panel`: `--surface`, `--line` border, `--radius`, `--shadow`. Over the 3D
scene, panels hug the edges (16 px from them) and never cover the
character's face: transcript on the right, measures on the left, controls at
the bottom centre.

### Dialogs

Native `<dialog>` with `.panel.dialog`: solid surface, 24 px padding, title
`h2` at 20 px, actions in a `.row` at the bottom with the primary action
first. In read-only dialogs (debrief) "Fermer" is the primary action.
Backdrop: `rgba(40, 28, 16, 0.35)`. Escape closes; focus goes to the first
field.

### Cards (home screen)

`.card`: a choice with a picture, a name and one line. Selected =
`--accent` border 2 px + `--accent-soft` background + `aria-pressed="true"`.
The whole card is a `<button>`.

### Collapsible test measures

Measures for testing (delay, FPS, model, log, report) live in a
`<details class="panel measures">` titled "Mesures de test", **closed by
default**. They stay reachable in one click and never distract a learner.

### Chips

`.chip`: small pill (12 px) for statuses and tags ("gardée", "corrigée",
"américain", "britannique").

## 5. Tone of the French texts

- Tutoiement, warm and short: "Clique sur « Démarrer » et dis bonjour à
  Jake." One idea per sentence.
- Speak about the learner's goals, not about the machine. Technical words
  only in "Détail technique" lines, in `--ink-soft`.
- Errors say what happened, then what to do: "Ta clé n'est pas acceptée par
  Google. Vérifie-la dans les réglages."
- Encourage without flattering: the debrief starts with what went well.
- French typography: « guillemets », non-breaking space before `: ; ? !`
  where the browser allows it, decimal comma ("1,4 s").
- Character names stay in English; the rest of the interface is French.

## 6. Empty and waiting states

- Empty: one friendly sentence and the next action. "Pas encore de bilan :
  parle avec un personnage, ton bilan arrivera à la fin."
- Waiting less than 1 s: nothing. 1–10 s: a sentence with "…" and
  `aria-live="polite"` ("Chargement d'Emma… 40 %"). Longer than 10 s: say how
  long it usually takes ("Jake prépare ton bilan… (10 à 30 secondes)").
- A character always says who is busy ("Maya t'écoute", "Emma parle").

## 7. Accessibility

- Contrast AA everywhere (see §1); focus ring `3px solid` `--accent-soft`
  stronger (`rgba(179, 74, 23, 0.5)`), offset 2 px, on every interactive
  element.
- Everything works with the keyboard: Tab order follows reading order; cards
  are buttons; dialogs trap focus (native `<dialog>`).
- Every input has a `<label>`; every status that changes is in an
  `aria-live` region; error boxes use `role="alert"`.
- `prefers-reduced-motion`: no camera moves, no walk-in (the character is
  already in place); gestures stay, at reduced amplitude.
- Text can grow to 200 % without losing content (panels scroll).
- The 3D canvas has an `aria-label` that names the scene and the character.

## 8. Screens (checked with screenshots each phase)

| Screen | File | Notes |
|---|---|---|
| Home (scene + character) | `index.html` `#home` | Scene preview live behind the panel |
| Talk | `index.html` | Big button bottom centre, transcript right, measures left (closed) |
| Settings | `index.html` `#settings` | Keys first, then voice, then transcription |
| Debrief | `index.html` `#debrief` | Summary, strengths, mistakes by type, words, next focus |
| Transcription lab | `lab.html` | Page layout (`body.page`), same tokens |
| Memory ("Ce qu'ils savent de moi") | `index.html` `#memory` | Facts grouped by subject, each with "Corriger" (quiet) and "Effacer" (danger link); "Ajouter" folded; "Fermer" primary |
| Progress ("Mes progrès") | `index.html` `#progress` | Level box (band + "estimation" chip + 4 skill bars with B1/B2/C1 ticks), 4 tiles, mistakes × weeks table, speaking-time bars, list of talks |
| Settings → account | `index.html` `#settings` | "Compte (facultatif)" after the keys; says plainly when accounts are off |

### Charts (phase 3)

- Plain HTML and CSS, no chart library. One hue (the accent) for every
  measure: there is never more than one series per chart.
- Every value is also written as text (cell number, bar label, `title` on
  hover); counts use `tabular-nums`.
- Level and scores always say "estimation"; scores are /100 with the B1
  (40), B2 (60), C1 (80) marks.
