import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { Blinker } from './blink';
import { SILENT, VISEME_NAMES, type VisemeWeights } from '../lipsync/visemes';

/**
 * The 3D stage: one VRM character in a simple lit scene, camera at eye level.
 * The character looks at the camera, blinks, breathes and sways; the mouth is
 * driven from outside through `setVisemes`.
 */
export class Stage {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(26, 1, 0.1, 30);
  private readonly clock = new THREE.Clock();
  private readonly blinker = new Blinker();
  private vrm: VRM | null = null;
  private visemes: VisemeWeights = { ...SILENT };
  private talkLevel = 0;
  private t = 0;
  /** Frames rendered since the character appeared (used by the smoke test). */
  frames = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.background = new THREE.Color(0xf3e3cf);
    this.scene.fog = new THREE.Fog(0xf3e3cf, 6, 14);

    // Soft light: a warm sky/ground fill plus one gentle key light.
    this.scene.add(new THREE.HemisphereLight(0xfff4e6, 0xb9a48c, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.7);
    key.position.set(1.2, 2.4, 2.0);
    this.scene.add(key);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(8, 64),
      new THREE.MeshStandardMaterial({ color: 0xd9b991, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    // A soft blob under the feet instead of real-time shadows.
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 40),
      new THREE.MeshBasicMaterial({ color: 0x5b4630, transparent: true, opacity: 0.25 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.005;
    this.scene.add(shadow);

    this.camera.position.set(0, 1.4, 1.6);
    this.scene.add(this.camera);
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
  }

  async loadCharacter(url: string, onProgress?: (ratio: number) => void): Promise<void> {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    const gltf = await loader.loadAsync(url, (e) => {
      if (e.total > 0) onProgress?.(e.loaded / e.total);
    });
    const vrm = gltf.userData.vrm as VRM | undefined;
    if (!vrm) throw new Error('This file is not a VRM model');
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    VRMUtils.rotateVRM0(vrm); // VRM 0.x models face the other way
    vrm.scene.traverse((o) => (o.frustumCulled = false));
    this.scene.add(vrm.scene);
    this.vrm = vrm;

    // Eye level: put the camera at the height of the head, framing the bust.
    vrm.scene.updateMatrixWorld(true);
    const head = vrm.humanoid.getNormalizedBoneNode('head');
    const eyeY = head ? head.getWorldPosition(new THREE.Vector3()).y + 0.06 : 1.4;
    this.camera.position.set(0, eyeY, 1.55);
    this.camera.lookAt(0, eyeY - 0.12, 0);
    if (vrm.lookAt) vrm.lookAt.target = this.camera;
    this.frames = 0;
  }

  /** Mouth shapes for this frame (already smoothed by the caller). */
  setVisemes(v: VisemeWeights): void {
    this.visemes = v;
    this.talkLevel = Math.min(1, v.aa + v.ih + v.ou + v.ee + v.oh);
  }

  private tick(): void {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.t += dt;
    const vrm = this.vrm;
    if (vrm) {
      this.animateIdle(vrm, this.t);
      const ex = vrm.expressionManager;
      if (ex) {
        ex.setValue('blink', this.blinker.update(dt));
        for (const name of VISEME_NAMES) ex.setValue(name, this.visemes[name]);
        // A hint of a smile so the face is not blank at rest.
        ex.setValue('relaxed', 0.18);
      }
      vrm.update(dt);
      this.frames++;
    }
    this.renderer.render(this.scene, this.camera);
  }

  /** Procedural idle: arms down, breathing, slow sway, small head moves. */
  private animateIdle(vrm: VRM, t: number): void {
    const bone = (name: Parameters<typeof vrm.humanoid.getNormalizedBoneNode>[0]) =>
      vrm.humanoid.getNormalizedBoneNode(name);
    const breath = Math.sin(t * 1.5);
    const sway = Math.sin(t * 0.55);
    const talk = this.talkLevel;

    const lArm = bone('leftUpperArm');
    const rArm = bone('rightUpperArm');
    if (lArm) lArm.rotation.set(0.05, 0, 1.22 + breath * 0.012);
    if (rArm) rArm.rotation.set(0.05, 0, -1.22 - breath * 0.012);
    const lFore = bone('leftLowerArm');
    const rFore = bone('rightLowerArm');
    if (lFore) lFore.rotation.set(0, -0.2, 0);
    if (rFore) rFore.rotation.set(0, 0.2, 0);

    const hips = bone('hips');
    if (hips) {
      hips.rotation.z = sway * 0.012;
      hips.rotation.y = Math.sin(t * 0.31) * 0.03;
    }
    const spine = bone('spine');
    if (spine) spine.rotation.set(breath * 0.008, 0, -sway * 0.012);
    const chest = bone('chest');
    if (chest) chest.rotation.x = breath * 0.014;
    const neck = bone('neck');
    if (neck) neck.rotation.y = Math.sin(t * 0.43 + 1) * 0.03;
    const head = bone('head');
    if (head) {
      // The head bobs a little with the voice, so talking is not mouth-only.
      head.rotation.x = Math.sin(t * 0.7) * 0.015 + Math.sin(t * 6.5) * 0.02 * talk;
      head.rotation.z = Math.sin(t * 0.37) * 0.02 + Math.sin(t * 2.3) * 0.015 * talk;
    }
  }
}
