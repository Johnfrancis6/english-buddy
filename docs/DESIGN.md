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
| `--success-soft` | `rgba(46, 125, 50, 0.12)` | Background of success chips ("réussie ✓", challenge over, "dans tes révisions ✓"); `.ok-text` = `--success` text, 600, for "Clé acceptée ✓" | `--success` text on it ≥ 4.5 |
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
| Home → today (phase 4) | `index.html` `#today` | Box on `--surface-raised` under the lead: streak line (bold, tabular numbers), "Défi du jour" and "Révisions" rows, each with one secondary small button; the mission line under the character cards |
| Goals panel (phase 4) | `index.html` `#goals` | Left column under the folded measures, never over the face: title, timer chip (challenge only), mission goal, "Tu avais dit « … »" items (wrong form in `--danger`, never the answer), expressions with ○/✓ and a hidden word for screen readers, today's speaking time |
| Reviews ("Révisions à voix haute") | `index.html` `#reviews` | One card at a time; "Voir la réponse" is the primary action; four grade buttons (secondary, small); "Retirer cette carte" danger link; "Fermer" secondary |
| Mission map | `index.html` `#map` | Three columns (places) × three rows (levels) of `.card.mission`; locked cards are disabled, on `--bg`, and say what opens them in text; "Fermer" primary |
| Welcome (phase 5) | `index.html` `#welcome` | One step at a time in a dialog (600 px): a thin progress bar of six segments (accent = done/current), title + "Étape N sur 6" chip, short text, exact clicks as a numbered list (button names in bold, in English as on the site), privacy box (`.note.privacy`), one primary action ("C’est parti", "Suivant", "Passer cette étape", "Commencer avec …"), "Retour" secondary, "Plus tard" link. Levels as `.card.level` (2 columns, 1 below 560 px) |
| Documents (phase 5) | `index.html` `#documents` | Two views in one dialog (680 px). List: intro, "Importer un PDF" (secondary), link field + "Ouvrir le lien", status line (`aria-live`, errors in `--danger`), documents as rows on `--surface-raised`. Reader: "← Mes documents" link, title, passage chip with previous/next (quiet small), the passage (`lang="en"`, scrolls, 1.6 line height), hard words rows with "Ajouter aux révisions" or a green "dans tes révisions ✓" chip, "Ajouter un mot moi-même" folded; "Étudier ce passage avec …" is the primary action |
| Goals panel → document (phase 5) | `#goals` `[data-mode="document"]` | Title "Étude d’un document", document title, passage number and a one-line how-to, the passage folded, the hard words |
| Pronunciation (phase 6) | `index.html` `#pronunciation` | Dialog (620 px): privacy note, one sentence at a time in a card on `--surface-raised` (source chip + sound chips, the sentence at 20 px with hard-sound words underlined in dotted accent, the word under review in bold); "Enregistrer" primary → "J’ai fini" + level meter; "Écouter le modèle" secondary; result: score /100 + "estimation" chip, one tile per word (word, then ✓/~/✗ and its number; bottom border `--success` / `--ink-soft` / `--danger`, never colour alone), "Sons à travailler" list with the French tip, French feedback on `--accent-soft`; "Phrase suivante" becomes the primary action; "Fermer" secondary |
| Home → today → pronunciation (phase 6) | `#today` | Third row "Prononciation" with the estimate and the weakest sound, small secondary "M’entraîner" |
| Progress → pronunciation (phase 6) | `#progress` | A "Prononciation" bar in the level box (accent hue like the others, explained as outside the level), then "Sons à travailler" + "estimation" chip: one bar per sound, weakest first, the number written |
| Home → today → song (phase 7) | `#today` | Fourth row "Chanson" with the count of takes and the best score, small secondary "Chanter avec Maya" |
| Songbook (phase 7) | `index.html` `#songs` | Dialog (680 px): what it is (Maya hums, she does not sing the words), privacy note, "Ta chanson" box on `--accent-soft` (the lessons used as rows with a "Faute" / "Mot" chip, "Écrire ma chanson" secondary, status line, own songs with "Chanter" + "Effacer" danger link), then "Le carnet de chansons": rows on `--surface-raised` (title `lang="en"`, source chip "Domaine public" / "Écrite pour English Buddy", what it trains, best score), each with a small secondary "Chanter"; "Fermer" secondary |
| Karaoke (phase 7) | `index.html` `#sing` | A `.panel` at the bottom centre (720 px, at most 46 % of the height, 52 % below 560 px), under the character, never over the face; Maya in her street. Title (20 px, `lang="en"`) + source chip; a status line that says who is busy ("Maya compte…", "Maya fredonne…", "À toi : chante !", "Maya écoute ta prise…"); the count-in as a 28 px accent number; the lyrics on `--surface-raised`: current line at 20 px, next line in `--ink-soft`; the word to sing is accent **and** bold **and** underlined (never colour alone), sung words in `--ink-soft`; in turns each line carries a "Maya" / "Toi" chip. "Chanter" primary → dark "Arrêter" (`.live`) with the level meter; "Écouter Maya" secondary; two selects (way of singing, tempo); privacy line; "Autre chanson" quiet, "Quitter" link, credit in `--ink-soft`. While a song plays only the words and "Arrêter" stay |
| Karaoke result (phase 7) | `index.html` `#sing-result` | Dialog (660 px): score /100 + "estimation" chip, "Prononciation N · Rythme N", one tile per word grouped by line (the phase 6 tile with two marks: pronunciation ✓/~/✗ + number, then rhythm ♪ ✓/~/✗ + number; the bottom border follows the weaker one), legend, "Sons à travailler" with the French tip, "Rythme à reprendre", the constant delay when ≥ 0,25 s, French feedback on `--accent-soft`, how the rhythm was measured; "Rechanter" primary, "Autre chanson" and "Fermer" secondary |
| Progress → songs (phase 7) | `#progress` | "Chansons" + "estimation" chip after the pronunciation section: two bars (sung pronunciation, rhythm), accent hue, numbers written, said to be outside the level |
| Top bar (phase 8) | `index.html` `.topbar` | Name + "version de test" chip, then the menu (`nav.topnav`, secondary buttons). Below 560 px: two lines at most — the name, then the menu on one line with short labels ("Progrès", "Mémoire", "Scènes"; the visible text is the accessible name), 12 px, scrolling sideways rather than wrapping. Panels start under its real height (`--topbar-h`, set by the page) |
| Settings → my data (phase 8) | `#settings` `#data-list` | Last section, "Mes données": one sentence (everything is here, text only, never the voice), one row per kind of data on `--surface-raised` (bold label 14 px, what it holds in `--ink-soft`, a count chip with tabular numbers or "vide", an "Effacer" danger link when not empty), then "Clés API" (count, "Effacer"), then one line: the account keeps its own copy + "Tout effacer de ce navigateur" danger link. Every erase asks first; the result goes to an `aria-live` line |
| Debrief → plan (phase 4) | `#debrief` `.plan-result` | After the summary: mission (left border `--success` / `--danger` + the words "réussie" / "pas encore réussie"), expressions placed, old mistakes reviewed |

### Charts (phase 3)

- Plain HTML and CSS, no chart library. One hue (the accent) for every
  measure: there is never more than one series per chart.
- Every value is also written as text (cell number, bar label, `title` on
  hover); counts use `tabular-nums`.
- Level and scores always say "estimation"; scores are /100 with the B1
  (40), B2 (60), C1 (80) marks.
