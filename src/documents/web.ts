/**
 * Opens a web link from the browser, without any relay server: it works only
 * when the site allows it (CORS). Otherwise the learner gets a clear French
 * message and can save the page as PDF instead.
 */
export type WebResult =
  | { kind: 'pdf'; data: ArrayBuffer; name: string }
  | { kind: 'html'; title: string; text: string }
  | { kind: 'error'; french: string; detail: string };

/** A usable http(s) address, or null. */
export function parseLink(raw: string): URL | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(s) ? s : `https://${s}`);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u : null;
  } catch {
    return null;
  }
}

const BLOCKED =
  'Ce site ne permet pas à une autre page de lire son contenu (règle de sécurité « CORS » du site). English Buddy n’utilise pas de serveur relais, donc il ne peut pas l’ouvrir. Astuce : ouvre la page, fais « Imprimer » → « Enregistrer au format PDF », puis importe le PDF ici.';

export async function fetchLink(url: URL, f: typeof fetch = fetch): Promise<WebResult> {
  let res: Response;
  try {
    res = await f(url.href, { mode: 'cors', credentials: 'omit', redirect: 'follow' });
  } catch (err) {
    // A CORS refusal and a network failure look the same from the page.
    return {
      kind: 'error',
      french:
        navigator.onLine === false ? 'Tu es hors ligne. Reconnecte-toi, puis réessaie.' : BLOCKED,
      detail: String(err),
    };
  }
  if (!res.ok) {
    return {
      kind: 'error',
      french: `Le site a répondu une erreur (${res.status}). Vérifie l’adresse, puis réessaie.`,
      detail: `HTTP ${res.status}`,
    };
  }
  const type = res.headers.get('content-type') ?? '';
  if (/pdf/i.test(type) || /\.pdf$/i.test(url.pathname)) {
    const name = decodeURIComponent(url.pathname.split('/').pop() || 'document.pdf');
    return { kind: 'pdf', data: await res.arrayBuffer(), name };
  }
  if (/html|text\/plain/i.test(type) || !type) {
    const body = await res.text();
    if (/text\/plain/i.test(type)) return { kind: 'html', title: url.hostname, text: body };
    return { kind: 'html', ...htmlToText(body, url.hostname) };
  }
  return {
    kind: 'error',
    french:
      'Ce lien ne mène ni à une page web ni à un PDF. Seuls les PDF et les pages web marchent.',
    detail: type,
  };
}

/**
 * The readable text of a page: the article (or main) content, headings,
 * paragraphs and list items; scripts, menus and footers are dropped. Parsed
 * with DOMParser, so no script of the page ever runs.
 */
export function htmlToText(html: string, fallbackTitle: string): { title: string; text: string } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc
    .querySelectorAll('script, style, noscript, nav, header, footer, aside, form, svg')
    .forEach((n) => n.remove());
  const root = doc.querySelector('article') ?? doc.querySelector('main') ?? doc.body;
  const blocks = [...(root?.querySelectorAll('h1, h2, h3, p, li, blockquote') ?? [])]
    .map((n) => (n.textContent ?? '').replace(/\s+/g, ' ').trim())
    .filter((t) => t.length > 1);
  const title =
    (doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? '').trim() ||
    (doc.title ?? '').trim() ||
    fallbackTitle;
  return { title: title.slice(0, 120), text: blocks.join('\n\n') };
}
