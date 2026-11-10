import { expect, test, type Page } from '@playwright/test';

/**
 * Phase 8: one place in the settings lists everything the app keeps in this
 * browser and erases it (by kind, or all at once, keys included); the top
 * bar stays on two lines at 420 px.
 */
const FAKE_KEY = 'AIzaFAKE-e2e-0000000000';

test.beforeEach(async ({ page }) => {
  // Once per tab: after "Tout effacer" the reload must find nothing.
  await page.addInitScript((key) => {
    if (sessionStorage.getItem('eb-seeded')) return;
    sessionStorage.setItem('eb-seeded', '1');
    localStorage.setItem('english-buddy.settings.v1', JSON.stringify({ apiKey: key }));
    localStorage.setItem('english-buddy.welcome.v1', JSON.stringify({ done: true, at: 1 }));
  }, FAKE_KEY);
});

const STORES = ['talks', 'facts', 'cards', 'docs', 'pron', 'sing', 'songs'] as const;

async function counts(page: Page): Promise<Record<string, number>> {
  return page.evaluate(async (stores) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('english-buddy');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const out: Record<string, number> = {};
    for (const s of stores) {
      out[s] = db.objectStoreNames.contains(s)
        ? await new Promise<number>((resolve) => {
            const r = db.transaction(s).objectStore(s).count();
            r.onsuccess = () => resolve(r.result);
          })
        : 0;
    }
    db.close();
    return out;
  }, STORES);
}

async function seedAll(page: Page): Promise<void> {
  await page.evaluate(async (stores) => {
    const now = Date.now();
    const rows: Record<string, object[]> = {
      talks: [
        {
          id: 't1',
          startedAt: now - 3_600_000,
          durationMs: 120_000,
          label: '',
          character: 'jake',
          scene: 'cafe',
          turns: [{ id: 1, who: 'you', text: 'I go yesterday.', source: 'live' }],
          why: {},
        },
      ],
      facts: [
        {
          id: 'f1',
          category: 'job',
          text: 'Travaille dans une banque.',
          createdAt: now,
          updatedAt: now,
          byLearner: false,
        },
      ],
      pron: [
        {
          id: 'p1',
          at: now,
          sentence: 'I think so.',
          source: 'bank',
          result: { scorer: 'gemini', model: 'seed', overall: 70, words: [] },
        },
      ],
      sing: [
        {
          id: 's1',
          at: now,
          songId: 'row',
          title: 'Row',
          mode: 'hum',
          result: {
            overall: 60,
            pron: 60,
            rhythm: 60,
            lagMs: 0,
            words: [],
            scorer: null,
            model: 'seed',
            timing: 'voice',
          },
        },
      ],
      songs: [{ id: 'own1', title: 'My Song', lines: [] }],
      docs: [{ id: 'd1', title: 'Doc', addedAt: now, passages: ['Hello.'] }],
    };
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('english-buddy');
      req.onsuccess = () => {
        const names = stores.filter((s) => req.result.objectStoreNames.contains(s) && rows[s]);
        const tx = req.result.transaction(names, 'readwrite');
        for (const s of names) for (const r of rows[s]!) tx.objectStore(s).put(r);
        tx.oncomplete = () => {
          req.result.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }, STORES);
}

test('my data: erase by kind (songs go with talks), then everything', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => void d.accept());
  await page.goto('./');
  await expect(page.locator('#enter')).toBeVisible();
  // Wait for the app to open (and upgrade) its database.
  await expect.poll(async () => Object.keys(await counts(page)).length).toBe(STORES.length);
  await seedAll(page);

  await page.locator('#open-settings').click();
  const list = page.locator('#data-list');
  const talksRow = list.locator('li', { hasText: 'Conversations, bilans et chansons' });
  await expect(talksRow.locator('.chip')).toHaveText('3 éléments');
  await expect(list.locator('li', { hasText: 'Documents' }).locator('.chip')).toHaveText(
    '1 document',
  );
  await expect(list.locator('li', { hasText: 'Clés API' }).locator('.chip')).toHaveText('1 clé');

  await talksRow.getByRole('button', { name: /Effacer/ }).click();
  await expect(page.locator('#data-status')).toContainText('effacé');
  await expect(talksRow.locator('.chip')).toHaveText('vide');
  const after = await counts(page);
  expect(after).toMatchObject({ talks: 0, sing: 0, songs: 0, facts: 1, docs: 1, pron: 1 });

  // Everything, keys included; the page reloads.
  const reloaded = page.waitForEvent('load', { timeout: 60_000 });
  await page.locator('#wipe-all').click();
  await reloaded;
  await expect(page.locator('#enter')).toBeVisible();
  const empty = await counts(page);
  for (const s of STORES) expect(empty[s], s).toBe(0);
  const settings = await page.evaluate(() => localStorage.getItem('english-buddy.settings.v1'));
  expect(settings ?? '').not.toContain(FAKE_KEY);
  expect(errors).toEqual([]);
});

test('top bar: two lines at most at 420 px, nothing hidden at 1280 px', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 860 });
  await page.goto('./');
  await expect(page.locator('#enter')).toBeVisible();
  const bar = await page.evaluate(() => {
    const nav = document.querySelector('.topnav') as HTMLElement;
    const home = document.getElementById('home')!.getBoundingClientRect().top;
    return {
      height: (document.querySelector('.topbar') as HTMLElement).offsetHeight,
      fits: nav.scrollWidth <= nav.clientWidth,
      homeBelow: home >= (document.querySelector('.topbar') as HTMLElement).offsetHeight,
      pageWidth: document.documentElement.scrollWidth,
    };
  });
  expect(bar.height).toBeLessThan(100);
  expect(bar.fits).toBe(true);
  expect(bar.homeBelow).toBe(true);
  expect(bar.pageWidth).toBeLessThanOrEqual(420);
  await expect(page.getByRole('button', { name: 'Mémoire' })).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole('button', { name: 'Ce qu’ils savent de moi' })).toBeVisible();
});

test('420 px: the lab and the mission map do not scroll sideways', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 860 });
  await page.goto('./lab.html');
  await expect(page.locator('h1')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(420);
  await page.goto('./');
  await expect(page.locator('#enter')).toBeVisible();
  await page.locator('#open-map').click();
  await expect(page.locator('#map .map-grid')).toBeVisible();
  const cols = await page
    .locator('#map .map-grid')
    .evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(' ').length);
  expect(cols).toBe(1);
});
