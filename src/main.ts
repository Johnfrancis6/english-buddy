import './style.css';
import { Stage } from './scene/stage';
import { bandEnergies, computeVisemes, SILENT, smoothVisemes } from './lipsync/visemes';
import {
  ANALYSIS_MODELS,
  DEFAULTS,
  effectiveSource,
  loadSettings,
  maskKey,
  MODELS,
  PAUSES,
  saveSettings,
  TRANSCRIPT_SOURCES,
  VOICES,
  type Settings,
  type TranscriptSource,
} from './settings';
import { MIC_CHUNK_MS, MIC_RATE, PcmPlayer } from './voice/audio';
import { friendly, type FriendlyError } from './voice/errors';
import { GeminiLiveSession } from './voice/geminiLive';
import { LatencyTracker } from './voice/latency';
import type { VoiceState } from './voice/types';
import { buildSystemPrompt, DEFAULT_LEARNER, JAKE } from './teaching/persona';
import { Transcript, type Turn } from './talk/transcript';
import { ClipRecorder } from './transcribe/clip';
import { makeTranscriber } from './transcribe/factory';
import type { Transcriber } from './transcribe/types';
import { pcm16ToWav } from './transcribe/wav';
import { GeminiAnalyzer } from './analysis/geminiAnalyzer';
import type { AnalysisTurn } from './analysis/types';
import { asProviderError } from './net/providerError';
import { clearTalks, listTalks, saveTalk, type SavedTalk } from './storage/talks';
import { TranscriptView } from './ui/transcriptView';
import { debriefText, renderDebrief } from './ui/debriefView';
import { el } from './ui/dom';

const CHARACTER_URL = `${import.meta.env.BASE_URL}models/HairSample_Male.vrm`;
const TARGET_MS = 1500;
/** Longest wait for the second recogniser before the debrief starts anyway. */
const PENDING_WAIT_MS = 15_000;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('stage');
const startBtn = $<HTMLButtonElement>('start');
const lipBtn = $<HTMLButtonElement>('lip-test');
const debriefBtn = $<HTMLButtonElement>('open-debrief');
const dState = $('d-state');
const dMedian = $('d-median');
const dCount = $('d-count');
const dLast = $('d-last');
const dDuration = $('d-duration');
const dMic = $('d-mic');
const dModel = $('d-model');
const dLog = $('d-log');
const transcriptPanel = $('transcript-panel');
const transcriptBody = $('transcript');
const errorBox = $('error');
const settingsDialog = $<HTMLDialogElement>('settings');
const keyInput = $<HTMLInputElement>('api-key');
const groqInput = $<HTMLInputElement>('groq-key');
const modelSelect = $<HTMLSelectElement>('model');
const voiceSelect = $<HTMLSelectElement>('voice');
const pauseSelect = $<HTMLSelectElement>('pause');
const sourceSelect = $<HTMLSelectElement>('source');
const analysisSelect = $<HTMLSelectElement>('analysis-model');
const showTranscriptBox = $<HTMLInputElement>('show-transcript');
const keyStatus = $('key-status');
const debriefDialog = $<HTMLDialogElement>('debrief');
const debriefStatus = $('debrief-status');
const debriefBody = $('debrief-body');

const STATE_LABELS: Record<VoiceState, string> = {
  idle: 'Prêt — clique sur « Démarrer »',
  connecting: 'Connexion à Jake…',
  listening: 'Jake t’écoute',
  speaking: 'Jake parle',
  reconnecting: 'Reconnexion…',
  error: 'Arrêté sur une erreur',
};
const SOURCE_LABEL = Object.fromEntries(TRANSCRIPT_SOURCES.map((s) => [s.id, s.label])) as Record<
  TranscriptSource,
  string
>;

let settings = loadSettings();
let characterReady = false;
let sessionStartedAt: number | null = null;
const logLines: string[] = [];
let overlapsSeen = 0;
/** What the running (or last) conversation was started with. */
let sessionLabel = '—';

// ---------------------------------------------------------------- 3D stage
const stage = new Stage(canvas);
stage
  .loadCharacter(CHARACTER_URL, (r) => {
    dState.textContent = `Chargement de Jake… ${Math.round(r * 100)} %`;
  })
  .then(() => {
    characterReady = true;
    canvas.dataset.ready = 'true';
    startBtn.disabled = false;
    lipBtn.disabled = false;
    renderState(voice.state);
    if (!settings.apiKey) openSettings();
  })
  .catch((err: unknown) => {
    canvas.dataset.ready = 'error';
    dState.textContent = 'Jake n’a pas pu être chargé';
    log(`Chargement du personnage impossible : ${String(err)}`);
  });

// ------------------------------------------------------------- the talk
/** Everything about the conversation in progress (text only). */
interface Talk {
  id: string;
  startedAt: number;
  transcript: Transcript;
  source: TranscriptSource;
  /** Second recogniser, or null when the Live transcript is used. */
  transcriber: Transcriber | null;
  /** The learner's current turn, in memory only, to know whether they spoke. */
  clip: ClipRecorder;
  transcribeErrors: number;
  ended: boolean;
}
let talk: Talk | null = null;
const transcriptView = new TranscriptView(transcriptBody);

const player = new PcmPlayer();
const latency = new LatencyTracker();
const voice = new GeminiLiveSession(player, latency, {
  onState: renderState,
  onError: showError,
  onModelTurnStart: (ms) => {
    if (ms !== null) log(`Délai de ce tour : ${formatMs(ms)}`);
    else if (latency.overlaps > overlapsSeen) {
      log(`Jake a pris la parole pendant que tu parlais encore (${latency.overlaps} fois)`);
    }
    overlapsSeen = latency.overlaps;
    renderLatency();
    if (talk) endLearnerTurn(talk);
  },
  onMicLevel: (rms, voiced) => {
    dMic.style.width = `${Math.min(100, Math.round(rms * 500))}%`;
    dMic.classList.toggle('voiced', voiced);
  },
  onMicAudio: (pcm, voiced) => talk?.clip.push(pcm, voiced),
  onTranscript: (who, text) => talk?.transcript.addLive(who, text),
  onTurnComplete: (interrupted) => talk?.transcript.completeModelTurn(interrupted),
  onInfo: log,
});

startBtn.addEventListener('click', () => {
  if (voice.state === 'idle' || voice.state === 'error') void startTalk();
  else void voice.stop();
});

async function startTalk(): Promise<void> {
  hideError();
  settings = loadSettings();
  const source = effectiveSource(settings);
  if (source !== settings.transcriptSource) {
    log('Pas de clé Groq : la transcription Gemini Live est utilisée');
  }
  voice.configure({
    ...settings,
    systemPrompt: buildSystemPrompt(JAKE, DEFAULT_LEARNER),
    greeting: JAKE.greeting,
  });
  sessionLabel = `${settings.model} · voix ${settings.voice} · pause ${settings.pauseMs} ms · texte : ${source}`;
  dModel.textContent = sessionLabel;
  overlapsSeen = 0;
  const transcript = new Transcript(source);
  transcript.onChange = (turn) => transcriptView.update(turn);
  talk = {
    id: `talk-${Date.now()}`,
    startedAt: Date.now(),
    transcript,
    source,
    transcriber: makeTranscriber(source, settings),
    clip: new ClipRecorder({ chunkMs: MIC_CHUNK_MS }),
    transcribeErrors: 0,
    ended: false,
  };
  transcriptView.clear();
  renderSourceLabel();
  await voice.start();
}

/**
 * Jake starts answering, or the talk stops: the learner's turn is over. With
 * a second recogniser, the turn's audio goes to it once, then is dropped.
 */
function endLearnerTurn(t: Talk): void {
  const pcm = t.clip.cut();
  const turn = t.transcript.cutLearner(pcm !== null);
  if (!turn || !pcm || !t.transcriber) return;
  const transcriber = t.transcriber;
  transcriber.transcribe(pcm16ToWav(pcm, MIC_RATE)).then(
    (text) => t.transcript.setLearnerText(turn.id, text),
    (err: unknown) => {
      t.transcript.setLearnerText(turn.id, null);
      const e = asProviderError(err, t.source === 'gemini-audio' ? 'gemini' : 'groq');
      if (t.transcribeErrors++ === 0) {
        log(`${transcriber.label} : ${e.french} Texte Gemini Live utilisé à la place.`);
      }
      log(`Détail : ${e.detail}`);
    },
  );
}

function renderState(state: VoiceState): void {
  if (!characterReady) return;
  dState.textContent = STATE_LABELS[state];
  const live = state !== 'idle' && state !== 'error';
  startBtn.textContent = live ? 'Arrêter' : 'Démarrer';
  startBtn.classList.toggle('live', live);
  lipBtn.disabled = live;
  if (live && sessionStartedAt === null) {
    sessionStartedAt = performance.now();
    log('Conversation démarrée');
  }
  if (!live && sessionStartedAt !== null) {
    log(`Conversation arrêtée après ${formatDuration(performance.now() - sessionStartedAt)}`);
    sessionStartedAt = null;
    dMic.style.width = '0';
    if (talk && !talk.ended) void finishTalk(talk);
  }
  if (state === 'listening' || state === 'speaking') hideError();
}

function renderLatency(): void {
  const m = latency.medianMs;
  dMedian.textContent = m === null ? '—' : formatMs(m);
  dMedian.className = m === null ? '' : m < TARGET_MS ? 'ok' : 'slow';
  dCount.textContent = `(${latency.count}/10 tours)`;
  dLast.textContent = latency.last === null ? '—' : formatMs(latency.last);
}

setInterval(() => {
  if (sessionStartedAt !== null) {
    dDuration.textContent = formatDuration(performance.now() - sessionStartedAt);
  }
}, 500);

// ---------------------------------------------------------------- debrief
let current: SavedTalk | null = null;

async function finishTalk(t: Talk): Promise<void> {
  t.ended = true;
  endLearnerTurn(t);
  t.transcript.completeModelTurn(false);
  const waitUntil = Date.now() + PENDING_WAIT_MS;
  while (t.transcript.pendingCount > 0 && Date.now() < waitUntil) {
    await new Promise((r) => setTimeout(r, 200));
  }
  const turns = t.transcript.finished();
  if (!turns.some((x) => x.who === 'you')) {
    log('Pas de phrase de ta part : pas de bilan pour cette conversation');
    return;
  }
  current = {
    id: t.id,
    startedAt: t.startedAt,
    durationMs: Date.now() - t.startedAt,
    label: sessionLabel,
    turns: turns.map(({ id, who, text, liveText, source, interrupted }) => ({
      id,
      who,
      text,
      liveText,
      source,
      interrupted,
    })),
    debrief: null,
    why: {},
  };
  await persist(current);
  await runDebrief(current);
}

function analyzer(): GeminiAnalyzer {
  settings = loadSettings();
  return new GeminiAnalyzer(
    settings.apiKey,
    settings.analysisModel,
    ANALYSIS_MODELS.map((m) => m.id),
  );
}

const analysisTurns = (s: SavedTalk): AnalysisTurn[] =>
  s.turns.map(({ id, who, text, interrupted }) => ({ id, who, text, interrupted }));

async function runDebrief(s: SavedTalk): Promise<void> {
  showDebrief(s);
  debriefStatus.textContent = 'Jake prépare ton bilan… (10 à 30 secondes)';
  debriefStatus.className = 'status busy';
  $('debrief-retry').hidden = true;
  try {
    const source = s.turns.find((x) => x.who === 'you')?.source ?? 'live';
    s.debrief = await analyzer().analyze(analysisTurns(s), {
      level: DEFAULT_LEARNER.level,
      characterName: JAKE.name,
      transcriptSource: source === 'live' ? 'Gemini Live' : SOURCE_LABEL[source],
    });
    log(`Bilan prêt (${s.debrief.mistakes.length} fautes, modèle ${s.debrief.model})`);
    await persist(s);
    if (current?.id === s.id) showDebrief(s);
  } catch (err) {
    const e = asProviderError(err, 'gemini');
    debriefStatus.textContent = `${e.french} Ta conversation est gardée : tu peux réessayer.`;
    debriefStatus.className = 'status error-text';
    $('debrief-retry').hidden = false;
    log(`Bilan impossible : ${e.detail}`);
  }
}

function showDebrief(s: SavedTalk): void {
  current = s;
  const when = new Date(s.startedAt).toLocaleString('fr-FR');
  $('debrief-meta').textContent = `${when} · ${formatDuration(s.durationMs)}`;
  debriefBody.replaceChildren();
  debriefStatus.textContent = '';
  debriefStatus.className = 'status';
  if (s.debrief) {
    renderDebrief(debriefBody, s.debrief, {
      known: s.why,
      why: async (index, mistake) => {
        const text = await analyzer()
          .explain(mistake, analysisTurns(s))
          .catch((err: unknown) => {
            throw asProviderError(err, 'gemini');
          });
        s.why[index] = text;
        void persist(s);
        return text;
      },
    });
  }
  $('debrief-lines').replaceChildren(
    ...s.turns.map((x) =>
      el(
        'p',
        { class: x.who },
        el('span', { class: 'who', text: x.who === 'you' ? 'Toi :' : 'Jake :' }),
        ` ${x.text}`,
      ),
    ),
  );
  if (!debriefDialog.open) debriefDialog.showModal();
}

async function persist(s: SavedTalk): Promise<void> {
  try {
    await saveTalk(s);
    debriefBtn.hidden = false;
  } catch (err) {
    log(`Conversation non sauvegardée dans le navigateur : ${String(err)}`);
  }
}

debriefBtn.addEventListener('click', () => {
  void listTalks().then((all) => {
    const last = all[0];
    if (!last) return;
    showDebrief(last);
    if (!last.debrief) void runDebrief(last);
  });
});
$('debrief-retry').addEventListener('click', () => current && void runDebrief(current));
$('debrief-close').addEventListener('click', () => debriefDialog.close());
$('debrief-copy').addEventListener('click', () => {
  if (!current?.debrief) return;
  void navigator.clipboard.writeText(debriefText(current.debrief)).then(
    () => log('Bilan copié'),
    () => log('Copie impossible'),
  );
});
void listTalks()
  .then((all) => (debriefBtn.hidden = all.length === 0))
  .catch(() => {
    /* IndexedDB unavailable (private window): the debrief still shows */
  });

// ---------------------------------------------------------------- lip sync
const analyser = voice.outputAnalyser;
const timeData = new Float32Array(analyser.fftSize);
const freqData = new Uint8Array(analyser.frequencyBinCount);
let mouth = { ...SILENT };
let lastFrame = performance.now();

function lipSyncFrame(now: number): void {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  analyser.getFloatTimeDomainData(timeData);
  let sum = 0;
  for (let i = 0; i < timeData.length; i++) sum += timeData[i] * timeData[i];
  const rms = Math.sqrt(sum / timeData.length);
  analyser.getByteFrequencyData(freqData);
  const { low, mid, high } = bandEnergies(freqData, analyser.context.sampleRate);
  mouth = smoothVisemes(mouth, computeVisemes(rms, low, mid, high), dt);
  stage.setVisemes(mouth);
  // Exposed for the smoke test and for debugging: how open the mouth is.
  canvas.dataset.mouth = (mouth.aa + mouth.ih + mouth.ou + mouth.ee + mouth.oh).toFixed(2);
  canvas.dataset.frames = String(stage.frames);
  requestAnimationFrame(lipSyncFrame);
}
requestAnimationFrame(lipSyncFrame);

/** Plays a synthetic "voice" so the lip sync can be checked without a key. */
lipBtn.addEventListener('click', () => {
  void player.resume().then(() => {
    const rate = 24_000;
    const seconds = 4;
    const samples = new Float32Array(rate * seconds);
    for (let i = 0; i < samples.length; i++) {
      const t = i / rate;
      // Four "syllables" per second, with a full second of silence at 1.5 s.
      const silent = t > 1.5 && t < 2.5;
      const syllable = Math.max(0, Math.sin(t * Math.PI * 4)) ** 2;
      const formant = 500 + 900 * (0.5 + 0.5 * Math.sin(t * 2.1));
      const tone =
        Math.sin(2 * Math.PI * 130 * t) * 0.5 +
        Math.sin(2 * Math.PI * formant * t) * 0.35 +
        Math.sin(2 * Math.PI * 2800 * t) * 0.15 * (0.5 + 0.5 * Math.sin(t * 3.3));
      samples[i] = silent ? 0 : tone * syllable * 0.5;
    }
    player.enqueue(samples, rate);
    log('Test des lèvres : 4 s de son, avec 1 s de silence au milieu');
  });
});

// -------------------------------------------------------------- transcript
function applyTranscriptVisibility(): void {
  transcriptPanel.classList.toggle('collapsed', !settings.showTranscript);
  $('toggle-transcript').textContent = settings.showTranscript ? 'Masquer' : 'Afficher';
}
$('toggle-transcript').addEventListener('click', () => {
  settings = { ...loadSettings(), showTranscript: !settings.showTranscript };
  saveSettings(settings);
  applyTranscriptVisibility();
});
applyTranscriptVisibility();

function renderSourceLabel(): void {
  $('t-source').textContent = `texte : ${SOURCE_LABEL[effectiveSource(settings)]}`;
}
renderSourceLabel();

// ------------------------------------------------------------------ errors
function showError(error: FriendlyError): void {
  $('error-message').textContent = error.message;
  $('error-detail').textContent = error.detail ? `Détail technique : ${error.detail}` : '';
  $('error-retry').hidden = !error.canRetry;
  $('error-settings').hidden = !['missing-key', 'bad-key', 'model'].includes(error.kind);
  errorBox.hidden = false;
  log(`Erreur (${error.kind}) : ${error.detail || error.message}`);
}
function hideError(): void {
  errorBox.hidden = true;
}
// A lost Wi-Fi link can take the browser a long time to notice on its own.
window.addEventListener('offline', () => {
  if (voice.state === 'idle' || voice.state === 'error') return;
  void voice.stop().then(() => showError(friendly('network', 'le navigateur est hors ligne')));
});
$('error-retry').addEventListener('click', () => void startTalk());
$('error-settings').addEventListener('click', openSettings);
$('error-close').addEventListener('click', hideError);

// ---------------------------------------------------------------- settings
for (const m of MODELS) modelSelect.add(new Option(m.label, m.id));
for (const v of VOICES) voiceSelect.add(new Option(v, v));
for (const x of PAUSES) pauseSelect.add(new Option(x.label, String(x.ms)));
for (const x of TRANSCRIPT_SOURCES) sourceSelect.add(new Option(x.label, x.id));
for (const m of ANALYSIS_MODELS) analysisSelect.add(new Option(m.label, m.id));

function keyStatusText(s: Settings): string {
  const gemini = s.apiKey
    ? `Clé Gemini enregistrée dans ce navigateur : ${maskKey(s.apiKey)}`
    : 'Aucune clé Gemini enregistrée pour l’instant.';
  const groq = s.groqKey ? ` Clé Groq : ${maskKey(s.groqKey)}.` : ' Pas de clé Groq.';
  return gemini + groq;
}

function openSettings(): void {
  settings = loadSettings();
  keyInput.value = settings.apiKey;
  groqInput.value = settings.groqKey;
  modelSelect.value = settings.model;
  voiceSelect.value = settings.voice;
  pauseSelect.value = String(settings.pauseMs);
  sourceSelect.value = settings.transcriptSource;
  analysisSelect.value = settings.analysisModel;
  showTranscriptBox.checked = settings.showTranscript;
  keyStatus.textContent = keyStatusText(settings);
  settingsDialog.returnValue = '';
  settingsDialog.showModal();
}
$('open-settings').addEventListener('click', openSettings);
$('forget-key').addEventListener('click', () => {
  saveSettings({ ...loadSettings(), apiKey: '', groqKey: '' });
  keyInput.value = '';
  groqInput.value = '';
  keyStatus.textContent = 'Clés effacées de ce navigateur.';
});
$('clear-talks').addEventListener('click', () => {
  void clearTalks().then(
    () => {
      debriefBtn.hidden = true;
      current = null;
      log('Conversations effacées de ce navigateur');
      keyStatus.textContent = 'Conversations effacées de ce navigateur.';
    },
    () => log('Effacement impossible'),
  );
});
settingsDialog.addEventListener('close', () => {
  if (settingsDialog.returnValue !== 'save') return;
  saveSettings({
    apiKey: keyInput.value,
    groqKey: groqInput.value,
    model: modelSelect.value || DEFAULTS.model,
    voice: voiceSelect.value || DEFAULTS.voice,
    pauseMs: Number(pauseSelect.value) || DEFAULTS.pauseMs,
    transcriptSource: (sourceSelect.value || DEFAULTS.transcriptSource) as TranscriptSource,
    analysisModel: analysisSelect.value || DEFAULTS.analysisModel,
    showTranscript: showTranscriptBox.checked,
  });
  settings = loadSettings();
  applyTranscriptVisibility();
  renderSourceLabel();
  log(
    settings.apiKey ? 'Réglages enregistrés dans ce navigateur' : 'Réglages enregistrés (sans clé)',
  );
  if (settings.transcriptSource !== effectiveSource(settings)) {
    log('Groq choisi sans clé Groq : Gemini Live sera utilisé');
  }
  hideError();
});

// ------------------------------------------------------------ log + report
function log(text: string): void {
  const stamp = new Date().toLocaleTimeString('fr-FR');
  logLines.push(`${stamp} ${text}`);
  if (logLines.length > 80) logLines.shift();
  const row = document.createElement('div');
  row.textContent = `${stamp} — ${text}`;
  dLog.prepend(row);
  while (dLog.childElementCount > 30) dLog.lastElementChild?.remove();
}

$('copy-report').addEventListener('click', () => {
  // The report never contains an API key or the transcript.
  const turns: Turn[] = talk?.transcript.turns ?? [];
  const learner = turns.filter((x) => x.who === 'you' && x.text.trim());
  const report = [
    'English Buddy — rapport de test phase 1',
    `Date : ${new Date().toLocaleString('fr-FR')}`,
    `Conversation lancée avec : ${sessionLabel}`,
    `État : ${dState.textContent}`,
    `Délai médian : ${dMedian.textContent} ${dCount.textContent}`,
    `Dernier délai : ${dLast.textContent}`,
    `Jake a parlé pendant que tu parlais encore : ${latency.overlaps} fois`,
    `Durée affichée : ${dDuration.textContent}`,
    `Tours : ${learner.length} de toi, ${turns.filter((x) => x.who === 'jake').length} de Jake ; interruptions de Jake : ${turns.filter((x) => x.interrupted).length}`,
    `Transcription : ${talk ? SOURCE_LABEL[talk.source] : '—'} ; échecs du 2ᵉ reconnaisseur : ${talk?.transcribeErrors ?? 0}`,
    `Bilan : ${current?.debrief ? `${current.debrief.mistakes.length} fautes, modèle ${current.debrief.model}` : 'aucun'}`,
    `Navigateur : ${navigator.userAgent}`,
    '--- Journal ---',
    ...logLines,
  ].join('\n');
  void navigator.clipboard.writeText(report).then(
    () => {
      log('Rapport copié : colle-le dans ta réponse');
      const btn = $('copy-report');
      btn.textContent = 'Copié ✓';
      setTimeout(() => (btn.textContent = 'Copier le rapport'), 2000);
    },
    () => log('Copie impossible : sélectionne le journal à la main'),
  );
});

function formatMs(ms: number): string {
  return `${(ms / 1000).toFixed(2).replace('.', ',')} s`;
}
function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
