import { expect, test, type Page } from '@playwright/test';

/**
 * Phase 7 with Google and Groq simulated: the songbook, a song written from
 * the learner's lessons, the karaoke with Maya (she hums and keeps the
 * beat), a take recorded from Chromium's fake microphone, the score per word
 * (pronunciation by "Gemini", rhythm measured in the page and refined by
 * "Whisper" timestamps), text-only storage. Nothing here measures a real
 * voice, a real model, or how the hum sounds.
 */
const FAKE_KEY = 'AIzaFAKE-e2e-0000000000';
const GROQ_KEY = 'gsk_FAKE_e2e';

async function shot(page: Page, name: string): Promise<void> {
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}.png` });
}

const SONG_JSON = JSON.stringify({
  title: 'Two Years Here',
  lines: [
    ['I', 'have', 'lived', 'here', 'for', 'two', 'years,'],
    ['it', 'depends', 'on', 'the', 'weather.'],
    ['I', 'agree', 'with', 'you,', 'my', 'dear,'],
    ['we', 'can', 'sing', 'together.'],
  ].map((ws) => ({ words: ws.map((w) => ({ w, syl: /depends|agree|weather/.test(w) ? 2 : 1 })) })),
});

/** Sung words: those with "th" are said badly. */
function fakePron(prompt: string): string {
  const m = prompt.match(/Target words, in order \(\d+\): (.*)/);
  const words = (m?.[1] ?? '').split(' | ').filter(Boolean);
  return JSON.stringify({
    audio_ok: true,
    heard: words.join(' ').replace(/th/gi, 's'),
    words: words.map((w) => {
      const th = /th/i.test(w);
      return {
        word: w,
        score: th ? 45 : 91,
        missing: false,
        issues: th ? ['th'] : [],
        ...(th ? { heard_as: w.replace(/th/i, 's'), tip_fr: 'Langue entre les dents.' } : {}),
      };
    }),
    feedback_fr: 'Tu tiens bien l’air. À travailler : le « th ».',
  });
}

interface Calls {
  songs: { system: string; prompt: string }[];
  pron: { prompt: string; audioBytes: number }[];
  groq: number;
}

async function mockProviders(page: Page): Promise<Calls> {
  const calls: Calls = { songs: [], pron: [], groq: 0 };
  await page.route('**/v1beta/models/*:generateContent', async (route) => {
    expect(route.request().headers()['x-goog-api-key']).toBe(FAKE_KEY);
    const json = JSON.parse(route.request().postData() ?? '{}');
    const parts = json.contents[0].parts as { text?: string; inlineData?: { data: string } }[];
    const prompt = parts.find((p) => p.text)?.text ?? '';
    const audio = parts.find((p) => p.inlineData)?.inlineData;
    let text: string;
    if (json.generationConfig?.responseJsonSchema?.properties?.lines) {
      calls.songs.push({ system: json.systemInstruction?.parts?.[0]?.text ?? '', prompt });
      text = SONG_JSON;
    } else {
      calls.pron.push({
        prompt,
        audioBytes: audio ? Buffer.from(audio.data, 'base64').length : 0,
      });
      text = fakePron(prompt);
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }),
    });
  });
  await page.route('**/openai/v1/audio/transcriptions', async (route) => {
    calls.groq++;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        text: 'I think of three thin things',
        words: ['I', 'think', 'of', 'three', 'thin', 'things'].map((word, i) => ({
          word,
          start: 0.4 + i * 0.6,
          end: 0.9 + i * 0.6,
        })),
      }),
    });
  });
  return calls;
}

const noSideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

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

test('karaoke: songbook, own song, Maya hums and keeps the beat, score per word', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const calls = await mockProviders(page);

  await page.goto('./');
  await expect(page.locator('#sing-line')).toContainText('8 chansons courtes');
  await expect(page.locator('#stage')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await shot(page, 'p7-home');

  // The songbook: public domain or written for the platform, each with its credit.
  await page.locator('#open-songs').click();
  const songs = page.locator('#songs');
  await expect(songs).toBeVisible();
  await expect(songs.locator('#song-book .song-row')).toHaveCount(8);
  await expect(songs.locator('#song-book')).toContainText('Twinkle, Twinkle, Little Star');
  await expect(songs.locator('#song-book')).toContainText('Domaine public');
  await expect(songs.locator('#song-book')).toContainText('Écrite pour English Buddy');
  await expect(songs.locator('.note.privacy')).toContainText('rien n’est');
  // A newcomer has no review card yet: the song starts from classic mistakes.
  await expect(songs.locator('.song-lessons li')).toHaveCount(3);
  await expect(songs.locator('.songs-own')).toContainText('fautes classiques des francophones');
  await shot(page, 'p7-songbook');

  // A song written from the lessons: the request carries them and the syllables per line.
  await songs.locator('#song-write').click();
  await expect(songs.locator('.songs-own .song-row')).toHaveCount(1, { timeout: 20_000 });
  expect(calls.songs).toHaveLength(1);
  expect(calls.songs[0].prompt).toContain('Sung syllables per line:');
  expect(calls.songs[0].prompt).toContain('- I have lived here for two years');
  expect(calls.songs[0].system).toContain('never quote or imitate the lyrics of an existing song');
  await expect(songs.locator('.songs-own .song-row')).toContainText('Two Years Here');
  await expect(songs.locator('.songs-own .song-row')).toContainText('Écrite pour toi');
  await shot(page, 'p7-own-song');

  // Sing it first: the words fit the tune and the lessons used are shown.
  await songs
    .locator('.songs-own .song-row')
    .getByRole('button', { name: /Chanter/ })
    .click();
  const sing = page.locator('#sing');
  await expect(sing).toBeVisible();
  await expect(sing.locator('.sing-title')).toHaveText('Two Years Here');
  await expect(sing.locator('.sing-uses')).toContainText('It depends on the weather');
  await expect(sing.locator('.sing-line.current')).toHaveText('I have lived here for two years,');
  // Maya takes the stage in her street.
  const stage = page.locator('#stage');
  await expect(stage).toHaveAttribute('data-character', 'maya');
  await expect(stage).toHaveAttribute('data-scene', 'street');
  await expect(stage).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await expect(page.locator('#home')).toBeHidden();
  await shot(page, 'p7-own-song-ready');

  // Another song from the panel: the short "th" song written for the platform.
  await sing.locator('#sing-other').click();
  await songs
    .locator('#song-book .song-row[data-id="three-thin-things"]')
    .getByRole('button', { name: /Chanter/ })
    .click();
  await expect(sing.locator('.sing-title')).toHaveText('Three Thin Things');
  await expect(sing.locator('.sing-credit')).toContainText('écrits pour English Buddy');

  // Listen first: Maya counts, hums (her mouth moves), keeps the beat; the words light up.
  await sing.locator('#sing-listen').click();
  await expect(sing.locator('.sing-count')).not.toBeEmpty();
  await expect(stage).toHaveAttribute('data-dancing', 'true', { timeout: 15_000 });
  await expect(sing.locator('.sing-word.now')).toHaveCount(1, { timeout: 15_000 });
  await expect(sing.locator('.sing-status')).toContainText('Maya fredonne');
  await expect
    .poll(async () => Number(await stage.getAttribute('data-mouth')), { timeout: 15_000 })
    .toBeGreaterThan(0.05);
  await shot(page, 'p7-listening');
  await sing.getByRole('button', { name: 'Arrêter' }).click();
  await expect(sing.locator('#sing-go')).toHaveText('Chanter');
  await expect(stage).toHaveAttribute('data-dancing', 'false', { timeout: 15_000 });

  // Sing: the fake microphone is recorded for the length of the song, then scored.
  await sing.locator('#sing-go').click();
  await expect(sing.locator('.sing-word.now')).toHaveCount(1, { timeout: 20_000 });
  await expect(sing.locator('.sing-status')).toContainText('chante avec Maya');
  await shot(page, 'p7-singing');
  const result = page.locator('#sing-result');
  await expect(result).toBeVisible({ timeout: 90_000 });
  await expect(result.locator('.pron-overall')).toContainText('/100');
  await expect(result.locator('.pron-overall')).toContainText('estimation');
  await expect(result.locator('.sing-parts')).toContainText('Prononciation');
  await expect(result.locator('.sing-parts')).toContainText('Rythme');
  // 6 + 5 + 7 + 5 words, each with a pronunciation mark and a rhythm mark.
  await expect(result.locator('.sing-tile')).toHaveCount(23);
  await expect(result.locator('.sing-tile .sing-r')).toHaveCount(23);
  await expect(result.locator('.sing-tile').nth(1)).toContainText('think');
  await expect(result.locator('.sing-tile').nth(1)).toContainText('✗ 45');
  await expect(result.locator('.sing-result')).toContainText('Le « th »');
  await expect(result.locator('.sing-result')).toContainText('horodatages de Groq Whisper');
  await shot(page, 'p7-result');

  // One request for the whole short song, told that the words are sung, with the take as WAV.
  expect(calls.pron).toHaveLength(1);
  expect(calls.pron[0].prompt).toContain('Target lyrics (sung by the speaker)');
  expect(calls.pron[0].prompt).toContain('SINGING');
  expect(calls.pron[0].prompt).toContain('I think of three thin things, this and that');
  // About 21 s of 16 kHz mono 16-bit audio: the song's lines, not more.
  expect(calls.pron[0].audioBytes).toBeGreaterThan(15 * 32_000);
  expect(calls.pron[0].audioBytes).toBeLessThan(26 * 32_000);
  expect(calls.groq).toBe(1);

  // Text only is stored: scores and lyrics, no audio.
  const stored = await page.evaluate(
    () =>
      new Promise<{ sing: string; songs: string }>((resolve, reject) => {
        const req = indexedDB.open('english-buddy');
        req.onsuccess = () => {
          const tx = req.result.transaction(['sing', 'songs'], 'readonly');
          const a = tx.objectStore('sing').getAll();
          const s = tx.objectStore('songs').getAll();
          tx.oncomplete = () => {
            req.result.close();
            resolve({ sing: JSON.stringify(a.result), songs: JSON.stringify(s.result) });
          };
        };
        req.onerror = () => reject(req.error);
      }),
  );
  const attempts = JSON.parse(stored.sing) as { songId: string; result: { words: object[] } }[];
  expect(attempts).toHaveLength(1);
  expect(attempts[0].songId).toBe('three-thin-things');
  expect(attempts[0].result.words).toHaveLength(23);
  expect(stored.sing.length).toBeLessThan(8000);
  expect(stored.sing + stored.songs).not.toMatch(/UklGR|audio\/wav|inlineData|pcm/);
  expect(JSON.parse(stored.songs)).toHaveLength(1);

  // The log (test measures) says how the take was measured.
  await result.getByRole('button', { name: 'Fermer' }).click();
  await page.locator('#measures summary').click();
  await expect(page.locator('#d-log')).toContainText('décalage constant retiré');
  await expect(page.locator('#d-log')).toContainText('voix + horodatages Whisper');

  // Back home: the first character is back, the line counts the take, progress shows it.
  await sing.locator('#sing-quit').click();
  await expect(page.locator('#home')).toBeVisible();
  await expect(sing).toBeHidden();
  await expect(stage).toHaveAttribute('data-character', 'jake');
  await expect(page.locator('#sing-line')).toContainText('1 prise chantée');
  await page.locator('#open-progress').click();
  await expect(page.locator('#progress .sing-progress')).toContainText('Rythme');
  await expect(page.locator('#progress .sing-progress')).toContainText('estimation');
  await shot(page, 'p7-progress');
  expect(errors).toEqual([]);
});

test('karaoke without any key: the rhythm is still scored, on a narrow screen', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('english-buddy.settings.v1', JSON.stringify({ apiKey: '' }));
    // The welcome has been seen: this test is about singing.
    localStorage.setItem('english-buddy.welcome.v1', JSON.stringify({ done: true, at: 1 }));
  });
  let providerCalls = 0;
  await page.route(/generativelanguage|groq\.com/, async (route) => {
    providerCalls++;
    await route.abort();
  });
  await page.setViewportSize({ width: 420, height: 860 });
  await page.goto('./');
  const welcome = page.locator('#welcome');
  if (await welcome.isVisible()) await welcome.getByRole('button', { name: 'Plus tard' }).click();
  await page.locator('#open-songs').click();
  const songs = page.locator('#songs');
  await expect(songs.locator('#song-book .song-row')).toHaveCount(8);
  expect(await noSideScroll(page)).toBe(true);
  await shot(page, 'p7-420-songbook');

  // Without a key the song is assembled in the page from the lessons.
  await songs.locator('#song-write').click();
  await expect(songs.locator('.songs-own .song-row')).toContainText('My Own Song');
  await expect(songs.locator('.songs-own .status')).toContainText('sans IA');
  await shot(page, 'p7-420-own');

  await songs
    .locator('#song-book .song-row[data-id="sleeping"]')
    .getByRole('button', { name: /Chanter/ })
    .click();
  const sing = page.locator('#sing');
  await expect(sing).toBeVisible();
  await expect(sing.locator('.sing-note')).toContainText('seul ton rythme est noté');
  await expect(page.locator('#stage')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  expect(await noSideScroll(page)).toBe(true);
  await shot(page, 'p7-420-ready');

  // In turns: Maya hums a line, the learner sings the next; only those lines are scored.
  await sing.locator('#sing-mode').selectOption('turns');
  await expect(sing.locator('.sing-line.current .sing-who')).toHaveText('Maya');
  await sing.locator('#sing-go').click();
  await expect(sing.locator('.sing-word.now')).toHaveCount(1, { timeout: 20_000 });
  await shot(page, 'p7-420-singing');
  const result = page.locator('#sing-result');
  await expect(result).toBeVisible({ timeout: 90_000 });
  await expect(result.locator('.sing-parts')).toContainText('Prononciation : pas notée');
  await expect(result.locator('.sing-result')).toContainText('ajoute ta clé Gemini');
  await expect(result.locator('.sing-result')).toContainText('seules tes lignes sont notées');
  // Lines 2 and 4 of "Are You Sleeping?": 4 + 6 words, rhythm only.
  await expect(result.locator('.sing-tile')).toHaveCount(10);
  expect(await noSideScroll(page)).toBe(true);
  await shot(page, 'p7-420-result');
  expect(providerCalls).toBe(0);
  expect(errors).toEqual([]);
});
