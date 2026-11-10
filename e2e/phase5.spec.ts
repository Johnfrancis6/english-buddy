import { expect, test, type Page } from '@playwright/test';

/**
 * Phase 5, the welcome, with Google and Groq simulated: a newcomer goes
 * through the six steps (key checked, Groq skipped, microphone tested with
 * Chromium's fake device, level, first character); the level reaches the
 * character's prompt; the welcome does not come back but can be reopened from
 * the settings. Not the real services.
 */
const GOOD_KEY = 'AIzaFAKE-e2e-phase5-good';
const shot = async (page: Page, name: string) => {
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}.png` });
};

test('welcome: keys, microphone, level and first character', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const checked: string[] = [];
  await page.route('**/v1beta/models?pageSize=1', async (route) => {
    const key = route.request().headers()['x-goog-api-key'];
    checked.push(key);
    if (key === GOOD_KEY) await route.fulfill({ json: { models: [{ name: 'models/x' }] } });
    else
      await route.fulfill({
        status: 400,
        json: { error: { message: 'API key not valid. Please pass a valid API key.' } },
      });
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
  const w = page.locator('#welcome');
  await expect(w).toBeVisible();
  await expect(w).toHaveAttribute('data-step', 'hello');
  await expect(w).toContainText('Tes clés restent dans ce navigateur');
  await expect(page.locator('#settings')).toBeHidden();
  await expect(page.locator('#stage')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await shot(page, 'welcome-1-hello');
  await page.locator('#welcome-next').click();

  // Step 2: the exact clicks, then a wrong key, then the right one.
  await expect(w).toHaveAttribute('data-step', 'gemini');
  await expect(w.locator('a[href="https://aistudio.google.com/apikey"]')).toBeVisible();
  await expect(w).toContainText('Create API key');
  await page.locator('#gemini-input').fill('AIzaWRONG');
  await page.locator('#gemini-input-check').click();
  await expect(page.locator('#gemini-input-status')).toContainText('ne reconnaît pas');
  await page.locator('#gemini-input').fill(` ${GOOD_KEY} `);
  await page.locator('#gemini-input-check').click();
  await expect(page.locator('#gemini-input-status')).toContainText('Clé acceptée par Google ✓');
  expect(checked).toEqual(['AIzaWRONG', GOOD_KEY]);
  await shot(page, 'welcome-2-gemini');
  await page.locator('#welcome-next').click();

  // Step 3: Groq is optional.
  await expect(w).toHaveAttribute('data-step', 'groq');
  await expect(w.locator('a[href="https://console.groq.com/keys"]')).toBeVisible();
  await expect(page.locator('#welcome-next')).toHaveText('Passer cette étape');
  await page.locator('#welcome-next').click();

  // Step 4: the fake microphone plays a tone, so it is heard.
  await expect(w).toHaveAttribute('data-step', 'mic');
  await page.locator('#welcome-mic-test').click();
  await expect(page.locator('#welcome-mic-status')).toContainText('On t’entend bien ✓', {
    timeout: 25_000,
  });
  await shot(page, 'welcome-4-mic');
  await page.locator('#welcome-next').click();

  // Step 5: level.
  await expect(w).toHaveAttribute('data-step', 'level');
  await w.locator('.card.level[data-id="A2"]').click();
  await expect(w.locator('.card.level[data-id="A2"]')).toHaveAttribute('aria-pressed', 'true');
  await shot(page, 'welcome-5-level');
  await page.locator('#welcome-next').click();

  // Step 6: first character.
  await expect(w).toHaveAttribute('data-step', 'character');
  await w.locator('.card[data-id="maya"]').click();
  await expect(page.locator('#welcome-next')).toHaveText('Commencer avec Maya');
  await shot(page, 'welcome-6-character');
  await page.locator('#welcome-next').click();
  await expect(w).toBeHidden();
  await expect(page.locator('#character-cards .card[data-id="maya"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const stored = JSON.parse(
    (await page.evaluate(() => localStorage.getItem('english-buddy.settings.v1'))) ?? '{}',
  );
  expect(stored).toMatchObject({
    apiKey: GOOD_KEY,
    groqKey: '',
    startLevel: 'A2',
    character: 'maya',
  });

  // It does not come back; it can be reopened from the settings.
  await page.reload();
  await expect(page.locator('#stage')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await expect(w).toBeHidden();
  await page.locator('#open-settings').click();
  await expect(page.locator('#start-level')).toHaveValue('A2');
  await page.locator('#open-welcome').click();
  await expect(w).toBeVisible();
  await expect(w).toHaveAttribute('data-step', 'hello');
  await w.getByRole('button', { name: 'Plus tard' }).click();

  // The chosen level reaches the character.
  await page.locator('#enter').click();
  await expect(w).toBeHidden();
  await expect(page.locator('#start')).toBeEnabled({ timeout: 30_000 });
  await page.locator('#start').click();
  await expect.poll(() => setup !== null, { timeout: 20_000 }).toBe(true);
  expect(JSON.stringify(setup)).toContain('at about A2 level (a first estimate)');
  await page.locator('#start').click();

  expect(errors).toEqual([]);
});

test('welcome at phone width (420 px)', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 860 });
  await page.goto('./');
  const w = page.locator('#welcome');
  await expect(w).toBeVisible();
  const box = await w.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(420);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await shot(page, 'welcome-420-hello');
  for (let i = 0; i < 4; i++) await page.locator('#welcome-next').click();
  await expect(w).toHaveAttribute('data-step', 'level');
  await shot(page, 'welcome-420-level');
  await page.locator('#welcome-next').click();
  await shot(page, 'welcome-420-character');
});
