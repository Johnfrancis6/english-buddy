import { CAST, type CastMember } from '../cast';
import {
  checkGeminiKey,
  checkGroqKey,
  LEVEL_CHOICES,
  looksLikeHeadset,
  micLabel,
  STEP_TITLES,
  WELCOME_STEPS,
  type WelcomeStep,
} from '../onboarding/welcome';
import { listMicrophones, testMicrophone } from '../onboarding/micTest';
import { loadSettings, maskKey, saveSettings, type Settings } from '../settings';
import { el } from './dom';

export interface WelcomeDeps {
  /** Picture of a character card. */
  picture: (id: string) => string;
  /** The character chosen at the last step (the page updates the 3D preview). */
  pick: (c: CastMember) => void;
  /** The welcome was finished ("Commencer"). */
  finish: () => void;
  log: (text: string) => void;
}

const AISTUDIO_KEYS = 'https://aistudio.google.com/apikey';
const GROQ_KEYS = 'https://console.groq.com/keys';

const link = (href: string, text: string) =>
  el('a', { href, target: '_blank', rel: 'noreferrer', text });

/** An ordered list of exact clicks. */
const steps = (...items: (string | Node)[][]) =>
  el('ol', { class: 'welcome-steps' }, ...items.map((parts) => el('li', {}, ...parts)));

/**
 * The welcome dialog: one short step at a time. Every step can be passed; the
 * key and the choices are saved as soon as they are made (in this browser only).
 */
export class WelcomeView {
  private step: WelcomeStep = 'hello';
  private testing = false;

  constructor(
    private readonly dialog: HTMLDialogElement,
    private readonly deps: WelcomeDeps,
  ) {
    dialog.addEventListener('close', () => (this.testing = false));
  }

  open(step: WelcomeStep = 'hello'): void {
    this.step = step;
    this.render();
    if (!this.dialog.open) this.dialog.showModal();
    this.dialog.querySelector<HTMLElement>('h2')?.focus();
  }

  private get index(): number {
    return WELCOME_STEPS.indexOf(this.step);
  }

  private go(delta: number): void {
    const next = WELCOME_STEPS[this.index + delta];
    if (!next) return;
    this.step = next;
    this.render();
    this.dialog.querySelector<HTMLElement>('h2')?.focus();
    this.dialog.scrollTop = 0;
  }

  private save(patch: Partial<Settings>): Settings {
    const s = { ...loadSettings(), ...patch };
    saveSettings(s);
    return s;
  }

  private render(): void {
    const i = this.index;
    const n = WELCOME_STEPS.length;
    const dots = el(
      'ol',
      { class: 'welcome-dots', 'aria-hidden': 'true' },
      ...WELCOME_STEPS.map((s, k) =>
        el('li', { class: k < i ? 'done' : k === i ? 'current' : '', 'data-step': s }),
      ),
    );
    const title = el('h2', { id: 'welcome-title', tabindex: '-1', text: STEP_TITLES[this.step] });
    const head = el(
      'div',
      { class: 'dialog-head' },
      title,
      el('span', { class: 'chip', text: `Étape ${i + 1} sur ${n}` }),
    );
    const body = el('div', { class: 'welcome-body' }, ...this.body());
    const back = el('button', { class: 'btn', type: 'button', text: 'Retour' });
    back.addEventListener('click', () => this.go(-1));
    back.hidden = i === 0;
    const later = el('button', { class: 'link', type: 'button', text: 'Plus tard' });
    later.addEventListener('click', () => {
      this.deps.log('Accueil fermé avant la fin (il reste dans les réglages)');
      this.dialog.close();
    });
    const actions = el('div', { class: 'row' }, this.primary(), back, later);
    this.dialog.dataset.step = this.step;
    this.dialog.replaceChildren(dots, head, body, actions);
  }

  /** The main button of each step. */
  private primary(): HTMLButtonElement {
    const last = this.step === 'character';
    const label =
      this.step === 'hello'
        ? 'C’est parti'
        : this.step === 'groq' && !loadSettings().groqKey
          ? 'Passer cette étape'
          : last
            ? `Commencer avec ${this.chosen().character.name}`
            : 'Suivant';
    const b = el('button', {
      class: 'btn primary',
      type: 'button',
      id: 'welcome-next',
      text: label,
    });
    b.addEventListener('click', () => {
      if (this.step === 'gemini') this.keepKey('gemini-input', 'apiKey');
      if (this.step === 'groq') this.keepKey('groq-input', 'groqKey');
      if (last) {
        this.deps.finish();
        this.dialog.close();
      } else this.go(1);
    });
    return b;
  }

  /** Saves what is in a key field (an empty field keeps the saved key). */
  private keepKey(inputId: string, field: 'apiKey' | 'groqKey'): void {
    const v = this.dialog.querySelector<HTMLInputElement>(`#${inputId}`)?.value.trim() ?? '';
    if (v) this.save({ [field]: v });
  }

  private chosen(): CastMember {
    const id = loadSettings().character;
    return CAST.find((c) => c.id === id) ?? CAST[0];
  }

  private body(): Node[] {
    switch (this.step) {
      case 'hello':
        return this.hello();
      case 'gemini':
        return this.gemini();
      case 'groq':
        return this.groq();
      case 'mic':
        return this.mic();
      case 'level':
        return this.level();
      case 'character':
        return this.character();
    }
  }

  private hello(): Node[] {
    return [
      el(
        'p',
        { class: 'lead' },
        'Ici, tu parles anglais à voix haute avec des personnages en 3D. Ils te répondent tout de suite, comme un ami ou un collègue.',
      ),
      el(
        'ul',
        { class: 'welcome-list' },
        el('li', {
          text: 'Quand tu fais une faute, le personnage redit ta phrase correctement, sans faire de cours.',
        }),
        el('li', {
          text: 'À la fin, tu reçois un bilan en français : ce qui va bien, tes fautes et pourquoi.',
        }),
        el('li', {
          text: 'Tes fautes et tes mots reviennent en révisions au bon moment. Tu peux aussi étudier un document PDF avec un personnage.',
        }),
      ),
      el(
        'div',
        { class: 'note privacy', role: 'note' },
        el('strong', { text: '🔒 Ta vie privée' }),
        el(
          'ul',
          {},
          el('li', {
            text: 'Tes clés restent dans ce navigateur. Elles ne vont qu’à Google (et à Groq si tu en mets une), jamais à English Buddy.',
          }),
          el('li', {
            text: 'Ta voix n’est jamais enregistrée : elle part en direct vers Google pour la conversation, puis elle est oubliée.',
          }),
          el('li', {
            text: 'Seul le texte de tes conversations est gardé, sur cet ordinateur. Tu peux tout effacer dans les réglages.',
          }),
        ),
      ),
      el('p', { class: 'muted small', text: 'Il faut environ 5 minutes. Tout est gratuit.' }),
    ];
  }

  private keyField(
    id: string,
    label: string,
    placeholder: string,
    saved: string,
    check: (key: string) => Promise<{ ok: boolean; french: string }>,
    who: string,
  ): Node[] {
    const input = el('input', {
      id,
      type: 'password',
      autocomplete: 'off',
      spellcheck: 'false',
      placeholder,
    });
    const status = el('p', { id: `${id}-status`, class: 'small', 'aria-live': 'polite' });
    if (saved)
      status.textContent = `Clé déjà enregistrée dans ce navigateur : ${maskKey(saved)}. Colle une autre clé pour la remplacer.`;
    const btn = el('button', {
      class: 'btn small',
      type: 'button',
      id: `${id}-check`,
      text: 'Vérifier ma clé',
    });
    btn.addEventListener('click', () => {
      const key = input.value.trim() || saved;
      status.className = 'small status busy';
      status.textContent = `Je demande à ${who}…`;
      btn.disabled = true;
      void check(key).then((r) => {
        btn.disabled = false;
        status.className = r.ok ? 'small ok-text' : 'small error-text';
        status.textContent = r.french;
        if (r.ok && input.value.trim()) {
          this.save(id === 'gemini-input' ? { apiKey: key } : { groqKey: key });
          this.deps.log(`Clé ${who} vérifiée et enregistrée`);
          input.value = '';
          status.textContent = `${r.french} Enregistrée : ${maskKey(key)}.`;
          // The primary label of the Groq step changes once a key exists.
          this.dialog.querySelector('#welcome-next')?.replaceWith(this.primary());
        }
      });
    });
    return [
      el('label', { for: id, text: label }),
      input,
      el('div', { class: 'row tight' }, btn),
      status,
    ];
  }

  private gemini(): Node[] {
    const s = loadSettings();
    return [
      el(
        'p',
        {},
        'Les personnages parlent grâce à Gemini, de Google. Il te faut ta propre clé : c’est gratuit, sans carte bancaire.',
      ),
      steps(
        ['Ouvre ', link(AISTUDIO_KEYS, 'aistudio.google.com/apikey'), ' (nouvel onglet).'],
        ['Connecte-toi avec ton compte Google (Gmail).'],
        [
          'La première fois, accepte les conditions d’utilisation : Google crée tout seul un projet et une clé.',
        ],
        [
          'Sur la page des clés, copie ta clé avec le bouton de copie. S’il n’y en a pas, clique sur « ',
          el('strong', { text: 'Create API key' }),
          ' ».',
        ],
        ['Reviens ici, colle-la dans la case, puis clique sur « Vérifier ma clé ».'],
      ),
      ...this.keyField(
        'gemini-input',
        'Ta clé Gemini',
        'Colle ta clé ici',
        s.apiKey,
        (k) => checkGeminiKey(k),
        'Google',
      ),
      el(
        'p',
        { class: 'muted small' },
        'Gratuit, mais limité : Google fixe un nombre de minutes par jour. Avec la formule gratuite, Google peut utiliser tes conversations pour améliorer ses produits. Ne donne jamais ta clé à quelqu’un d’autre.',
      ),
    ];
  }

  private groq(): Node[] {
    const s = loadSettings();
    return [
      el(
        'p',
        {},
        'Facultatif. Groq écrit tes phrases avec un autre outil (Whisper), qui garde parfois mieux tes fautes. Sans clé Groq, tout marche.',
      ),
      steps(
        ['Ouvre ', link(GROQ_KEYS, 'console.groq.com/keys'), '.'],
        [
          'Clique sur « ',
          el('strong', { text: 'Log In' }),
          ' » et connecte-toi (Google ou e-mail). La formule gratuite ne demande pas de carte.',
        ],
        [
          'Clique sur « ',
          el('strong', { text: 'Create API Key' }),
          ' », donne-lui un nom (par exemple « english buddy »), puis valide.',
        ],
        [
          'Copie la clé tout de suite (elle commence par gsk_ ; Groq ne la montre qu’une fois), colle-la ici et vérifie-la.',
        ],
      ),
      ...this.keyField(
        'groq-input',
        'Ta clé Groq (facultative)',
        'gsk_…',
        s.groqKey,
        (k) => checkGroqKey(k),
        'Groq',
      ),
      el(
        'p',
        { class: 'muted small' },
        'Avec Groq, le son de chaque phrase part chez Groq pour être écrit, puis il est oublié. Tu choisis qui écrit tes phrases dans les réglages.',
      ),
    ];
  }

  private mic(): Node[] {
    const select = el('select', { id: 'welcome-mic' });
    const status = el('p', { id: 'welcome-mic-status', class: 'small', 'aria-live': 'polite' });
    const meter = el('span', { id: 'welcome-mic-level' });
    const advice = el('p', { class: 'small muted', id: 'welcome-mic-advice' });
    const fill = async () => {
      const mics = await listMicrophones().catch(() => [] as MediaDeviceInfo[]);
      const saved = loadSettings().micDeviceId;
      select.replaceChildren(
        el('option', { value: '', text: 'Micro par défaut de l’ordinateur' }),
        ...mics
          .filter((d) => d.deviceId && d.deviceId !== 'default')
          .map((d, k) => el('option', { value: d.deviceId, text: micLabel(d, k) })),
      );
      select.value = [...select.options].some((o) => o.value === saved) ? saved : '';
      const named = mics.some((d) => d.label);
      advice.textContent = !named
        ? 'Les noms des micros apparaissent après le premier test (le navigateur te demande la permission).'
        : mics.some((d) => looksLikeHeadset(d.label))
          ? 'Un casque est branché : choisis-le pour que le personnage ne s’entende pas lui-même.'
          : 'Aucun casque reconnu dans la liste. Avec des haut-parleurs, baisse le volume.';
    };
    void fill();
    select.addEventListener('change', () => {
      this.save({ micDeviceId: select.value });
      this.deps.log(`Micro choisi : ${select.selectedOptions[0]?.text ?? 'par défaut'}`);
    });
    const btn = el('button', {
      class: 'btn small',
      type: 'button',
      id: 'welcome-mic-test',
      text: 'Tester mon micro',
    });
    btn.addEventListener('click', () => {
      if (this.testing) return;
      this.testing = true;
      btn.disabled = true;
      status.className = 'small status busy';
      status.textContent =
        'Parle maintenant : dis par exemple « Hello, my name is… ». Rien n’est enregistré.';
      testMicrophone(select.value, (rms) => {
        meter.style.width = `${Math.min(100, Math.round(rms * 500))}%`;
        meter.classList.toggle('voiced', rms > 0.02);
      }).then(
        async (r) => {
          this.testing = false;
          btn.disabled = false;
          status.className = r.heard ? 'small ok-text' : 'small error-text';
          status.textContent = r.heard
            ? `On t’entend bien ✓ (${r.label || 'micro par défaut'})`
            : 'Je n’ai presque rien entendu. Rapproche le micro, vérifie qu’il n’est pas coupé, ou choisis-en un autre.';
          this.deps.log(
            `Test du micro : ${r.heard ? 'voix entendue' : 'rien entendu'} (niveau max ${r.peak.toFixed(3)})`,
          );
          await fill();
        },
        (err: unknown) => {
          this.testing = false;
          btn.disabled = false;
          status.className = 'small error-text';
          const name = err instanceof DOMException ? err.name : '';
          status.textContent =
            name === 'NotAllowedError'
              ? 'Le navigateur bloque le micro. Clique sur le cadenas à gauche de l’adresse, autorise le micro, puis réessaie.'
              : name === 'NotFoundError'
                ? 'Aucun micro trouvé. Branche ton casque, puis réessaie.'
                : 'Le micro n’a pas pu s’ouvrir. Ferme les autres applications qui l’utilisent, puis réessaie.';
        },
      );
    });
    return [
      el(
        'p',
        {},
        'Le mieux : un casque avec micro. Sinon, le personnage peut s’entendre lui-même dans les haut-parleurs.',
      ),
      el('label', { for: 'welcome-mic', text: 'Ton micro' }),
      select,
      advice,
      el(
        'div',
        { class: 'row tight' },
        btn,
        el('span', { class: 'meter', 'aria-hidden': 'true' }, meter),
      ),
      status,
    ];
  }

  private level(): Node[] {
    const current = loadSettings().startLevel;
    const cards = LEVEL_CHOICES.map((l) => {
      const b = el(
        'button',
        {
          class: 'card level',
          type: 'button',
          'data-id': l.id,
          'aria-pressed': String(l.id === current),
        },
        el('strong', { text: l.title }),
        el('span', { class: 'small muted', text: l.line }),
        el('span', { class: 'chip', text: `niveau ${l.id}` }),
      );
      b.addEventListener('click', () => {
        this.save({ startLevel: l.id });
        for (const x of this.dialog.querySelectorAll<HTMLButtonElement>('.card.level')) {
          x.setAttribute('aria-pressed', String(x.dataset.id === l.id));
        }
      });
      return b;
    });
    return [
      el(
        'p',
        {},
        'Choisis ce qui te ressemble le plus. Les personnages adaptent leur vitesse et leurs mots. Après quelques bilans, ton niveau est estimé à partir de tes conversations.',
      ),
      el('div', { class: 'cards levels', role: 'group', 'aria-label': 'Niveaux' }, ...cards),
    ];
  }

  private character(): Node[] {
    const current = this.chosen();
    const cards = CAST.map((c) => {
      const img = el('img', { src: this.deps.picture(c.id), alt: '', loading: 'lazy' });
      img.addEventListener('error', () => img.remove(), { once: true });
      const b = el(
        'button',
        {
          class: 'card',
          type: 'button',
          'data-id': c.id,
          'aria-pressed': String(c.id === current.id),
        },
        img,
        el('strong', { text: c.character.name }),
        el('span', { class: 'small muted', text: `${c.ageFr} · ${c.accentFr}` }),
        el('span', { class: 'small muted', text: c.roleFr }),
      );
      b.addEventListener('click', () => {
        this.deps.pick(c);
        for (const x of this.dialog.querySelectorAll<HTMLButtonElement>('.welcome-body .card')) {
          x.setAttribute('aria-pressed', String(x.dataset.id === c.id));
        }
        about.textContent = `${c.character.name} : ${c.blurbFr}`;
        this.dialog.querySelector('#welcome-next')?.replaceWith(this.primary());
      });
      return b;
    });
    const about = el('p', {
      class: 'small',
      'aria-live': 'polite',
      text: `${current.character.name} : ${current.blurbFr}`,
    });
    return [
      el(
        'p',
        {},
        'Avec qui veux-tu parler en premier ? Tu pourras changer à chaque fois sur l’écran d’accueil.',
      ),
      el('div', { class: 'cards people', role: 'group', 'aria-label': 'Personnages' }, ...cards),
      about,
    ];
  }
}
