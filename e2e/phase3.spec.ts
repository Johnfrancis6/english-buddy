import { expect, test, type Page, type WebSocketRoute } from '@playwright/test';

/**
 * Phase 3 with Google simulated: memory, learner profile and progress, from
 * talks seeded in IndexedDB. Checks what the character is told, what the
 * analyzer is asked, and the French screens. Not the real models.
 */
const FAKE_KEY = 'AIzaFAKE-e2e-phase3-000000';
const DAY = 86_400_000;

function audio(): string {
  const n = 9600;
  const buf = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++)
    buf.writeInt16LE(Math.round(Math.sin((i / 24000) * 2 * Math.PI * 220) * 8000), i * 2);
  return buf.toString('base64');
}

/** Three past talks over two weeks, and two facts, as phase 3 saves them. */
export async function seed(page: Page): Promise<void> {
  await page.evaluate(async (DAY) => {
    const now = Date.now();
    const m = (type: string, said: string, correct: string) => ({
      turn: 1,
      type,
      said,
      correct,
      explanationFr: 'Règle.',
      recastByCharacter: false,
    });
    const talk = (
      id: string,
      ago: number,
      text: string,
      mistakes: object[],
      score: number,
      character = 'jake',
    ) => ({
      id,
      startedAt: now - ago * DAY,
      durationMs: 300_000,
      label: '',
      character,
      scene: 'cafe',
      turns: [{ id: 1, who: 'you', text, liveText: text, source: 'live', interrupted: false }],
      debrief: {
        summaryFr: 'Bien.',
        strengthsFr: [],
        mistakes,
        vocabulary: [],
        nextFocusFr: '',
        model: 'seed',
        skills: { fluency: score, grammar: score - 6, vocabulary: score, listening: score + 6 },
      },
      why: {},
      speakingMs: 150_000,
    });
    const talks = [
      talk(
        's1',
        9,
        'Yesterday I go to the office and I meet my manager.',
        [
          m('verb_tense', 'I go', 'I went'),
          m('verb_tense', 'I meet', 'I met'),
          m('articles', 'the life', 'life'),
        ],
        48,
      ),
      talk(
        's2',
        2,
        'I am working on a big project for a bank, it is very interesting.',
        [m('verb_tense', 'I work since', 'I have been working since')],
        56,
        'emma',
      ),
      talk(
        's3',
        1,
        'My daughter started the school this week.',
        [m('articles', 'the school', 'school')],
        58,
      ),
    ];
    const facts = [
      {
        id: 'fa',
        category: 'job',
        text: 'Travaille comme ingénieur de données dans une banque.',
        createdAt: now - 9 * DAY,
        updatedAt: now - 9 * DAY,
        byLearner: false,
      },
      {
        id: 'fb',
        category: 'family',
        text: 'A une fille qui vient d’entrer au CP.',
        createdAt: now - DAY,
        updatedAt: now - DAY,
        byLearner: false,
      },
      {
        id: 'fc',
        category: 'last_talk',
        character: 'jake',
        text: 'Vous avez parlé de la rentrée de sa fille ; lui demander comment ça se passe.',
        createdAt: now - DAY,
        updatedAt: now - DAY,
        byLearner: false,
      },
    ];
    await new Promise<void>((resolve, reject) => {
      // No version: the page may already have upgraded the database (phase 4: v3).
      const req = indexedDB.open('english-buddy');
      req.onupgradeneeded = () => {
        for (const s of ['talks', 'facts'])
          if (!req.result.objectStoreNames.contains(s))
            req.result.createObjectStore(s, { keyPath: 'id' });
      };
      req.onsuccess = () => {
        const tx = req.result.transaction(['talks', 'facts'], 'readwrite');
        for (const t of talks) tx.objectStore('talks').put(t);
        for (const f of facts) tx.objectStore('facts').put(f);
        tx.oncomplete = () => {
          req.result.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }, DAY);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => {
    if (!localStorage.getItem('english-buddy.settings.v1')) {
      localStorage.setItem('english-buddy.settings.v1', JSON.stringify({ apiKey: key }));
    }
  }, FAKE_KEY);
});

test('progress dashboard and memory screen from saved talks', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  // Empty states first.
  await page.locator('#open-progress').click();
  await expect(page.locator('#progress-body')).toContainText('Pas encore de progrès');
  await page.locator('#progress-close').click();
  await seed(page);
  await page.reload();

  await page.locator('#open-progress').click();
  const dash = page.locator('#progress');
  await expect(dash.locator('.level-band')).toHaveText('B1');
  await expect(dash).toContainText('estimation');
  await expect(dash.locator('.skill')).toHaveCount(5); // 4 skills + the scale
  await expect(dash.locator('.heat-table tbody tr')).toHaveCount(3); // 2 types + total
  await expect(dash.locator('.heat-table')).toContainText('Temps du verbe');
  await expect(dash.locator('.bar')).toHaveCount(8);
  await expect(dash.locator('.talk-list li')).toHaveCount(3);
  // A past talk opens its debrief.
  await dash.locator('.talk-list li').first().getByRole('button').click();
  await expect(page.locator('#debrief')).toBeVisible();
  await page.locator('#debrief-close').click();

  // Memory: see, correct, erase, add; it survives a reload.
  await page.locator('#open-memory').click();
  const mem = page.locator('#memory');
  await expect(mem.locator('.fact')).toHaveCount(3);
  await expect(mem).toContainText('Dernière conversation');
  await expect(mem).toContainText('avec Jake');
  const job = mem.locator('.fact[data-id="fa"]');
  await job.getByRole('button', { name: 'Corriger' }).click();
  await job.locator('textarea').fill('Travaille comme chef de projet dans une banque.');
  await job.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(job).toContainText('corrigé par toi');
  await mem.locator('.fact[data-id="fb"]').getByRole('button', { name: 'Effacer' }).click();
  await expect(mem.locator('.fact')).toHaveCount(2);
  await mem.locator('.add-fact summary').click();
  await mem.locator('#fact-category').selectOption('likes');
  await mem.locator('#fact-new').fill('Adore le jazz.');
  await mem.getByRole('button', { name: 'Ajouter' }).click();
  await expect(mem.locator('.fact')).toHaveCount(3);
  await page.reload();
  await page.locator('#open-memory').click();
  await expect(mem).toContainText('chef de projet');
  await expect(mem).toContainText('Adore le jazz.');
  await expect(mem).not.toContainText('CP');
  expect(errors).toEqual([]);
});

test('the character gets the profile and memory; the debrief updates the memory', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
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
  let analyzerBody = '';
  await page.route('**/v1beta/models/*:generateContent', async (route) => {
    analyzerBody = route.request().postData() ?? '';
    const text = JSON.stringify({
      summary_fr: 'Bonne conversation.',
      strengths_fr: [],
      mistakes: [],
      vocabulary: [],
      next_focus_fr: 'Le present perfect.',
      skill_scores: { fluency: 62, grammar: 55, vocabulary: 60, listening: 70 },
      memory_facts: [
        { category: 'plans', fact_fr: 'Part à Londres en mars pour le travail.', replaces: '' },
        { category: 'job', fact_fr: 'Est chef de projet données dans une banque.', replaces: 'fa' },
      ],
      talk_memory_fr: 'Il a parlé de son voyage à Londres ; lui demander comment il le prépare.',
    });
    await route.fulfill({ json: { candidates: [{ content: { parts: [{ text }] } }] } });
  });

  await page.goto('./');
  await seed(page);
  await page.reload();
  await expect(page.locator('#stage')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await page.locator('#enter').click();
  await expect(page.locator('#start')).toBeEnabled({ timeout: 30_000 });
  await page.locator('#start').click();
  await expect.poll(() => setup !== null, { timeout: 20_000 }).toBe(true);

  const prompt = JSON.stringify(
    (setup as unknown as { systemInstruction: object }).systemInstruction,
  );
  expect(prompt).toContain('at about B1 level (estimated from their recent talks)');
  expect(prompt).toContain('verb tenses, e.g.');
  expect(prompt).toContain('Travaille comme ingénieur de données dans une banque.');
  expect(prompt).toContain('Your last talk with them (yesterday)');
  expect(prompt).toContain('Never recite the list');

  const ws = live as unknown as WebSocketRoute;
  const say = (serverContent: object) => ws.send(JSON.stringify({ serverContent }));
  say({
    modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: audio() } }] },
  });
  say({ outputTranscription: { text: 'Hey! How is your daughter liking school?' } });
  say({ turnComplete: true });
  say({ inputTranscription: { text: 'She likes it. And I go to London in March for work.' } });
  say({
    modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: audio() } }] },
  });
  say({ outputTranscription: { text: "No way, you're going to London? Awesome!" } });
  say({ turnComplete: true });
  await expect(page.locator('#transcript p.buddy:not([hidden])')).toHaveCount(2);
  await page.locator('#start').click();

  const dialog = page.locator('#debrief');
  await expect(dialog.locator('.memory-note')).toContainText('Part à Londres en mars', {
    timeout: 15_000,
  });
  await expect(dialog.locator('.skills-line')).toContainText('Aisance 62');
  // The analyzer got the known facts with their ids and the estimated level.
  expect(analyzerBody).toContain('[fa] (job) Travaille comme ingénieur de données');
  expect(analyzerBody).toContain('level about B1');
  expect(analyzerBody).toContain('skill_scores');

  await dialog.getByRole('button', { name: 'Voir, corriger ou effacer' }).click();
  const mem = page.locator('#memory');
  await expect(mem).toContainText('Part à Londres en mars pour le travail.');
  await expect(mem).toContainText('Est chef de projet données dans une banque.');
  await expect(mem).not.toContainText('ingénieur de données');
  await expect(mem.locator('.fact-group[data-category="last_talk"] .fact')).toHaveCount(1);
  await expect(mem).toContainText('voyage à Londres');
  expect(errors).toEqual([]);
});
