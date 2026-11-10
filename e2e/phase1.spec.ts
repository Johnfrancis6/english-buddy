import { expect, test, type Page, type WebSocketRoute } from '@playwright/test';

/**
 * Phase 1 flows with Google and Groq simulated: the Live WebSocket and the
 * HTTP APIs are answered by the test, so no key is needed. This checks our
 * side (messages sent, transcript, debrief, "Pourquoi ?", lab scoring), not
 * the real models.
 */

const FAKE_KEY = 'AIzaFAKE-e2e-0000000000';

/** 0.4 s of a 220 Hz tone, 24 kHz 16-bit PCM, base64. */
function jakeAudio(): string {
  const n = 9600;
  const buf = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++)
    buf.writeInt16LE(Math.round(Math.sin((i / 24000) * 2 * Math.PI * 220) * 8000), i * 2);
  return buf.toString('base64');
}

const say = (ws: WebSocketRoute, serverContent: object) =>
  ws.send(JSON.stringify({ serverContent }));

async function withKey(page: Page, extra: object = {}): Promise<void> {
  await page.addInitScript(
    ([key, more]) => {
      if (!localStorage.getItem('english-buddy.settings.v1')) {
        localStorage.setItem(
          'english-buddy.settings.v1',
          JSON.stringify({ apiKey: key, ...(more as object) }),
        );
      }
    },
    [FAKE_KEY, extra] as const,
  );
}

test('talk with Jake, live transcript, French debrief and "Pourquoi ?"', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await withKey(page);

  let setup: Record<string, unknown> | null = null;
  let live: WebSocketRoute | null = null;
  await page.routeWebSocket(/BidiGenerateContent/, (ws) => {
    live = ws;
    ws.onMessage((raw) => {
      const msg = JSON.parse(String(raw));
      if (msg.setup) {
        setup = msg.setup;
        ws.send(JSON.stringify({ setupComplete: {} }));
      }
    });
  });

  const requests: { schema: boolean; body: string }[] = [];
  await page.route('**/v1beta/models/*:generateContent', async (route) => {
    const body = route.request().postData() ?? '';
    const json = JSON.parse(body);
    const schema = Boolean(json.generationConfig?.responseJsonSchema);
    requests.push({ schema, body });
    expect(route.request().headers()['x-goog-api-key']).toBe(FAKE_KEY);
    const text = schema
      ? JSON.stringify({
          summary_fr: 'Belle conversation, tu as osé raconter ta soirée.',
          strengths_fr: ['Tu poses des questions à Jake.'],
          mistakes: [
            {
              turn: 2,
              type: 'verb_tense',
              said: 'Yesterday I go',
              correct: 'Yesterday I went',
              explanation_fr: 'Avec « yesterday », on met le verbe au passé (prétérit).',
              recast_by_jake: true,
            },
          ],
          vocabulary: [
            {
              english: 'to catch a movie',
              french: 'aller voir un film',
              example: "Let's catch a movie.",
            },
          ],
          next_focus_fr: 'Le prétérit des verbes irréguliers.',
        })
      : 'En anglais, une action terminée dans le passé se dit au prétérit.';
    await route.fulfill({ json: { candidates: [{ content: { parts: [{ text }] } }] } });
  });

  await page.goto('./');
  await expect(page.locator('#stage')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await page.locator('#start').click();
  await expect.poll(() => setup !== null, { timeout: 20_000 }).toBe(true);

  // What we send to Google: Jake's teaching prompt and both transcriptions.
  const s = setup as unknown as Record<string, Record<string, unknown>>;
  const prompt = JSON.stringify(s.systemInstruction);
  expect(prompt).toContain('You are Jake');
  expect(prompt).toContain('Recast');
  expect(s.inputAudioTranscription).toBeTruthy();
  expect(s.outputAudioTranscription).toBeTruthy();

  const ws = live as unknown as WebSocketRoute;
  say(ws, {
    modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: jakeAudio() } }] },
  });
  say(ws, { outputTranscription: { text: 'Hey! How are you doing?' } });
  say(ws, { turnComplete: true });
  await expect(page.locator('#transcript')).toContainText('Hey! How are you doing?');

  say(ws, { inputTranscription: { text: 'Yesterday I go ' } });
  say(ws, { inputTranscription: { text: 'to the cinema.' } });
  await expect(page.locator('#transcript p.you:not([hidden])')).toContainText(
    'Yesterday I go to the cinema.',
  );
  say(ws, {
    modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: jakeAudio() } }] },
  });
  say(ws, { outputTranscription: { text: 'Oh nice, you went to the cinema? What did you see?' } });
  say(ws, { turnComplete: true });
  await expect(page.locator('#transcript p.jake:not([hidden])')).toHaveCount(2);

  // Hide / show the transcript.
  await page.locator('#toggle-transcript').click();
  await expect(page.locator('#transcript')).toBeHidden();
  await page.locator('#toggle-transcript').click();
  await expect(page.locator('#transcript')).toBeVisible();

  // Stop: the debrief is built from the transcript.
  await page.locator('#start').click();
  const dialog = page.locator('#debrief');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.mistake')).toHaveCount(1, { timeout: 15_000 });
  await expect(dialog.locator('.said')).toHaveText('Yesterday I go');
  await expect(dialog.locator('.correct')).toHaveText('Yesterday I went');
  await expect(dialog).toContainText('Temps du verbe');
  await expect(dialog).toContainText('Jake l’a reformulé');
  expect(requests[0].schema).toBe(true);
  expect(requests[0].body).toContain('Learner: Yesterday I go to the cinema.');

  await dialog.getByRole('button', { name: 'Pourquoi ?' }).click();
  await expect(dialog.locator('.why')).toContainText('prétérit');
  expect(requests).toHaveLength(2);
  expect(requests[1].schema).toBe(false);

  // The talk (text only) is kept in this browser and comes back after a reload.
  await page.locator('#debrief-close').click();
  await page.reload();
  await expect(page.locator('#open-debrief')).toBeVisible();
  await page.locator('#open-debrief').click();
  await expect(page.locator('#debrief .correct')).toHaveText('Yesterday I went');
  await page.locator('#debrief').getByRole('button', { name: 'Pourquoi ?' }).click();
  await expect(page.locator('#debrief .why')).toContainText('prétérit');
  expect(requests).toHaveLength(2); // cached, no new request

  expect(errors).toEqual([]);
});

test('transcription lab compares sources on the same recording', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let live: WebSocketRoute | null = null;
  let setupPrompt = '';
  await page.routeWebSocket(/BidiGenerateContent/, (ws) => {
    live = ws;
    ws.onMessage((raw) => {
      const msg = JSON.parse(String(raw));
      if (msg.setup) {
        setupPrompt = JSON.stringify(msg.setup.systemInstruction);
        ws.send(JSON.stringify({ setupComplete: {} }));
      }
    });
  });
  let groqCalls = 0;
  await page.route('https://api.groq.com/**', async (route) => {
    groqCalls++;
    expect(route.request().headers().authorization).toBe('Bearer gsk_fake_e2e');
    await route.fulfill({ json: { text: 'Yesterday I go to the cinema with my friends.' } });
  });
  await page.route('**/v1beta/models/*:generateContent', (route) =>
    route.fulfill({
      json: {
        candidates: [
          { content: { parts: [{ text: 'Yesterday I went to the cinema with my friends.' }] } },
        ],
      },
    }),
  );

  await page.goto('./lab.html');
  await expect(page.locator('h1')).toContainText('transcription');
  await page.locator('#lab-gemini').fill(FAKE_KEY);
  await page.locator('#lab-groq').fill('gsk_fake_e2e');
  await page.locator('#lab-connect').click();
  await expect(page.locator('#lab-state')).toContainText('Connecté', { timeout: 15_000 });
  expect(setupPrompt).toContain('Okay');
  await expect(page.locator('#lab-sentence')).toHaveText(
    'Yesterday I go to the cinema with my friends.',
  );

  await page.locator('#lab-record').click();
  await page.waitForTimeout(600);
  const ws = live as unknown as WebSocketRoute;
  say(ws, { inputTranscription: { text: 'Yesterday I go to the cinema with my friends.' } });
  await page.locator('#lab-record').click();
  say(ws, { turnComplete: true });

  const row = (id: string) => page.locator(`#lab-results [data-source="${id}"]`);
  await expect(row('live').locator('.fate.kept')).toHaveCount(1, { timeout: 10_000 });
  await expect(row('groq').locator('.fate.kept')).toHaveCount(1);
  await expect(row('groq-prompt').locator('.fate.kept')).toHaveCount(1);
  await expect(row('gemini-audio').locator('.fate.fixed')).toHaveCount(1);
  expect(groqCalls).toBe(2);
  await expect(page.locator('#lab-table tr[data-source="gemini-audio"]')).toContainText('0/1');
  await expect(page.locator('#lab-reco')).toContainText('au moins 8 phrases');
  expect(errors).toEqual([]);
});

test('with a Groq key, the learner text comes from Groq Whisper', async ({ page }) => {
  test.setTimeout(120_000);
  await withKey(page, { groqKey: 'gsk_fake_e2e', transcriptSource: 'groq' });
  let live: WebSocketRoute | null = null;
  await page.routeWebSocket(/BidiGenerateContent/, (ws) => {
    live = ws;
    ws.onMessage((raw) => {
      if (JSON.parse(String(raw)).setup) ws.send(JSON.stringify({ setupComplete: {} }));
    });
  });
  let wavBytes = 0;
  await page.route('https://api.groq.com/**', async (route) => {
    wavBytes = route.request().postDataBuffer()?.length ?? 0;
    await route.fulfill({ json: { text: 'Yesterday I go to the cinema.' } });
  });
  let analysed = '';
  await page.route('**/v1beta/models/*:generateContent', async (route) => {
    analysed = route.request().postData() ?? '';
    await route.fulfill({
      json: {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    summary_fr: 'OK',
                    strengths_fr: [],
                    mistakes: [],
                    vocabulary: [],
                    next_focus_fr: '',
                  }),
                },
              ],
            },
          },
        ],
      },
    });
  });

  await page.goto('./');
  await expect(page.locator('#stage')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await expect(page.locator('#t-source')).toContainText('Groq');
  await page.locator('#start').click();
  await expect.poll(() => live !== null, { timeout: 20_000 }).toBe(true);
  const ws = live as unknown as WebSocketRoute;
  // Chromium's fake microphone beeps: that is the "speech" sent to Groq.
  await page.waitForTimeout(2500);
  say(ws, { inputTranscription: { text: 'Yesterday I went to the cinema.' } });
  say(ws, {
    modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: jakeAudio() } }] },
  });
  say(ws, { outputTranscription: { text: 'Cool! What did you see?' } });
  say(ws, { turnComplete: true });

  const you = page.locator('#transcript p.you:not([hidden])');
  await expect(you).toHaveText(/Yesterday I go to the cinema\./, { timeout: 10_000 });
  expect(wavBytes).toBeGreaterThan(10_000);

  await page.locator('#start').click();
  await expect(page.locator('#debrief')).toContainText('Aucune faute', { timeout: 15_000 });
  expect(analysed).toContain('Learner: Yesterday I go to the cinema.');
  expect(analysed).toContain('Groq');
});
