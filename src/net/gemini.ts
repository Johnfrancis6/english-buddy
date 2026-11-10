import { ProviderError, providerFetch } from './providerError';

/**
 * Minimal client for Gemini text models (generateContent, REST v1beta), with
 * the user's key sent in a header rather than in the URL. Shape checked on
 * 2026-11-10: `generationConfig.responseJsonSchema` is a known field of
 * v1beta (an unknown field name is rejected before the key is even checked),
 * see docs/DECISIONS.md.
 */
export const GEMINI_REST = 'https://generativelanguage.googleapis.com/v1beta';

export type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

export interface GenerateRequest {
  apiKey: string;
  model: string;
  system?: string;
  parts: Part[];
  /** JSON Schema of the answer; when set the answer is parsed as JSON. */
  jsonSchema?: object;
  temperature?: number;
  signal?: AbortSignal;
}

interface GenerateResponse {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
}

export async function generateText(req: GenerateRequest): Promise<string> {
  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: req.parts }],
    generationConfig: {
      temperature: req.temperature ?? 0.2,
      ...(req.jsonSchema
        ? { responseMimeType: 'application/json', responseJsonSchema: req.jsonSchema }
        : {}),
    },
  };
  if (req.system) body.systemInstruction = { parts: [{ text: req.system }] };
  const res = await providerFetch(
    'gemini',
    `${GEMINI_REST}/models/${encodeURIComponent(req.model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': req.apiKey.trim() },
      body: JSON.stringify(body),
      signal: req.signal,
    },
  );
  const json = (await res.json()) as GenerateResponse;
  if (json.promptFeedback?.blockReason) {
    throw new ProviderError('gemini', 'blocked', json.promptFeedback.blockReason);
  }
  const cand = json.candidates?.[0];
  const text = (cand?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('');
  if (!text) {
    throw new ProviderError('gemini', 'bad-output', `empty answer (${cand?.finishReason ?? '?'})`);
  }
  return text;
}

/** Tries the models in order while the error says the model is unavailable. */
export async function withModelFallback<T>(
  models: readonly string[],
  run: (model: string) => Promise<T>,
): Promise<{ value: T; model: string }> {
  let last: unknown;
  for (const model of models) {
    try {
      return { value: await run(model), model };
    } catch (err) {
      last = err;
      if (!(err instanceof ProviderError) || err.kind !== 'model') throw err;
    }
  }
  throw last;
}
