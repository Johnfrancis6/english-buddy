import { expect, test } from '@playwright/test';

test('home, scene, character, key, gestures and lip sync', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('./');
  await expect(page).toHaveTitle(/English Buddy/);
  const canvas = page.locator('#stage');
  await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });

  // A newcomer (no key) is welcomed first; "Plus tard" leaves the home screen usable.
  const welcome = page.locator('#welcome');
  await expect(welcome).toBeVisible();
  await expect(welcome).toContainText('Ta voix n’est jamais enregistrée');
  await welcome.getByRole('button', { name: 'Plus tard' }).click();
  await expect(welcome).toBeHidden();

  // Home: three scenes, five characters, Jake at the café by default.
  await expect(page.locator('#home')).toBeVisible();
  await expect(page.locator('#scene-cards .card')).toHaveCount(3);
  await expect(page.locator('#character-cards .card')).toHaveCount(5);
  await expect(page.locator('#character-cards .card[data-id="jake"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // The test measures stay out of the way on the home screen.
  await expect(page.locator('#measures')).toBeHidden();

  // Picking the office brings Emma.
  await page.locator('#scene-cards .card[data-id="office"]').click();
  await expect(canvas).toHaveAttribute('data-scene', 'office');
  await expect(canvas).toHaveAttribute('data-character', 'emma');
  await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await expect(page.locator('#enter')).toContainText('Emma');

  // Still no key: entering opens the welcome at the key step (not the settings).
  await page.locator('#enter').click();
  await expect(welcome).toBeVisible();
  await expect(welcome).toHaveAttribute('data-step', 'gemini');
  await page.locator('#gemini-input').fill('AIzaFAKE-smoke-test-key-0000');
  await page.locator('#welcome-next').click();
  await expect(welcome).toHaveAttribute('data-step', 'groq');
  await welcome.getByRole('button', { name: 'Plus tard' }).click();
  await expect(welcome).toBeHidden();
  const stored = await page.evaluate(() => localStorage.getItem('english-buddy.settings.v1'));
  expect(stored).toContain('AIzaFAKE-smoke-test-key-0000');
  expect(stored).toContain('"character":"emma"');

  // Emma walks in, then the talk can start.
  await expect(page.locator('#start')).toBeEnabled({ timeout: 30_000 });
  await expect(canvas).toHaveAttribute('data-walking', 'false');
  await expect(page.locator('#talk-hint')).toContainText('Emma');

  // The canvas really draws: frames advance and the image is not one flat colour.
  const frames = async () => Number(await canvas.getAttribute('data-frames'));
  const before = await frames();
  await expect.poll(frames, { timeout: 15_000 }).toBeGreaterThan(before + 5);
  const colours = await page.evaluate(async () => {
    const c = document.getElementById('stage') as HTMLCanvasElement;
    await new Promise(requestAnimationFrame);
    const copy = document.createElement('canvas');
    copy.width = 64;
    copy.height = 64;
    const ctx = copy.getContext('2d')!;
    ctx.drawImage(c, 0, 0, 64, 64);
    const d = ctx.getImageData(0, 0, 64, 64).data;
    const seen = new Set<number>();
    for (let i = 0; i < d.length; i += 4)
      seen.add((d[i] >> 4) | ((d[i + 1] >> 4) << 4) | ((d[i + 2] >> 4) << 8));
    return seen.size;
  });
  expect(colours).toBeGreaterThan(8);

  // Measures are folded; once open, FPS is measured and the test tools work.
  const measures = page.locator('#measures');
  await expect(measures).toBeVisible();
  await expect(measures).not.toHaveAttribute('open');
  // The top bar stays on one line and never covers the measures.
  const bar = await page.locator('.topbar').boundingBox();
  const side = await measures.boundingBox();
  expect(bar!.y + bar!.height).toBeLessThanOrEqual(side!.y);
  await measures.locator('summary').click();
  await expect(page.locator('#d-fps')).not.toHaveText('—', { timeout: 5000 });

  // Gestures: the test button plays the first one.
  await page.locator('#gesture-test').click();
  await expect(canvas).toHaveAttribute('data-gestures', /wave/, { timeout: 3000 });

  // Lip sync: the mouth opens on sound and closes again in silence.
  const mouth = async () => Number(await canvas.getAttribute('data-mouth'));
  await page.locator('#lip-test').click();
  await expect.poll(mouth, { timeout: 3000, intervals: [30] }).toBeGreaterThan(0.2);
  await expect.poll(mouth, { timeout: 8000, intervals: [100] }).toBe(0);

  // Back home: the choice is kept.
  await page.locator('#open-home').click();
  await expect(page.locator('#home')).toBeVisible();
  await expect(page.locator('#character-cards .card[data-id="emma"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  expect(errors).toEqual([]);
});
