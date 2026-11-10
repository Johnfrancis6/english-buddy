import { expect, test } from '@playwright/test';

test('page loads, the character renders, the mouth follows sound', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('./');
  await expect(page).toHaveTitle(/English Buddy/);

  const canvas = page.locator('#stage');
  await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });

  // First visit without a key: the settings dialog opens with the privacy note.
  const dialog = page.locator('#settings');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Cette clé reste dans ton navigateur');
  await page.locator('#api-key').fill('AIzaFAKE-smoke-test-key-0000');
  await page.locator('#save-settings').click();
  await expect(dialog).toBeHidden();
  const stored = await page.evaluate(() => localStorage.getItem('english-buddy.settings.v1'));
  expect(stored).toContain('AIzaFAKE-smoke-test-key-0000');

  // The canvas really draws: frames advance and the image is not one flat colour.
  const frames = async () => Number(await canvas.getAttribute('data-frames'));
  const before = await frames();
  await expect.poll(frames).toBeGreaterThan(before + 5);
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

  // Lip sync: the mouth opens on sound and closes again in silence.
  const mouth = async () => Number(await canvas.getAttribute('data-mouth'));
  expect(await mouth()).toBe(0);
  await page.locator('#lip-test').click();
  await expect.poll(mouth, { timeout: 3000, intervals: [30] }).toBeGreaterThan(0.2);
  await expect.poll(mouth, { timeout: 8000, intervals: [100] }).toBe(0);

  expect(errors).toEqual([]);
});
