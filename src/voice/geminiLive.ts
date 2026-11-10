import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from '@google/genai';
import { Mic, MIC_CHUNK_MS, MIC_RATE, PcmPlayer } from './audio';
import { classify, friendly, friendlyFromClose, friendlyFromUnknown } from './errors';
import { LatencyTracker } from './latency';
import { base64ToBytes, bytesToBase64, sampleRateFromMime } from './pcm';
import type { VoiceEvents, VoiceSession, VoiceState } from './types';

export interface GeminiLiveOptions {
  apiKey: string;
  model: string;
  voice: string;
  /** Silence, in ms, after which the server decides the learner has finished. */
  pauseMs: number;
  /** Character prompt (persona + teaching policy). */
  systemPrompt: string;
  /** Sent as text right after connecting so the character speaks first. */
  greeting: string | null;
}

const OUTPUT_RATE = 24_000;
const MAX_AUTO_RECONNECTS = 2;
/**
 * Tried in order until the WebSocket handshake succeeds. Measured on
 * 2026-11-09: the SDK default ("v1") answers 404 on the Live endpoint, while
 * "v1beta" accepts the handshake (see docs/DECISIONS.md).
 */
const API_VERSIONS = ['v1beta', 'v1', 'v1alpha'] as const;

/**
 * Real-time conversation through the Gemini Live API (WebSocket), with the
 * user's own key. API shape checked on 2026-11-09 against
 * https://aistudio.google.com/docs/live-api (see docs/DECISIONS.md).
 */
export class GeminiLiveSession implements VoiceSession {
  private _state: VoiceState = 'idle';
  private readonly mic = new Mic();
  private session: Session | null = null;
  /** Identifies the current connection; callbacks of older ones are ignored. */
  private connId = 0;
  private stopping = false;
  private inModelTurn = false;
  private resumeHandle: string | null = null;
  private autoReconnects = 0;
  private opts: GeminiLiveOptions | null = null;
  private apiVersion: string = API_VERSIONS[0];
  /** Tell the transcriber the talk is in English; dropped if Google refuses it. */
  private languageHint = true;

  constructor(
    private readonly player: PcmPlayer,
    private readonly latency: LatencyTracker,
    private readonly events: VoiceEvents,
  ) {
    this.player.onDrained = () => {
      if (!this.inModelTurn && this._state === 'speaking') this.setState('listening');
    };
  }

  get state(): VoiceState {
    return this._state;
  }
  get outputAnalyser(): AnalyserNode {
    return this.player.analyser;
  }

  configure(opts: GeminiLiveOptions): void {
    this.opts = opts;
  }

  private setState(s: VoiceState): void {
    if (this._state === s) return;
    this._state = s;
    this.events.onState(s);
  }

  async start(): Promise<void> {
    if (this._state !== 'idle' && this._state !== 'error') return;
    if (!this.opts?.apiKey.trim()) {
      this.fail(friendly('missing-key'));
      return;
    }
    this.stopping = false;
    this.autoReconnects = 0;
    this.resumeHandle = null;
    this.languageHint = true;
    this.latency.reset();
    this.setState('connecting');
    try {
      await this.player.resume();
      await this.mic.start((pcm, rms) => this.onMicChunk(pcm, rms));
      await this.connectFirst();
    } catch (err) {
      if (this.stopping) return;
      await this.teardown();
      this.fail(friendlyFromUnknown(err));
    }
  }

  /** First connection: finds an API version whose handshake is accepted. */
  private async connectFirst(): Promise<void> {
    let lastError: unknown;
    for (const version of API_VERSIONS) {
      if (this.stopping) return;
      this.apiVersion = version;
      try {
        await this.connect(true);
        this.events.onInfo(`Connecté à Google (API ${version})`);
        return;
      } catch (err) {
        lastError = err;
        const message = String((err as Error)?.message);
        // Only a refused handshake is worth another version.
        if (/connection failed|websocket error/i.test(message)) continue;
        const kind = classify(message);
        if (this.languageHint && kind !== 'bad-key' && kind !== 'quota') {
          // The setup was refused for another reason: retry once without the
          // optional language hint before giving up.
          this.languageHint = false;
          try {
            await this.connect(true);
            this.events.onInfo(`Connecté à Google (API ${version}, sans indice de langue)`);
            return;
          } catch (retryErr) {
            lastError = retryErr;
          }
        }
        break;
      }
    }
    throw lastError;
  }

  async stop(): Promise<void> {
    this.stopping = true;
    await this.teardown();
    this.setState('idle');
  }

  private fail(error: ReturnType<typeof friendly>): void {
    this.setState('error');
    this.events.onError(error);
  }

  private async teardown(): Promise<void> {
    this.connId++;
    const s = this.session;
    this.session = null;
    this.inModelTurn = false;
    this.player.flush();
    try {
      s?.close();
    } catch {
      /* already closed */
    }
    await this.mic.stop();
  }

  private async connect(greet: boolean): Promise<void> {
    const opts = this.opts!;
    const id = ++this.connId;
    const ai = new GoogleGenAI({
      apiKey: opts.apiKey.trim(),
      httpOptions: { apiVersion: this.apiVersion },
    });
    const session = await ai.live.connect({
      model: opts.model,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: opts.systemPrompt,
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: opts.voice } } },
        // The transcript comes from a separate recogniser, not from what the
        // voice model understood. Without a hint it guesses the language, and
        // a French accent can push it towards French spellings.
        inputAudioTranscription: this.languageHint ? { languageCodes: ['en-US'] } : {},
        outputAudioTranscription: this.languageHint ? { languageCodes: ['en-US'] } : {},
        // Server-side voice activity detection. The learner chooses how much
        // silence ends their turn (docs recommend 500–800 ms, default ≈ 800 ms).
        realtimeInputConfig: {
          automaticActivityDetection: { silenceDurationMs: opts.pauseMs },
        },
        // Lets a talk run past the 15-minute audio session limit.
        contextWindowCompression: { slidingWindow: {} },
        // Lets us survive the ~10-minute connection lifetime.
        sessionResumption: this.resumeHandle ? { handle: this.resumeHandle } : {},
      },
      callbacks: {
        onmessage: (m) => id === this.connId && this.onMessage(m),
        onerror: (e) =>
          id === this.connId && this.events.onInfo(`Erreur réseau : ${e.message ?? ''}`),
        onclose: (e) => id === this.connId && void this.onClose(e.code, e.reason),
      },
    });
    if (id !== this.connId) {
      // Stopped or replaced while connecting.
      session.close();
      return;
    }
    const previous = this.session;
    this.session = session;
    try {
      previous?.close();
    } catch {
      /* already closed */
    }
    if (greet && opts.greeting) {
      try {
        session.sendRealtimeInput({ text: opts.greeting });
      } catch {
        /* the greeting is optional */
      }
    }
    if (!this.player.playing) this.setState('listening');
  }

  private onMicChunk(pcm: Uint8Array, rms: number): void {
    const voiced = this.latency.onMicFrame(performance.now(), rms, MIC_CHUNK_MS);
    this.events.onMicLevel(rms, voiced);
    this.events.onMicAudio?.(pcm, voiced);
    const s = this.session;
    if (!s || this._state === 'connecting' || this._state === 'error') return;
    try {
      s.sendRealtimeInput({
        audio: { data: bytesToBase64(pcm), mimeType: `audio/pcm;rate=${MIC_RATE}` },
      });
    } catch {
      /* socket closing: onclose will report it */
    }
  }

  private onMessage(m: LiveServerMessage): void {
    if (m.sessionResumptionUpdate?.resumable && m.sessionResumptionUpdate.newHandle) {
      this.resumeHandle = m.sessionResumptionUpdate.newHandle;
    }
    if (m.goAway) {
      this.events.onInfo(
        `Google annonce la fin de la connexion (${m.goAway.timeLeft ?? '?'}) : reconnexion automatique.`,
      );
      void this.reconnect(false);
    }
    const sc = m.serverContent;
    if (!sc) return;
    // A healthy exchange resets the automatic reconnection budget.
    this.autoReconnects = 0;

    if (sc.interrupted) {
      this.player.flush();
      this.inModelTurn = false;
      this.events.onTurnComplete(true);
      this.setState('listening');
    }
    for (const part of sc.modelTurn?.parts ?? []) {
      const data = part.inlineData?.data;
      if (!data) continue;
      if (!this.inModelTurn) {
        this.inModelTurn = true;
        this.events.onModelTurnStart(this.latency.onModelAudioStart(performance.now()));
        this.setState('speaking');
      }
      this.player.enqueuePcm16(
        base64ToBytes(data),
        sampleRateFromMime(part.inlineData?.mimeType, OUTPUT_RATE),
      );
    }
    if (sc.inputTranscription?.text) this.events.onTranscript('you', sc.inputTranscription.text);
    if (sc.outputTranscription?.text) this.events.onTranscript('jake', sc.outputTranscription.text);
    if (sc.turnComplete) {
      this.inModelTurn = false;
      this.events.onTurnComplete(false);
      if (!this.player.playing && this._state === 'speaking') this.setState('listening');
    }
  }

  /** Opens a new connection, resuming the same conversation when possible. */
  private async reconnect(showState: boolean): Promise<void> {
    if (this.stopping) return;
    if (showState) this.setState('reconnecting');
    try {
      await this.connect(false);
    } catch (err) {
      if (this.stopping) return;
      await this.teardown();
      this.fail(friendlyFromUnknown(err));
    }
  }

  private async onClose(code: number, reason: string): Promise<void> {
    if (this.stopping) return;
    this.session = null;
    const error = friendlyFromClose(code, reason);
    // Only plain drops are retried: a bad key or a quota refusal would just
    // fail again.
    if (
      error.kind === 'dropped' &&
      this._state !== 'connecting' &&
      this.autoReconnects < MAX_AUTO_RECONNECTS
    ) {
      this.autoReconnects++;
      this.events.onInfo(`Connexion coupée (${error.detail}) : nouvelle tentative…`);
      this.player.flush();
      this.inModelTurn = false;
      await this.reconnect(true);
      return;
    }
    await this.teardown();
    this.fail(error);
  }
}
