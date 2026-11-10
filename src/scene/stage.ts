import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { Blinker } from './blink';
import { buildSet, type BuiltSet } from './sets';
import {
  composePose,
  dancePose,
  GesturePlayer,
  idlePose,
  smoothstep,
  walkPose,
  type Bone,
  type Euler3,
  type GestureName,
  type Pose,
} from './gestures';
import { SILENT, VISEME_NAMES, type VisemeWeights } from '../lipsync/visemes';
import type { SceneId } from '../teaching/persona';

/** Where the walk-in starts (metres to the side) and how long it takes. */
const WALK_FROM = 1.9;
const WALK_SECONDS = 2.6;

/**
 * The 3D stage: one scene and one VRM character, camera at the character's
 * eye level. The character looks at the camera, blinks, breathes, can walk
 * to their spot and play gestures; the mouth is driven from outside through
 * `setVisemes`.
 */
export class Stage {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(26, 1, 0.1, 40);
  private readonly timer = new THREE.Timer();
  private readonly blinker = new Blinker();
  private readonly hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1.6);
  private readonly key = new THREE.DirectionalLight(0xffffff, 1.7);
  private readonly shadow: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  /** Moves and turns the character (the VRM scene itself is turned by rotateVRM0). */
  private readonly root = new THREE.Group();
  private readonly gazeTarget = new THREE.Object3D();
  private readonly loader = new GLTFLoader();
  private readonly cache = new Map<string, Promise<VRM>>();
  private set: BuiltSet | null = null;
  private vrm: VRM | null = null;
  private visemes: VisemeWeights = { ...SILENT };
  private talkLevel = 0;
  private t = 0;
  private eyeY = 1.4;
  /** Walk-in: start time on the stage clock, or null when standing. */
  private walkStart: number | null = null;
  private readonly gestures = new GesturePlayer();
  /** Beat of the song being played (phase 7), or null: the character keeps the beat. */
  private danceBeat: number | null = null;
  private lastDanceBeat = 0;
  private danceWeight = 0;
  private reducedMotion = false;
  private viewShift = 0;
  private viewShiftTarget = 0;
  private fpsFrames = 0;
  private fpsSince = 0;
  /** Frames rendered since the character appeared (used by the smoke test). */
  frames = 0;
  /** Frames per second over the last full second (0 until measured). */
  fps = 0;
  /** Draw calls and triangles of the last frame (cost of the scene). */
  get drawStats(): { calls: number; triangles: number } {
    const r = this.renderer.info.render;
    return { calls: r.calls, triangles: r.triangles };
  }
  /** Called once a walk-in is over and the character faces the learner. */
  onArrived: (() => void) | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.loader.register((parser) => new VRMLoaderPlugin(parser));

    this.scene.add(this.hemi);
    this.key.position.set(1.2, 2.4, 2.0);
    this.scene.add(this.key);
    // A soft blob under the feet instead of real-time shadows.
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.4, 40),
      new THREE.MeshBasicMaterial({ color: 0x5b4630, transparent: true, opacity: 0.22 }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.006;
    this.root.add(this.shadow);
    this.scene.add(this.root);
    this.scene.add(this.camera);
    this.camera.add(this.gazeTarget);

    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.reducedMotion = Boolean(motion?.matches);
    this.gestures.amp = this.reducedMotion ? 0.5 : 1;

    this.setScene('cafe');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.renderer.setAnimationLoop(() => this.tick());
  }

  private resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.frameCamera();
  }

  setScene(id: SceneId): void {
    const next = buildSet(id);
    if (this.set === next) return;
    if (this.set) this.scene.remove(this.set.group);
    this.set = next;
    this.scene.add(next.group);
    const look = next.look;
    this.scene.background = new THREE.Color(look.background);
    this.scene.fog = new THREE.Fog(look.background, look.fog[0], look.fog[1]);
    this.hemi.color.setHex(look.hemi[0]);
    this.hemi.groundColor.setHex(look.hemi[1]);
    this.hemi.intensity = look.hemi[2];
    this.key.color.setHex(look.key[0]);
    this.key.intensity = look.key[1];
    this.shadow.material.color.setHex(look.shadow);
  }

  private load(url: string, onProgress?: (ratio: number) => void): Promise<VRM> {
    let p = this.cache.get(url);
    if (!p) {
      p = this.loader
        .loadAsync(url, (e) => {
          if (e.total > 0) onProgress?.(e.loaded / e.total);
        })
        .then((gltf) => {
          const vrm = gltf.userData.vrm as VRM | undefined;
          if (!vrm) throw new Error('This file is not a VRM model');
          VRMUtils.removeUnnecessaryVertices(gltf.scene);
          VRMUtils.combineSkeletons(gltf.scene);
          VRMUtils.rotateVRM0(vrm); // VRM 0.x models face the other way
          vrm.scene.traverse((o) => (o.frustumCulled = false));
          return vrm;
        });
      p.catch(() => this.cache.delete(url));
      this.cache.set(url, p);
    }
    return p;
  }

  /** Starts downloading a character without showing it. */
  preload(url: string): void {
    void this.load(url).catch(() => {
      /* shown when really needed */
    });
  }

  /**
   * Shows a character (downloaded once, then cached). With `walkIn`, they
   * walk in from the side and `onArrived` fires when they face the learner.
   */
  async loadCharacter(
    url: string,
    onProgress?: (ratio: number) => void,
    opts: { walkIn?: boolean } = {},
  ): Promise<void> {
    const vrm = await this.load(url, onProgress);
    if (this.vrm !== vrm) {
      if (this.vrm) this.root.remove(this.vrm.scene);
      this.root.add(vrm.scene);
      this.vrm = vrm;
      // Rest pose for measuring the head height.
      vrm.humanoid.resetNormalizedPose();
      vrm.update(0);
      vrm.scene.updateMatrixWorld(true);
      const head = vrm.humanoid.getNormalizedBoneNode('head');
      this.eyeY = head ? head.getWorldPosition(new THREE.Vector3()).y + 0.06 : 1.4;
      if (vrm.lookAt) vrm.lookAt.target = this.gazeTarget;
      this.frameCamera();
    }
    this.frames = 0;
    if (opts.walkIn) this.walkIn();
    else this.standAtMark();
  }

  get hasCharacter(): boolean {
    return this.vrm !== null;
  }

  /** Framing from the knees up, at the character's eye level. */
  private frameCamera(): void {
    const narrow = this.camera.aspect < 1;
    const dist = narrow ? 4.2 : 3.1;
    this.camera.position.set(0, this.eyeY + 0.02, dist);
    this.camera.lookAt(0, this.eyeY - 0.42, 0);
  }

  /**
   * Moves the character sideways on screen (fraction of the width, > 0 to
   * the right) so a panel on the left does not hide them.
   */
  setViewShift(fraction: number): void {
    this.viewShiftTarget = fraction;
  }

  private applyViewShift(dt: number): void {
    const k = this.reducedMotion ? 1 : Math.min(1, dt * 4);
    this.viewShift += (this.viewShiftTarget - this.viewShift) * k;
    const size = this.renderer.getSize(new THREE.Vector2());
    if (Math.abs(this.viewShift) < 0.001) this.camera.clearViewOffset();
    else this.camera.setViewOffset(size.x, size.y, -this.viewShift * size.x, 0, size.x, size.y);
  }

  /** Walks in from the side (or appears in place with reduced motion). */
  walkIn(): void {
    if (this.reducedMotion || !this.vrm) {
      this.standAtMark();
      this.onArrived?.();
      return;
    }
    this.walkStart = this.t;
    this.root.position.set(WALK_FROM, 0, 0);
    this.root.rotation.y = -Math.PI / 2;
  }

  private standAtMark(): void {
    this.walkStart = null;
    this.root.position.set(0, 0, 0);
    this.root.rotation.y = 0;
  }

  get walking(): boolean {
    return this.walkStart !== null;
  }

  play(g: GestureName): void {
    this.gestures.play(g, this.t);
  }

  /** Gestures on screen now (for tests and the report). */
  get activeGestures(): GestureName[] {
    return this.gestures.active;
  }

  /** Keeps the beat of a song: pass the current beat each frame, null to stop. */
  setDance(beat: number | null): void {
    this.danceBeat = beat;
  }

  /** Is the character keeping the beat? (for tests and the report) */
  get dancing(): boolean {
    return this.danceWeight > 0.5;
  }

  /** Mouth shapes for this frame (already smoothed by the caller). */
  setVisemes(v: VisemeWeights): void {
    this.visemes = v;
    this.talkLevel = Math.min(1, v.aa + v.ih + v.ou + v.ee + v.oh);
  }

  private tick(): void {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.1);
    this.t += dt;
    const vrm = this.vrm;
    if (vrm) {
      this.animate(vrm, dt);
      vrm.update(dt);
      this.frames++;
    }
    this.applyViewShift(dt);
    this.renderer.render(this.scene, this.camera);
    this.countFps();
  }

  private countFps(): void {
    const now = performance.now();
    if (this.fpsSince === 0) this.fpsSince = now;
    this.fpsFrames++;
    if (now - this.fpsSince >= 1000) {
      this.fps = (this.fpsFrames * 1000) / (now - this.fpsSince);
      this.fpsFrames = 0;
      this.fpsSince = now;
    }
  }

  private animate(vrm: VRM, dt: number): void {
    const t = this.t;
    const extra: Pose[] = [];
    let bob = 0;

    // Walk-in: move along x, then turn to face the learner.
    if (this.walkStart !== null) {
      const k = (t - this.walkStart) / WALK_SECONDS;
      const move = smoothstep(0, 0.82, k);
      this.root.position.x = WALK_FROM * (1 - move);
      const turn = smoothstep(0.7, 1, k);
      this.root.rotation.y = (-Math.PI / 2) * (1 - turn);
      const w = smoothstep(0, 0.1, k) * (1 - smoothstep(0.72, 0.9, k));
      const stride = (WALK_FROM * move) / 0.62; // about 0.62 m per step pair
      const walk = walkPose(stride * Math.PI, w);
      extra.push(walk.pose);
      bob = walk.bob;
      if (k >= 1) {
        this.standAtMark();
        this.onArrived?.();
      }
    }
    // Keeping the beat of a song: fades in and out over about half a second.
    const target = this.danceBeat !== null && this.walkStart === null ? 1 : 0;
    this.danceWeight += (target - this.danceWeight) * Math.min(1, dt * 4);
    if (this.danceBeat !== null) this.lastDanceBeat = this.danceBeat;
    if (this.danceWeight > 0.01) {
      const amp = this.danceWeight * (this.reducedMotion ? 0.5 : 1);
      const d = dancePose(this.lastDanceBeat, amp);
      extra.push(d.pose);
      bob += d.bob;
    } else if (target === 0) this.danceWeight = 0;
    this.root.position.y = bob;

    const layers = this.gestures.frames(t);
    const pose = composePose(idlePose(t, this.talkLevel), layers, extra);
    const humanoid = vrm.humanoid;
    // Bones not in the pose go back to rest (fingers after a fist).
    for (const bone of ALL_BONES) {
      const node = humanoid.getNormalizedBoneNode(bone);
      if (!node) continue;
      const e: Euler3 = pose[bone] ?? REST;
      node.rotation.set(e[0], e[1], e[2]);
    }

    // Gaze: at the camera, or up and aside while thinking.
    let gx = 0;
    let gy = 0;
    const ex = vrm.expressionManager;
    const expr: Record<string, number> = { happy: 0, relaxed: 0.18, surprised: 0, aa: 0 };
    for (const l of layers) {
      gx += l.gaze[0];
      gy += l.gaze[1];
      for (const [k, v] of Object.entries(l.expressions)) expr[k] = Math.max(expr[k] ?? 0, v);
    }
    this.gazeTarget.position.set(gx, gy, 0);
    if (ex) {
      ex.setValue('blink', expr.happy > 0.6 ? 0 : this.blinker.update(dt));
      for (const name of VISEME_NAMES) ex.setValue(name, this.visemes[name]);
      ex.setValue('aa', Math.max(this.visemes.aa, expr.aa));
      ex.setValue('happy', expr.happy);
      // A hint of a smile so the face is not blank at rest.
      ex.setValue('relaxed', expr.happy > 0.1 ? 0 : expr.relaxed);
    }
  }
}

const REST: Euler3 = [0, 0, 0];
const ALL_BONES: readonly Bone[] = [
  'hips',
  'spine',
  'chest',
  'neck',
  'head',
  'leftUpperArm',
  'rightUpperArm',
  'leftLowerArm',
  'rightLowerArm',
  'leftHand',
  'rightHand',
  'leftUpperLeg',
  'rightUpperLeg',
  'leftLowerLeg',
  'rightLowerLeg',
  'leftFoot',
  'rightFoot',
  'rightThumbProximal',
  'rightIndexProximal',
  'rightMiddleProximal',
  'rightRingProximal',
  'rightLittleProximal',
  'rightIndexIntermediate',
  'rightMiddleIntermediate',
  'rightRingIntermediate',
  'rightLittleIntermediate',
];
