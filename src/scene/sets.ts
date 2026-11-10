import * as THREE from 'three';
import type { SceneId } from '../teaching/persona';

/**
 * The three scenes, built from simple shapes with toon (cel) shading so they
 * match the MToon characters. No model or texture file: nothing to license,
 * nothing to download, cheap to draw. The character stands at the origin
 * facing +Z; the camera is about 2 m in front, at eye level, so only what
 * lies within about ±2.5 m sideways and 0–2.6 m high is seen.
 */
export interface SetLook {
  background: number;
  fog: [number, number];
  hemi: [sky: number, ground: number, intensity: number];
  key: [colour: number, intensity: number];
  /** Under-feet shadow colour. */
  shadow: number;
}

export interface BuiltSet {
  group: THREE.Group;
  look: SetLook;
}

let gradient: THREE.DataTexture | null = null;
/** Three hard light bands: the cel look. */
function toonGradient(): THREE.DataTexture {
  if (gradient) return gradient;
  const data = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

const materials = new Map<string, THREE.Material>();
function toon(colour: number, emissive = 0): THREE.Material {
  const key = `${colour}-${emissive}`;
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({
      color: colour,
      gradientMap: toonGradient(),
      emissive: emissive ? new THREE.Color(emissive) : new THREE.Color(0),
    });
    materials.set(key, m);
  }
  return m;
}
function flat(colour: number): THREE.Material {
  const key = `flat-${colour}`;
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: colour });
    materials.set(key, m);
  }
  return m;
}

type V3 = [number, number, number];
const unitBox = new THREE.BoxGeometry(1, 1, 1);

/** A box by its size and the position of its centre. */
function box(g: THREE.Object3D, size: V3, pos: V3, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(unitBox, mat);
  m.scale.set(...size);
  m.position.set(...pos);
  g.add(m);
  return m;
}
function cyl(
  g: THREE.Object3D,
  rTop: number,
  rBottom: number,
  h: number,
  pos: V3,
  mat: THREE.Material,
  seg = 16,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), mat);
  m.position.set(...pos);
  g.add(m);
  return m;
}
function ball(g: THREE.Object3D, r: number, pos: V3, mat: THREE.Material, detail = 1): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), mat);
  m.position.set(...pos);
  g.add(m);
  return m;
}

/** A flat panel with a canvas drawing (menu board, whiteboard, sign). */
function painted(
  g: THREE.Object3D,
  w: number,
  h: number,
  pos: V3,
  draw: (ctx: CanvasRenderingContext2D, W: number, H: number) => void,
): THREE.Mesh {
  const W = 512;
  const H = Math.round((512 * h) / w);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx, W, H);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex }),
  );
  m.position.set(...pos);
  g.add(m);
  return m;
}

function plant(g: THREE.Object3D, x: number, z: number, scale = 1): void {
  const p = new THREE.Group();
  cyl(p, 0.17, 0.13, 0.32, [0, 0.16, 0], toon(0xc8693a));
  const leaf = toon(0x4f8a4b);
  ball(p, 0.28, [0, 0.55, 0], leaf);
  ball(p, 0.2, [0.17, 0.72, 0.05], leaf);
  ball(p, 0.19, [-0.15, 0.78, -0.03], leaf);
  ball(p, 0.16, [0.02, 0.92, 0.04], toon(0x5e9b55));
  p.position.set(x, 0, z);
  p.scale.setScalar(scale);
  g.add(p);
}

function tree(g: THREE.Object3D, x: number, z: number, s = 1): void {
  const t = new THREE.Group();
  cyl(t, 0.09, 0.13, 1.8, [0, 0.9, 0], toon(0x7a5434), 8);
  const leaf = toon(0x5f9e4f);
  ball(t, 0.85, [0, 2.3, 0], leaf);
  ball(t, 0.6, [0.55, 2.0, 0.1], toon(0x6aab58));
  ball(t, 0.55, [-0.5, 2.05, 0.15], leaf);
  t.position.set(x, 0, z);
  t.scale.setScalar(s);
  g.add(t);
}

// --------------------------------------------------------------------- café
function cafe(): BuiltSet {
  const g = new THREE.Group();
  const wall = toon(0xf0d3b0);
  // Floor (wood) and back wall with a darker wainscot.
  box(g, [12, 0.05, 12], [0, -0.025, -2], toon(0xb98a5e));
  box(g, [12, 3.2, 0.1], [0, 1.6, -3], wall);
  box(g, [12, 0.9, 0.06], [0, 0.45, -2.94], toon(0x8c5a3a));
  box(g, [12, 0.05, 0.08], [0, 0.92, -2.92], toon(0x6e4429));
  // Side wall on the left, angled in for depth.
  const side = box(g, [6, 3.2, 0.1], [-3.4, 1.6, -1.2], wall);
  side.rotation.y = Math.PI / 2.6;

  // Big window with a sunny street outside.
  const frame = toon(0x5b3a26);
  box(g, [2.0, 1.4, 0.04], [-1.35, 1.65, -2.93], flat(0xbfe3f2));
  painted(g, 1.96, 1.36, [-1.35, 1.65, -2.9], (c, W, H) => {
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#9fd3ee');
    sky.addColorStop(1, '#e4f4fb');
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#e8c7a0';
    c.fillRect(0, H * 0.55, W * 0.35, H * 0.45);
    c.fillStyle = '#d9a77c';
    c.fillRect(W * 0.62, H * 0.45, W * 0.38, H * 0.55);
    c.fillStyle = '#6aab58';
    c.beginPath();
    c.arc(W * 0.48, H * 0.68, H * 0.2, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#c9c4bd';
    c.fillRect(0, H * 0.88, W, H * 0.12);
  });
  box(g, [2.1, 0.08, 0.1], [-1.35, 2.37, -2.9], frame);
  box(g, [2.1, 0.08, 0.14], [-1.35, 0.93, -2.88], frame);
  box(g, [0.06, 1.44, 0.1], [-2.37, 1.65, -2.9], frame);
  box(g, [0.06, 1.44, 0.1], [-0.33, 1.65, -2.9], frame);
  box(g, [0.04, 1.4, 0.08], [-1.35, 1.65, -2.88], frame);

  // Menu board.
  painted(g, 1.0, 0.75, [1.25, 1.62, -2.93], (c, W, H) => {
    c.fillStyle = '#5b3a26';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#2f3b33';
    c.fillRect(14, 14, W - 28, H - 28);
    c.fillStyle = '#f5efe3';
    c.font = 'bold 54px system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText('MENU', W / 2, 80);
    c.font = '34px system-ui, sans-serif';
    c.textAlign = 'left';
    const items = [
      'Latte .......... 3.80',
      'Cappuccino ..... 3.50',
      'Iced tea ........ 2.90',
      'Muffin ........... 2.50',
    ];
    items.forEach((t, i) => c.fillText(t, 50, 145 + i * 52));
  });

  // Counter with an espresso machine and cups, on the right.
  box(g, [2.2, 1.0, 0.6], [2.2, 0.5, -2.3], toon(0x8c5a3a));
  box(g, [2.3, 0.06, 0.7], [2.2, 1.03, -2.3], toon(0xe8dccb));
  box(g, [0.5, 0.42, 0.36], [2.5, 1.27, -2.4], toon(0xb7bec4));
  box(g, [0.5, 0.06, 0.4], [2.5, 1.5, -2.4], toon(0x6f767c));
  for (let i = 0; i < 3; i++)
    cyl(g, 0.045, 0.035, 0.09, [1.7 + i * 0.14, 1.11, -2.2], toon(0xffffff), 10);
  // Shelf with jars.
  box(g, [1.4, 0.04, 0.22], [2.3, 2.15, -2.88], frame);
  const jars = [0xd4a35a, 0x9fc6a2, 0xe2c08e, 0xc77d5b];
  jars.forEach((c, i) => cyl(g, 0.07, 0.07, 0.2, [1.8 + i * 0.32, 2.27, -2.85], toon(c), 10));

  // Pendant lamps.
  for (const x of [-1.6, 0.2, 1.9]) {
    cyl(g, 0.006, 0.006, 0.7, [x, 2.85, -1.6], flat(0x2b2118), 4);
    cyl(g, 0.06, 0.22, 0.18, [x, 2.42, -1.6], toon(0x2f4a3a));
    ball(g, 0.06, [x, 2.32, -1.6], flat(0xfff1c9), 0);
  }
  // A table with two chairs behind, a plant by the window.
  cyl(g, 0.45, 0.45, 0.04, [-1.0, 0.74, -1.9], toon(0xe8dccb), 24);
  cyl(g, 0.04, 0.04, 0.72, [-1.0, 0.36, -1.9], frame, 8);
  for (const dx of [-0.6, 0.6]) {
    box(g, [0.38, 0.04, 0.38], [-1.0 + dx, 0.45, -1.9], toon(0x6e4429));
    box(g, [0.38, 0.45, 0.04], [-1.0 + dx * 1.3, 0.68, -1.9], toon(0x6e4429));
  }
  cyl(g, 0.05, 0.04, 0.08, [-1.1, 0.8, -1.85], toon(0xffffff), 10);
  plant(g, -2.6, -2.5, 1.1);

  return {
    group: g,
    look: {
      background: 0xf3e3cf,
      fog: [6, 14],
      hemi: [0xfff4e6, 0xb9a48c, 1.6],
      key: [0xfff3e0, 1.7],
      shadow: 0x5b4630,
    },
  };
}

// ------------------------------------------------------------------- office
function office(): BuiltSet {
  const g = new THREE.Group();
  box(g, [12, 0.05, 12], [0, -0.025, -2], toon(0x8e9aa6));
  box(g, [12, 3.2, 0.1], [0, 1.6, -3], toon(0xe9edf0));
  const side = box(g, [6, 3.2, 0.1], [3.4, 1.6, -1.2], toon(0xdfe5ea));
  side.rotation.y = -Math.PI / 2.6;

  // Window band with the city outside.
  painted(g, 3.0, 1.5, [-1.0, 1.75, -2.93], (c, W, H) => {
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#a9cfe9');
    sky.addColorStop(1, '#e6f1f8');
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H);
    const towers = [
      [0.02, 0.45, '#8aa1b8'],
      [0.12, 0.25, '#7d93ab'],
      [0.24, 0.55, '#9fb2c4'],
      [0.36, 0.3, '#6f86a0'],
      [0.5, 0.5, '#8ea4ba'],
      [0.6, 0.2, '#7990a8'],
      [0.74, 0.42, '#9db0c3'],
      [0.86, 0.33, '#7088a2'],
    ] as const;
    for (const [x, top, colour] of towers) {
      c.fillStyle = colour;
      c.fillRect(x * W, top * H, W * 0.11, H);
      c.fillStyle = 'rgba(255,255,255,0.45)';
      for (let y = top * H + 12; y < H; y += 22)
        for (let k = 0; k < 3; k++) c.fillRect(x * W + 8 + k * 16, y, 8, 10);
    }
  });
  const mullion = toon(0x55606b);
  box(g, [3.1, 0.07, 0.1], [-1.0, 2.53, -2.9], mullion);
  box(g, [3.1, 0.07, 0.12], [-1.0, 0.97, -2.9], mullion);
  for (const x of [-2.52, -1.0, 0.52]) box(g, [0.06, 1.6, 0.1], [x, 1.75, -2.9], mullion);

  // Whiteboard.
  painted(g, 1.3, 0.85, [1.7, 1.45, -2.93], (c, W, H) => {
    c.fillStyle = '#b8c0c8';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#ffffff';
    c.fillRect(10, 10, W - 20, H - 20);
    c.strokeStyle = '#2f5d8a';
    c.lineWidth = 6;
    c.font = 'bold 40px system-ui, sans-serif';
    c.fillStyle = '#2f5d8a';
    c.fillText('Q3 plan', 40, 70);
    c.font = '28px system-ui, sans-serif';
    c.fillStyle = '#3d4a56';
    ['• new clients', '• hiring', '• London trip'].forEach((t, i) =>
      c.fillText(t, 50, 130 + i * 42),
    );
    c.strokeStyle = '#b34a17';
    c.beginPath();
    c.moveTo(300, 250);
    c.lineTo(350, 190);
    c.lineTo(400, 215);
    c.lineTo(460, 130);
    c.stroke();
  });

  // Meeting table behind, with chairs and a laptop.
  box(g, [2.4, 0.05, 0.9], [0.2, 0.74, -1.9], toon(0xf4f1ec));
  box(g, [0.06, 0.72, 0.06], [-0.9, 0.36, -1.9], mullion);
  box(g, [0.06, 0.72, 0.06], [1.3, 0.36, -1.9], mullion);
  for (const x of [-0.5, 0.9]) {
    box(g, [0.45, 0.06, 0.45], [x, 0.48, -2.5], toon(0x2f3b48));
    box(g, [0.45, 0.55, 0.06], [x, 0.78, -2.72], toon(0x2f3b48));
  }
  box(g, [0.36, 0.02, 0.25], [0.6, 0.775, -1.85], toon(0x3d4a56));
  const screen = box(g, [0.36, 0.24, 0.015], [0.6, 0.9, -1.97], toon(0x3d4a56));
  screen.rotation.x = -0.25;
  cyl(g, 0.045, 0.04, 0.1, [-0.3, 0.81, -1.8], toon(0xffffff), 10);

  // Shelf with binders, a plant, a ceiling strip of light.
  box(g, [1.0, 1.2, 0.35], [-2.9, 0.6, -2.7], toon(0xc9cfd5));
  const binders = [0x2f5d8a, 0xb34a17, 0x2e6b4f, 0x9a5b00, 0x2f5d8a];
  binders.forEach((c, i) => box(g, [0.08, 0.3, 0.25], [-3.25 + i * 0.12, 1.36, -2.7], toon(c)));
  plant(g, 2.6, -2.4, 1.2);
  box(g, [5, 0.04, 0.3], [0, 2.95, -1.6], flat(0xfdfdf8));

  return {
    group: g,
    look: {
      background: 0xe6ebef,
      fog: [6, 14],
      hemi: [0xf5f8ff, 0x9aa4ad, 1.7],
      key: [0xffffff, 1.6],
      shadow: 0x3d4a56,
    },
  };
}

// ------------------------------------------------------------------- street
function street(): BuiltSet {
  const g = new THREE.Group();
  // Pavement, kerb, road, and the far pavement.
  box(g, [16, 0.05, 6], [0, -0.025, -0.5], toon(0xd5d0c8));
  box(g, [16, 0.12, 0.2], [0, 0.03, -3.5], toon(0xbfb8ad));
  box(g, [16, 0.04, 3], [0, -0.04, -5.1], toon(0x5d6266));
  for (let x = -7; x <= 7; x += 2) box(g, [1, 0.01, 0.12], [x, -0.015, -5.1], flat(0xf2efe6));
  box(g, [16, 0.05, 2], [0, -0.02, -7.6], toon(0xd5d0c8));

  // Building fronts across the road.
  const fronts: [number, number, number, number][] = [
    [-5.5, 3.2, 5.2, 0xe2b48a],
    [-2.6, 2.6, 6.0, 0xd98f6b],
    [0.2, 3.0, 4.6, 0xf0d9a8],
    [3.1, 2.8, 5.6, 0xa9c4c9],
    [6.0, 3.0, 4.8, 0xe7c9b8],
  ];
  for (const [x, w, h, colour] of fronts) {
    box(g, [w, h, 1], [x, h / 2, -9], toon(colour));
    const win = toon(0x7fa9c2);
    for (let row = 0; row < 3; row++) {
      const y = 2.0 + row * 1.15;
      if (y > h - 0.5) break;
      if (x === 0.2 && row === 0) continue; // the shop sign is there
      for (let k = -1; k <= 1; k++) box(g, [0.55, 0.7, 0.05], [x + k * (w / 3.2), y, -8.48], win);
    }
  }
  // Shop with a striped awning and a sign in the middle.
  box(g, [2.2, 1.3, 0.05], [0.2, 0.75, -8.47], flat(0xcfe6ee));
  painted(g, 2.4, 0.5, [0.2, 1.75, -8.0], (c, W, H) => {
    for (let i = 0; i < 12; i++) {
      c.fillStyle = i % 2 ? '#f5efe3' : '#b34a17';
      c.fillRect((i * W) / 12, 0, W / 12 + 1, H);
    }
  }).rotation.x = -0.5;
  painted(g, 1.5, 0.32, [0.2, 2.3, -8.47], (c, W, H) => {
    c.fillStyle = '#2b2118';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#f5efe3';
    c.font = 'bold 64px system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText('RECORDS', W / 2, H * 0.75);
  });

  // Trees, a street lamp, a bench, a bus stop sign.
  tree(g, -3.2, -2.6, 1.05);
  tree(g, 2.9, -2.9, 0.95);
  tree(g, 6.5, -2.4, 1.1);
  cyl(g, 0.05, 0.06, 3.2, [-1.4, 1.6, -3.0], toon(0x2f3b33), 8);
  box(g, [0.5, 0.06, 0.06], [-1.2, 3.2, -3.0], toon(0x2f3b33));
  ball(g, 0.12, [-0.98, 3.12, -3.0], flat(0xfff1c9));
  box(g, [1.5, 0.06, 0.45], [1.3, 0.45, -2.6], toon(0x8c5a3a));
  box(g, [1.5, 0.4, 0.06], [1.3, 0.7, -2.82], toon(0x8c5a3a));
  for (const x of [0.65, 1.95]) box(g, [0.06, 0.45, 0.4], [x, 0.22, -2.6], toon(0x2f3b33));
  cyl(g, 0.03, 0.03, 2.4, [3.9, 1.2, -1.8], toon(0x55606b), 8);
  painted(g, 0.5, 0.5, [3.9, 2.25, -1.77], (c, W, H) => {
    c.fillStyle = '#2f5d8a';
    c.beginPath();
    c.arc(W / 2, H / 2, W / 2 - 4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ffffff';
    c.font = 'bold 120px system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText('BUS', W / 2, H * 0.62);
  });
  // A few soft clouds in the sky.
  const cloud = flat(0xffffff);
  for (const [x, y] of [
    [-4, 6.8],
    [1.5, 7.6],
    [5.5, 6.6],
  ]) {
    ball(g, 0.7, [x, y, -12], cloud, 1);
    ball(g, 0.5, [x + 0.7, y - 0.15, -12], cloud, 1);
    ball(g, 0.45, [x - 0.65, y - 0.2, -12], cloud, 1);
  }

  return {
    group: g,
    look: {
      background: 0xbfe1f2,
      fog: [9, 22],
      hemi: [0xeaf6ff, 0xa89f8f, 1.7],
      key: [0xfff6e5, 1.9],
      shadow: 0x4a4a4a,
    },
  };
}

const BUILDERS: Record<SceneId, () => BuiltSet> = { cafe, office, street };
const cache = new Map<SceneId, BuiltSet>();

/** Builds a scene once, then reuses it. */
export function buildSet(id: SceneId): BuiltSet {
  let set = cache.get(id);
  if (!set) {
    set = BUILDERS[id]();
    cache.set(id, set);
  }
  return set;
}
