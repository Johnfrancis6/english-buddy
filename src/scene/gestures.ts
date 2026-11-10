/**
 * Hand-written, procedural body language for VRM characters: idle, walk,
 * wave, nod, laugh, think, fist bump. No animation file, so no licence
 * question (docs/DECISIONS.md, 2026-11-10). Everything here is pure maths on
 * normalized humanoid bones, so it is unit-tested without WebGL.
 *
 * Axis conventions, measured on the normalized VRM rig with screenshots
 * (2026-11-10), character facing the camera:
 * - right upper arm: z < 0 lowers it, z > 0 raises it, y > 0 brings it
 *   forward; the left arm mirrors z and y;
 * - with the arm hanging, x < 0 swings it forward (both arms);
 * - lower arms: y bends the elbow forward (right +, left -), z bends it in
 *   the frontal plane (right +, left -);
 * - upper legs: x > 0 forward; lower legs: x > 0 bends the knee;
 * - spine, neck, head: x > 0 leans or looks down.
 */
export type Euler3 = readonly [number, number, number];
export type Bone =
  | 'hips'
  | 'spine'
  | 'chest'
  | 'neck'
  | 'head'
  | 'leftUpperArm'
  | 'rightUpperArm'
  | 'leftLowerArm'
  | 'rightLowerArm'
  | 'leftHand'
  | 'rightHand'
  | 'leftUpperLeg'
  | 'rightUpperLeg'
  | 'leftLowerLeg'
  | 'rightLowerLeg'
  | 'leftFoot'
  | 'rightFoot'
  | 'rightThumbProximal'
  | 'rightIndexProximal'
  | 'rightMiddleProximal'
  | 'rightRingProximal'
  | 'rightLittleProximal'
  | 'rightIndexIntermediate'
  | 'rightMiddleIntermediate'
  | 'rightRingIntermediate'
  | 'rightLittleIntermediate';
export type Pose = Partial<Record<Bone, Euler3>>;
export type ExpressionWeights = Partial<Record<'happy' | 'relaxed' | 'surprised' | 'aa', number>>;

export type GestureName = 'wave' | 'nod' | 'laugh' | 'think' | 'fistBump' | 'clap';
export const GESTURES: readonly GestureName[] = [
  'wave',
  'nod',
  'laugh',
  'think',
  'fistBump',
  'clap',
];

/** One frame of a gesture. */
export interface GestureFrame {
  /** 0..1: how much the gesture takes over from the idle pose. */
  weight: number;
  /** Absolute rotations, blended over the idle pose by `weight`. */
  abs: Pose;
  /** Offsets added on top (already scaled by the weight). */
  add: Pose;
  expressions: ExpressionWeights;
  /** Gaze offset in metres around the camera (think: look up and aside). */
  gaze: readonly [number, number];
}

export interface GestureSpec {
  duration: number;
  /** Seconds to blend in and out. */
  fadeIn: number;
  fadeOut: number;
  /** Additive gestures (nod) can run over a body gesture. */
  additive: boolean;
  frame(t: number, amp: number): Omit<GestureFrame, 'weight'>;
}

export const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** 0 → 1 → 0 over the gesture, with smooth ends. */
export function envelope(t: number, duration: number, fadeIn: number, fadeOut: number): number {
  if (t <= 0 || t >= duration) return 0;
  return smoothstep(0, fadeIn, t) * (1 - smoothstep(duration - fadeOut, duration, t));
}

const NONE: Pick<GestureFrame, 'abs' | 'add' | 'expressions' | 'gaze'> = {
  abs: {},
  add: {},
  expressions: {},
  gaze: [0, 0],
};

/** Right hand closed into a loose fist. */
const FIST: Pose = {
  rightThumbProximal: [0, -0.5, 0.3],
  rightIndexProximal: [0, 0, 1.3],
  rightMiddleProximal: [0, 0, 1.4],
  rightRingProximal: [0, 0, 1.4],
  rightLittleProximal: [0, 0, 1.4],
  rightIndexIntermediate: [0, 0, 1.4],
  rightMiddleIntermediate: [0, 0, 1.4],
  rightRingIntermediate: [0, 0, 1.4],
  rightLittleIntermediate: [0, 0, 1.4],
};

export const SPECS: Record<GestureName, GestureSpec> = {
  // Right hand up beside the head, forearm swinging three times.
  wave: {
    duration: 2.4,
    fadeIn: 0.45,
    fadeOut: 0.5,
    additive: false,
    frame: (t, amp) => {
      const swing = Math.sin(t * 2 * Math.PI * 1.6) * 0.28 * amp * smoothstep(0.35, 0.6, t);
      return {
        ...NONE,
        abs: {
          rightUpperArm: [0, 0.3, -0.45 + 0.05 * amp],
          rightLowerArm: [0, 0.1, 1.55 + swing],
          rightHand: [0, 0, swing * 0.4],
        },
        add: { head: [0, 0, -0.04 * amp], spine: [0, 0, -0.02 * amp] },
        expressions: { happy: 0.45 * amp },
      };
    },
  },
  // Two soft nods: "I'm listening".
  nod: {
    duration: 1.3,
    fadeIn: 0.15,
    fadeOut: 0.3,
    additive: true,
    frame: (t, amp) => {
      const n = Math.max(0, Math.sin(t * 2 * Math.PI * 1.5));
      return {
        ...NONE,
        add: { head: [0.13 * n * amp, 0, 0], neck: [0.05 * n * amp, 0, 0] },
      };
    },
  },
  // Head back, shoulders bouncing, a big smile.
  laugh: {
    duration: 2.0,
    fadeIn: 0.2,
    fadeOut: 0.5,
    additive: false,
    frame: (t, amp) => {
      const bounce = Math.abs(Math.sin(t * 2 * Math.PI * 3)) * smoothstep(0.1, 0.3, t);
      return {
        ...NONE,
        add: {
          head: [-0.12 * amp + 0.05 * bounce * amp, 0, 0.05 * amp],
          chest: [-0.05 * amp + 0.04 * bounce * amp, 0, 0],
          spine: [0.02 * bounce * amp, 0, 0],
          leftUpperArm: [0, 0, -0.06 * bounce * amp],
          rightUpperArm: [0, 0, 0.06 * bounce * amp],
        },
        expressions: { happy: 0.9 * amp, aa: 0.25 * amp * (0.5 + 0.5 * bounce) },
      };
    },
  },
  // Hand to the chin, head tilted, eyes up and aside.
  think: {
    duration: 2.6,
    fadeIn: 0.5,
    fadeOut: 0.6,
    additive: false,
    frame: (_t, amp) => ({
      abs: {
        rightUpperArm: [0, 0.75, -0.95],
        rightLowerArm: [0, 2.5, 0],
        rightHand: [0, 0, -0.35],
        ...FIST,
      },
      add: { head: [-0.06 * amp, 0.06 * amp, 0.1 * amp], neck: [0, 0.03 * amp, 0] },
      expressions: { relaxed: 0.1 },
      gaze: [0.35 * amp, 0.3 * amp],
    }),
  },
  // Fist held out towards the learner (the camera), a little push, smile.
  fistBump: {
    duration: 2.0,
    fadeIn: 0.4,
    fadeOut: 0.5,
    additive: false,
    frame: (t, amp) => {
      const push = smoothstep(0.55, 0.8, t) * (1 - smoothstep(0.85, 1.2, t));
      return {
        ...NONE,
        abs: {
          rightUpperArm: [0, 1.25 + 0.1 * push, -0.4],
          rightLowerArm: [0, 0.35 - 0.25 * push * amp, 0],
          rightHand: [0, 0, 0],
          ...FIST,
        },
        add: { spine: [0.04 * push * amp, 0, 0], head: [0, 0, -0.03 * amp] },
        expressions: { happy: 0.6 * amp },
      };
    },
  },
  // Both hands in front of the chest, four small claps, a smile (end of a song).
  clap: {
    duration: 2.2,
    fadeIn: 0.35,
    fadeOut: 0.45,
    additive: false,
    frame: (t, amp) => {
      const beat = Math.max(0, Math.sin(t * 2 * Math.PI * 2.2)) * smoothstep(0.3, 0.5, t);
      const open = 0.22 * (1 - beat) * amp;
      return {
        ...NONE,
        abs: {
          rightUpperArm: [0, 0.55, -1.05],
          rightLowerArm: [0, 1.75 - open, 0],
          rightHand: [0, 0.2, 0],
          leftUpperArm: [0, -0.55, 1.05],
          leftLowerArm: [0, -1.75 + open, 0],
          leftHand: [0, -0.2, 0],
        },
        add: { head: [0.03 * beat * amp, 0, 0], chest: [0.01 * beat * amp, 0, 0] },
        expressions: { happy: 0.7 * amp },
      };
    },
  },
};

/** Gesture frame at time t (seconds since it started); weight 0 when over. */
export function sampleGesture(name: GestureName, t: number, amp = 1, gain = 1): GestureFrame {
  const spec = SPECS[name];
  const weight = envelope(t, spec.duration, spec.fadeIn, spec.fadeOut) * gain;
  if (weight === 0) return { weight, ...NONE };
  const f = spec.frame(t, amp);
  const add: Pose = {};
  for (const [bone, e] of Object.entries(f.add) as [Bone, Euler3][]) {
    add[bone] = [e[0] * weight, e[1] * weight, e[2] * weight];
  }
  const expressions: ExpressionWeights = {};
  for (const [k, v] of Object.entries(f.expressions) as [keyof ExpressionWeights, number][]) {
    expressions[k] = v * weight;
  }
  return {
    weight,
    abs: f.abs,
    add,
    expressions,
    gaze: [f.gaze[0] * weight, f.gaze[1] * weight],
  };
}

/** Standing pose: arms relaxed, breathing, slow sway; head bobs with the voice. */
export function idlePose(t: number, talk: number): Pose {
  const breath = Math.sin(t * 1.5);
  const sway = Math.sin(t * 0.55);
  return {
    leftUpperArm: [0.05, 0, 1.3 + breath * 0.012],
    rightUpperArm: [0.05, 0, -1.3 - breath * 0.012],
    leftLowerArm: [0, -0.3, 0],
    rightLowerArm: [0, 0.3, 0],
    leftHand: [0, 0, 0.1],
    rightHand: [0, 0, -0.1],
    hips: [0, Math.sin(t * 0.31) * 0.03, sway * 0.012],
    spine: [breath * 0.008, 0, -sway * 0.012],
    chest: [breath * 0.014, 0, 0],
    neck: [0, Math.sin(t * 0.43 + 1) * 0.03, 0],
    head: [
      Math.sin(t * 0.7) * 0.015 + Math.sin(t * 6.5) * 0.02 * talk,
      0,
      Math.sin(t * 0.37) * 0.02 + Math.sin(t * 2.3) * 0.015 * talk,
    ],
  };
}

/**
 * Walk cycle at a given stride phase (radians), as offsets for legs, arms,
 * hips. `w` fades it in and out. Returns the vertical hip bob in metres too.
 */
export function walkPose(phase: number, w: number): { pose: Pose; bob: number } {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const knee = (x: number) => Math.max(0, x) * 0.9 + 0.08;
  return {
    pose: {
      leftUpperLeg: [0.42 * s * w, 0, 0],
      rightUpperLeg: [-0.42 * s * w, 0, 0],
      leftLowerLeg: [knee(-c) * w, 0, 0],
      rightLowerLeg: [knee(c) * w, 0, 0],
      leftFoot: [-0.15 * s * w, 0, 0],
      rightFoot: [0.15 * s * w, 0, 0],
      leftUpperArm: [0.3 * s * w, 0, 0],
      rightUpperArm: [-0.3 * s * w, 0, 0],
      leftLowerArm: [0, -0.25 * w, 0],
      rightLowerArm: [0, 0.25 * w, 0],
      spine: [0.03 * w, 0.06 * s * w, 0],
      hips: [0, -0.05 * s * w, 0],
    },
    bob: Math.abs(Math.cos(phase)) * 0.025 * w,
  };
}

/**
 * Keeping the beat while a song plays (phase 7): a sober sway, forearms up
 * and bouncing lightly, the head marking each beat. `beat` counts the beats
 * of the song; `w` fades it in and out. Offsets to add over the idle pose,
 * and a small vertical bounce in metres.
 */
export function dancePose(beat: number, w: number): { pose: Pose; bob: number } {
  const side = Math.sin(beat * Math.PI); // one sway per two beats
  const pulse = Math.cos(beat * 2 * Math.PI) * 0.5 + 0.5; // 1 on the beat
  return {
    pose: {
      hips: [0, 0.06 * side * w, 0.035 * side * w],
      spine: [0, -0.03 * side * w, -0.03 * side * w],
      chest: [0.01 * pulse * w, 0, -0.02 * side * w],
      neck: [0, 0, 0.02 * side * w],
      head: [0.05 * pulse * w, 0, 0.03 * side * w],
      leftUpperArm: [0, 0, (-0.22 - 0.04 * side) * w],
      rightUpperArm: [0, 0, (0.22 - 0.04 * side) * w],
      leftLowerArm: [0, (-0.75 - 0.18 * pulse) * w, 0],
      rightLowerArm: [0, (0.75 + 0.18 * pulse) * w, 0],
      leftUpperLeg: [0, 0, 0.02 * side * w],
      rightUpperLeg: [0, 0, 0.02 * side * w],
    },
    bob: -0.012 * pulse * w,
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Blends absolute targets over a base pose, then adds offsets. */
export function composePose(base: Pose, layers: readonly GestureFrame[], extra: Pose[] = []): Pose {
  const out: Record<string, [number, number, number]> = {};
  for (const [bone, e] of Object.entries(base) as [Bone, Euler3][]) out[bone] = [e[0], e[1], e[2]];
  for (const layer of layers) {
    for (const [bone, e] of Object.entries(layer.abs) as [Bone, Euler3][]) {
      const cur = out[bone] ?? [0, 0, 0];
      out[bone] = [
        lerp(cur[0], e[0], layer.weight),
        lerp(cur[1], e[1], layer.weight),
        lerp(cur[2], e[2], layer.weight),
      ];
    }
  }
  for (const add of [...layers.map((l) => l.add), ...extra]) {
    for (const [bone, e] of Object.entries(add) as [Bone, Euler3][]) {
      const cur = out[bone] ?? [0, 0, 0];
      out[bone] = [cur[0] + e[0], cur[1] + e[1], cur[2] + e[2]];
    }
  }
  return out as Pose;
}

interface Running {
  name: GestureName;
  start: number;
  /** Set when cut short by a newer body gesture. */
  stopAt: number | null;
}

/**
 * Plays gestures over time. One body gesture at a time (a new one cuts the
 * previous with a short cross-fade); additive ones (nod) stack on top.
 */
export class GesturePlayer {
  private running: Running[] = [];
  /** 0.5 with prefers-reduced-motion: same gestures, smaller. */
  amp = 1;

  play(name: GestureName, now: number): void {
    if (!SPECS[name].additive) {
      for (const r of this.running) {
        if (!SPECS[r.name].additive && r.stopAt === null) r.stopAt = now;
      }
    } else {
      // The same additive gesture is not stacked twice.
      this.running = this.running.filter((r) => r.name !== name);
    }
    this.running.push({ name, start: now, stopAt: null });
  }

  /** Is a body gesture (not a nod) still playing? */
  busy(now: number): boolean {
    return this.running.some(
      (r) => !SPECS[r.name].additive && r.stopAt === null && now < r.start + SPECS[r.name].duration,
    );
  }

  frames(now: number): GestureFrame[] {
    const CUT = 0.3;
    this.running = this.running.filter((r) => {
      const end = r.stopAt === null ? r.start + SPECS[r.name].duration : r.stopAt + CUT;
      return now < end;
    });
    return this.running.map((r) => {
      const gain = r.stopAt === null ? 1 : 1 - smoothstep(r.stopAt, r.stopAt + CUT, now);
      return sampleGesture(r.name, now - r.start, this.amp, gain);
    });
  }

  get active(): GestureName[] {
    return this.running.map((r) => r.name);
  }
}
