import * as THREE from 'three';
import { createBoard, BOARD_W } from './boards.js';

export const ISLAND_RADIUS = 70;
const TOP = 5.4; // walkable ground height
const STRIP_LEN = 30;
const PLANE_GROUND_OFFSET = 4.15; // plane root height above ground when wheels touch

// ---------- helpers ----------
const matCache = new Map();
export function mat(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra }));
  }
  return matCache.get(key);
}

function add(parent, geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

// Displace vertices deterministically by position so seams stay closed.
function jitter(geo, amt, yAmt = amt) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = Math.round(p.getX(i) * 10) / 10;
    const y = Math.round(p.getY(i) * 10) / 10;
    const z = Math.round(p.getZ(i) * 10) / 10;
    p.setXYZ(
      i,
      p.getX(i) + (hash(x, y, z) - 0.5) * amt,
      p.getY(i) + (hash(y, z, x) - 0.5) * yAmt,
      p.getZ(i) + (hash(z, x, y) - 0.5) * amt,
    );
  }
  geo.computeVertexNormals();
  return geo;
}

function scatter(rand, count, rMin, rMax, ok = () => true) {
  const pts = [];
  let tries = 0;
  while (pts.length < count && tries++ < 500) {
    const a = rand() * Math.PI * 2;
    const d = rMin + rand() * (rMax - rMin);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!ok(x, z)) continue;
    if (pts.some((p) => Math.hypot(p[0] - x, p[1] - z) < 6)) continue;
    pts.push([x, z]);
  }
  return pts;
}

// ---------- props ----------
const LEAF_GEO = new THREE.ConeGeometry(1.3, 7, 4).translate(0, 3.5, 0);

function palm(rand) {
  const g = new THREE.Group();
  const h = 10 + rand() * 6;
  const segs = 5, segH = h / segs, lean = 0.05 + rand() * 0.06;
  let x = 0, y = 0;
  for (let i = 0; i < segs; i++) {
    const r0 = 0.75 - i * 0.08;
    const s = add(g, new THREE.CylinderGeometry(r0 - 0.08, r0, segH * 1.08, 6), mat('#a0703f'), x, y + segH / 2, 0);
    s.rotation.z = -lean * i;
    x += Math.sin(lean * i) * segH;
    y += Math.cos(lean * i) * segH;
  }
  const crown = new THREE.Group();
  crown.position.set(x, y, 0);
  g.add(crown);
  for (let k = 0; k < 7; k++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (k / 7) * Math.PI * 2 + rand() * 0.5;
    crown.add(pivot);
    const leaf = new THREE.Mesh(LEAF_GEO, mat(k % 2 ? '#3dbb5c' : '#2f9e4c'));
    leaf.rotation.z = -(1.7 + rand() * 0.4);
    leaf.scale.set(0.35, 1, 1);
    pivot.add(leaf);
  }
  for (let k = 0; k < 3; k++) {
    add(crown, new THREE.IcosahedronGeometry(0.55, 0), mat('#6b4423'), Math.cos(k * 2.1) * 0.7, -0.5, Math.sin(k * 2.1) * 0.7);
  }
  g.rotation.y = rand() * Math.PI * 2;
  return g;
}

function tree(rand) {
  const g = new THREE.Group();
  const h = 3 + rand() * 2;
  add(g, new THREE.CylinderGeometry(0.4, 0.5, h, 5), mat('#8d5b3a'), 0, h / 2, 0);
  const s = 2.6 + rand() * 1.4;
  const top = add(g, jitter(new THREE.IcosahedronGeometry(s, 0), 0.6), mat(rand() > 0.5 ? '#4caf50' : '#66bb6a'), 0, h + s * 0.7, 0);
  top.rotation.y = rand() * 3;
  return g;
}

function rock(rand, size) {
  const m = new THREE.Mesh(jitter(new THREE.DodecahedronGeometry(size, 0), size * 0.3), mat('#9aa3ad'));
  m.scale.y = 0.7;
  m.rotation.set(rand() * 3, rand() * 3, rand() * 3);
  return m;
}

function blinker(color, size = 0.7) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 6), new THREE.MeshBasicMaterial({ color }));
  m.userData.noShadow = true;
  return m;
}

// ---------- island base ----------
function addBase(g, r, grass) {
  add(g, jitter(new THREE.CylinderGeometry(r * 0.92, r * 1.18, 14, 13, 2), r * 0.08, 1.2), mat('#ecd39c'), 0, -5, 0);
  add(g, jitter(new THREE.CylinderGeometry(r * 0.76, r * 0.86, 4, 13, 1), r * 0.04, 0.4), mat(grass), 0, 3.6, 0);
  const foam = new THREE.Mesh(
    new THREE.RingGeometry(r * 1.12, r * 1.34, 32, 1),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.y = 0.8;
  foam.userData.noShadow = true;
  g.add(foam);
  return foam;
}

function addRocks(g, rand, r, n = 6) {
  for (const [x, z] of scatter(rand, n, r * 0.9, r * 1.02)) {
    const k = rock(rand, 1.8 + rand() * 2.5);
    k.position.set(x, 2, z);
    g.add(k);
  }
}

function addPalms(g, ctx, n, rMin, rMax, ok) {
  for (const [x, z] of scatter(ctx.rand, n, rMin, rMax, ok)) {
    const p = palm(ctx.rand);
    p.position.set(x, ctx.top, z);
    g.add(p);
    ctx.collide(x, z, 1);
  }
}

// ---------- themed island cores (everything within ~28 units of the centre) ----------
const BUILDERS = {
  // Base Camp: hangar, tent, windsock, campfire
  home(g, ctx) {
    const { top } = ctx;
    const hangar = new THREE.Group();
    hangar.position.set(-12, top, -6);
    hangar.rotation.y = 0.6;
    g.add(hangar);
    add(hangar, new THREE.BoxGeometry(13, 7, 12), mat('#ff6b6b'), 0, 3.5, 0);
    const roof = add(hangar, new THREE.CylinderGeometry(6.5, 6.5, 12.4, 10, 1, false, -Math.PI / 2, Math.PI), mat('#ffe8cc'), 0, 7, 0);
    roof.rotation.x = -Math.PI / 2;
    add(hangar, new THREE.BoxGeometry(8, 6, 0.3), mat('#3a3f55'), 0, 3, 6.1);
    ctx.collide(-12, -6, 9.5);

    const ws = new THREE.Group();
    ws.position.set(13, top, -14);
    g.add(ws);
    add(ws, new THREE.CylinderGeometry(0.25, 0.3, 10, 5), mat('#d9d9d9'), 0, 5, 0);
    const sockPivot = new THREE.Group();
    sockPivot.position.y = 9.5;
    ws.add(sockPivot);
    const sockGeo = new THREE.ConeGeometry(1.1, 5, 8, 1, true).rotateZ(Math.PI / 2).translate(-2.5, 0, 0);
    add(sockPivot, sockGeo, mat('#ff8c42', { side: THREE.DoubleSide }));
    ctx.collide(13, -14, 0.8);

    const fire = new THREE.Group();
    fire.position.set(10, top, 10);
    g.add(fire);
    for (let k = 0; k < 2; k++) add(fire, new THREE.BoxGeometry(3, 0.6, 0.6), mat('#6b4423'), 0, 0.3, 0).rotation.y = k * 1.6;
    const flameMat = new THREE.MeshStandardMaterial({ color: '#ffb703', emissive: '#ff7b00', emissiveIntensity: 1.5, flatShading: true });
    const flame = add(fire, new THREE.ConeGeometry(0.9, 2.4, 5), flameMat, 0, 1.6, 0);
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1;
      add(fire, new THREE.BoxGeometry(2.2, 0.8, 0.8), mat('#8d5b3a'), Math.cos(a) * 3.5, 0.4, Math.sin(a) * 3.5).rotation.y = -a + Math.PI / 2;
    }
    ctx.collide(10, 10, 1.8);

    const tent = new THREE.Group();
    tent.position.set(-6, top, 16);
    tent.rotation.y = 0.4;
    g.add(tent);
    add(tent, new THREE.ConeGeometry(4.5, 5.5, 4), mat('#ffd166'), 0, 2.75, 0).rotation.y = Math.PI / 4;
    add(tent, new THREE.BoxGeometry(1.6, 3, 0.2), mat('#6b3e26'), 0, 1.5, 3.1);
    ctx.collide(-6, 16, 3.8);

    addPalms(g, ctx, 6, 16, 27, (x, z) => ctx.free(x, z, 4));

    return {
      clearance: 20,
      update(t) {
        sockPivot.rotation.y = Math.sin(t * 0.7) * 0.4;
        sockPivot.rotation.z = Math.sin(t * 3) * 0.08;
        flame.scale.set(1 + Math.sin(t * 17) * 0.1, 1 + Math.sin(t * 11) * 0.2, 1 + Math.cos(t * 15) * 0.1);
      },
    };
  },

  // Work Experience: a little skyline
  city(g, ctx) {
    const { top, rand } = ctx;
    const palette = ['#ffd166', '#f78c6b', '#f4f1de', '#8ecae6', '#cdb4db', '#90be6d'];
    const glass = mat('#3d5a80', { roughness: 0.3, metalness: 0.2 });
    let maxH = 0, tallest = null;
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const h = i === 0 && j === 0 ? 46 : 12 + rand() * 26;
        const w = 7 + rand() * 3;
        const x = i * 13 + (rand() - 0.5) * 2, z = j * 13 + (rand() - 0.5) * 2;
        const b = new THREE.Group();
        b.position.set(x, top, z);
        b.rotation.y = (rand() - 0.5) * 0.3;
        g.add(b);
        add(b, new THREE.BoxGeometry(w, h, w), mat(palette[Math.floor(rand() * palette.length)]), 0, h / 2, 0);
        for (let y = 4; y < h - 2; y += 4) add(b, new THREE.BoxGeometry(w + 0.3, 1.4, w + 0.3), glass, 0, y, 0);
        add(b, new THREE.BoxGeometry(w * 0.5, 1.5, w * 0.5), mat('#adb5bd'), 0, h + 0.75, 0);
        ctx.collide(x, z, w * 0.72);
        if (h > maxH) { maxH = h; tallest = b; }
      }
    }
    add(tallest, new THREE.CylinderGeometry(0.2, 0.35, 10, 4), mat('#adb5bd'), 0, maxH + 6.5, 0);
    const light = blinker('#ff3b3b');
    light.position.y = maxH + 12;
    tallest.add(light);

    for (const [x, z] of scatter(rand, 7, 24, 28, (x, z) => ctx.free(x, z, 3))) {
      const t = tree(rand);
      t.position.set(x, top, z);
      g.add(t);
      ctx.collide(x, z, 1.5);
    }
    return { clearance: maxH + 14, update(t) { light.visible = Math.sin(t * 4) > 0; } };
  },

  // Work Projects: a data center with blinking racks
  lab(g, ctx) {
    const { top, rand } = ctx;
    const hall = new THREE.Group();
    hall.position.set(0, top, 0);
    g.add(hall);
    add(hall, new THREE.BoxGeometry(30, 10, 18), mat('#eef1f5'), 0, 5, 0);
    add(hall, new THREE.BoxGeometry(30.3, 1.4, 18.3), mat('#4cc9f0', { emissive: '#4cc9f0', emissiveIntensity: 0.5 }), 0, 8, 0);
    add(hall, new THREE.BoxGeometry(5, 6, 0.3), mat('#2b2d42'), 0, 3, 9.1);
    for (const x of [-10, 0, 10]) ctx.collide(x, 0, 10);

    const leds = [];
    const ledGeo = new THREE.BoxGeometry(0.8, 0.5, 0.15);
    const ledColors = ['#4ade80', '#38bdf8', '#facc15'];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 3; j++) {
          const m = add(hall, ledGeo, new THREE.MeshBasicMaterial({ color: ledColors[(i + j) % 3] }), side * (4.5 + i * 1.5), 2.5 + j * 1.5, 9.15);
          m.userData.noShadow = true;
          leds.push({ m, phase: rand() * 10, speed: 2 + rand() * 7 });
        }
      }
    }

    const fans = [];
    for (const x of [-9, 0, 9]) {
      add(hall, new THREE.CylinderGeometry(2.4, 2.4, 1.2, 10), mat('#9aa3ad'), x, 10.6, 0);
      const blades = new THREE.Group();
      blades.position.set(x, 11.35, 0);
      hall.add(blades);
      add(blades, new THREE.BoxGeometry(4.2, 0.2, 0.7), mat('#2b2d42'));
      add(blades, new THREE.BoxGeometry(0.7, 0.2, 4.2), mat('#2b2d42'));
      fans.push(blades);
    }

    const dish = new THREE.Group();
    dish.position.set(17, top, -15);
    g.add(dish);
    add(dish, new THREE.BoxGeometry(3, 2, 3), mat('#9aa3ad'), 0, 1, 0);
    add(dish, new THREE.CylinderGeometry(0.4, 0.4, 6, 6), mat('#9aa3ad'), 0, 4, 0);
    const tilt = new THREE.Group();
    tilt.position.y = 7;
    tilt.rotation.x = -0.6;
    dish.add(tilt);
    const bowl = add(tilt, new THREE.SphereGeometry(5, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.32), mat('#ffffff', { side: THREE.DoubleSide }), 0, 5, 0);
    bowl.rotation.x = Math.PI;
    add(tilt, new THREE.CylinderGeometry(0.15, 0.15, 4, 4), mat('#2b2d42'), 0, 2.2, 0);
    add(tilt, new THREE.SphereGeometry(0.6, 6, 4), mat('#ff5a5f'), 0, 4.3, 0);
    ctx.collide(17, -15, 2.4);

    const mastH = 34;
    add(g, new THREE.CylinderGeometry(0.35, 0.7, mastH, 5), mat('#ff6b6b'), -18, top + mastH / 2, -13);
    const light = blinker('#ff3b3b');
    light.position.set(-18, top + mastH + 0.6, -13);
    g.add(light);
    ctx.collide(-18, -13, 1);

    for (const x of [-9, -2, 5]) {
      add(g, new THREE.BoxGeometry(5, 3, 3), mat('#cfd6de'), x, top + 1.5, -13);
      ctx.collide(x, -13, 2.8);
    }

    addPalms(g, ctx, 5, 20, 27, (x, z) => ctx.free(x, z, 4));

    return {
      clearance: 40,
      update(t, dt) {
        for (const l of leds) l.m.visible = Math.sin(t * l.speed + l.phase) > -0.3;
        for (const f of fans) f.rotation.y += dt * 6;
        dish.rotation.y = t * 0.3;
        light.visible = Math.sin(t * 3) > 0;
      },
    };
  },

  // Side Quests: a smoking volcano
  volcano(g, ctx) {
    const { top, rand } = ctx;
    const baseR = 25;
    add(g, jitter(new THREE.CylinderGeometry(7, baseR, 30, 11, 3), 2.2, 1.6), mat('#8d5b4c'), 0, top + 14.5, 0);
    ctx.collide(0, 0, baseR + 0.5);
    const lavaMat = new THREE.MeshStandardMaterial({ color: '#ff7b00', emissive: '#ff4d00', emissiveIntensity: 1.2, flatShading: true });
    add(g, new THREE.CylinderGeometry(6.4, 6.4, 1, 11), lavaMat, 0, top + 29, 0);

    const slope = Math.atan2(30, baseR - 7);
    for (let k = 0; k < 3; k++) {
      const pivot = new THREE.Group();
      pivot.rotation.y = k * 2.3 + 0.4;
      g.add(pivot);
      const stream = add(pivot, new THREE.BoxGeometry(1.8, 0.8, 15), lavaMat, 0, top + 22.5, 12.2);
      stream.rotation.x = slope;
    }

    const smoke = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(
        new THREE.IcosahedronGeometry(3, 0),
        new THREE.MeshStandardMaterial({ color: '#dcdcdc', flatShading: true, transparent: true, opacity: 0, depthWrite: false }),
      );
      m.userData.noShadow = true;
      g.add(m);
      smoke.push(m);
    }

    // Treasure chest near the landing strip
    const a = ctx.landingAngle + 0.35;
    const chest = new THREE.Group();
    chest.position.set(Math.cos(a) * 30, top, Math.sin(a) * 30);
    chest.rotation.y = -a + Math.PI / 2;
    g.add(chest);
    add(chest, new THREE.BoxGeometry(2.6, 1.6, 1.7), mat('#8d5b3a'), 0, 0.8, 0);
    add(chest, new THREE.BoxGeometry(2.7, 0.6, 1.8), mat('#ffd166', { metalness: 0.4, roughness: 0.4 }), 0, 1.9, 0);
    ctx.collide(chest.position.x, chest.position.z, 1.6);

    addPalms(g, ctx, 7, 27, 30, (x, z) => ctx.free(x, z, 3));

    return {
      clearance: 44,
      update(t) {
        lavaMat.emissiveIntensity = 1.1 + Math.sin(t * 2) * 0.35;
        smoke.forEach((m, i) => {
          const ph = (t * 0.16 + i / smoke.length) % 1;
          m.position.set(Math.sin(i * 2.3) * 2 + ph * 8, top + 31 + ph * 36, Math.cos(i * 1.7) * 2);
          m.scale.setScalar(1 + ph * 2.6);
          m.rotation.set(ph * 2, i, ph);
          m.material.opacity = 0.8 * (1 - ph) * Math.min(1, ph * 6);
        });
      },
    };
  },

  // Contact: lighthouse with sweeping beams
  lighthouse(g, ctx) {
    const { top } = ctx;
    const lh = new THREE.Group();
    lh.position.set(0, top, 0);
    g.add(lh);
    const segs = 6, segH = 5;
    for (let i = 0; i < segs; i++) {
      add(lh, new THREE.CylinderGeometry(5 - (i + 1) * 0.28, 5 - i * 0.28, segH, 12), mat(i % 2 ? '#ffffff' : '#ef4444'), 0, i * segH + segH / 2, 0);
    }
    ctx.collide(0, 0, 5.4);
    const H = segs * segH;
    add(lh, new THREE.CylinderGeometry(4.4, 4.4, 0.8, 12), mat('#2b2d42'), 0, H + 0.4, 0);
    const lampMat = new THREE.MeshStandardMaterial({ color: '#fff3b0', emissive: '#ffd166', emissiveIntensity: 1.4, flatShading: true });
    add(lh, new THREE.CylinderGeometry(2.6, 2.6, 4, 8), lampMat, 0, H + 2.8, 0);
    add(lh, new THREE.ConeGeometry(3.6, 3.4, 8), mat('#ef4444'), 0, H + 6.5, 0);
    add(lh, new THREE.SphereGeometry(0.6, 6, 4), mat('#2b2d42'), 0, H + 8.5, 0);

    const beam = new THREE.Group();
    beam.position.y = H + 2.8;
    lh.add(beam);
    const beamGeo = new THREE.ConeGeometry(7, 110, 20, 1, true).translate(0, -55, 0).rotateX(-Math.PI / 2);
    const beamMat = new THREE.MeshBasicMaterial({
      color: '#fff6c2', transparent: true, opacity: 0.22, depthWrite: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
    });
    for (const rot of [0, Math.PI]) {
      const b = new THREE.Mesh(beamGeo, beamMat);
      b.rotation.y = rot;
      b.userData.noShadow = true;
      beam.add(b);
    }

    const cottage = new THREE.Group();
    cottage.position.set(15, top, 7);
    cottage.rotation.y = -0.5;
    g.add(cottage);
    add(cottage, new THREE.BoxGeometry(9, 6, 8), mat('#f8f9fa'), 0, 3, 0);
    add(cottage, new THREE.ConeGeometry(7, 4.5, 4), mat('#8d6e63'), 0, 8.25, 0).rotation.y = Math.PI / 4;
    add(cottage, new THREE.BoxGeometry(2, 3.6, 0.3), mat('#5d4037'), 0, 1.8, 4.1);
    add(cottage, new THREE.BoxGeometry(1.2, 3, 1.2), mat('#9aa3ad'), 2.5, 9, -1.5);
    ctx.collide(15, 7, 6.5);

    const mailbox = new THREE.Group();
    mailbox.position.set(-10, top, 12);
    g.add(mailbox);
    add(mailbox, new THREE.BoxGeometry(0.4, 3, 0.4), mat('#8d5b3a'), 0, 1.5, 0);
    add(mailbox, new THREE.BoxGeometry(1.4, 1.2, 2), mat('#ef4444'), 0, 3.4, 0);
    const flag = add(mailbox, new THREE.BoxGeometry(0.15, 1, 0.3), mat('#ffd166'), 0.8, 3.9, 0.5);
    ctx.collide(-10, 12, 1.2);

    addPalms(g, ctx, 4, 16, 27, (x, z) => ctx.free(x, z, 4));

    return {
      clearance: 50,
      update(t) {
        beam.rotation.y = t * 0.9;
        lampMat.emissiveIntensity = 1.3 + Math.sin(t * 3) * 0.2;
        flag.rotation.z = Math.max(0, Math.sin(t * 1.5)) * -1.2;
      },
    };
  },
};

// ---------- floating label ----------
function makeLabel(def) {
  const W = 768, H = 220;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  sprite.renderOrder = 10;

  function draw(visited) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.font = '700 82px Fredoka, Nunito, sans-serif';
    const tw = ctx.measureText(def.name).width;
    ctx.font = '800 38px Nunito, sans-serif';
    const sw = ctx.measureText(def.subtitle).width;
    const w = Math.min(W - 16, Math.max(tw, sw) + 130);
    const x = (W - w) / 2;
    ctx.fillStyle = '#1d2340';
    ctx.beginPath(); ctx.roundRect(x + 10, 20, w - 10, 190, 44); ctx.fill();
    ctx.fillStyle = '#fffaf0';
    ctx.beginPath(); ctx.roundRect(x + 3, 8, w - 12, 190, 44); ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = '#1d2340'; ctx.stroke();
    ctx.fillStyle = def.color;
    ctx.beginPath(); ctx.arc(x + 58, 103, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (visited) {
      ctx.strokeStyle = '#1d2340'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(x + 47, 104); ctx.lineTo(x + 56, 113); ctx.lineTo(x + 71, 93); ctx.stroke();
    }
    ctx.fillStyle = '#1d2340';
    ctx.font = '700 82px Fredoka, Nunito, sans-serif';
    ctx.fillText(def.name, x + 98, 112);
    ctx.fillStyle = '#5c6185';
    ctx.font = '800 38px Nunito, sans-serif';
    ctx.fillText(def.subtitle.toUpperCase(), x + 100, 166);
    tex.needsUpdate = true;
  }
  draw(false);
  return { sprite, draw };
}

// ---------- landing strip ----------
function addStrip(g, kind, angle, r, top) {
  const rs = r * 0.63;
  const strip = new THREE.Group();
  strip.position.set(Math.cos(angle) * rs, top + 0.05, Math.sin(angle) * rs);
  strip.rotation.y = -angle; // local +Z runs along the tangent
  g.add(strip);
  const paved = kind === 'home';
  add(strip, new THREE.BoxGeometry(8, 0.6, STRIP_LEN), mat(paved ? '#4a4f5e' : '#d9b77a'));
  if (paved) {
    for (let i = -2; i <= 2; i++) add(strip, new THREE.BoxGeometry(0.6, 0.1, 3), mat('#ffffff'), 0, 0.32, i * 6);
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const cone = add(strip, new THREE.ConeGeometry(0.4, 1, 5), mat('#ff8c42'), side * 4.6, 0.8, -STRIP_LEN / 2 + 2 + i * 8.6);
      cone.userData.noShadow = true;
    }
  }
  return rs;
}

// ---------- assemble ----------
export function buildIsland(def, index) {
  const rand = rng((index + 1) * 7919);
  const r = def.radius ?? ISLAND_RADIUS;
  const landingAngle = def.landingAngle ?? Math.PI / 2;
  const group = new THREE.Group();
  group.position.set(def.position[0], 0, def.position[2]);
  const cx = group.position.x, cz = group.position.z;

  const colliders = []; // world space
  const localColliders = [];
  const ctx = {
    r, top: TOP, rand, landingAngle,
    collide(x, z, cr) {
      localColliders.push({ x, z, r: cr });
      colliders.push({ x: cx + x, z: cz + z, r: cr });
    },
    free(x, z, margin) {
      return localColliders.every((c) => Math.hypot(c.x - x, c.z - z) > c.r + margin);
    },
  };

  const foam = addBase(group, r, def.grass ?? '#7ed957');
  const kind = BUILDERS[def.kind](group, ctx);
  addRocks(group, rand, r);

  // Landing strip on the ring, along the tangent
  const rs = addStrip(group, def.kind, landingAngle, r, TOP);
  const T = new THREE.Vector3(-Math.sin(landingAngle), 0, Math.cos(landingAngle));
  const C = new THREE.Vector3(cx + Math.cos(landingAngle) * rs, 0, cz + Math.sin(landingAngle) * rs);
  const planeY = TOP + PLANE_GROUND_OFFSET;
  const strip = {
    dir: T,
    yaw: Math.PI - landingAngle,
    touchdown: C.clone().addScaledVector(T, -STRIP_LEN / 2 + 1).setY(planeY),
    park: C.clone().addScaledVector(T, STRIP_LEN / 2 - 4).setY(planeY),
    inward: new THREE.Vector3(-Math.cos(landingAngle), 0, -Math.sin(landingAngle)),
  };

  // Signboards on a ring facing outwards, spread around the side away from the strip
  const boardRing = r * 0.52;
  const n = def.boards.length;
  const span = n > 1 ? Math.min(Math.PI * 1.4, (n - 1) * 0.68) : 0;
  const boards = def.boards.map((b, i) => {
    // decreasing angle = left-to-right when viewed from outside the island
    const a = landingAngle + Math.PI + span / 2 - (n > 1 ? (i * span) / (n - 1) : 0);
    const board = createBoard(b, def.color);
    const lx = Math.cos(a) * boardRing, lz = Math.sin(a) * boardRing;
    board.group.position.set(lx, TOP, lz);
    board.group.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
    group.add(board.group);
    const normal = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const tangent = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    const base = new THREE.Vector3(cx + lx, TOP, cz + lz);
    for (const off of [-BOARD_W / 2 + 0.8, 0, BOARD_W / 2 - 0.8]) {
      colliders.push({ x: base.x + tangent.x * off, z: base.z + tangent.z * off, r: 1.2 });
    }
    return {
      def: b,
      index: i,
      base,
      normal,
      tangent,
      face: base.clone().setY(TOP + board.faceHeight),
    };
  });

  // Beacon: spinning gem + sky pillar + label, visible from far away
  const gemY = kind.clearance + 16;
  const gem = add(
    group,
    new THREE.OctahedronGeometry(4, 0),
    new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 0.6, flatShading: true }),
    0, gemY, 0,
  );
  const pillar = add(
    group,
    new THREE.CylinderGeometry(0.9, 0.9, 600, 6, 1, true),
    new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.32, depthWrite: false, fog: false }),
    0, gemY + 300, 0,
  );
  pillar.userData.noShadow = true;
  gem.userData.noShadow = true;
  const label = makeLabel(def);
  group.add(label.sprite);
  document.fonts?.ready.then(() => label.draw(false));

  group.traverse((o) => {
    if (o.isMesh && !o.userData.noShadow) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  return {
    def,
    id: def.id,
    group,
    center: group.position,
    radius: r,
    coreRadius: 30,
    top: TOP,
    walkRadius: r * 0.7,
    clearance: kind.clearance,
    colliders,
    boards,
    strip,
    update(t, dt, camera) {
      gem.rotation.y = t * 1.2;
      gem.position.y = gemY + Math.sin(t * 2 + index) * 1.5;
      label.sprite.position.y = gemY + 13 + Math.sin(t * 2 + index) * 1.5;
      // Grow labels with distance so far islands stay readable
      const ls = THREE.MathUtils.clamp(camera.position.distanceTo(group.position) / 230, 1, 4);
      label.sprite.scale.set(52 * ls, 52 * ls * (220 / 768), 1);
      foam.material.opacity = 0.4 + Math.sin(t * 1.5 + index) * 0.15;
      foam.scale.setScalar(1 + Math.sin(t * 1.5 + index) * 0.025);
      kind.update?.(t, dt);
    },
    setVisited() {
      label.draw(true);
      pillar.material.opacity = 0.12;
    },
  };
}
