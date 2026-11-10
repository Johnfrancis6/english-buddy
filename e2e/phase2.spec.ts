import { expect, test, type WebSocketRoute } from '@playwright/test';

/**
 * Phase 2 with Google simulated: a talk with Emma at the office. Checks
 * what is sent (her prompt, her voice), that her gestures follow the talk,
 * and that the debrief speaks about her. Not the real model.
 */
const FAKE_KEY = 'AIzaFAKE-e2e-phase2-000000';

function audio(): string {
  const n = 9600;
  const buf = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++)
    buf.writeInt16LE(Math.round(Math.sin((i / 24000) * 2 * Math.PI * 220) * 8000), i * 2);
  return buf.toString('base64');
}

test('talk with Emma at the office: prompt, voice, gestures, debrief', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((key) => {
    if (!localStorage.getItem('english-buddy.settings.v1')) {
      localStorage.setItem(
        'english-buddy.settings.v1',
        JSON.stringify({ apiKey: key, scene: 'office', character: 'emma' }),
      );
    }
  }, FAKE_KEY);

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
  const bodies: string[] = [];
  await page.route('**/v1beta/models/*:generateContent', async (route) => {
    bodies.push(route.request().postData() ?? '');
    const text = JSON.stringify({
      summary_fr: 'Bonne réunion.',
      strengths_fr: [],
      mistakes: [
        {
          turn: 2,
          type: 'verb_form',
          said: 'I am agree',
          correct: 'I agree',
          explanation_fr: '« Agree » est un verbe, pas un adjectif.',
          recast_by_character: true,
        },
      ],
      vocabulary: [],
      next_focus_fr: 'Les verbes.',
    });
    await route.fulfill({ json: { candidates: [{ content: { parts: [{ text }] } }] } });
  });

  await page.goto('./');
  const canvas = page.locator('#stage');
  await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await expect(canvas).toHaveAttribute('data-character', 'emma');
  await expect(page.locator('#enter')).toContainText('bureau avec Emma');
  await page.locator('#enter').click();
  await expect(page.locator('#start')).toBeEnabled({ timeout: 30_000 });
  await page.locator('#start').click();
  await expect.poll(() => setup !== null, { timeout: 20_000 }).toBe(true);

  const s = setup as unknown as Record<string, Record<string, unknown>>;
  const prompt = JSON.stringify(s.systemInstruction);
  expect(prompt).toContain('You are Emma');
  expect(prompt).toContain('British accent');
  expect(prompt).toContain('meeting room at the office');
  expect(JSON.stringify(s.generationConfig ?? s)).toContain('Kore');

  const ws = live as unknown as WebSocketRoute;
  const say = (serverContent: object) => ws.send(JSON.stringify({ serverContent }));
  const speak = (text: string) => {
    say({
      modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: audio() } }] },
    });
    say({ outputTranscription: { text } });
    say({ turnComplete: true });
  };

  speak('Hello! How are your first weeks going?');
  await expect(canvas).toHaveAttribute('data-gestures', /wave/);
  await expect(page.locator('#transcript p.buddy .who').first()).toHaveText('Emma :');

  say({ inputTranscription: { text: 'I am agree with the plan.' } });
  await expect(page.locator('#transcript p.you:not([hidden])')).toContainText('I am agree');
  // Wait for the wave to end, then a joke: Emma laughs.
  await expect(canvas).not.toHaveAttribute('data-gestures', /wave/, { timeout: 10_000 });
  speak('Haha, you agree with me? Brilliant.');
  await expect(canvas).toHaveAttribute('data-gestures', /laugh/, { timeout: 5000 });

  await page.locator('#start').click();
  const dialog = page.locator('#debrief');
  await expect(dialog.locator('.mistake')).toHaveCount(1, { timeout: 15_000 });
  await expect(dialog).toContainText('Emma l’a reformulé');
  await expect(page.locator('#debrief-meta')).toContainText('avec Emma');
  expect(bodies[0]).toContain('British team manager');
  expect(bodies[0]).toContain('Emma: Hello!');

  expect(errors).toEqual([]);
});
