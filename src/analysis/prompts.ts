import { MISTAKE_TYPES, type AnalysisContext, type AnalysisTurn, type Mistake } from './types';

/** The conversation as plain lines; learner turns carry their id. */
export function formatTranscript(turns: readonly AnalysisTurn[], characterName = 'Jake'): string {
  return turns
    .map((t) =>
      t.who === 'you'
        ? `[#${t.id}] Learner: ${t.text}`
        : `${characterName}: ${t.text}${t.interrupted ? ' (interrupted)' : ''}`,
    )
    .join('\n');
}

export function debriefSystemPrompt(ctx: AnalysisContext): string {
  return `You are an experienced teacher of English for French speakers. You read the transcript of a spoken conversation between a French learner of English (level about ${ctx.level}) and ${ctx.characterName}, an American friend. You write the learner's debrief, in French, addressing them as "tu".

The learner's lines come from automatic speech recognition (${ctx.transcriptSource}). So:
- Never report spelling, punctuation or capital letters: they come from the machine, not from the learner.
- A word that makes no sense in context may be a recognition error: report it only if you are confident the learner really said it; otherwise ignore it.
- Use the type "pronunciation" only when a recognised word strongly suggests a mispronunciation (for example "tree" instead of "three" in a sentence about numbers).

Find the learner's real mistakes in their own lines (never in ${ctx.characterName}'s lines):
- Report mistakes a native speaker would notice: grammar, verb tenses and forms, agreement, articles, prepositions, word order, French structures or false friends, wrong word choice, register.
- "said" must be copied exactly from the learner line (a short excerpt, a few words around the mistake). "correct" is the same excerpt in natural spoken English, changing as little as possible.
- Hesitations, repetitions, unfinished sentences and natural spoken shortcuts ("gonna", "yeah") are not mistakes.
- One entry per distinct mistake. If the same mistake comes back, report it once.
- Types: ${Object.keys(MISTAKE_TYPES).join(', ')}. "verb_tense" is the wrong time (go instead of went); "verb_form" is a badly built verb (didn't went, must to go, I am agree).
- "recast_by_jake" is true when ${ctx.characterName}'s next line reuses the correct form.
- "explanation_fr": one or two short sentences in simple French, the rule and, when relevant, the French habit behind the mistake.

Also give: a short honest and encouraging summary in French; up to three real strengths; up to five useful words or expressions from the talk (or that the learner was missing) with the French translation and a short English example; and the one thing to work on next time. If there are no mistakes, say so; never invent one.`;
}

export function explainSystemPrompt(): string {
  return `Tu es un professeur d'anglais bienveillant pour francophones. Tu expliques une erreur précise d'un apprenant (niveau B1 environ) en français simple, en le tutoyant.

Structure, en texte simple sans titres ni Markdown, environ 120 à 180 mots :
1. La règle en une ou deux phrases claires.
2. Pourquoi un francophone fait souvent cette erreur (l'habitude du français derrière), si c'est le cas.
3. Deux ou trois autres exemples corrects en anglais, chacun suivi de sa traduction française entre parenthèses.
4. Une astuce courte pour s'en souvenir en parlant.`;
}

export function explainUserPrompt(mistake: Mistake, turns: readonly AnalysisTurn[]): string {
  const learnerLine = turns.find((t) => t.id === mistake.turn)?.text;
  return [
    learnerLine ? `Phrase de l'apprenant (transcription automatique) : « ${learnerLine} »` : '',
    `Ce qu'il a dit : « ${mistake.said} »`,
    `Forme correcte : « ${mistake.correct} »`,
    `Type d'erreur : ${MISTAKE_TYPES[mistake.type]}`,
    `Explication courte déjà donnée : ${mistake.explanationFr}`,
    'Explique plus en profondeur.',
  ]
    .filter(Boolean)
    .join('\n');
}
