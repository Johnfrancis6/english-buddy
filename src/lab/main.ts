import '../style.css';
import { loadSettings, saveSettings, type TranscriptSource } from '../settings';
import { MIC_RATE, PcmPlayer } from '../voice/audio';
import { GeminiLiveSession } from '../voice/geminiLive';
import { LatencyTracker } from '../voice/latency';
import { asProviderError } from '../net/providerError';
import { makeTranscriber } from '../transcribe/factory';
import { concatBytes, pcm16ToWav } from '../transcribe/wav';
import { el } from '../ui/dom';
import { LAB_SENTENCES } from './sentences';
import {
  mistakeFates,
  recommend,
  tally,
  wordErrorRate,
  type LabResult,
  type MistakeFate,
} from './score';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Sources compared, in display order. */
const SOURCES: { id: TranscriptSource; label: string; needs: 'gemini' | 'groq' }[] = [
  { id: 'live', label: 'Gemini Live (actuel)', needs: 'gemini' },
  { id: 'groq', label: 'Groq Whisper', needs: 'groq' },
  { id: 'groq-prompt', label: 'Groq Whisper + consigne', needs: 'groq' },
  { id: 'gemini-audio', label: 'Gemini Flash mot à mot', needs: 'gemini' },
];
const LABEL = Object.fromEntries(SOURCES.map((s) => [s.id, s.label]));

const LAB_PROMPT = `You are helping to test a speech recogniser. The user reads English sentences aloud; some contain deliberate mistakes. After each sentence, say only the single word "Okay". Never correct, repeat or comment on anything.`;

/** Wait for the Live transcript after the learner clicks "J'ai fini". */
const LIVE_WAIT_MS = 6000;

const geminiInput = $<HTMLInputElement>('lab-gemini');
const groqInput = $<HTMLInputElement>('lab-groq');
const stateEl = $('lab-state');
const recordBtn = $<HTMLButtonElement>('lab-record');
const resultsEl = $('lab-results');

let settings = loadSettings();
geminiInput.value = settings.apiKey;
groqInput.value = settings.groqKey;

const results = new Map<number, LabResult>();
let index = 0;
let recording: Uint8Array[] | null = null;
/** Live input text since the recording started; null when not collecting. */
let liveText: string[] | null = null;
let liveTurnDone: (() => void) | null = null;
let lastLiveChunkAt = 0;
let busy = false;

const player = new PcmPlayer();
const voice = new GeminiLiveSession(player, new LatencyTracker(), {
  onState: (s) => {
    const labels: Record<string, string> = {
      idle: 'Déconnecté.',
      connecting: 'Connexion à Google…',
      listening: 'Connecté : tu peux enregistrer.',
      speaking: 'Connecté.',
      reconnecting: 'Reconnexion…',
      error: 'Erreur : voir le message.',
    };
    stateEl.textContent = labels[s] ?? s;
    const live = s !== 'idle' && s !== 'error';
    $('lab-connect').textContent = live ? 'Déconnecter' : 'Commencer';
    $('lab-card').hidden = !live && results.size === 0;
    recordBtn.disabled = !live || busy;
  },
  onError: (e) => (stateEl.textContent = `${e.message} ${e.detail ? `(${e.detail})` : ''}`),
  onModelTurnStart: () => {},
  onMicLevel: (rms) => ($('lab-mic').style.width = `${Math.min(100, Math.round(rms * 500))}%`),
  onMicAudio: (pcm) => recording?.push(pcm),
  onTranscript: (who, text) => {
    if (who === 'you' && liveText) {
      liveText.push(text);
      lastLiveChunkAt = performance.now();
    }
  },
  onTurnComplete: () => liveTurnDone?.(),
  onInfo: () => {},
});

$('lab-connect').addEventListener('click', () => {
  if (voice.state !== 'idle' && voice.state !== 'error') {
    void voice.stop();
    return;
  }
  settings = {
    ...loadSettings(),
    apiKey: geminiInput.value.trim(),
    groqKey: groqInput.value.trim(),
  };
  saveSettings(settings);
  if (!settings.apiKey) {
    stateEl.textContent = 'Il faut ta clé Gemini pour commencer.';
    return;
  }
  voice.configure({
    ...settings,
    voice: settings.voiceOverride || 'Puck',
    systemPrompt: LAB_PROMPT,
    greeting: null,
  });
  showSentence();
  void voice.start();
});

function showSentence(): void {
  const s = LAB_SENTENCES[index];
  $('lab-card').hidden = false;
  $('lab-progress').textContent =
    `Phrase ${index + 1} / ${LAB_SENTENCES.length} — lis-la exactement, fautes comprises :`;
  $('lab-sentence').textContent = s.say;
  $('lab-hints').textContent = `Fautes volontaires : ${s.mistakes.map((m) => m.label).join(' ; ')}`;
  ($('lab-prev') as HTMLButtonElement).disabled = index === 0;
  ($('lab-next') as HTMLButtonElement).disabled = index === LAB_SENTENCES.length - 1;
  renderResult(results.get(index) ?? null);
}

$('lab-prev').addEventListener('click', () => {
  if (busy || index === 0) return;
  index--;
  showSentence();
});
$('lab-next').addEventListener('click', () => {
  if (busy || index >= LAB_SENTENCES.length - 1) return;
  index++;
  showSentence();
});

recordBtn.addEventListener('click', () => {
  if (recording === null) {
    recording = [];
    liveText = [];
    recordBtn.textContent = '■ J’ai fini';
    recordBtn.classList.add('live');
    resultsEl.replaceChildren(el('p', { class: 'muted', text: 'Je t’écoute… lis la phrase.' }));
    return;
  }
  void finishRecording();
});

async function finishRecording(): Promise<void> {
  const chunks = recording ?? [];
  recording = null;
  recordBtn.textContent = '🎙 Enregistrer';
  recordBtn.classList.remove('live');
  busy = true;
  recordBtn.disabled = true;
  const sentenceIndex = index;
  const sentence = LAB_SENTENCES[sentenceIndex];
  resultsEl.replaceChildren(el('p', { class: 'muted', text: 'Transcription par chaque source…' }));

  const pcm = concatBytes(chunks);
  const wav = pcm16ToWav(pcm, MIC_RATE);
  const heard: Record<string, string | null> = {};
  const errors: Record<string, string> = {};

  const live = new Promise<void>((resolve) => {
    const started = performance.now();
    // Done when Gemini ends its turn, or when text came in and then nothing
    // for 1.5 s (the turn may have ended while we were still recording).
    const poll = setInterval(() => {
      const now = performance.now();
      const quiet = (liveText?.length ?? 0) > 0 && now - lastLiveChunkAt > 1500;
      if (quiet || now - started > LIVE_WAIT_MS) finish();
    }, 100);
    const finish = () => {
      clearInterval(poll);
      liveTurnDone = null;
      resolve();
    };
    liveTurnDone = () => setTimeout(finish, 300); // a last chunk can trail the turn end
  }).then(() => {
    heard.live = (liveText ?? []).join('').replace(/\s+/g, ' ').trim() || null;
    if (heard.live === null) errors.live = 'rien reçu de Gemini Live';
    liveText = null;
  });

  const others = SOURCES.filter((s) => s.id !== 'live').map(async (s) => {
    if (s.needs === 'groq' && !settings.groqKey) {
      heard[s.id] = null;
      errors[s.id] = 'pas de clé Groq';
      return;
    }
    try {
      heard[s.id] = await makeTranscriber(s.id, settings)!.transcribe(wav);
    } catch (err) {
      const e = asProviderError(err, s.needs);
      heard[s.id] = null;
      errors[s.id] = `${e.french} (${e.detail})`;
    }
  });
  await Promise.all([live, ...others]);

  const result: LabResult = { sentence, heard };
  results.set(sentenceIndex, result);
  busy = false;
  recordBtn.disabled = voice.state === 'idle' || voice.state === 'error';
  if (index === sentenceIndex) renderResult(result, errors);
  renderTally();
}

const FATE: Record<MistakeFate, { mark: string; text: string }> = {
  kept: { mark: '✓', text: 'gardée' },
  fixed: { mark: '✗', text: 'corrigée en silence' },
  lost: { mark: '?', text: 'mal entendue' },
};

function renderResult(r: LabResult | null, errors: Record<string, string> = {}): void {
  resultsEl.replaceChildren();
  if (!r) return;
  for (const s of SOURCES) {
    const text = r.heard[s.id];
    const row = el('div', { class: 'lab-row', 'data-source': s.id });
    row.append(el('strong', { text: s.label }));
    if (text === null || text === undefined) {
      row.append(
        el('span', { class: 'muted', text: ` — non testé (${errors[s.id] ?? 'pas de résultat'})` }),
      );
    } else {
      row.append(el('q', { text }));
      const fates = mistakeFates(r.sentence, text);
      row.append(
        el(
          'span',
          { class: 'fates' },
          ...fates.map((f, i) =>
            el('span', {
              class: `fate ${f}`,
              text: `${FATE[f].mark} ${r.sentence.mistakes[i].label} : ${FATE[f].text}`,
            }),
          ),
        ),
      );
    }
    resultsEl.append(row);
  }
}

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)} %` : '—');

function renderTally(): void {
  const all = [...results.values()];
  const tallies = tally(
    all,
    SOURCES.map((s) => s.id),
  );
  const body = $('lab-table').querySelector('tbody')!;
  body.replaceChildren(
    ...tallies.map((t) =>
      el(
        'tr',
        { 'data-source': t.source },
        el('td', { text: LABEL[t.source] }),
        el('td', { text: String(t.sentences) }),
        el('td', { text: `${t.kept}/${t.mistakes} (${pct(t.kept, t.mistakes)})` }),
        el('td', { text: String(t.fixed) }),
        el('td', { text: String(t.lost) }),
        el('td', { text: t.sentences ? `${Math.round(t.wer * 100)} %` : '—' }),
      ),
    ),
  );
  const best = recommend(tallies);
  const useBtn = $<HTMLButtonElement>('lab-use');
  if (!best) {
    $('lab-reco').textContent = 'Recommandation : fais au moins 8 phrases pour comparer.';
    useBtn.hidden = true;
    return;
  }
  $('lab-reco').textContent =
    `Recommandation (mesurée sur ${best.sentences} phrases) : ${LABEL[best.source]} — ${pct(best.kept, best.mistakes)} des fautes gardées, ${Math.round(best.wer * 100)} % de mots faux.`;
  useBtn.hidden = false;
  useBtn.dataset.source = best.source;
}

$('lab-use').addEventListener('click', () => {
  const source = $('lab-use').dataset.source as TranscriptSource | undefined;
  if (!source) return;
  saveSettings({ ...loadSettings(), transcriptSource: source });
  $('lab-reco').textContent += ' ✓ Choisie pour tes conversations.';
});

$('lab-copy').addEventListener('click', () => {
  const tallies = tally(
    [...results.values()],
    SOURCES.map((s) => s.id),
  );
  const lines = [
    'English Buddy — labo transcription',
    `Date : ${new Date().toLocaleString('fr-FR')}`,
    `Modèles : ${settings.model} (Live), ${settings.analysisModel} (Flash), Groq whisper-large-v3`,
    `Navigateur : ${navigator.userAgent}`,
    '',
    'Source | phrases | gardées | corrigées | mal entendues | mots faux',
    ...tallies.map(
      (t) =>
        `${LABEL[t.source]} | ${t.sentences} | ${t.kept}/${t.mistakes} | ${t.fixed} | ${t.lost} | ${Math.round(t.wer * 100)} %`,
    ),
    '',
    ...[...results.entries()]
      .sort((a, b) => a[0] - b[0])
      .flatMap(([i, r]) => [
        `${i + 1}. Lu : ${r.sentence.say}`,
        ...SOURCES.map((s) => {
          const h = r.heard[s.id];
          if (h === null || h === undefined) return `   ${s.label} : —`;
          const fates = mistakeFates(r.sentence, h)
            .map((f) => FATE[f].mark)
            .join('');
          return `   ${s.label} [${fates}] (${Math.round(wordErrorRate(r.sentence.say, h) * 100)} %) : ${h}`;
        }),
      ]),
  ];
  void navigator.clipboard.writeText(lines.join('\n')).then(
    () => ($('lab-copy').textContent = 'Copié ✓'),
    () => ($('lab-copy').textContent = 'Copie impossible'),
  );
});

renderTally();
