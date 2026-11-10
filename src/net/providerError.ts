/** Errors from the HTTP providers (Gemini text models, Groq, Azure Speech), in plain French. */
export type Provider = 'gemini' | 'groq' | 'azure';
export type ProviderErrorKind =
  'bad-key' | 'quota' | 'model' | 'network' | 'blocked' | 'bad-output' | 'unknown';

const NAMES: Record<Provider, string> = {
  gemini: 'Google (Gemini)',
  groq: 'Groq',
  azure: 'Microsoft (Azure Speech)',
};

export class ProviderError extends Error {
  constructor(
    readonly provider: Provider,
    readonly kind: ProviderErrorKind,
    readonly detail: string,
    readonly status = 0,
  ) {
    super(`${provider} ${kind}: ${detail}`);
    this.name = 'ProviderError';
  }

  /** One French sentence for the learner. */
  get french(): string {
    const who = NAMES[this.provider];
    switch (this.kind) {
      case 'bad-key':
        if (this.provider === 'groq')
          return 'Groq refuse ta clé Groq. Vérifie-la dans « Réglages » (elle commence par gsk_).';
        if (this.provider === 'azure')
          return 'Microsoft refuse ta clé Azure Speech. Vérifie la clé et la région dans « Réglages ».';
        return 'Google refuse ta clé Gemini. Vérifie-la dans « Réglages ».';
      case 'quota':
        return `${who} a refusé la demande : quota gratuit atteint pour l’instant. Réessaie dans une minute.`;
      case 'model':
        return `Le modèle demandé n’est pas disponible chez ${who} avec cette clé.`;
      case 'network':
        return `Impossible de joindre ${who}. Vérifie ta connexion puis réessaie.`;
      case 'blocked':
        return `${who} a refusé de répondre à ce contenu.`;
      case 'bad-output':
        return `${who} a répondu dans un format inattendu. Réessaie.`;
      default:
        return `${who} a renvoyé une erreur.`;
    }
  }
}

export function kindFromHttp(status: number, body: string): ProviderErrorKind {
  const s = body.toLowerCase();
  if (
    status === 401 ||
    status === 403 ||
    /api key not valid|invalid_api_key|api_key_invalid/.test(s)
  )
    return 'bad-key';
  if (status === 429 || /resource_exhausted|quota|rate limit/.test(s)) return 'quota';
  if (
    status === 404 ||
    /not found for api version|is not found|model_not_found|does not exist/.test(s)
  )
    return 'model';
  return 'unknown';
}

/** fetch() that turns every failure into a ProviderError. */
export async function providerFetch(
  provider: Provider,
  url: string,
  init: RequestInit,
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ProviderError(provider, 'network', String((err as Error)?.message ?? err));
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ProviderError(provider, kindFromHttp(res.status, body), shorten(body), res.status);
  }
  return res;
}

function shorten(body: string): string {
  try {
    const j = JSON.parse(body) as { error?: { message?: string } };
    if (j.error?.message) return j.error.message.slice(0, 300);
  } catch {
    /* not JSON */
  }
  return body.slice(0, 300);
}

export function asProviderError(err: unknown, provider: Provider): ProviderError {
  if (err instanceof ProviderError) return err;
  return new ProviderError(provider, 'unknown', String((err as Error)?.message ?? err));
}
