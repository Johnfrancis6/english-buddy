import { expect, test, type Page } from '@playwright/test';

/**
 * Phase 5, documents, with Google simulated and two fake web sites: a PDF is
 * read in the browser (PDF.js), cut into passages, kept after a reload; hard
 * words come from the (simulated) model and go to the FSRS reviews; a word can
 * be added by hand; a page that allows CORS is imported, one that refuses
 * gets the French message; a passage is studied with a character (it is in
 * the prompt as quoted data).
 */
const FAKE_KEY = 'AIzaFAKE-e2e-phase5-docs';
const shot = async (page: Page, name: string) => {
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}.png` });
};

/** A small real PDF (two pages of text, Helvetica), built by hand. */
function makePdf(pages: string[][]): Buffer {
  const objs: string[] = [];
  const kids: number[] = [];
  const font = 3;
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[font] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  let n = 4;
  for (const lines of pages) {
    const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
    const stream = `BT /F1 11 Tf 50 780 Td 14 TL ${lines.map((l) => `(${esc(l)}) Tj T*`).join(' ')} ET`;
    objs[n] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    objs[n + 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${n} 0 R >>`;
    kids.push(n + 1);
    n += 2;
  }
  objs[2] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = out.length;
    out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objs.length; i++) out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const PAGE1 = [
  'Working from home',
  '',
  'Remote work has become widespread since 2020. Many companies now let',
  'their staff work from home two or three days a week. Supporters say it',
  'boosts productivity and cuts commuting time. Critics worry that',
  'newcomers struggle to learn from their colleagues.',
];
const PAGE2 = [
  'Some managers have found a middle ground: they ask teams to meet in the',
  'office on the same days, so that people can brainstorm together.',
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => {
    if (!localStorage.getItem('english-buddy.settings.v1')) {
      localStorage.setItem('english-buddy.settings.v1', JSON.stringify({ apiKey: key }));
    }
  }, FAKE_KEY);
});

test('import a PDF, find hard words, add them to reviews, study with Jake', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let hardWordsAsked = '';
  await page.route('**/v1beta/models/*:generateContent', async (route) => {
    hardWordsAsked = route.request().postData() ?? '';
    const text = JSON.stringify({
      words: [
        { english: 'widespread', french: 'répandu', example: 'Remote work has become widespread.' },
        { english: 'to boost', french: 'stimuler', example: 'It boosts productivity.' },
        {
          english: 'commuting',
          french: 'les trajets domicile-travail',
          example: 'cuts commuting time',
        },
      ],
    });
    await route.fulfill({ json: { candidates: [{ content: { parts: [{ text }] } }] } });
  });
  let setup: Record<string, unknown> | null = null;
  await page.routeWebSocket(/BidiGenerateContent/, (ws) => {
    ws.onMessage((raw) => {
      const msg = JSON.parse(String(raw));
      if (msg.setup) {
        setup = msg.setup;
        ws.send(JSON.stringify({ setupComplete: {} }));
      }
    });
  });

  await page.goto('./');
  await expect(page.locator('#stage')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await expect(page.locator('#welcome')).toBeHidden(); // a key exists: no welcome
  await page.locator('#open-documents').click();
  const dlg = page.locator('#documents');
  await expect(dlg).toContainText('Pas encore de document');
  await shot(page, 'docs-1-empty');

  await page.locator('#doc-file').setInputFiles({
    name: 'remote-work.pdf',
    mimeType: 'application/pdf',
    buffer: makePdf([PAGE1, PAGE2]),
  });
  await expect(dlg).toHaveAttribute('data-view', 'reader', { timeout: 30_000 });
  await expect(dlg.locator('.doc-title')).toHaveText('Working from home');
  await expect(page.locator('#doc-passage-chip')).toHaveText('Passage 1 sur 1');
  await expect(dlg.locator('.doc-passage')).toContainText(
    'Remote work has become widespread since 2020. Many companies now let their staff',
  );
  await expect(dlg.locator('.doc-passage')).toContainText(
    'so that people can brainstorm together.',
  );

  // Hard words from the (simulated) model: only the passage is sent.
  await page.locator('#doc-find-words').click();
  await expect(dlg.locator('.doc-words li')).toHaveCount(3);
  expect(hardWordsAsked).toContain('Remote work has become widespread');
  expect(hardWordsAsked).toContain('responseJsonSchema');
  await dlg.locator('.doc-words li[data-word="widespread"] button').click();
  await expect(dlg.locator('.doc-words li[data-word="widespread"] .chip.ok')).toBeVisible();
  await shot(page, 'docs-2-reader');

  // A word added by hand.
  await dlg.locator('.doc-manual summary').click();
  await page.locator('#doc-word-en').fill('middle ground');
  await page.locator('#doc-word-fr').fill('compromis');
  await page.locator('#doc-word-add').click();
  await expect(dlg.locator('.doc-manual')).toContainText(
    '« middle ground » ajouté à tes révisions ✓',
  );

  // Two new cards, due tomorrow.
  const cards = await page.evaluate(
    () =>
      new Promise<{ id: string; front: string; note: string; talkId: string }[]>((resolve) => {
        const req = indexedDB.open('english-buddy');
        req.onsuccess = () => {
          const r = req.result.transaction('cards').objectStore('cards').getAll();
          r.onsuccess = () => resolve(r.result);
        };
      }),
  );
  expect(cards.map((c) => c.id).sort()).toEqual(['word:middle ground', 'word:widespread']);
  expect(cards.find((c) => c.id === 'word:middle ground')!.note).toContain('found a middle ground');
  expect(cards[0].talkId).toMatch(/^doc:/);

  // Study with Jake: the passage reaches the prompt as quoted data.
  await page.locator('#doc-study').click();
  await expect(dlg).toBeHidden();
  const goals = page.locator('#goals');
  await expect(goals).toBeVisible();
  await expect(goals).toContainText('Étude d’un document');
  await expect(goals).toContainText('Passage 1 sur 1');
  await expect(page.locator('#start')).toBeEnabled({ timeout: 30_000 });
  await shot(page, 'docs-3-talk');
  await page.locator('#start').click();
  await expect.poll(() => setup !== null, { timeout: 20_000 }).toBe(true);
  const prompt = JSON.stringify(setup);
  expect(prompt).toContain('Study session');
  expect(prompt).toContain('<<<PASSAGE');
  expect(prompt).toContain('Remote work has become widespread since 2020.');
  expect(prompt).toContain('\\"widespread\\"');
  await page.locator('#start').click();

  // Kept after a reload.
  await page.reload();
  await expect(page.locator('#stage')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await page.locator('#open-documents').click();
  await expect(dlg.locator('.doc-item')).toHaveCount(1);
  await expect(dlg.locator('.doc-item')).toContainText('2 pages');
  await expect(page.locator('#reviews-line')).toContainText('2 en tout');
  expect(errors).toEqual([]);
});

test('web links: allowed by CORS, refused, and the phone width', async ({ page }) => {
  test.setTimeout(120_000);
  await page.route('https://open.example.org/**', (route) =>
    route.fulfill({
      headers: { 'content-type': 'text/html', 'access-control-allow-origin': '*' },
      body: `<html><head><title>City parks</title><script>window.hacked = true</script></head><body>
        <nav>Home | About</nav>
        <article><h1>Why city parks matter</h1><p>Parks give people a place to unwind after work.</p>
        <p>They also cool the streets during heatwaves.</p></article><footer>© site</footer></body></html>`,
    }),
  );
  await page.route('https://closed.example.org/**', (route) => route.abort('failed'));
  await page.setViewportSize({ width: 420, height: 860 });
  await page.goto('./');
  await page.locator('#open-documents').click();
  const dlg = page.locator('#documents');

  await page.locator('#doc-link').fill('closed.example.org/news');
  await page.locator('#doc-link-go').click();
  await expect(page.locator('#documents-status')).toContainText('CORS');
  await expect(page.locator('#documents-status')).toContainText('Enregistrer au format PDF');
  await shot(page, 'docs-420-refused');

  await page.locator('#doc-link').fill('https://open.example.org/parks');
  await page.locator('#doc-link-go').click();
  await expect(dlg).toHaveAttribute('data-view', 'reader');
  await expect(dlg.locator('.doc-title')).toHaveText('City parks');
  await expect(dlg.locator('.doc-passage')).toContainText('cool the streets during heatwaves');
  await expect(dlg.locator('.doc-passage')).not.toContainText('Home | About');
  expect(await page.evaluate(() => (window as unknown as { hacked?: boolean }).hacked)).toBe(
    undefined,
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await shot(page, 'docs-420-reader');
});
