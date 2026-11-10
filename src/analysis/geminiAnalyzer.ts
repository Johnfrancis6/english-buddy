import { generateText, withModelFallback } from '../net/gemini';
import { ProviderError } from '../net/providerError';
import {
  debriefSystemPrompt,
  explainSystemPrompt,
  explainUserPrompt,
  formatTranscript,
} from './prompts';
import { DEBRIEF_SCHEMA, parseDebrief } from './schema';
import type { AnalysisContext, AnalysisTurn, Analyzer, Debrief, Mistake } from './types';

/** Debrief and explanations from a Gemini text model, with the user's key. */
export class GeminiAnalyzer implements Analyzer {
  /** The chosen model first, then the others as fallbacks. */
  private readonly models: string[];

  constructor(
    private readonly apiKey: string,
    preferred: string,
    all: readonly string[],
  ) {
    this.models = [preferred, ...all.filter((m) => m !== preferred)];
  }

  async analyze(
    turns: AnalysisTurn[],
    ctx: AnalysisContext,
    signal?: AbortSignal,
  ): Promise<Debrief> {
    const learnerIds = new Set(turns.filter((t) => t.who === 'you').map((t) => t.id));
    const { value } = await withModelFallback(this.models, async (model) => {
      const raw = await generateText({
        apiKey: this.apiKey,
        model,
        system: debriefSystemPrompt(ctx),
        parts: [{ text: `Transcript:\n${formatTranscript(turns, ctx.characterName)}` }],
        jsonSchema: DEBRIEF_SCHEMA,
        temperature: 0.2,
        signal,
      });
      try {
        return parseDebrief(raw, learnerIds, model);
      } catch (err) {
        throw new ProviderError('gemini', 'bad-output', String((err as Error).message));
      }
    });
    return value;
  }

  async explain(mistake: Mistake, turns: AnalysisTurn[], signal?: AbortSignal): Promise<string> {
    const { value } = await withModelFallback(this.models, (model) =>
      generateText({
        apiKey: this.apiKey,
        model,
        system: explainSystemPrompt(),
        parts: [{ text: explainUserPrompt(mistake, turns) }],
        temperature: 0.3,
        signal,
      }),
    );
    return value.trim();
  }
}
