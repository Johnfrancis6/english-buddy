/** Turns technical failures into a plain French message for the learner. */
export type ErrorKind =
  | 'missing-key'
  | 'bad-key'
  | 'quota'
  | 'model'
  | 'mic-denied'
  | 'mic-missing'
  | 'network'
  | 'dropped'
  | 'unknown';

export interface FriendlyError {
  kind: ErrorKind;
  message: string;
  /** Raw technical detail, shown small so Franco can report it. */
  detail: string;
  canRetry: boolean;
}

const MESSAGES: Record<ErrorKind, string> = {
  'missing-key': 'Il manque ta clé Gemini. Ouvre « Réglages » et colle-la.',
  'bad-key':
    'Google refuse cette clé. Vérifie dans « Réglages » qu’elle est complète, sans espace, et toujours active.',
  quota:
    'Google a refusé la conversation : le quota gratuit est dépassé ou indisponible pour l’instant. Attends une minute puis réessaie, et note l’heure pour le rapport.',
  model:
    'Le modèle vocal choisi n’est pas disponible avec cette clé. Essaie l’autre modèle dans « Réglages ».',
  'mic-denied':
    'Le micro est bloqué. Clique sur le cadenas à gauche de l’adresse, autorise le micro, puis recharge la page.',
  'mic-missing': 'Aucun micro détecté. Branche ton casque puis réessaie.',
  network: 'Impossible de joindre Google. Vérifie ta connexion Wi-Fi puis réessaie.',
  dropped: 'La connexion avec Jake a été coupée.',
  unknown: 'Quelque chose s’est mal passé.',
};

export function classify(raw: string, name = ''): ErrorKind {
  const s = `${name} ${raw}`.toLowerCase();
  if (/notallowederror|permission denied|permission dismissed/.test(s)) return 'mic-denied';
  if (/notfounderror|requested device not found|notreadableerror/.test(s)) return 'mic-missing';
  if (/api key|api_key|unauthenticated|permission_denied|\b401\b|\b403\b/.test(s)) return 'bad-key';
  if (/quota|resource_exhausted|rate limit|\b429\b|exceeded|billing/.test(s)) return 'quota';
  if (/model|not found|not supported|\b404\b|unsupported/.test(s)) return 'model';
  if (/network|failed to fetch|offline|websocket|timeout|\b1006\b/.test(s)) return 'network';
  return 'unknown';
}

export function friendly(kind: ErrorKind, detail = ''): FriendlyError {
  return {
    kind,
    message: MESSAGES[kind],
    detail,
    canRetry: kind !== 'missing-key' && kind !== 'mic-denied',
  };
}

export function friendlyFromUnknown(err: unknown): FriendlyError {
  const e = err as { name?: string; message?: string } | undefined;
  const detail = e?.message ?? String(err);
  return friendly(classify(detail, e?.name ?? ''), `${e?.name ? e.name + ': ' : ''}${detail}`);
}

/** A WebSocket that closed without the user asking for it. */
export function friendlyFromClose(code: number, reason: string): FriendlyError {
  const detail = `code ${code}${reason ? ' — ' + reason : ''}`;
  const kind = reason ? classify(reason) : 'unknown';
  if (kind === 'unknown' || kind === 'network') return friendly('dropped', detail);
  return friendly(kind, detail);
}
