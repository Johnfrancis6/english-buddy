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
  LEVELS,
  TRANSCRIPT_SOURCES,
  VOICES,
  type Level,
  type Settings,
  type TranscriptSource,
} from './settings';
import { MIC_CHUNK_MS, MIC_RATE, PcmPlayer } from './voice/audio';
import { friendly, type FriendlyError } from './voice/errors';
import { GeminiLiveSession } from './voice/geminiLive';
import { LatencyTracker } from './voice/latency';
import type { VoiceState } from './voice/types';
import {
  buildSystemPrompt,
  DEFAULT_LEARNER,
  type LearnerProfile,
  type SceneId,
} from './teaching/persona';
import { CAST, castMember, SCENES, sceneInfo, type CastMember } from './cast';
import { GestureDirector } from './scene/director';
import { GESTURES } from './scene/gestures';
import { Transcript, type Turn } from './talk/transcript';
import { ClipRecorder } from './transcribe/clip';
import { makeTranscriber } from './transcribe/factory';
import type { Transcriber } from './transcribe/types';
import { pcm16ToWav } from './transcribe/wav';
import { GeminiAnalyzer } from './analysis/geminiAnalyzer';
import type { AnalysisTurn } from './analysis/types';
import { asProviderError } from './net/providerError';
import { listTalks, saveTalk, type SavedTalk } from './storage/talks';
import { CARDS_BACKFILLED, clearGroup, countGroups, wipeEverything } from './storage/wipe';
import { renderData, type DataHandlers } from './ui/dataView';
import { clearFacts, deleteFact, listFacts, putFact, saveFacts } from './storage/facts';
import { factsForAnalyzer, mergeFacts, newFactId, type Fact } from './memory/facts';
import { buildLearnerProfile } from './progress/profile';
import { buildProgress } from './progress/stats';
import { renderMemory } from './ui/memoryView';
import { renderProgress } from './ui/progressView';
import { renderReviews } from './ui/reviewView';
import { renderMap } from './ui/mapView';
import { GoalsView } from './ui/goalsView';
import {
  buildChallenge,
  CHALLENGE_MINUTES,
  FREE_PLAN,
  documentPlan,
  missionPlan,
  planPrompt,
  type TalkPlan,
} from './habit/plan';
import { missionById, unlockMap, type Mission } from './habit/missions';
import { computeStreak, dayKey } from './habit/streak';
import { challengeDoneToday, missionRecords, nextDueFr } from './habit/today';
import { dueCards, draftsFromDebrief, type ReviewCard } from './reviews/cards';
import { addDrafts, applyTalk, applyUpdates, gradeCard, listCards, putCard } from './storage/cards';
import { talkStats } from './progress/stats';
import {
  cloudConfig,
  isProjectUrl,
  makeCloud,
  rememberDeleted,
  saveCloudConfig,
  syncOnce,
} from './sync/config';
import type { CloudSync } from './sync/types';
import { TranscriptView } from './ui/transcriptView';
import { debriefText, renderDebrief } from './ui/debriefView';
import { el } from './ui/dom';
import { WelcomeView } from './ui/welcomeView';
import { DocumentsView } from './ui/documentsView';
import { cleanPdfText, guessTitle, makeDoc, type HardWord, type StudyDoc } from './documents/text';
import { parseLink, fetchLink } from './documents/web';
import { findHardWords } from './documents/hardWords';
import { deleteDoc, listDocs, putDoc } from './storage/docs';
import { cardId } from './reviews/cards';
import { loadWelcome, saveWelcome, shouldOpenWelcome, LEVEL_CHOICES } from './onboarding/welcome';
import { listMicrophones } from './onboarding/micTest';
import { PronunciationView } from './ui/pronunciationView';
import { buildExercises } from './pronunciation/sentences';
import { pronProgress, soundLevels, type PronAttempt } from './pronunciation/progress';
import { makeScorer, scorerNameFr } from './pronunciation/factory';
import { pronUpdates, soundDrafts } from './pronunciation/cards';
import { recordTake } from './pronunciation/recorder';
import { SOUNDS } from './pronunciation/sounds';
import { AZURE_REGIONS } from './pronunciation/azure';
import { WhisperCheckedScorer } from './pronunciation/whisperCheck';
import { listAttempts, saveAttempt } from './storage/pron';
import { makeMainScorer } from './pronunciation/factory';
import { whisperWords } from './pronunciation/whisperCheck';
import {
  renderPicker,
  singProgressSection,
  SingView,
  MODES as SING_MODES,
  type SongRow,
} from './ui/singView';
import type { Song } from './singing/melody';
import { SONGS } from './singing/songs';
import { playSong, learnerLine } from './singing/synth';
import { scoreSinging } from './singing/score';
import {
  lessonsIn,
  localSong,
  pickLessons,
  STARTER_LESSONS,
  tuneFor,
  writeSong,
} from './singing/compose';
import {
  deleteOwnSong,
  listOwnSongs,
  listSingAttempts,
  saveOwnSong,
  saveSingAttempt,
  type SingAttempt,
} from './storage/sing';

const modelUrl = (c: CastMember) => `${import.meta.env.BASE_URL}models/${c.model}`;
const picture = (kind: 'scenes' | 'people', id: string) =>
  `${import.meta.env.BASE_URL}pictures/${kind}/${id}.webp`;
const TARGET_MS = 1500;
/** Longest wait for the second recogniser before the debrief starts anyway. */
const PENDING_WAIT_MS = 15_000;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// Panels sit under the top bar, whose height depends on the screen width.
const topbar = document.querySelector<HTMLElement>('.topbar');
if (topbar) {
  const setTopbarHeight = () =>
    document.documentElement.style.setProperty('--topbar-h', `${topbar.offsetHeight}px`);
  setTopbarHeight();
  new ResizeObserver(setTopbarHeight).observe(topbar);
}
const canvas = $<HTMLCanvasElement>('stage');
const startBtn = $<HTMLButtonElement>('start');
const lipBtn = $<HTMLButtonElement>('lip-test');
const gestureBtn = $<HTMLButtonElement>('gesture-test');
const homePanel = $('home');
const measures = $('measures');
/** On the home screen the character stands right of the panel. */
const homeShift = () => (window.innerWidth > 760 ? 0.2 : 0);
const homeStatus = $('home-status');
const enterBtn = $<HTMLButtonElement>('enter');
const controls = document.querySelector<HTMLElement>('.controls')!;
const talkHint = $('talk-hint');
const dFps = $('d-fps');
const dGesture = $('d-gesture');
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

const stateLabel = (state: VoiceState, name: string): string =>
  ({
    idle: 'Prêt — clique sur « Démarrer »',
    connecting: `Connexion à ${name}…`,
    listening: `${name} t’écoute`,
    speaking: `${name} parle`,
    reconnecting: 'Reconnexion…',
    error: 'Arrêté sur une erreur',
  })[state];
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

// ------------------------------------------------------- 3D stage + home
const stage = new Stage(canvas);
/** What is chosen on the home screen (saved in the settings). */
let sceneId: SceneId = settings.scene;
let member: CastMember = castMember(settings.character);
/** The learner is in the scene (home closed). */
let inScene = false;
let director: GestureDirector | null = null;
let firstAnswer = true;
/** What the next talk is for: free chat, a mission, or the daily challenge. */
let plan: TalkPlan = FREE_PLAN;
const planMission = () => missionById(plan.missionId);
const goals = new GoalsView($('goals'), $('goals-body'), $('goals-title'), $('goals-timer'));

function applyCharacterLook(): void {
  document.body.style.setProperty('--buddy', member.colour);
  transcriptView.characterName = member.character.name;
  canvas.setAttribute('aria-label', `${sceneInfo(sceneId).labelFr} avec ${member.character.name}`);
  canvas.dataset.character = member.id;
  canvas.dataset.scene = sceneId;
}

/** Shows the chosen character (cached after the first download). */
async function showCharacter(opts: { walkIn?: boolean } = {}): Promise<void> {
  const wanted = member;
  characterReady = false;
  canvas.dataset.ready = 'false';
  startBtn.disabled = true;
  enterBtn.disabled = true;
  const name = wanted.character.name;
  const progress = (r: number) => {
    const text = `Chargement de ${name}… ${Math.round(r * 100)} %`;
    homeStatus.textContent = text;
    dState.textContent = text;
  };
  try {
    await stage.loadCharacter(modelUrl(wanted), progress, opts);
    if (wanted !== member) return; // another choice was made meanwhile
    characterReady = true;
    canvas.dataset.ready = 'true';
    homeStatus.textContent = '';
    enterBtn.disabled = false;
    lipBtn.disabled = false;
    gestureBtn.disabled = false;
    if (!opts.walkIn) startBtn.disabled = false;
    renderState(voice.state);
  } catch (err: unknown) {
    canvas.dataset.ready = 'error';
    const text = `${name} n’a pas pu être chargé. Vérifie ta connexion, puis choisis à nouveau.`;
    homeStatus.textContent = text;
    dState.textContent = text;
    enterBtn.disabled = false;
    log(`Chargement du personnage impossible : ${String(err)}`);
  }
}

stage.onArrived = () => {
  if (!inScene) return;
  startBtn.disabled = !characterReady;
  talkHint.textContent = `Clique sur « Démarrer » et dis bonjour à ${member.character.name}.`;
};

function card(
  kind: 'scenes' | 'people',
  id: string,
  title: string,
  lines: string[],
  onPick: () => void,
): HTMLButtonElement {
  const img = el('img', { src: picture(kind, id), alt: '', loading: 'lazy' });
  img.addEventListener('error', () => img.remove(), { once: true });
  const button = el(
    'button',
    { class: 'card', type: 'button', 'data-id': id, 'aria-pressed': 'false' },
    img,
    el('strong', { text: title }),
    ...lines.map((t) => el('span', { class: 'small muted', text: t })),
  );
  button.addEventListener('click', onPick);
  return button;
}

function renderHome(): void {
  $('scene-cards').replaceChildren(
    ...SCENES.map((x) =>
      card('scenes', x.id, x.labelFr, [x.blurbFr], () => {
        if (sceneId === x.id) return;
        sceneId = x.id;
        member = castMember(x.host);
        if (plan.mode === 'mission' && planMission()?.scene !== x.id) plan = FREE_PLAN;
        choose();
      }),
    ),
  );
  $('character-cards').replaceChildren(
    ...CAST.map((c) =>
      card('people', c.id, c.character.name, [`${c.ageFr} · ${c.accentFr}`, c.roleFr], () => {
        if (member.id === c.id) return;
        member = c;
        choose();
      }),
    ),
  );
  markChoice();
}

function markChoice(): void {
  for (const b of document.querySelectorAll<HTMLButtonElement>('#scene-cards .card')) {
    b.setAttribute('aria-pressed', String(b.dataset.id === sceneId));
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>('#character-cards .card')) {
    b.setAttribute('aria-pressed', String(b.dataset.id === member.id));
  }
  $('home-about').textContent = `${member.character.name} : ${member.blurbFr}`;
  enterBtn.textContent = `Entrer : ${sceneInfo(sceneId).labelFr.toLowerCase()} avec ${member.character.name}`;
  renderHomePlan();
}

/** The mission line of the home screen. */
function renderHomePlan(): void {
  const box = $('home-plan');
  const m = planMission();
  const pickBtn = el('button', {
    class: 'btn quiet small',
    type: 'button',
    text: m ? 'Changer' : 'Choisir une mission',
  });
  pickBtn.addEventListener('click', () => void openMap());
  if (plan.mode === 'document' && plan.document) {
    const d = plan.document;
    const drop = el('button', { class: 'link', type: 'button', text: 'Sans document' });
    drop.addEventListener('click', () => {
      plan = FREE_PLAN;
      renderHomePlan();
    });
    const other = el('button', { class: 'btn quiet small', type: 'button', text: 'Changer' });
    other.addEventListener('click', () => void documents.open());
    box.replaceChildren(
      el(
        'p',
        {},
        el('span', { class: 'chip', text: `Document · passage ${d.passage + 1} sur ${d.total}` }),
        ' ',
        el('strong', { text: d.title }),
      ),
      el('div', { class: 'row tight' }, other, drop),
    );
    return;
  }
  if (plan.mode === 'mission' && m) {
    const drop = el('button', { class: 'link', type: 'button', text: 'Sans mission' });
    drop.addEventListener('click', () => {
      plan = FREE_PLAN;
      renderHomePlan();
    });
    box.replaceChildren(
      el(
        'p',
        {},
        el('span', { class: 'chip', text: `Mission · niveau ${m.tier}` }),
        ' ',
        el('strong', { text: m.titleFr }),
      ),
      el('p', { class: 'small muted', text: m.goalFr }),
      el('div', { class: 'row tight' }, pickBtn, drop),
    );
  } else {
    box.replaceChildren(
      el(
        'p',
        { class: 'small muted' },
        'Conversation libre. Tu peux aussi te donner un but : ',
        pickBtn,
      ),
    );
  }
}

/** Streak, daily challenge and reviews, on the home screen. */
async function renderToday(): Promise<void> {
  const now = Date.now();
  const [talks, cards] = await Promise.all([
    listTalks().catch(() => [] as SavedTalk[]),
    listCards().catch(() => [] as ReviewCard[]),
  ]);
  const streak = computeStreak(
    talks.map((t) => ({ at: t.startedAt, speakingMs: talkStats(t).speakingMs })),
    now,
  );
  const today = Math.floor(streak.todayMs / 60_000);
  const streakText = streak.days
    ? `🔥 Série : ${streak.days} jour${streak.days > 1 ? 's' : ''}`
    : '🔥 Pas encore de série';
  const todayText = streak.todayDone
    ? 'aujourd’hui compte ✓'
    : `aujourd’hui : ${today} min de parole sur 3`;
  const joker = streak.jokerLeft ? 'joker de la semaine disponible' : 'joker de la semaine utilisé';
  $('streak-line').textContent = `${streakText} · ${todayText} · ${joker}`;
  $('streak-line').title =
    `Un jour compte quand tu as vraiment parlé au moins 3 minutes. Un jour manqué par semaine est couvert par le joker. Record : ${streak.best} jour${streak.best > 1 ? 's' : ''}.`;
  const due = dueCards(cards, now);
  const challenge = buildChallenge(cards, sceneId, now);
  const done = challengeDoneToday(talks, now);
  $('challenge-line').textContent =
    `${CHALLENGE_MINUTES} min avec ${member.character.name} · ${challenge.reviews.length ? `${challenge.reviews.length} faute${challenge.reviews.length > 1 ? 's' : ''} à reprendre` : 'aucune faute due'} · ${challenge.expressions.length} expressions à placer${done ? ' · déjà fait aujourd’hui ✓' : ''}`;
  $('start-challenge').textContent = done ? 'Refaire le défi' : 'Lancer le défi';
  $('reviews-line').textContent = cards.length
    ? `${due.length} carte${due.length > 1 ? 's' : ''} à revoir · ${cards.filter((c) => !c.suspended).length} en tout · prochaine : ${nextDueFr(cards, now)}`
    : 'Tes fautes et tes mots deviendront des cartes après tes bilans.';
  $<HTMLButtonElement>('open-reviews').disabled = due.length === 0;
  $('today').dataset.due = String(due.length);
  const pron = pronProgress(await listAttempts().catch(() => [] as PronAttempt[]), now);
  const weakest = pron.sounds[0];
  $('pron-line').textContent =
    pron.score === null
      ? '5 phrases à lire : th, h, r, voyelles, -ed, accent du mot. Chaque mot est noté.'
      : `Note estimée : ${pron.score}/100${weakest ? ` · à travailler : ${SOUNDS[weakest.sound].labelFr.toLowerCase()}` : ''}`;
  const sung = await listSingAttempts().catch(() => [] as SingAttempt[]);
  const bestSung = sung.reduce((n, a) => Math.max(n, a.result.overall), 0);
  $('sing-line').textContent = sung.length
    ? `${sung.length} prise${sung.length > 1 ? 's' : ''} chantée${sung.length > 1 ? 's' : ''} · meilleure note : ${bestSung}/100 · ${SONGS.length} chansons et la tienne`
    : `${SONGS.length} chansons courtes, et une chanson écrite avec tes fautes. Chaque mot est noté : prononciation et rythme.`;
  $('today').dataset.streak = String(streak.days);
}

/** A card was picked: update the preview and remember the choice. */
function choose(): void {
  settings = { ...loadSettings(), scene: sceneId, character: member.id };
  saveSettings(settings);
  markChoice();
  stage.setScene(sceneId);
  applyCharacterLook();
  void showCharacter();
}

function openHome(): void {
  if (voice.state !== 'idle' && voice.state !== 'error') return;
  leaveSing();
  inScene = false;
  homePanel.hidden = false;
  measures.hidden = true;
  stage.setViewShift(homeShift());
  controls.hidden = true;
  transcriptPanel.hidden = true;
  $('open-home').hidden = true;
  goals.hide();
  markChoice();
  void renderToday();
}

function enterScene(): void {
  if (!characterReady) return;
  inScene = true;
  homePanel.hidden = true;
  measures.hidden = false;
  stage.setViewShift(0);
  controls.hidden = false;
  transcriptPanel.hidden = false;
  $('open-home').hidden = false;
  startBtn.disabled = true;
  talkHint.textContent = `${member.character.name} arrive…`;
  renderSourceLabel();
  stage.walkIn();
  goals.show(plan, planMission(), member.character.name);
  goals.tick(plan.mode === 'challenge' ? (plan.minutes ?? CHALLENGE_MINUTES) * 60_000 : null, 0);
  void todaySpeakingMs().then((ms) => (todayBaseMs = ms));
  log(
    `Scène : ${sceneInfo(sceneId).labelFr}, avec ${member.character.name}${plan.mode === 'challenge' ? ' (défi du jour)' : planMission() ? ` (mission « ${planMission()!.titleFr} »)` : ''}`,
  );
  // No key yet: the welcome explains how to get one (it replaces the settings).
  if (!loadSettings().apiKey) welcome.open('gemini');
}

enterBtn.addEventListener('click', enterScene);
$('start-challenge').addEventListener('click', () => {
  void listCards()
    .catch(() => [] as ReviewCard[])
    .then((cards) => {
      plan = buildChallenge(cards, sceneId, Date.now());
      enterScene();
    });
});

/** Speaking time already saved today (for the streak line in the talk). */
let todayBaseMs = 0;
async function todaySpeakingMs(): Promise<number> {
  const talks = await listTalks().catch(() => [] as SavedTalk[]);
  const today = dayKey(Date.now());
  return talks
    .filter((t) => dayKey(t.startedAt) === today)
    .reduce((n, t) => n + talkStats(t).speakingMs, 0);
}
$('open-home').addEventListener('click', openHome);
$('home-debrief').addEventListener('click', () => debriefBtn.click());

// ------------------------------------------------------------- the talk
/** Everything about the conversation in progress (text only). */
interface Talk {
  id: string;
  character: CastMember;
  scene: SceneId;
  startedAt: number;
  transcript: Transcript;
  source: TranscriptSource;
  /** Second recogniser, or null when the Live transcript is used. */
  transcriber: Transcriber | null;
  /** The learner's current turn, in memory only, to know whether they spoke. */
  clip: ClipRecorder;
  transcribeErrors: number;
  ended: boolean;
  /** Time the microphone heard the learner's voice (measured, ms). */
  speakingMs: number;
  /** What the character was told about the learner at the start. */
  profile: LearnerProfile;
  /** Phase 4: mission, review items, expressions to place. */
  plan: TalkPlan;
}
let talk: Talk | null = null;
const transcriptView = new TranscriptView(transcriptBody);

const stageTime = () => performance.now() / 1000;
const player = new PcmPlayer();
const latency = new LatencyTracker();
const voice = new GeminiLiveSession(player, latency, {
  onState: renderState,
  onError: showError,
  onModelTurnStart: (ms) => {
    if (ms !== null) log(`Délai de ce tour : ${formatMs(ms)}`);
    else if (latency.overlaps > overlapsSeen) {
      log(
        `${member.character.name} a pris la parole pendant que tu parlais encore (${latency.overlaps} fois)`,
      );
    }
    director?.buddyStarts();
    director?.learnerTurnOver();
    // The greeting comes with a wave.
    if (firstAnswer) {
      firstAnswer = false;
      director?.talkStarted(stageTime());
    }
    overlapsSeen = latency.overlaps;
    renderLatency();
    if (talk) endLearnerTurn(talk);
  },
  onMicLevel: (rms, voiced) => {
    director?.learnerFrame(stageTime(), voiced);
    if (voiced && talk && !talk.ended) talk.speakingMs += MIC_CHUNK_MS;
    dMic.style.width = `${Math.min(100, Math.round(rms * 500))}%`;
    dMic.classList.toggle('voiced', voiced);
  },
  onMicAudio: (pcm, voiced) => talk?.clip.push(pcm, voiced),
  onTranscript: (who, text) => {
    talk?.transcript.addLive(who, text);
    if (who === 'buddy') director?.buddySays(text, stageTime());
    else {
      director?.learnerSays(text, stageTime());
      if (talk) goals.learnerText(learnerText(talk), planMission());
    }
  },
  onTurnComplete: (interrupted) => {
    director?.buddyDone();
    talk?.transcript.completeModelTurn(interrupted);
  },
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
  const character = member.character;
  const voiceName = settings.voiceOverride || member.voice;
  startBtn.disabled = true; // no second start while the profile is read
  const profile = await learnerProfile(member.id).finally(() => (startBtn.disabled = false));
  const mission = planMission();
  voice.configure({
    ...settings,
    voice: voiceName,
    systemPrompt: buildSystemPrompt(
      character,
      profile,
      sceneId,
      planPrompt(plan, mission),
      mission?.roleEn,
    ),
    greeting: mission?.greetingEn ?? character.greeting,
  });
  director = new GestureDirector({ fistBump: member.fistBump }, (g) => stage.play(g));
  firstAnswer = true;
  talkHint.textContent = '';
  sessionLabel = `${character.name} · ${sceneId} · ${settings.model} · voix ${voiceName} · pause ${settings.pauseMs} ms · texte : ${source}`;
  dModel.textContent = sessionLabel;
  overlapsSeen = 0;
  const transcript = new Transcript(source);
  transcript.onChange = (turn) => transcriptView.update(turn);
  talk = {
    id: `talk-${Date.now()}`,
    character: member,
    scene: sceneId,
    startedAt: Date.now(),
    transcript,
    source,
    transcriber: makeTranscriber(source, settings),
    clip: new ClipRecorder({ chunkMs: MIC_CHUNK_MS }),
    transcribeErrors: 0,
    ended: false,
    speakingMs: 0,
    profile,
    plan,
  };
  goals.show(plan, mission, character.name);
  todayBaseMs = await todaySpeakingMs();
  transcriptView.clear();
  renderSourceLabel();
  await voice.start();
}

/** Everything the learner said so far in this talk. */
const learnerText = (t: Talk) =>
  t.transcript.turns
    .filter((x) => x.who === 'you')
    .map((x) => x.text)
    .join('\n');

goals.onPlaced = (en) => {
  log(`Expression placée : « ${en} »`);
  // A small sign that the character noticed (the voice reacts too, by prompt).
  stage.play(member.fistBump ? 'fistBump' : 'nod');
};

/** What the character knows before the talk: level, frequent mistakes, memory. */
async function learnerProfile(id: CastMember['id']): Promise<LearnerProfile> {
  try {
    const [talks, facts] = await Promise.all([listTalks(), listFacts()]);
    const p = buildLearnerProfile(talks, facts, id, Date.now(), loadSettings().startLevel);
    const remembered = facts.filter((f) => f.category !== 'last_talk').length;
    log(
      `Profil donné au personnage : niveau ${p.level} (${p.levelMeasured ? 'estimé sur tes bilans' : 'estimation de départ'}), ${remembered} souvenir${remembered > 1 ? 's' : ''}, fautes fréquentes : ${p.recentMistakes?.map((m) => m.type).join(', ') || 'aucune'}`,
    );
    return p;
  } catch (err) {
    log(`Profil non lu (${String(err)}) : niveau B1 par défaut, sans mémoire`);
    return DEFAULT_LEARNER;
  }
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
  dState.textContent = stateLabel(state, member.character.name);
  const live = state !== 'idle' && state !== 'error';
  startBtn.textContent = live ? 'Arrêter' : 'Démarrer';
  startBtn.classList.toggle('live', live);
  lipBtn.disabled = live;
  $('open-home').hidden = live || !(inScene || document.body.classList.contains('singing'));
  if (live && sessionStartedAt === null) {
    sessionStartedAt = performance.now();
    log('Conversation démarrée');
  }
  if (!live && sessionStartedAt !== null) {
    log(`Conversation arrêtée après ${formatDuration(performance.now() - sessionStartedAt)}`);
    sessionStartedAt = null;
    dMic.style.width = '0';
    director?.talkStopped(stageTime());
    director = null;
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
  const ds = stage.drawStats;
  dFps.textContent = stage.fps
    ? `${Math.round(stage.fps)} (${ds.calls} dessins, ${Math.round(ds.triangles / 1000)} k triangles)`
    : '—';
  canvas.dataset.draws = `${ds.calls}/${ds.triangles}`;
  canvas.dataset.fps = stage.fps.toFixed(1);
  const g = stage.activeGestures;
  dGesture.textContent = g.length ? g.join(', ') : '—';
  if (inScene && plan.mode !== 'free') {
    const live = talk && !talk.ended ? talk : null;
    const total = (plan.minutes ?? CHALLENGE_MINUTES) * 60_000;
    goals.tick(
      plan.mode === 'challenge' ? (live ? total - (Date.now() - live.startedAt) : total) : null,
      todayBaseMs + (live?.speakingMs ?? 0),
    );
  }
}, 500);

/** Plays every gesture once, to check them without a key. */
gestureBtn.addEventListener('click', () => {
  GESTURES.forEach((g, i) => setTimeout(() => stage.play(g), i * 2800));
  log(`Test des gestes : ${GESTURES.join(', ')}`);
});

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
    character: t.character.id,
    scene: t.scene,
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
    speakingMs: Math.round(t.speakingMs),
    ...(t.plan.mode !== 'free' ? { plan: t.plan } : {}),
  };
  // The challenge is played once; a mission stays chosen for another try.
  if (t.plan.mode === 'challenge') plan = FREE_PLAN;
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
  const who = castMember(s.character ?? 'jake').character;
  debriefStatus.textContent = 'Ton bilan arrive… (10 à 30 secondes)';
  debriefStatus.className = 'status busy';
  $('debrief-retry').hidden = true;
  try {
    const source = s.turns.find((x) => x.who === 'you')?.source ?? 'live';
    const facts = await listFacts().catch(() => [] as Fact[]);
    const others = (await listTalks().catch(() => [] as SavedTalk[])).filter((x) => x.id !== s.id);
    const level = buildLearnerProfile(
      others,
      [],
      who.id,
      Date.now(),
      loadSettings().startLevel,
    ).level;
    s.debrief = await analyzer().analyze(analysisTurns(s), {
      level,
      characterName: who.name,
      characterDescription: who.shortDescription,
      transcriptSource: source === 'live' ? 'Gemini Live' : SOURCE_LABEL[source],
      knownFacts: factsForAnalyzer(facts),
      plan: s.plan,
    });
    log(`Bilan prêt (${s.debrief.mistakes.length} fautes, modèle ${s.debrief.model})`);
    await persist(s);
    await remember(s, facts);
    if (current?.id === s.id) showDebrief(s);
    // After the debrief is on screen: the cards are not needed to read it.
    await updateCards(s);
    void autoSync();
  } catch (err) {
    const e = asProviderError(err, 'gemini');
    debriefStatus.textContent = `${e.french} Ta conversation est gardée : tu peux réessayer.`;
    debriefStatus.className = 'status error-text';
    $('debrief-retry').hidden = false;
    log(`Bilan impossible : ${e.detail}`);
  }
}

/** Grades the cards this talk reviewed, then adds its new mistakes and words. */
async function updateCards(s: SavedTalk): Promise<void> {
  if (!s.debrief) return;
  try {
    const now = Date.now();
    const graded = await applyTalk(s.id, s.debrief, now);
    const added = await addDrafts(
      draftsFromDebrief(s.debrief, s.id, s.character, now),
      await listCards(),
    );
    log(`Révisions : ${graded.length} carte(s) notée(s) par ce bilan, ${added} nouvelle(s)`);
  } catch (err) {
    log(`Cartes de révision non mises à jour : ${String(err)}`);
  }
}

/** Adds what the debrief learnt about the learner to the characters' memory. */
async function remember(s: SavedTalk, facts: Fact[]): Promise<void> {
  const d = s.debrief;
  if (!d || (!d.memory?.length && !d.talkMemoryFr)) return;
  try {
    const merged = mergeFacts(facts, d.memory ?? [], {
      now: Date.now(),
      talkId: s.id,
      character: (s.character ?? 'jake') as CastMember['id'],
      lastTalk: d.talkMemoryFr,
    });
    await saveFacts(merged);
    log(`Mémoire : ${d.memory?.length ?? 0} fait(s) proposé(s), ${merged.length} en tout`);
  } catch (err) {
    log(`Mémoire non enregistrée : ${String(err)}`);
  }
}

function showDebrief(s: SavedTalk): void {
  current = s;
  const who = castMember(s.character ?? 'jake');
  const when = new Date(s.startedAt).toLocaleString('fr-FR');
  $('debrief-meta').textContent =
    `avec ${who.character.name} · ${sceneInfo(s.scene ?? 'cafe').labelFr.toLowerCase()} · ${when} · ${formatDuration(s.durationMs)}`;
  debriefDialog.style.setProperty('--buddy', who.colour);
  debriefBody.replaceChildren();
  debriefStatus.textContent = '';
  debriefStatus.className = 'status';
  if (s.debrief) {
    renderDebrief(debriefBody, s.debrief, {
      characterName: who.character.name,
      known: s.why,
      missionTitle: missionById(s.plan?.missionId)?.titleFr,
      reviewSaid: Object.fromEntries(
        (s.plan?.reviews ?? []).map((r) => [r.cardId, { said: r.said, correct: r.correct }]),
      ),
      openMemory: () => void openMemory(),
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
        el('span', { class: 'who', text: x.who === 'you' ? 'Toi :' : `${who.character.name} :` }),
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
    $('home-debrief').hidden = false;
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
  .then((all) => {
    debriefBtn.hidden = all.length === 0;
    $('home-debrief').hidden = all.length === 0;
  })
  .catch(() => {
    /* IndexedDB unavailable (private window): the debrief still shows */
  });

// ------------------------------------------------------- memory + progress
const memoryDialog = $<HTMLDialogElement>('memory');
const progressDialog = $<HTMLDialogElement>('progress');
const memoryStatus = $('memory-status');
const characterName = (id: string) =>
  CAST.find((c) => c.id === id)?.character.name ?? 'un personnage';

async function openMemory(): Promise<void> {
  memoryStatus.textContent = '';
  try {
    const facts = await listFacts();
    renderMemory($('memory-body'), facts, {
      characterName,
      save: async (f) => {
        await putFact(f);
        memoryStatus.textContent =
          'Corrigé : les personnages s’en serviront dès la prochaine conversation.';
      },
      remove: async (id) => {
        await deleteFact(id);
        rememberDeleted([id]);
        memoryStatus.textContent = 'Effacé.';
      },
      add: async (category, text) => {
        const now = Date.now();
        await putFact({
          id: newFactId(now),
          category,
          text,
          createdAt: now,
          updatedAt: now,
          byLearner: true,
        });
        await openMemory();
        memoryStatus.textContent = 'Ajouté.';
      },
    });
  } catch (err) {
    memoryStatus.textContent =
      'La mémoire ne peut pas être lue dans ce navigateur (fenêtre privée ?).';
    log(`Mémoire illisible : ${String(err)}`);
  }
  if (!memoryDialog.open) {
    memoryDialog.showModal();
    // Start at the top: native dialogs focus their first button otherwise.
    $('memory-title').focus();
    memoryDialog.scrollTop = 0;
  }
}

async function openProgress(): Promise<void> {
  const talks = await listTalks().catch(() => [] as SavedTalk[]);
  const p = buildProgress(talks, Date.now());
  const pron = pronProgress(await listAttempts().catch(() => [] as PronAttempt[]), Date.now());
  $('progress-meta').textContent =
    `${p.totalTalks} conversation${p.totalTalks > 1 ? 's' : ''} gardée${p.totalTalks > 1 ? 's' : ''} dans ce navigateur`;
  renderProgress(
    $('progress-body'),
    p,
    pron,
    talks.map((t) => ({
      id: t.id,
      label: `${new Date(t.startedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · ${characterName(t.character ?? 'jake')} · ${sceneInfo(t.scene ?? 'cafe').labelFr.toLowerCase()} · ${formatDuration(t.durationMs)}`,
      mistakes: t.debrief ? t.debrief.mistakes.length : null,
    })),
    (id) => {
      const t = talks.find((x) => x.id === id);
      if (!t) return;
      progressDialog.close();
      showDebrief(t);
      if (!t.debrief) void runDebrief(t);
    },
  );
  const sungBox = singProgressSection(await listSingAttempts().catch(() => [] as SingAttempt[]));
  if (sungBox) {
    const body = $('progress-body');
    const after = body.querySelector('.pron-progress');
    if (after) after.after(sungBox);
    else body.append(sungBox);
  }
  if (!progressDialog.open) {
    progressDialog.showModal();
    // Start at the top: native dialogs focus their first button otherwise.
    $('progress-title').focus();
    progressDialog.scrollTop = 0;
  }
}

$('open-memory').addEventListener('click', () => void openMemory());
$('open-progress').addEventListener('click', () => void openProgress());
$('progress-memory').addEventListener('click', () => {
  progressDialog.close();
  void openMemory();
});
$('memory-close').addEventListener('click', () => memoryDialog.close());
$('progress-close').addEventListener('click', () => progressDialog.close());
$('memory-clear').addEventListener('click', () => {
  if (!confirm('Effacer tout ce que les personnages savent de toi ?')) return;
  void listFacts()
    .then((all) => rememberDeleted(all.map((f) => f.id)))
    .catch(() => {})
    .then(() => clearFacts())
    .then(
      () => openMemory().then(() => (memoryStatus.textContent = 'Tout est effacé.')),
      () => (memoryStatus.textContent = 'Effacement impossible.'),
    );
});

// ------------------------------------------------------- reviews + map
const reviewsDialog = $<HTMLDialogElement>('reviews');
const mapDialog = $<HTMLDialogElement>('map');

async function openReviews(): Promise<void> {
  const now = Date.now();
  const cards = await listCards().catch(() => [] as ReviewCard[]);
  const due = dueCards(cards, now);
  $('reviews-meta').textContent = due.length
    ? `${due.length} carte${due.length > 1 ? 's' : ''} à revoir aujourd’hui`
    : '';
  renderReviews(
    $('reviews-body'),
    due,
    { total: cards.filter((c) => !c.suspended).length, nextDueFr: nextDueFr(cards, now) },
    {
      grade: async (card, grade) => {
        const next = await gradeCard(card, grade, Date.now());
        Object.assign(card, next);
      },
      remove: async (card) => {
        card.suspended = true;
        await putCard(card);
      },
      done: (n) => {
        log(`Révisions à voix haute : ${n} carte(s)`);
        void listCards().then((all) => {
          $('reviews-body')
            .querySelector('.review-end .muted')
            ?.replaceChildren(
              `${all.filter((c) => !c.suspended).length} cartes en tout. Prochaine révision : ${nextDueFr(all, Date.now())}. Les cartes reviennent au bon moment pour ne pas les oublier (méthode FSRS).`,
            );
        });
        void renderToday();
      },
    },
  );
  if (!reviewsDialog.open) reviewsDialog.showModal();
}

async function openMap(): Promise<void> {
  const talks = await listTalks().catch(() => [] as SavedTalk[]);
  const overall = buildProgress(talks, Date.now()).level?.overall ?? null;
  const cells = unlockMap(missionRecords(talks), overall);
  const passed = cells.filter((c) => c.record?.passed).length;
  $('map-meta').textContent =
    `${passed} réussie${passed > 1 ? 's' : ''} sur ${cells.length}${overall !== null ? ` · niveau estimé ${overall}/100` : ''}`;
  renderMap($('map-body'), cells, plan.missionId, (m: Mission) => {
    plan = missionPlan(m);
    mapDialog.close();
    if (voice.state !== 'idle' && voice.state !== 'error') return;
    if (inScene) openHome();
    sceneId = m.scene;
    if (member.id !== m.host) member = castMember(m.host);
    choose();
    $('home-plan').scrollIntoView({ block: 'nearest' });
  });
  if (!mapDialog.open) {
    mapDialog.showModal();
    $('map-title').focus();
    mapDialog.scrollTop = 0;
  }
}

$('open-reviews').addEventListener('click', () => void openReviews());
$('reviews-close').addEventListener('click', () => reviewsDialog.close());
reviewsDialog.addEventListener('close', () => void renderToday());
$('open-map').addEventListener('click', () => void openMap());
$('map-close').addEventListener('click', () => mapDialog.close());
$('map-free').addEventListener('click', () => {
  plan = FREE_PLAN;
  mapDialog.close();
  renderHomePlan();
});

// ----------------------------------------------------------- pronunciation
const pronDialog = $<HTMLDialogElement>('pronunciation');
let pronScorerLabel = 'Gemini';

/** The browser's own English voice, as a model to imitate (absent in some browsers). */
function speakModel(text: string): void {
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voices = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
  const voice = voices.find((v) => /en-us/i.test(v.lang)) ?? voices[0];
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? 'en-US';
  u.rate = 0.85;
  synth.speak(u);
}

const pronView = new PronunciationView(
  $('pron-body'),
  $('pron-meta'),
  {
    record: (onLevel) => recordTake(loadSettings().micDeviceId, onLevel),
    score: async (e, wav) => {
      const scorer = makeScorer(loadSettings());
      if (!scorer) throw new Error('missing-key');
      // The take lives only in this call: it is not saved and is forgotten after scoring.
      const result = await scorer.score({ wav, reference: e.text });
      const now = Date.now();
      const attempt: PronAttempt = {
        id: `pron-${now}-${Math.random().toString(36).slice(2, 7)}`,
        at: now,
        sentence: e.text,
        source: e.source,
        result,
      };
      await saveAttempt(attempt);
      const cards = await listCards().catch(() => [] as ReviewCard[]);
      const updates = pronUpdates(cards, attempt, now);
      await applyUpdates(cards, updates, attempt.id, now);
      const added = await addDrafts(soundDrafts(attempt), cards);
      const check = scorer instanceof WhisperCheckedScorer ? scorer.lastCheck : '';
      log(
        `Prononciation (${scorerNameFr(result.scorer)}, ${result.model}) : ${result.overall}/100${result.unreliable ? ' (son peu fiable)' : ''}, ${added} carte(s) ajoutée(s), ${updates.length} révision(s)${check ? ` · ${check}` : ''}`,
      );
      return { result, added, graded: updates.length, check };
    },
    errorText: (err) => {
      log(`Prononciation, erreur : ${String((err as Error)?.message ?? err).slice(0, 200)}`);
      console.warn('pronunciation', err);
      if ((err as Error)?.message === 'missing-key')
        return 'Il faut une clé Gemini gratuite pour noter ta prononciation : ajoute-la dans « Réglages ».';
      if (err instanceof DOMException && err.name === 'NotAllowedError')
        return 'Le micro est refusé. Autorise-le dans la barre d’adresse du navigateur, puis réessaie.';
      if (err instanceof DOMException) return 'Le micro ne s’ouvre pas. Vérifie qu’il est branché.';
      const pe = asProviderError(err, 'gemini');
      return pe.french;
    },
    speak: 'speechSynthesis' in window ? speakModel : null,
    done: (n) => {
      if (n) log(`Prononciation : ${n} phrase(s) notée(s)`);
      void renderToday();
    },
  },
  () => pronScorerLabel,
);

async function openPronunciation(): Promise<void> {
  const now = Date.now();
  const s = loadSettings();
  const scorer = makeScorer(s);
  if (!scorer) {
    welcome.open('gemini');
    return;
  }
  pronScorerLabel = scorerNameFr(scorer.id);
  const [cards, attempts] = await Promise.all([
    listCards().catch(() => [] as ReviewCard[]),
    listAttempts().catch(() => [] as PronAttempt[]),
  ]);
  const items = buildExercises(cards, soundLevels(pronProgress(attempts, now)), now);
  pronView.start(items);
  if (!pronDialog.open) {
    pronDialog.showModal();
    $('pron-title').focus();
    pronDialog.scrollTop = 0;
  }
}
$('open-pron').addEventListener('click', () => void openPronunciation());
$('pron-close').addEventListener('click', () => pronDialog.close());
pronDialog.addEventListener('close', () => {
  pronView.stop();
  window.speechSynthesis?.cancel();
  void renderToday();
});

// ------------------------------------------------------------------ singing
const songsDialog = $<HTMLDialogElement>('songs');
const singResultDialog = $<HTMLDialogElement>('sing-result');
/** What was on stage before the karaoke (Maya and her street take over meanwhile). */
let beforeSing: { member: CastMember; sceneId: SceneId } | null = null;

const singErrorText = (err: unknown): string => {
  log(`Chant, erreur : ${String((err as Error)?.message ?? err).slice(0, 200)}`);
  console.warn('singing', err);
  if (err instanceof DOMException && err.name === 'NotAllowedError')
    return 'Le micro est refusé. Autorise-le dans la barre d’adresse du navigateur, puis réessaie.';
  if (err instanceof DOMException) return 'Le micro ne s’ouvre pas. Vérifie qu’il est branché.';
  return asProviderError(err, 'gemini').french;
};

const singView = new SingView(
  $('sing'),
  singResultDialog,
  $('sing-result-body'),
  {
    play: (song, t, mode) => {
      void player.resume();
      return playSong(player.ctx, player.analyser, song, t, { mode, lead: 0.25 });
    },
    clock: () => player.ctx.currentTime,
    record: (onLevel, maxMs) => {
      // Called from the click: the audio clock must run before the microphone answers.
      void player.resume();
      return recordTake(loadSettings().micDeviceId, onLevel, {
        // A song has rests: only the end of the song (or its length) ends the take.
        endSilenceMs: maxMs,
        noSpeechMs: maxMs,
        maxMs,
      });
    },
    score: async (song, mode, t, wav, takeStartSec) => {
      const s = loadSettings();
      const lines = t.lines.filter((_, i) => learnerLine(mode, i));
      // The take lives only in this call: cut in memory, sent once, never saved.
      const result = await scoreSinging({
        pcm: wav.subarray(44),
        rate: MIC_RATE,
        lines,
        takeStartSec,
        scorer: makeMainScorer(s),
        ...(s.groqKey.trim()
          ? { whisper: (part: Uint8Array) => whisperWords(part, s.groqKey) }
          : {}),
      });
      const now = Date.now();
      await saveSingAttempt({
        id: `sing-${now}-${Math.random().toString(36).slice(2, 7)}`,
        at: now,
        songId: song.id,
        title: song.title,
        mode,
        result,
      });
      log(
        `Chant « ${song.title} » (${SING_MODES.find((m) => m.id === mode)?.label ?? mode}) : ${result.overall}/100 — prononciation ${result.pron ?? 'non notée'}${result.scorer ? ` (${scorerNameFr(result.scorer)}, ${result.model})` : ''}, rythme ${result.rhythm} (${result.timing === 'voice+whisper' ? 'voix + horodatages Whisper' : 'voix seule'}), décalage constant retiré ${result.lagMs} ms${result.pronError ? ` · prononciation en erreur : ${result.pronError}` : ''}`,
      );
      return result;
    },
    errorText: singErrorText,
    beat: (beat) => stage.setDance(beat),
    cheer: (overall) => stage.play(overall >= 60 ? 'clap' : 'nod'),
    hasScorer: () => makeMainScorer(loadSettings()) !== null,
    chunkSec: MIC_CHUNK_MS / 1000,
  },
  { other: () => void openSongs(), quit: () => openHome() },
);

/** Maya takes the stage in her street; the choice of the home screen is kept for later. */
async function enterSing(song: Song): Promise<void> {
  if (voice.state !== 'idle' && voice.state !== 'error') return;
  if (songsDialog.open) songsDialog.close();
  const maya = castMember('maya');
  if (!beforeSing) beforeSing = { member, sceneId };
  inScene = false;
  homePanel.hidden = true;
  measures.hidden = false;
  controls.hidden = true;
  transcriptPanel.hidden = true;
  goals.hide();
  $('open-home').hidden = false;
  $('open-home').textContent = 'Retour à l’accueil';
  stage.setViewShift(0);
  document.body.classList.add('singing');
  singView.open(song);
  log(`Karaoké : « ${song.title} » avec Maya`);
  if (member !== maya || sceneId !== maya.homeScene || !characterReady) {
    member = maya;
    sceneId = maya.homeScene;
    stage.setScene(sceneId);
    applyCharacterLook();
    await showCharacter();
  }
}

function leaveSing(): void {
  if (!singView.active) return;
  singView.close();
  document.body.classList.remove('singing');
  $('open-home').textContent = 'Changer de scène';
  const back = beforeSing;
  beforeSing = null;
  if (back && (back.member !== member || back.sceneId !== sceneId)) {
    member = back.member;
    sceneId = back.sceneId;
    stage.setScene(sceneId);
    applyCharacterLook();
    void showCharacter();
  }
}

async function openSongs(notice = ''): Promise<void> {
  const now = Date.now();
  const [cards, own, attempts] = await Promise.all([
    listCards().catch(() => [] as ReviewCard[]),
    listOwnSongs().catch(() => [] as Song[]),
    listSingAttempts().catch(() => [] as SingAttempt[]),
  ]);
  const best = (id: string): number | null => {
    const mine = attempts.filter((a) => a.songId === id);
    return mine.length ? Math.max(...mine.map((a) => a.result.overall)) : null;
  };
  const rows = (songs: readonly Song[]): SongRow[] =>
    songs.map((song) => ({ song, best: best(song.id) }));
  const picked = pickLessons(cards, now);
  const lessons = picked.length ? picked : [...STARTER_LESSONS];
  $('songs-meta').textContent =
    `${SONGS.length} chansons · domaine public ou écrites pour la plateforme`;
  renderPicker(
    $('songs-body'),
    rows(own),
    rows(SONGS),
    lessons,
    picked.length === 0,
    {
      pick: (song) => void enterSing(song),
      compose: async () => {
        const s = loadSettings();
        const at = Date.now();
        const tune = tuneFor(at);
        let song: Song | null = null;
        let by: 'gemini' | 'local' = 'local';
        if (s.apiKey.trim()) {
          const models = [s.analysisModel, ...ANALYSIS_MODELS.map((m) => m.id)].filter(
            (m, i, all) => all.indexOf(m) === i,
          );
          try {
            song = await writeSong(s.apiKey, models, lessons, tune, s.startLevel, at);
            if (song) by = 'gemini';
            else log('Chanson : réponse de Gemini inutilisable, paroles assemblées ici');
          } catch (err) {
            log(
              `Chanson : Gemini indisponible (${String((err as Error)?.message ?? err).slice(0, 120)}), paroles assemblées ici`,
            );
          }
        }
        song ??= localSong(lessons, tune, at);
        const used = lessonsIn(song, lessons);
        // Only the lessons really present in the words are announced.
        song.uses = (used.length ? used : lessons.slice(0, 2)).map((l) => l.text);
        if (!used.length && by === 'gemini') song.uses = [];
        await saveOwnSong(song);
        log(
          `Chanson écrite (${by === 'gemini' ? 'Gemini' : 'sans IA'}) : « ${song.title} », ${used.length} point(s) repris sur ${lessons.length}`,
        );
        return { song, by, used };
      },
      remove: (song) => deleteOwnSong(song.id),
      errorText: singErrorText,
    },
    (text) => void openSongs(text),
    notice,
  );
  if (!songsDialog.open) {
    songsDialog.showModal();
    $('songs-title').focus();
    songsDialog.scrollTop = 0;
  }
}
$('open-songs').addEventListener('click', () => void openSongs());
$('songs-close').addEventListener('click', () => songsDialog.close());
$('sing-again').addEventListener('click', () => singView.again());
$('sing-result-other').addEventListener('click', () => {
  singResultDialog.close();
  void openSongs();
});
$('sing-result-close').addEventListener('click', () => singResultDialog.close());

/**
 * Talks debriefed before phase 4 have no cards yet: create them once, due
 * from the day after each talk (most are due at once).
 */
async function backfillCards(): Promise<void> {
  try {
    // Once only: after that, erased cards must stay erased.
    if (localStorage.getItem(CARDS_BACKFILLED)) return;
    const cards = await listCards();
    if (cards.length) {
      localStorage.setItem(CARDS_BACKFILLED, '1');
      return;
    }
    const talks = await listTalks();
    const drafts = talks
      .filter((t) => t.debrief)
      .sort((a, b) => a.startedAt - b.startedAt)
      .flatMap((t) => draftsFromDebrief(t.debrief!, t.id, t.character, t.startedAt));
    if (!drafts.length) return;
    const t0 = performance.now();
    const added = await addDrafts(drafts, []);
    localStorage.setItem(CARDS_BACKFILLED, '1');
    log(
      `Révisions : ${added} carte(s) créée(s) à partir de tes anciens bilans (${Math.round(performance.now() - t0)} ms)`,
    );
  } catch (err) {
    log(`Cartes de révision illisibles : ${String(err)}`);
  }
}

// ------------------------------------------------- optional account (cloud)
const pageUrl = () => `${location.origin}${location.pathname}`;
let cloud: CloudSync = makeCloud(pageUrl());
const cloudStatus = $('cloud-status');

async function renderCloud(): Promise<void> {
  const override = cloudConfig();
  $<HTMLInputElement>('cloud-url').value = override.url;
  $<HTMLInputElement>('cloud-key').value = override.key;
  $('cloud-signed-out').hidden = true;
  $('cloud-signed-in').hidden = true;
  if (!cloud.configured) {
    cloudStatus.textContent =
      'Les comptes ne sont pas encore activés : tout reste dans ce navigateur.';
    return;
  }
  try {
    const user = await cloud.currentUser();
    if (user) {
      cloudStatus.textContent = `Connecté : ${user.email}. Ta mémoire et le résumé de tes conversations (sans le texte complet) suivent ton compte.`;
      $('cloud-signed-in').hidden = false;
    } else {
      cloudStatus.textContent =
        'Facultatif : crée un compte pour retrouver tes progrès sur un autre ordinateur. Tu reçois un lien par e-mail, sans mot de passe.';
      $('cloud-signed-out').hidden = false;
    }
  } catch (err) {
    cloudStatus.textContent = `Le compte ne répond pas. Tout reste dans ce navigateur. Détail technique : ${String(err)}`;
  }
}

/** Reads online, merges with this browser, writes both. */
async function syncNow(): Promise<string> {
  const [facts, talks] = await Promise.all([listFacts(), listTalks()]);
  const merged = await syncOnce(cloud, { facts, talks });
  await saveFacts(merged.facts);
  const known = new Set(talks.map((t) => t.id));
  const added = merged.talks.filter((t) => !known.has(t.id));
  for (const t of added) await saveTalk(t);
  return `Synchronisé : ${merged.facts.length} souvenir(s), ${merged.talks.length} conversation(s) (${added.length} nouvelle(s) ici).`;
}

async function autoSync(): Promise<void> {
  if (!cloud.configured) return;
  try {
    if (!(await cloud.currentUser())) return;
    log(await syncNow());
  } catch (err) {
    log(`Synchronisation impossible (tout reste dans ce navigateur) : ${String(err)}`);
  }
}

$('cloud-link').addEventListener('click', () => {
  const email = $<HTMLInputElement>('cloud-email').value.trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    cloudStatus.textContent = 'Écris une adresse e-mail valide.';
    return;
  }
  cloudStatus.textContent = 'Envoi du lien…';
  cloud.sendMagicLink(email).then(
    () =>
      (cloudStatus.textContent = `Lien envoyé à ${email}. Ouvre-le sur cet ordinateur : tu reviendras ici, connecté.`),
    (err: unknown) =>
      (cloudStatus.textContent = `Le lien n’a pas pu être envoyé. Réessaie dans une minute. Détail technique : ${String(err)}`),
  );
});
$('cloud-sync').addEventListener('click', () => {
  cloudStatus.textContent = 'Synchronisation…';
  syncNow().then(
    (text) => (cloudStatus.textContent = text),
    (err: unknown) =>
      (cloudStatus.textContent = `Synchronisation impossible. Tout reste dans ce navigateur. Détail technique : ${String(err)}`),
  );
});
$('cloud-signout').addEventListener('click', () => {
  void cloud.signOut().finally(() => void renderCloud());
});
$('cloud-save').addEventListener('click', () => {
  const url = $<HTMLInputElement>('cloud-url').value;
  const key = $<HTMLInputElement>('cloud-key').value;
  if (url.trim() && !isProjectUrl(url)) {
    cloudStatus.textContent = 'Adresse inattendue : elle ressemble à https://xxxx.supabase.co.';
    return;
  }
  saveCloudConfig({ url, key });
  cloud = makeCloud(pageUrl());
  void renderCloud();
});
// Back from the sign-in link: supabase-js reads the session from the URL.
if (cloud.configured) void autoSync();

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
  canvas.dataset.gestures = stage.activeGestures.join(' ');
  canvas.dataset.walking = String(stage.walking);
  canvas.dataset.dancing = String(stage.dancing);
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
voiceSelect.add(new Option('Celle du personnage (recommandé)', ''));
for (const v of VOICES) voiceSelect.add(new Option(v, v));
for (const x of PAUSES) pauseSelect.add(new Option(x.label, String(x.ms)));
for (const x of TRANSCRIPT_SOURCES) sourceSelect.add(new Option(x.label, x.id));
for (const m of ANALYSIS_MODELS) analysisSelect.add(new Option(m.label, m.id));
const micSelect = $<HTMLSelectElement>('mic-device');
const levelSelect = $<HTMLSelectElement>('start-level');
const azureInput = $<HTMLInputElement>('azure-key');
const azureRegion = $<HTMLSelectElement>('azure-region');
for (const r of AZURE_REGIONS) azureRegion.add(new Option(r, r));
for (const l of LEVEL_CHOICES) levelSelect.add(new Option(`${l.title} (${l.id})`, l.id));

/** Microphones of this computer; the saved one stays selected even if unplugged. */
async function fillMicSelect(saved: string): Promise<void> {
  const mics = await listMicrophones().catch(() => [] as MediaDeviceInfo[]);
  micSelect.replaceChildren(new Option('Micro par défaut de l’ordinateur', ''));
  mics
    .filter((d) => d.deviceId && d.deviceId !== 'default')
    .forEach((d, k) => micSelect.add(new Option(d.label || `Micro ${k + 1}`, d.deviceId)));
  if (saved && ![...micSelect.options].some((o) => o.value === saved)) {
    micSelect.add(new Option('Micro choisi (débranché ?)', saved));
  }
  micSelect.value = saved;
}

function keyStatusText(s: Settings): string {
  const gemini = s.apiKey
    ? `Clé Gemini enregistrée dans ce navigateur : ${maskKey(s.apiKey)}`
    : 'Aucune clé Gemini enregistrée pour l’instant.';
  const groq = s.groqKey ? ` Clé Groq : ${maskKey(s.groqKey)}.` : ' Pas de clé Groq.';
  const azure = s.azureKey ? ` Clé Azure : ${maskKey(s.azureKey)} (${s.azureRegion}).` : '';
  return gemini + groq + azure;
}

function openSettings(): void {
  settings = loadSettings();
  keyInput.value = settings.apiKey;
  groqInput.value = settings.groqKey;
  azureInput.value = settings.azureKey;
  azureRegion.value = settings.azureRegion;
  modelSelect.value = settings.model;
  voiceSelect.value = settings.voiceOverride;
  pauseSelect.value = String(settings.pauseMs);
  sourceSelect.value = settings.transcriptSource;
  analysisSelect.value = settings.analysisModel;
  showTranscriptBox.checked = settings.showTranscript;
  levelSelect.value = settings.startLevel;
  void fillMicSelect(settings.micDeviceId);
  keyStatus.textContent = keyStatusText(settings);
  $('data-status').textContent = '';
  void renderMyData();
  void renderCloud();
  settingsDialog.returnValue = '';
  settingsDialog.showModal();
}
$('open-settings').addEventListener('click', openSettings);
$('open-welcome').addEventListener('click', () => {
  settingsDialog.close();
  welcome.open();
});

// --------------------------------------------------------------- documents
/** Reads a PDF in this browser; returns the document or a French error. */
async function docFromPdf(data: ArrayBuffer, name: string, kind: StudyDoc['kind']) {
  const { extractPdf, PdfError } = await import('./documents/pdf');
  try {
    const pdf = await extractPdf(data);
    const text = cleanPdfText(pdf.pages);
    return makeDoc(
      guessTitle(pdf.title, text, name),
      kind,
      name,
      text,
      pdf.pages.length,
      Date.now(),
    );
  } catch (err) {
    log(`PDF illisible : ${String(err)}`);
    if (err instanceof PdfError && err.kind === 'password') {
      return 'Ce PDF est protégé par un mot de passe : enregistre-le sans protection, puis réessaie.';
    }
    return 'Ce fichier n’est pas un PDF lisible. Vérifie qu’il s’ouvre bien sur ton ordinateur.';
  }
}

const MAX_PDF_BYTES = 40 * 1024 * 1024;

const documents = new DocumentsView(
  $<HTMLDialogElement>('documents'),
  $('documents-body'),
  $('documents-meta'),
  $('documents-actions'),
  {
    list: listDocs,
    save: putDoc,
    remove: deleteDoc,
    importPdf: async (file) => {
      if (file.size > MAX_PDF_BYTES) return 'Ce PDF est trop lourd (plus de 40 Mo).';
      return docFromPdf(await file.arrayBuffer(), file.name, 'pdf');
    },
    importLink: async (raw) => {
      const url = parseLink(raw);
      if (!url) return 'Cette adresse n’est pas valide. Elle doit commencer par https://';
      const r = await fetchLink(url);
      if (r.kind === 'error') {
        log(`Lien refusé (${url.hostname}) : ${r.detail}`);
        return r.french;
      }
      if (r.kind === 'pdf') return docFromPdf(r.data, r.name, 'web');
      const text = r.text.trim();
      if (!text) return 'Aucun texte trouvé sur cette page.';
      return makeDoc(r.title, 'web', url.href, text, 0, Date.now());
    },
    hardWords: async (passage) => {
      const s = loadSettings();
      const profile = await learnerProfile(member.id);
      try {
        return await findHardWords(
          s.apiKey,
          [
            s.analysisModel,
            ...ANALYSIS_MODELS.map((m) => m.id).filter((m) => m !== s.analysisModel),
          ],
          passage,
          profile.level,
        );
      } catch (err) {
        const e = asProviderError(err, 'gemini');
        log(`Mots difficiles : ${e.detail}`);
        throw new Error(e.french, { cause: err });
      }
    },
    hasKey: () => Boolean(loadSettings().apiKey),
    knownWords: async () =>
      new Set((await listCards()).filter((c) => !c.suspended).map((c) => c.id)),
    wordId: (english) => cardId('word', english),
    addWord: async (w: HardWord, doc: StudyDoc) => {
      const cards = await listCards().catch(() => [] as ReviewCard[]);
      const added = await addDrafts(
        [
          {
            id: cardId('word', w.english),
            kind: 'word',
            front: w.french,
            back: w.english,
            note: w.example,
            talkId: `doc:${doc.id}`,
            createdAt: Date.now(),
          },
        ],
        cards,
      );
      log(
        added
          ? `Mot ajouté aux révisions : ${w.english}`
          : `Déjà dans les révisions : ${w.english}`,
      );
      void renderToday();
      return added > 0;
    },
    characterName: () => member.character.name,
    study: (doc, passage) => {
      if (voice.state !== 'idle' && voice.state !== 'error') return;
      plan = documentPlan({
        docId: doc.id,
        title: doc.title,
        passage,
        total: doc.passages.length,
        text: doc.passages[passage],
        words: doc.hardWords?.[passage] ?? [],
      });
      log(`Étude du document « ${doc.title} », passage ${passage + 1}`);
      if (inScene) openHome();
      renderHomePlan();
      enterScene();
    },
    askKey: () => welcome.open('gemini'),
    log,
  },
);
$('open-documents').addEventListener('click', () => void documents.open());

// ----------------------------------------------------------------- welcome
const welcome = new WelcomeView($<HTMLDialogElement>('welcome'), {
  picture: (id) => picture('people', id),
  pick: (c) => {
    if (voice.state !== 'idle' && voice.state !== 'error') return;
    if (inScene) openHome();
    if (member.id === c.id) return;
    member = c;
    choose();
  },
  finish: () => {
    saveWelcome({ done: true, at: Date.now() });
    settings = loadSettings();
    log(`Accueil terminé : niveau de départ ${settings.startLevel}, ${member.character.name}`);
    if (!inScene) $('enter').focus();
  },
  log,
});
// ---------------------------------------------------- my data (settings)
const dataHandlers: DataHandlers = {
  counts: countGroups,
  clear: async (id) => {
    if (id === 'facts') {
      // The optional account must learn that these facts were erased.
      await listFacts()
        .then((all) => rememberDeleted(all.map((f) => f.id)))
        .catch(() => {});
    }
    await clearGroup(id);
    if (id === 'cards') localStorage.setItem(CARDS_BACKFILLED, '1');
    if (id === 'talks') {
      debriefBtn.hidden = true;
      $('home-debrief').hidden = true;
      current = null;
    }
    log(`Données effacées de ce navigateur : ${id}`);
    void renderToday();
  },
  keyCount: () => {
    const s = loadSettings();
    return [s.apiKey, s.groqKey, s.azureKey].filter(Boolean).length;
  },
  forgetKeys: () => {
    saveSettings({ ...loadSettings(), apiKey: '', groqKey: '', azureKey: '' });
    keyInput.value = '';
    groqInput.value = '';
    azureInput.value = '';
    settings = loadSettings();
    keyStatus.textContent = keyStatusText(settings);
  },
  wipe: async () => {
    await cloud.signOut().catch(() => {});
    await wipeEverything();
    location.reload();
  },
  confirm: (q) => confirm(q),
};
const renderMyData = () => renderData($('data-list'), $('data-status'), dataHandlers);
settingsDialog.addEventListener('close', () => {
  if (settingsDialog.returnValue !== 'save') return;
  saveSettings({
    ...loadSettings(),
    apiKey: keyInput.value,
    groqKey: groqInput.value,
    azureKey: azureInput.value,
    azureRegion: azureRegion.value || DEFAULTS.azureRegion,
    model: modelSelect.value || DEFAULTS.model,
    voiceOverride: voiceSelect.value,
    pauseMs: Number(pauseSelect.value) || DEFAULTS.pauseMs,
    transcriptSource: (sourceSelect.value || DEFAULTS.transcriptSource) as TranscriptSource,
    analysisModel: analysisSelect.value || DEFAULTS.analysisModel,
    showTranscript: showTranscriptBox.checked,
    micDeviceId: micSelect.value,
    startLevel: (LEVELS as readonly string[]).includes(levelSelect.value)
      ? (levelSelect.value as Level)
      : DEFAULTS.startLevel,
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
    'English Buddy — rapport de test phase 5',
    `Date : ${new Date().toLocaleString('fr-FR')}`,
    `Conversation lancée avec : ${sessionLabel}`,
    `État : ${dState.textContent}`,
    `Délai médian : ${dMedian.textContent} ${dCount.textContent}`,
    `Dernier délai : ${dLast.textContent}`,
    `Le personnage a parlé pendant que tu parlais encore : ${latency.overlaps} fois`,
    `Images par seconde : ${stage.fps.toFixed(0)} ; écran ${window.innerWidth}×${window.innerHeight} × ${window.devicePixelRatio}`,
    `Durée affichée : ${dDuration.textContent}`,
    `Tours : ${learner.length} de toi, ${turns.filter((x) => x.who === 'buddy').length} du personnage ; interruptions du personnage : ${turns.filter((x) => x.interrupted).length}`,
    `Transcription : ${talk ? SOURCE_LABEL[talk.source] : '—'} ; échecs du 2ᵉ reconnaisseur : ${talk?.transcribeErrors ?? 0}`,
    `Bilan : ${current?.debrief ? `${current.debrief.mistakes.length} fautes, modèle ${current.debrief.model}` : 'aucun'}`,
    `Profil donné : niveau ${talk?.profile.level ?? '—'}${talk?.profile.levelMeasured ? ' (estimé)' : ` (départ choisi : ${loadSettings().startLevel})`}, mémoire ${talk?.profile.memory ? 'oui' : 'vide'} ; temps de parole mesuré : ${talk ? formatDuration(talk.speakingMs) : '—'}`,
    `Plan : ${talk ? `${talk.plan.mode}${talk.plan.missionId ? ` (${talk.plan.missionId})` : ''}${talk.plan.document ? ` (document de ${talk.plan.document.text.split(/\s+/).length} mots, passage ${talk.plan.document.passage + 1}/${talk.plan.document.total}, ${talk.plan.document.words.length} mots difficiles)` : ''}, ${talk.plan.reviews.length} faute(s) à reprendre, ${talk.plan.expressions.length} expression(s), ${goals.placedCount} placée(s) d’après le texte` : '—'}`,
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

// Test hook (Playwright and manual checks): the stage, to trigger gestures.
(window as unknown as { __stage: Stage }).__stage = stage;

// ------------------------------------------------------------------- start
stage.setScene(sceneId);
applyCharacterLook();
renderHome();
measures.hidden = true;
stage.setViewShift(homeShift());
void showCharacter();
void renderToday();
if (shouldOpenWelcome(loadWelcome(), settings.apiKey)) welcome.open();
void backfillCards().then(() => renderToday());
// The other characters download in the background once the first is shown.
setTimeout(() => CAST.forEach((c) => stage.preload(modelUrl(c))), 4000);
