/**
 * Text extraction from a PDF, in the browser, with Mozilla's PDF.js
 * (`pdfjs-dist` 6.5.438, Apache-2.0). Loaded only when a PDF is opened.
 * API checked in the package's own types (2026-11-10): `getDocument({ data })`
 * → `promise` → `getPage(n)` → `getTextContent()` whose items have `str` and
 * `hasEOL`; `loadingTask.destroy()` frees it; the worker URL goes in `GlobalWorkerOptions.workerSrc`.
 */
export interface PdfText {
  pages: string[];
  /** Title from the PDF metadata, if any. */
  title?: string;
}

export class PdfError extends Error {
  constructor(
    readonly kind: 'password' | 'invalid' | 'other',
    detail: string,
  ) {
    super(detail);
  }
}

export async function extractPdf(data: ArrayBuffer, maxPages = 400): Promise<PdfText> {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  // A copy: PDF.js takes ownership of the buffer it is given.
  const task = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) });
  let doc;
  try {
    doc = await task.promise;
  } catch (err) {
    await task.destroy().catch(() => {});
    const name = (err as { name?: string })?.name ?? '';
    if (name === 'PasswordException') throw new PdfError('password', String(err));
    if (name === 'InvalidPDFException') throw new PdfError('invalid', String(err));
    throw new PdfError('other', String(err));
  }
  try {
    const pages: string[] = [];
    const n = Math.min(doc.numPages, maxPages);
    for (let i = 1; i <= n; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let text = '';
      for (const item of content.items) {
        if (!('str' in item)) continue;
        text += item.str;
        text += item.hasEOL ? '\n' : item.str && !item.str.endsWith(' ') ? ' ' : '';
      }
      pages.push(text);
      page.cleanup();
    }
    const meta = await doc.getMetadata().catch(() => null);
    const info = (meta?.info ?? {}) as { Title?: unknown };
    return { pages, title: typeof info.Title === 'string' ? info.Title : undefined };
  } finally {
    // In PDF.js 6 the loading task closes the document and its worker.
    await task.destroy();
  }
}
