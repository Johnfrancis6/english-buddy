import './style.css';
import { Stage } from './scene/stage';
import { bandEnergies, computeVisemes, SILENT, smoothVisemes } from './lipsync/visemes';
import { DEFAULTS, loadSettings, maskKey, MODELS, PAUSES, saveSettings, VOICES } from './settings';
import { PcmPlayer } from './voice/audio';
import { friendly, type FriendlyError } from './voice/errors';
import { GeminiLiveSession } from './voice/geminiLive';
import { LatencyTracker } from './voice/latency';
import type { VoiceState } from './voice/types';

const CHARACTER_URL = `${import.meta.env.BASE_URL}models/HairSample_Male.vrm`;
const TARGET_MS = 1500;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('stage');
const startBtn = $<HTMLButtonElement>('start');
const lipBtn = $<HTMLButtonElement>('lip-test');
const dState = $('d-state');
const dMedian = $('d-median');
const dCount = $('d-count');
const dLast = $('d-last');
const dDuration = $('d-duration');
const dMic = $('d-mic');
const dModel = $('d-model');
const dLog = $('d-log');
const transcriptEl = $('transcript');
const errorBox = $('error');
const settingsDialog = $<HTMLDialogElement>('settings');
const keyInput = $<HTMLInputElement>('api-key');
const modelSelect = $<HTMLSelectElement>('model');
const voiceSelect = $<HTMLSelectElement>('voice');
const pauseSelect = $<HTMLSelectElement>('pause');
const keyStatus = $('key-status');

const STATE_LABELS: Record<VoiceState, string> = {
  idle: 'Prêt — clique sur « Démarrer »',
  connecting: 'Connexion à Jake…',
  listening: 'Jake t’écoute',
  speaking: 'Jake parle',
  reconnecting: 'Reconnexion…',
  error: 'Arrêté sur une erreur',
};

let settings = loadSettings();
let characterReady = false;
let sessionStartedAt: number | null = null;
const logLines: string[] = [];

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

// ------------------------------------------------------------------- voice
const player = new PcmPlayer();
const latency = new LatencyTracker();
const voice = new GeminiLiveSession(player, latency, {
  onState: renderState,
  onError: showError,
  onModelTurnStart: (ms) => {
    if (ms !== null) log(`Délai de ce tour : ${formatMs(ms)}`);
    renderLatency();
  },
  onMicLevel: (rms, voiced) => {
    dMic.style.width = `${Math.min(100, Math.round(rms * 500))}%`;
    dMic.classList.toggle('voiced', voiced);
  },
  onTranscript: appendTranscript,
  onInfo: log,
});

startBtn.addEventListener('click', () => {
  if (voice.state === 'idle' || voice.state === 'error') void startTalk();
  else void voice.stop();
});

async function startTalk(): Promise<void> {
  hideError();
  settings = loadSettings();
  voice.configure(settings);
  dModel.textContent = `${settings.model} · voix ${settings.voice} · pause ${settings.pauseMs} ms`;
  transcriptEl.replaceChildren();
  await voice.start();
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
// Kept in memory only, to check that the conversation works. Nothing is saved.
const openLine: { you: HTMLElement | null; jake: HTMLElement | null } = { you: null, jake: null };

function appendTranscript(who: 'you' | 'jake', text: string, turnDone: boolean): void {
  if (text) {
    let line = openLine[who];
    if (!line) {
      line = document.createElement('p');
      line.className = who;
      const label = document.createElement('span');
      label.className = 'who';
      label.textContent = who === 'you' ? 'Toi :' : 'Jake :';
      line.append(label, document.createElement('span'));
      transcriptEl.append(line);
      openLine[who] = line;
      while (transcriptEl.childElementCount > 12) transcriptEl.firstElementChild?.remove();
    }
    line.lastElementChild!.textContent += text;
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  }
  if (turnDone) openLine[who] = null;
}

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

function openSettings(): void {
  settings = loadSettings();
  keyInput.value = settings.apiKey;
  modelSelect.value = settings.model;
  voiceSelect.value = settings.voice;
  pauseSelect.value = String(settings.pauseMs);
  keyStatus.textContent = settings.apiKey
    ? `Clé enregistrée dans ce navigateur : ${maskKey(settings.apiKey)}`
    : 'Aucune clé enregistrée pour l’instant.';
  settingsDialog.returnValue = '';
  settingsDialog.showModal();
}
$('open-settings').addEventListener('click', openSettings);
$('forget-key').addEventListener('click', () => {
  saveSettings({ ...loadSettings(), apiKey: '' });
  keyInput.value = '';
  keyStatus.textContent = 'Clé effacée de ce navigateur.';
});
settingsDialog.addEventListener('close', () => {
  if (settingsDialog.returnValue !== 'save') return;
  saveSettings({
    apiKey: keyInput.value,
    model: modelSelect.value || DEFAULTS.model,
    voice: voiceSelect.value || DEFAULTS.voice,
    pauseMs: Number(pauseSelect.value) || DEFAULTS.pauseMs,
  });
  settings = loadSettings();
  log(
    settings.apiKey ? 'Réglages enregistrés dans ce navigateur' : 'Réglages enregistrés (sans clé)',
  );
  hideError();
});

// ------------------------------------------------------------ log + report
function log(text: string): void {
  const stamp = new Date().toLocaleTimeString('fr-FR');
  logLines.push(`${stamp} ${text}`);
  if (logLines.length > 60) logLines.shift();
  const row = document.createElement('div');
  row.textContent = `${stamp} — ${text}`;
  dLog.prepend(row);
  while (dLog.childElementCount > 30) dLog.lastElementChild?.remove();
}

$('copy-report').addEventListener('click', () => {
  // The report never contains the API key or the transcript.
  const report = [
    'English Buddy — rapport de test phase 0',
    `Date : ${new Date().toLocaleString('fr-FR')}`,
    `Modèle : ${settings.model} · voix ${settings.voice} · pause ${settings.pauseMs} ms`,
    `État : ${dState.textContent}`,
    `Délai médian : ${dMedian.textContent} ${dCount.textContent}`,
    `Dernier délai : ${dLast.textContent}`,
    `Durée affichée : ${dDuration.textContent}`,
    `Navigateur : ${navigator.userAgent}`,
    '--- Journal ---',
    ...logLines,
  ].join('\n');
  void navigator.clipboard.writeText(report).then(
    () => log('Rapport copié : colle-le dans ta réponse'),
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
