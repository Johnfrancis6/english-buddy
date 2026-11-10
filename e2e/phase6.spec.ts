import { expect, test, type Page } from '@playwright/test';

/**
 * Phase 6 with Google and Groq simulated: the pronunciation exercise records
 * a take from Chromium's fake microphone, sends it to "Gemini" (inline WAV +
 * the sentence) and to "Groq Whisper" (verbose_json, word timestamps), shows
 * the score per word and the sounds to work on, turns badly said words into
 * FSRS cards, and feeds "Mes progrès". Nothing here measures real models.
 */
const FAKE_KEY = 'AIzaFAKE-e2e-0000000000';
const GROQ_KEY = 'gsk_FAKE_e2e';

async function shot(page: Page, name: string): Promise<void> {
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}.png` });
}

/** Scores the words of the target sentence: words with "th" or "r" are said badly. */
function fakeGemini(prompt: string): string {
  const m = prompt.match(/Target words, in order \(\d+\): (.*)/);
  const words = (m?.[1] ?? '').split(' | ').filter(Boolean);
  return JSON.stringify({
    audio_ok: true,
    heard: words.join(' ').replace(/th/gi, 's'),
    words: words.map((w) => {
      const th = /th/i.test(w);
      const r = /r[aeiou]/i.test(w);
      return {
        word: w,
        score: th ? 42 : r ? 66 : 92,
        missing: false,
        issues: th ? ['th'] : r ? ['r'] : [],
        ...(th
          ? { heard_as: w.replace(/th/i, 's'), tip_fr: 'Langue entre les dents, puis souffle.' }
          : {}),
      };
    }),
    feedback_fr: 'Belle lecture, rythme naturel. À travailler : le « th ».',
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ([key, groq]) => {
      if (!localStorage.getItem('english-buddy.settings.v1')) {
        localStorage.setItem(
          'english-buddy.settings.v1',
          JSON.stringify({ apiKey: key, groqKey: groq }),
        );
      }
    },
    [FAKE_KEY, GROQ_KEY] as const,
  );
});

test('pronunciation: score per word, sounds to work on, FSRS cards, progress', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const gemini: { prompt: string; audioBytes: number; mime: string; schema: boolean }[] = [];
  await page.route('**/v1beta/models/*:generateContent', async (route) => {
    expect(route.request().headers()['x-goog-api-key']).toBe(FAKE_KEY);
    const json = JSON.parse(route.request().postData() ?? '{}');
    const parts = json.contents[0].parts as {
      text?: string;
      inlineData?: { mimeType: string; data: string };
    }[];
    const prompt = parts.find((p) => p.text)?.text ?? '';
    const audio = parts.find((p) => p.inlineData)?.inlineData;
    gemini.push({
      prompt,
      audioBytes: audio ? Buffer.from(audio.data, 'base64').length : 0,
      mime: audio?.mimeType ?? '',
      schema: Boolean(json.generationConfig?.responseJsonSchema?.properties?.words),
    });
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{ content: { parts: [{ text: fakeGemini(prompt) }] } }],
      }),
    });
  });
  const groq: { format: string; granularity: string; bytes: number }[] = [];
  await page.route('**/openai/v1/audio/transcriptions', async (route) => {
    expect(route.request().headers()['authorization']).toBe(`Bearer ${GROQ_KEY}`);
    const body = route.request().postDataBuffer() ?? Buffer.alloc(0);
    const text = body.toString('latin1');
    const field = (name: string) =>
      text.match(
        new RegExp(`name="${name.replace(/[[\]]/g, '\\$&')}"\\r\\n\\r\\n([^\\r]*)`),
      )?.[1] ?? '';
    groq.push({
      format: field('response_format'),
      granularity: field('timestamp_granularities[]'),
      bytes: body.length,
    });
    // Whisper "hears" every word of the sentence except those with "th"
    // (it waits for the Gemini request, which carries the sentence).
    for (let i = 0; i < 50 && gemini.length < groq.length; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    const m = gemini[groq.length - 1]?.prompt.match(/Target words, in order \(\d+\): (.*)/);
    const heard = (m?.[1] ?? '').split(' | ').map((w) => w.replace(/th/i, 's'));
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        text: heard.join(' '),
        words: heard.map((word, i) => ({ word, start: i * 0.3, end: i * 0.3 + 0.25 })),
      }),
    });
  });

  await page.goto('./');
  await expect(page.locator('#pron-line')).toContainText('5 phrases');
  await shot(page, 'p6-home');
  await page.locator('#open-pron').click();
  const dialog = page.locator('#pronunciation');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#pron-meta')).toContainText('Phrase 1 sur 5');
  await expect(page.locator('#pron-meta')).toContainText('Gemini + contrôle Groq');
  // A new learner starts with the "th" sentence of the bank, hard words underlined.
  await expect(dialog.locator('.pron-sentence')).toHaveAttribute('lang', 'en');
  await expect(dialog.locator('.pron-hard').first()).toBeVisible();
  await expect(dialog.locator('.note.privacy')).toContainText('rien n’est');
  await shot(page, 'p6-sentence');

  // Record with the fake microphone, then stop by hand.
  await dialog.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(dialog.getByRole('button', { name: 'J’ai fini' })).toBeVisible();
  await page.waitForTimeout(2500);
  await dialog.getByRole('button', { name: 'J’ai fini' }).click();

  await expect(dialog.locator('.pron-result')).toBeVisible({ timeout: 30_000 });
  expect(gemini).toHaveLength(1);
  expect(gemini[0].mime).toBe('audio/wav');
  expect(gemini[0].audioBytes).toBeGreaterThan(16_000); // > 0.5 s of 16 kHz audio
  expect(gemini[0].schema).toBe(true);
  expect(gemini[0].prompt).toContain('Target sentence');
  expect(groq).toEqual([expect.objectContaining({ format: 'verbose_json', granularity: 'word' })]);

  const words = dialog.locator('.pron-word');
  expect(await words.count()).toBeGreaterThan(5);
  // "think" said badly (42) → weak, with its score written next to it
  const weak = dialog.locator('.pron-word[data-level="weak"]').first();
  await expect(weak).toContainText('✗');
  await expect(dialog.locator('.pron-word[data-level="good"]').first()).toContainText('✓');
  await expect(dialog.locator('.pron-result')).toContainText('Sons à travailler');
  await expect(dialog.locator('.pron-tips')).toContainText('Le « th »');
  await expect(dialog.locator('.pron-overall')).toContainText('estimation');
  await expect(dialog.locator('.pron-result')).toContainText('La machine a entendu');
  await expect(dialog.locator('.pron-live .status')).toContainText('ajouté');
  await shot(page, 'p6-result');

  // Text only is stored: the attempt has the sentence and scores, no audio.
  const stored = await page.evaluate(
    () =>
      new Promise<{ attempts: string; cards: { id: string; kind: string; note: string }[] }>(
        (resolve, reject) => {
          const req = indexedDB.open('english-buddy');
          req.onsuccess = () => {
            const tx = req.result.transaction(['pron', 'cards'], 'readonly');
            const a = tx.objectStore('pron').getAll();
            const c = tx.objectStore('cards').getAll();
            tx.oncomplete = () => {
              req.result.close();
              resolve({ attempts: JSON.stringify(a.result), cards: c.result });
            };
          };
          req.onerror = () => reject(req.error);
        },
      ),
  );
  const attempts = JSON.parse(stored.attempts) as { sentence: string; result: object }[];
  expect(attempts).toHaveLength(1);
  expect(stored.attempts.length).toBeLessThan(6000);
  expect(stored.attempts).not.toMatch(/UklGR|audio\/wav|inlineData/); // no WAV anywhere
  const soundCards = stored.cards.filter((c) => c.kind === 'sound');
  expect(soundCards.length).toBeGreaterThan(0);
  expect(soundCards.every((c) => c.note === attempts[0].sentence)).toBe(true);

  // Next sentence, then close: the home line shows the estimate.
  await dialog.getByRole('button', { name: 'Phrase suivante' }).click();
  await expect(page.locator('#pron-meta')).toContainText('Phrase 2 sur 5');
  await dialog.getByRole('button', { name: 'Fermer' }).click();
  await expect(page.locator('#pron-line')).toContainText('Note estimée');

  // "Mes progrès": sounds to work on, weakest first ("th").
  await page.locator('#open-progress').click();
  const progress = page.locator('#progress');
  await expect(progress.locator('.pron-progress')).toContainText('Sons à travailler');
  await expect(progress.locator('.pron-progress .skill').first()).toContainText('Le « th »');
  await expect(progress.locator('.pron-progress')).toContainText('estimation');
  await shot(page, 'p6-progress');
  await progress.getByRole('button', { name: 'Fermer' }).click();

  // A sound card that is due shows in the flash reviews with its tip.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open('english-buddy');
        req.onsuccess = () => {
          const tx = req.result.transaction('cards', 'readwrite');
          const s = tx.objectStore('cards');
          const all = s.getAll();
          all.onsuccess = () => {
            for (const c of all.result) s.put({ ...c, fsrs: { ...c.fsrs, dueAt: 0 } });
          };
          tx.oncomplete = () => {
            req.result.close();
            resolve();
          };
        };
      }),
  );
  await page.reload();
  await expect(page.locator('#open-reviews')).toBeEnabled();
  await page.locator('#open-reviews').click();
  const review = page.locator('#reviews .review-card[data-kind="sound"]');
  await expect(review).toContainText('Prononce ce mot');
  await page.getByRole('button', { name: 'Voir la réponse' }).click();
  await expect(review.locator('.review-answer')).toBeVisible();
  await shot(page, 'p6-review');
  await page.locator('#reviews-close').click();

  // The due card comes back first in the exercise, its word in bold.
  await page.locator('#open-pron').click();
  await expect(dialog.locator('.pron-card').first()).toHaveAttribute('data-source', 'card');
  await expect(dialog.locator('.pron-hard.focus')).toBeVisible();

  // 420 px: no horizontal scroll in the dialog.
  await page.setViewportSize({ width: 420, height: 860 });
  await expect(dialog).toBeVisible();
  const overflow = await page.evaluate(() => {
    const d = document.getElementById('pronunciation')!;
    return d.scrollWidth - d.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
  await shot(page, 'p6-sentence-420');
  await dialog.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForTimeout(1500);
  await dialog.getByRole('button', { name: 'J’ai fini' }).click();
  await expect(dialog.locator('.pron-result')).toBeVisible({ timeout: 30_000 });
  const overflow2 = await page.evaluate(() => {
    const d = document.getElementById('pronunciation')!;
    return d.scrollWidth - d.clientWidth;
  });
  expect(overflow2).toBeLessThanOrEqual(0);
  await dialog.locator('.pron-result').scrollIntoViewIfNeeded();
  await shot(page, 'p6-result-420');
  await dialog.getByRole('button', { name: 'Fermer' }).click();

  // Settings: the optional Azure key sits under "Prononciation", folded.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator('#open-settings').click();
  await page.locator('#settings summary', { hasText: 'Azure' }).click();
  await expect(page.locator('#azure-region')).toHaveValue('westeurope');
  await page.locator('#azure-key').scrollIntoViewIfNeeded();
  await shot(page, 'p6-settings');
  expect(errors).toEqual([]);
});

test('pronunciation without a key opens the welcome at the key step', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('english-buddy.settings.v1', JSON.stringify({ apiKey: '' })),
  );
  await page.addInitScript(() =>
    localStorage.setItem('english-buddy.welcome.v1', JSON.stringify({ done: true, at: 1 })),
  );
  await page.goto('./');
  await page.locator('#open-pron').click();
  await expect(page.locator('#welcome')).toBeVisible();
  await expect(page.locator('#pronunciation')).toBeHidden();
});
