import { expect, test, type Page, type WebSocketRoute } from '@playwright/test';

/**
 * Phase 4 with Google simulated: review cards born from saved debriefs,
 * flash reviews out loud (self-graded, FSRS), the streak, the mission map,
 * the daily challenge (what the character is told, live ticks, what the
 * analyzer is asked, how the cards move) and a mission with a forbidden word.
 * Not the real models.
 */
const FAKE_KEY = 'AIzaFAKE-e2e-phase4-000000';
/** Screenshots for the design check, only when SHOTS names a folder. */
const shot = async (page: Page, name: string) => {
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}.png` });
};
const DAY = 86_400_000;

function audio(): string {
  const n = 9600;
  const buf = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++)
    buf.writeInt16LE(Math.round(Math.sin((i / 24000) * 2 * Math.PI * 220) * 8000), i * 2);
  return buf.toString('base64');
}

/**
 * Three debriefed talks on the three previous days, each with more than
 * 3 minutes of speech: 4 mistakes and 1 word become 5 review cards.
 */
async function seed(page: Page): Promise<void> {
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
    const talk = (id: string, ago: number, mistakes: object[], vocabulary: object[] = []) => ({
      id,
      startedAt: now - ago * DAY,
      durationMs: 360_000,
      label: '',
      character: 'jake',
      scene: 'cafe',
      turns: [
        { id: 1, who: 'you', text: 'Hello.', liveText: '', source: 'live', interrupted: false },
      ],
      debrief: {
        summaryFr: 'Bien.',
        strengthsFr: [],
        mistakes,
        vocabulary,
        nextFocusFr: '',
        model: 'seed',
        skills: { fluency: 52, grammar: 50, vocabulary: 54, listening: 60 },
      },
      why: {},
      speakingMs: 200_000,
    });
    const talks = [
      talk(
        's1',
        3,
        [m('verb_tense', 'Yesterday I go to the office', 'Yesterday I went to the office')],
        [{ english: 'to be swamped', french: 'être débordé', example: "I'm swamped this week." }],
      ),
      talk('s2', 2, [m('verb_form', 'I am agree', 'I agree'), m('pronunciation', 'tree', 'three')]),
      talk('s3', 1, [
        m('false_friend', 'I assisted to a meeting', 'I attended a meeting'),
        m('articles', 'the life is hard', 'life is hard'),
      ]),
    ];
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('english-buddy');
      req.onupgradeneeded = () => {
        for (const s of ['talks', 'facts', 'cards'])
          if (!req.result.objectStoreNames.contains(s))
            req.result.createObjectStore(s, { keyPath: 'id' });
      };
      req.onsuccess = () => {
        const tx = req.result.transaction(['talks'], 'readwrite');
        for (const t of talks) tx.objectStore('talks').put(t);
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

test('cards from past debriefs, flash reviews out loud, streak and mission map', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await expect(page.locator('#streak-line')).toContainText('Pas encore de série');
  await expect(page.locator('#reviews-line')).toContainText('deviendront des cartes');
  await seed(page);
  await page.reload();

  // Past debriefs became 5 cards (the pronunciation guess is left out).
  await expect(page.locator('#reviews-line')).toContainText('5 cartes à revoir', {
    timeout: 30_000,
  });
  await expect(page.locator('#streak-line')).toContainText('Série : 3 jours');
  await expect(page.locator('#streak-line')).toContainText('aujourd’hui : 0 min de parole sur 3');
  await expect(page.locator('#challenge-line')).toContainText('4 fautes à reprendre');

  await page.locator('#open-reviews').click();
  const dlg = page.locator('#reviews');
  await expect(dlg.locator('.review-card')).toContainText('Carte 1 sur 5');
  await expect(dlg.locator('.review-answer')).toBeHidden();
  await dlg.getByRole('button', { name: 'Voir la réponse' }).click();
  await expect(dlg.locator('.review-answer')).toBeVisible();
  await dlg.getByRole('button', { name: 'Je l’avais' }).click();
  await expect(dlg.locator('.review-card')).toContainText('Carte 2 sur 5');
  await dlg.getByRole('button', { name: 'Voir la réponse' }).click();
  await dlg.getByRole('button', { name: 'Raté' }).click();
  await expect(dlg.locator('.review-card')).toContainText('Carte 3 sur 5');
  await dlg.getByRole('button', { name: 'Retirer cette carte' }).click();
  await expect(dlg.locator('.review-card')).toContainText('Carte 4 sur 5');
  await page.locator('#reviews-close').click();
  // Good and again both move the card to a later day; the removed one is gone.
  await expect(page.locator('#reviews-line')).toContainText('2 cartes à revoir · 4 en tout');
  await page.reload();
  await expect(page.locator('#reviews-line')).toContainText('2 cartes à revoir · 4 en tout', {
    timeout: 30_000,
  });

  // The map: level 2 is open (estimated level 54 ≥ 50), level 3 is locked.
  await page.locator('#open-map').click();
  const map = page.locator('#map');
  await expect(map.locator('.card.mission')).toHaveCount(9);
  await expect(map.locator('.card.mission[data-state="locked"]')).toHaveCount(3);
  await expect(map.locator('[data-id="office-interview"]')).toBeDisabled();
  await expect(map.locator('[data-id="office-interview"]')).toContainText('Réussis 2 missions');
  await map.locator('[data-id="street-invite"]').click();
  await expect(map).toBeHidden();
  await expect(page.locator('#home-plan')).toContainText('Proposer une sortie');
  await expect(page.locator('#scene-cards [data-id="street"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('#character-cards [data-id="maya"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Sans mission' }).click();
  await expect(page.locator('#home-plan')).toContainText('Conversation libre');
  expect(errors).toEqual([]);
});

test('daily challenge: the character gets the reviews, ticks live, the debrief grades the cards', async ({
  page,
}) => {
  test.setTimeout(180_000);
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
      summary_fr: 'Beau défi.',
      strengths_fr: [],
      mistakes: [
        {
          turn: 2,
          type: 'verb_form',
          said: 'I am agree',
          correct: 'I agree',
          explanation_fr: 'Agree est un verbe.',
          recast_by_character: true,
        },
      ],
      vocabulary: [],
      next_focus_fr: '',
      skill_scores: { fluency: 60, grammar: 55, vocabulary: 58, listening: 66 },
      memory_facts: [],
      talk_memory_fr: '',
      expressions_used: [
        { expression: 'to be swamped', used: true, natural: true, quote: "I'm swamped" },
      ],
      review_results: [
        { item: 'mistake:yesterday i went to the office', result: 'correct', quote: 'I went' },
        { item: 'mistake:i agree', result: 'wrong', quote: 'I am agree' },
      ],
    });
    await route.fulfill({ json: { candidates: [{ content: { parts: [{ text }] } }] } });
  });

  await page.goto('./');
  await seed(page);
  await page.reload();
  await expect(page.locator('#reviews-line')).toContainText('5 cartes à revoir', {
    timeout: 30_000,
  });
  await expect(page.locator('#stage')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await page.locator('#start-challenge').click();

  const goals = page.locator('#goals');
  await expect(goals).toBeVisible();
  await expect(goals.locator('#goals-title')).toHaveText('Défi du jour');
  await expect(goals.locator('#goals-timer')).toHaveText('5:00');
  await expect(goals.locator('.goal-list li')).toHaveCount(4 + 3);
  await expect(goals).toContainText('Yesterday I go to the office');
  await expect(goals).not.toContainText('Yesterday I went'); // the answer is not shown
  await expect(goals.locator('.expressions li').first()).toContainText('to be swamped');

  await expect(page.locator('#start')).toBeEnabled({ timeout: 30_000 });
  await page.locator('#start').click();
  await expect.poll(() => setup !== null, { timeout: 20_000 }).toBe(true);
  const prompt = JSON.stringify(
    (setup as unknown as { systemInstruction: object }).systemInstruction,
  );
  expect(prompt).toContain('short daily challenge');
  expect(prompt).toContain('Review challenge');
  expect(prompt).toContain('They said \\"Yesterday I go to the office\\" instead of');
  expect(prompt).toContain('Expressions to place');
  expect(prompt).toContain('\\"to be swamped\\"');

  const ws = live as unknown as WebSocketRoute;
  const say = (serverContent: object) => ws.send(JSON.stringify({ serverContent }));
  say({
    modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: audio() } }] },
  });
  say({ outputTranscription: { text: 'Hey! How was your week?' } });
  say({ turnComplete: true });
  say({ inputTranscription: { text: "Busy! I'm swamped. Yesterday I went to the office." } });
  await expect(goals.locator('.expressions li').first()).toHaveAttribute('data-placed', 'true');
  await expect(goals.locator('.expressions li').nth(1)).toHaveAttribute('data-placed', 'false');
  await shot(page, 'talk-challenge-tick');
  say({
    modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: audio() } }] },
  });
  say({ outputTranscription: { text: 'Ooh, love that one. Swamped with what?' } });
  say({ turnComplete: true });
  say({ inputTranscription: { text: 'Meetings. I am agree they are too long.' } });
  say({
    modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: audio() } }] },
  });
  say({ outputTranscription: { text: 'Ha, I agree, meetings are the worst.' } });
  say({ turnComplete: true });
  await expect(page.locator('#transcript p.buddy:not([hidden])')).toHaveCount(3);
  await expect(goals.locator('#goals-timer')).not.toHaveText('5:00');
  await page.locator('#start').click();

  const dialog = page.locator('#debrief');
  await expect(dialog.locator('.plan-result')).toHaveCount(2, { timeout: 15_000 });
  await expect(dialog).toContainText('Expressions placées : 1 sur 3');
  await expect(dialog).toContainText('Tes anciennes fautes : 1 sur 4 réussies');
  await shot(page, 'debrief-challenge');
  await expect(dialog.locator('[data-result="wrong"]')).toContainText('même faute');
  // The analyzer was asked about exactly these items.
  expect(analyzerBody).toContain('review_results');
  expect(analyzerBody).toContain('mistake:yesterday i went to the office');
  expect(analyzerBody).toContain('expressions_used');
  expect(analyzerBody).toContain('item mistake:i agree');
  await page.locator('#debrief-close').click();

  // Back home: correct → good, wrong → again, expression used → good: 2 cards left today.
  await page.locator('#open-home').click();
  await expect(page.locator('#reviews-line')).toContainText('2 cartes à revoir', {
    timeout: 15_000,
  });
  await expect(page.locator('#challenge-line')).toContainText('déjà fait aujourd’hui');
  await expect(page.locator('#start-challenge')).toHaveText('Refaire le défi');
  expect(errors).toEqual([]);
});

test('mission without saying "table": live warning, failed in the debrief', async ({ page }) => {
  test.setTimeout(150_000);
  const sent: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let setup: Record<string, unknown> | null = null;
  let live: WebSocketRoute | null = null;
  await page.routeWebSocket(/BidiGenerateContent/, (ws) => {
    live = ws;
    ws.onMessage((raw) => {
      sent.push(String(raw));
      const msg = JSON.parse(String(raw));
      if (msg.setup) {
        setup = msg.setup;
        ws.send(JSON.stringify({ setupComplete: {} }));
      }
    });
  });
  await page.route('**/v1beta/models/*:generateContent', async (route) => {
    const text = JSON.stringify({
      summary_fr: 'Bien essayé.',
      strengths_fr: [],
      mistakes: [],
      vocabulary: [],
      next_focus_fr: '',
      skill_scores: { fluency: 60, grammar: 60, vocabulary: 60, listening: 60 },
      memory_facts: [],
      talk_memory_fr: '',
      mission: { passed: true, score: 88, feedback_fr: 'Tu as obtenu la terrasse.' },
      expressions_used: [],
    });
    await route.fulfill({ json: { candidates: [{ content: { parts: [{ text }] } }] } });
  });

  await page.goto('./');
  await seed(page);
  await page.reload();
  await expect(page.locator('#stage')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await page.locator('#open-map').click();
  await page.locator('#map [data-id="cafe-terrace"]').click();
  await expect(page.locator('#home-plan')).toContainText('sans dire « table »');
  await expect(page.locator('#enter')).toBeEnabled({ timeout: 30_000 });
  await page.locator('#enter').click();
  const goals = page.locator('#goals');
  await expect(goals.locator('#goals-title')).toHaveText('Ta mission');
  await expect(goals).toContainText('Mot interdit : « table »');
  await expect(goals.locator('#goals-timer')).toBeHidden();
  await expect(page.locator('#start')).toBeEnabled({ timeout: 30_000 });
  await page.locator('#start').click();
  await expect.poll(() => setup !== null, { timeout: 20_000 }).toBe(true);
  const prompt = JSON.stringify(setup);
  expect(prompt).toContain('host of the café');
  expect(prompt).toContain('never mention the rule');
  expect(prompt).toContain('Scene: You are working as the host of the café today.');
  expect(prompt).not.toContain('sitting at a table');
  // The mission's first line is the greeting sent to the character.
  await expect
    .poll(() => sent.some((m) => m.includes('Welcome the learner at the door')), {
      timeout: 10_000,
    })
    .toBe(true);

  const ws = live as unknown as WebSocketRoute;
  const say = (serverContent: object) => ws.send(JSON.stringify({ serverContent }));
  say({
    modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: audio() } }] },
  });
  say({ outputTranscription: { text: 'Hi there, how can I help?' } });
  say({ turnComplete: true });
  say({ inputTranscription: { text: 'Hi, can we have a table outside for three?' } });
  await expect(goals.locator('[role="alert"]')).toContainText('tu as dit « table »');
  await shot(page, 'talk-mission-alert');
  say({
    modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: audio() } }] },
  });
  say({ outputTranscription: { text: 'Sure, follow me to the terrace.' } });
  say({ turnComplete: true });
  await page.locator('#start').click();

  const dialog = page.locator('#debrief');
  await expect(dialog.locator('.mission-result')).toContainText(
    'Mission pas encore réussie · 40/100',
    { timeout: 15_000 },
  );
  await expect(dialog.locator('.mission-result')).toContainText('Mot interdit entendu : « table »');
  // "for three" was ticked during the talk: the debrief agrees even if the model missed it.
  await expect(dialog).toContainText('Expressions placées : 1 sur 3');
  await shot(page, 'debrief-mission');
  await page.locator('#debrief-close').click();
  // Still chosen for another try; the map counts the try.
  await page.locator('#open-home').click();
  await expect(page.locator('#home-plan')).toContainText('sans dire « table »');
  await page.locator('#open-map').click();
  await expect(page.locator('#map [data-id="cafe-terrace"]')).toContainText(
    'Pas encore réussie · meilleur score 40/100 · 1 essai',
  );
  expect(errors).toEqual([]);
});
