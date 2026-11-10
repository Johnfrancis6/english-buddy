import { afterEach, describe, expect, it, vi } from 'vitest';
import { Transcript } from '../src/talk/transcript';
import { ClipRecorder } from '../src/transcribe/clip';
import { concatBytes, pcm16ToWav } from '../src/transcribe/wav';
import { LAB_SENTENCES } from '../src/lab/sentences';
import {
  MIN_MISTAKES,
  mistakeFates,
  normalise,
  recommend,
  tally,
  wordErrorRate,
} from '../src/lab/score';
import { DEBRIEF_SCHEMA, groupByType, parseDebrief, stripFences } from '../src/analysis/schema';
import { formatTranscript, debriefSystemPrompt, explainUserPrompt } from '../src/analysis/prompts';
import { GeminiAnalyzer } from '../src/analysis/geminiAnalyzer';
import { buildSystemPrompt, JAKE } from '../src/teaching/persona';
import { DEFAULTS, effectiveSource, loadSettings, saveSettings } from '../src/settings';
import { generateText, withModelFallback } from '../src/net/gemini';
import { kindFromHttp, ProviderError } from '../src/net/providerError';
import { GroqWhisper, GROQ_URL } from '../src/transcribe/groq';

const memStore = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
};

describe('transcript', () => {
  it('assembles streamed chunks into turns and closes them', () => {
    const t = new Transcript('live', () => 0);
    t.addLive('jake', 'Hey! ');
    t.addLive('jake', 'How are you?');
    t.completeModelTurn(false);
    t.addLive('you', 'I am ');
    t.addLive('you', 'fine.');
    expect(t.cutLearner(true)?.text).toBe('I am fine.');
    t.addLive('jake', 'Cool.');
    t.addLive('you', ' Thanks'); // late chunk joins the cut learner turn
    t.completeModelTurn(false);
    t.addLive('you', 'Next');
    const f = t.finished();
    expect(f.map((x) => [x.who, x.text])).toEqual([
      ['jake', 'Hey! How are you?'],
      ['you', 'I am fine. Thanks'],
      ['jake', 'Cool.'],
      ['you', 'Next'],
    ]);
  });

  it('creates a learner turn at the cut when Live text lags, and fills it later', () => {
    const t = new Transcript('live', () => 0);
    const turn = t.cutLearner(true)!;
    expect(turn.state).toBe('cut');
    expect(t.cutLearner(false)).toBeNull();
    t.addLive('jake', 'Oh nice.');
    t.addLive('you', 'Yesterday I go');
    expect(t.turns.find((x) => x.id === turn.id)?.text).toBe('Yesterday I go');
  });

  it('replaces learner text with the second recogniser and falls back on failure', () => {
    const t = new Transcript('groq', () => 0);
    t.addLive('you', 'Yesterday I went');
    t.addLive('you', ' to the cinema');
    const a = t.cutLearner(true)!;
    expect(a.pending).toBe(true);
    expect(t.pendingCount).toBe(1);
    t.setLearnerText(a.id, 'Yesterday I go to the cinema');
    t.addLive('you', ' late'); // late Live chunk must not overwrite the Groq text
    expect(a.text).toBe('Yesterday I go to the cinema');
    expect(a.liveText).toBe('Yesterday I went to the cinema late');
    t.completeModelTurn(false);
    t.addLive('you', "She don't");
    const b = t.cutLearner(true)!;
    t.setLearnerText(b.id, null);
    expect(b.text).toBe("She don't");
    expect(b.source).toBe('live');
    expect(t.pendingCount).toBe(0);
  });

  it('marks an interrupted Jake turn and keeps the learner turn open', () => {
    const t = new Transcript('live', () => 0);
    t.addLive('jake', 'So I was thinking');
    t.addLive('you', 'Wait');
    t.completeModelTurn(true);
    expect(t.turns[0].interrupted).toBe(true);
    expect(t.turns[1].state).toBe('open');
    t.addLive('you', ' a second');
    expect(t.turns[1].text).toBe('Wait a second');
  });
});

describe('clip recorder', () => {
  const chunk = (v: number) => new Uint8Array(4).fill(v);
  it('keeps a pre-roll, trims trailing silence and drops noise', () => {
    const r = new ClipRecorder({ chunkMs: 100, preRollMs: 200, minVoicedMs: 200 });
    for (let i = 0; i < 5; i++) r.push(chunk(0), false);
    r.push(chunk(1), true);
    r.push(chunk(2), true);
    for (let i = 0; i < 6; i++) r.push(chunk(9), false);
    const pcm = r.cut()!;
    // 2 pre-roll + 2 voiced + 2 trailing chunks of 4 bytes
    expect(pcm.length).toBe(24);
    expect([...pcm.slice(8, 16)]).toEqual([1, 1, 1, 1, 2, 2, 2, 2]);
    r.push(chunk(1), true); // one 100 ms blip: not speech
    expect(r.cut()).toBeNull();
    expect(r.recording).toBe(false);
  });
  it('caps the clip length', () => {
    const r = new ClipRecorder({ chunkMs: 100, maxMs: 1000 });
    for (let i = 0; i < 50; i++) r.push(chunk(1), true);
    expect(r.cut()!.length).toBe(40);
  });
});

describe('wav', () => {
  it('writes a valid 16 kHz mono header', () => {
    const wav = pcm16ToWav(new Uint8Array([1, 2, 3, 4]), 16000);
    const v = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...wav.slice(8, 12))).toBe('WAVE');
    expect(v.getUint32(24, true)).toBe(16000);
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint32(40, true)).toBe(4);
    expect(wav.length).toBe(48);
    expect(concatBytes([new Uint8Array([1]), new Uint8Array([2, 3])])).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });
});

describe('transcription lab scoring', () => {
  it('normalises apostrophes and punctuation', () => {
    expect(normalise('She don’t, like  COFFEE!')).toBe("she don't like coffee");
  });
  it('every planted mistake is found in its own sentence and the fix is not', () => {
    for (const s of LAB_SENTENCES) {
      expect(mistakeFates(s, s.say).every((f) => f === 'kept')).toBe(true);
    }
  });
  it('detects silent corrections and misheard words', () => {
    const s = LAB_SENTENCES[0];
    expect(mistakeFates(s, 'Yesterday I went to the cinema with my friends')).toEqual(['fixed']);
    expect(mistakeFates(s, 'Yesterday I owe to the cinema')).toEqual(['lost']);
    const two = LAB_SENTENCES.find((x) => x.mistakes.length === 2)!;
    expect(mistakeFates(two, 'He has been working here since three years.')).toEqual([
      'fixed',
      'kept',
    ]);
  });
  it('computes word error rate', () => {
    expect(wordErrorRate('a b c d', 'a b c d')).toBe(0);
    expect(wordErrorRate('a b c d', 'a x c')).toBe(0.5);
  });
  it('recommends the source that keeps the most mistakes, then the cleanest', () => {
    const results = LAB_SENTENCES.map((sentence) => ({
      sentence,
      heard: {
        live: sentence.say.replace(/\bgo\b/, 'went').replace("don't", "doesn't"),
        groq: sentence.say,
        noisy: `${sentence.say} um yeah`,
        none: null,
      },
    }));
    const t = tally(results, ['live', 'groq', 'noisy', 'none']);
    expect(t[1].kept).toBe(t[1].mistakes);
    expect(t[0].fixed).toBeGreaterThan(0);
    expect(t[3].sentences).toBe(0);
    expect(recommend(t)?.source).toBe('groq');
    expect(recommend(tally(results.slice(0, 2), ['groq']))).toBeNull();
    expect(MIN_MISTAKES).toBeGreaterThan(0);
  });
});

describe('debrief parsing', () => {
  const ids = new Set([2, 4]);
  it('normalises a good answer and drops bad items', () => {
    const raw = JSON.stringify({
      summary_fr: ' Bien joué. ',
      strengths_fr: ['a', '', 'b', 'c', 'd'],
      mistakes: [
        {
          turn: 2,
          type: 'verb_tense',
          said: 'I go',
          correct: 'I went',
          explanation_fr: 'Passé.',
          recast_by_jake: true,
        },
        {
          turn: 2,
          type: 'verb_tense',
          said: 'I go',
          correct: 'I went',
          explanation_fr: 'doublon',
          recast_by_jake: false,
        },
        {
          turn: 9,
          type: 'nonsense',
          said: 'informations',
          correct: 'information',
          explanation_fr: 'x',
        },
        {
          turn: 4,
          type: 'articles',
          said: 'same',
          correct: 'Same',
          explanation_fr: 'pas une faute',
        },
        { turn: 4, said: '', correct: 'x' },
      ],
      vocabulary: [
        { english: 'gonna', french: 'aller (familier)', example: "I'm gonna go." },
        { english: 'x' },
      ],
      next_focus_fr: 'Le passé.',
    });
    const d = parseDebrief(raw, ids, 'm');
    expect(d.summaryFr).toBe('Bien joué.');
    expect(d.strengthsFr).toEqual(['a', 'b', 'c']);
    expect(d.mistakes).toHaveLength(2);
    expect(d.mistakes[0]).toMatchObject({ turn: 2, recastByJake: true, explanationFr: 'Passé.' });
    expect(d.mistakes[1]).toMatchObject({ turn: -1, type: 'other' });
    expect(d.vocabulary).toHaveLength(1);
    expect(d.model).toBe('m');
  });
  it('accepts fenced JSON and rejects garbage', () => {
    expect(stripFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(parseDebrief('```json\n{"mistakes":[]}\n```', ids, 'm').mistakes).toEqual([]);
    expect(() => parseDebrief('not json', ids, 'm')).toThrow();
  });
  it('groups mistakes by type, most frequent first', () => {
    const m = (type: 'articles' | 'verb_tense') => ({
      turn: 1,
      type,
      said: 'a',
      correct: 'b',
      explanationFr: '',
      recastByJake: false,
    });
    expect(groupByType([m('articles'), m('verb_tense'), m('verb_tense')]).map((g) => g[0])).toEqual(
      ['verb_tense', 'articles'],
    );
  });
  it('uses only JSON Schema keywords the Gemini docs list as supported', () => {
    const allowed = new Set([
      'type',
      'properties',
      'required',
      'items',
      'enum',
      'description',
      'maxItems',
      'minItems',
      'minimum',
      'maximum',
      'format',
      'title',
      'additionalProperties',
    ]);
    const walk = (node: unknown, inProps = false): void => {
      if (!node || typeof node !== 'object' || Array.isArray(node)) return;
      for (const [k, v] of Object.entries(node)) {
        if (!inProps) expect(allowed.has(k), k).toBe(true);
        walk(v, k === 'properties' && !inProps);
      }
    };
    walk(DEBRIEF_SCHEMA);
  });
});

describe('prompts', () => {
  it('formats the transcript with learner turn ids', () => {
    expect(
      formatTranscript([
        { id: 1, who: 'jake', text: 'Hi!', interrupted: true },
        { id: 2, who: 'you', text: 'I go home' },
      ]),
    ).toBe('Jake: Hi! (interrupted)\n[#2] Learner: I go home');
    expect(
      debriefSystemPrompt({ level: 'B1', characterName: 'Jake', transcriptSource: 'Groq' }),
    ).toContain('Groq');
    expect(
      explainUserPrompt(
        {
          turn: 2,
          type: 'verb_tense',
          said: 'I go',
          correct: 'I went',
          explanationFr: 'x',
          recastByJake: false,
        },
        [{ id: 2, who: 'you', text: 'Yesterday I go home' }],
      ),
    ).toContain('Yesterday I go home');
  });
  it('builds Jake’s prompt with persona, scene, level and both policies', () => {
    const p = buildSystemPrompt();
    expect(p).toContain('You are Jake');
    expect(p).toContain('Scene:');
    expect(p).toContain('B1');
    expect(p).toMatch(/Recast/);
    expect(p).toMatch(/never explain grammar/i);
    expect(p).toMatch(/one open question/);
    expect(JAKE.greeting).toBeTruthy();
  });
});

describe('settings (phase 1)', () => {
  it('keeps the Groq key and falls back to Live without it', () => {
    const store = memStore();
    saveSettings({ ...DEFAULTS, groqKey: ' gsk_abc ', transcriptSource: 'groq' }, store);
    const s = loadSettings(store);
    expect(s.groqKey).toBe('gsk_abc');
    expect(effectiveSource(s)).toBe('groq');
    expect(effectiveSource({ ...s, groqKey: '' })).toBe('live');
    expect(effectiveSource({ transcriptSource: 'groq-prompt', groqKey: '' })).toBe('live');
    expect(effectiveSource({ transcriptSource: 'gemini-audio', groqKey: '' })).toBe('gemini-audio');
    store.setItem(
      'english-buddy.settings.v1',
      JSON.stringify({ transcriptSource: 'bogus', analysisModel: 'x' }),
    );
    expect(loadSettings(store)).toMatchObject({
      transcriptSource: 'live',
      analysisModel: DEFAULTS.analysisModel,
    });
  });
});

describe('providers (fetch mocked)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const reply = (status: number, body: unknown) =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

  it('classifies HTTP errors', () => {
    expect(kindFromHttp(400, 'API key not valid. Please pass a valid API key.')).toBe('bad-key');
    expect(kindFromHttp(401, '{"error":{"code":"invalid_api_key"}}')).toBe('bad-key');
    expect(kindFromHttp(429, '')).toBe('quota');
    expect(kindFromHttp(404, 'models/x is not found for API version v1beta')).toBe('model');
    expect(kindFromHttp(500, 'boom')).toBe('unknown');
  });

  it('sends a v1beta generateContent request with the key in a header and the JSON schema', async () => {
    const fetchMock = vi.fn(async () =>
      reply(200, {
        candidates: [
          { content: { parts: [{ text: 'thinking', thought: true }, { text: '{"ok":1}' }] } },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const text = await generateText({
      apiKey: ' K ',
      model: 'gemini-3.8-flash',
      system: 'S',
      parts: [{ text: 'T' }],
      jsonSchema: { type: 'object' },
    });
    expect(text).toBe('{"ok":1}');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
    );
    expect(url).not.toContain('key=');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('K');
    const body = JSON.parse(init.body as string);
    expect(body.systemInstruction.parts[0].text).toBe('S');
    expect(body.generationConfig).toMatchObject({
      responseMimeType: 'application/json',
      responseJsonSchema: { type: 'object' },
    });
  });

  it('falls back to the next model only when the model is unavailable', async () => {
    const seen: string[] = [];
    const r = await withModelFallback(['a', 'b'], async (m) => {
      seen.push(m);
      if (m === 'a') throw new ProviderError('gemini', 'model', '404');
      return 42;
    });
    expect(r).toEqual({ value: 42, model: 'b' });
    await expect(
      withModelFallback(['a', 'b'], async () => {
        throw new ProviderError('gemini', 'quota', '429');
      }),
    ).rejects.toMatchObject({ kind: 'quota' });
  });

  it('analyzes a transcript into a debrief through the Analyzer interface', async () => {
    const answer = {
      summary_fr: 'OK',
      strengths_fr: [],
      mistakes: [
        {
          turn: 2,
          type: 'verb_tense',
          said: 'I go',
          correct: 'I went',
          explanation_fr: 'Passé',
          recast_by_jake: true,
        },
      ],
      vocabulary: [],
      next_focus_fr: 'x',
    };
    const fetchMock = vi.fn(async (url: string) =>
      url.includes('gemini-3.8-flash')
        ? reply(404, {
            error: { message: 'models/gemini-3.8-flash is not found for API version v1beta' },
          })
        : reply(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const a = new GeminiAnalyzer('K', 'gemini-3.8-flash', ['gemini-3.8-flash', 'gemini-3.6-flash']);
    const d = await a.analyze(
      [
        { id: 1, who: 'jake', text: 'Hi' },
        { id: 2, who: 'you', text: 'Yesterday I go home' },
      ],
      { level: 'B1', characterName: 'Jake', transcriptSource: 'Gemini Live' },
    );
    expect(d.model).toBe('gemini-3.6-flash');
    expect(d.mistakes[0]).toMatchObject({ turn: 2, said: 'I go' });
    const body = JSON.parse(
      (fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(body.contents[0].parts[0].text).toContain('[#2] Learner: Yesterday I go home');
  });

  it('calls Groq Whisper with a multipart form and reads the text', async () => {
    const fetchMock = vi.fn(async () => reply(200, { text: ' I go home. ' }));
    vi.stubGlobal('fetch', fetchMock);
    const text = await new GroqWhisper({ apiKey: 'gsk_x', prompt: 'P' }).transcribe(
      pcm16ToWav(new Uint8Array(8), 16000),
    );
    expect(text).toBe('I go home.');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(GROQ_URL);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer gsk_x');
    const form = init.body as FormData;
    expect(form.get('model')).toBe('whisper-large-v3');
    expect(form.get('language')).toBe('en');
    expect(form.get('prompt')).toBe('P');
    expect((form.get('file') as File).type).toBe('audio/wav');
  });

  it('turns a refused Groq key into a French message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        reply(401, { error: { message: 'Invalid API Key', code: 'invalid_api_key' } }),
      ),
    );
    const err = await new GroqWhisper({ apiKey: 'bad' })
      .transcribe(new Uint8Array(44))
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).kind).toBe('bad-key');
    expect((err as ProviderError).french).toContain('clé Groq');
  });
});
