import * as THREE from 'three';

export const WORLD_RADIUS = 1000;
const MIN_ALT = 10;
const MAX_ALT = 170;
const { damp, clamp } = THREE.MathUtils;

const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.7, ...extra });
}
function box(parent, w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// Toy biplane + pilot, built from boxes. Nose points to -Z.
export function createPlane() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const red = mat('#f25346');
  const cream = mat('#fff3dc');
  const brown = mat('#6b3e26');
  const dark = mat('#2a2230');
  const skin = mat('#f5c29b');
  const yellow = mat('#ffd23f');
  const lens = mat('#7fd1ff', { roughness: 0.1, metalness: 0.3 });
  const glass = mat('#bfe9ff', { transparent: true, opacity: 0.5, roughness: 0.1 });

  // Fuselage: box tapered toward the tail
  const fus = new THREE.BoxGeometry(3.2, 3, 9);
  const p = fus.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getZ(i) > 0) {
      p.setX(i, p.getX(i) * 0.45);
      p.setY(i, p.getY(i) * 0.45 + 0.55);
    }
  }
  fus.computeVertexNormals();
  const fuselage = new THREE.Mesh(fus, red);
  fuselage.position.z = 0.5;
  body.add(fuselage);

  box(body, 3.5, 3.3, 1.6, cream, 0, 0, -4.4); // engine cowl

  const propeller = new THREE.Group();
  propeller.position.z = -5.4;
  body.add(propeller);
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.4, 6), cream);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -0.5;
  propeller.add(spinner);
  box(propeller, 0.5, 8.5, 0.25, brown);

  // Biplane wings + struts
  box(body, 15, 0.35, 3, red, 0, -0.9, -1.2);
  box(body, 15, 0.35, 3, red, 0, 2.7, -1.4);
  for (const x of [-5.5, 5.5]) {
    box(body, 0.22, 3.4, 0.22, cream, x, 0.9, -0.6);
    box(body, 0.22, 3.4, 0.22, cream, x, 0.9, -2.0);
  }
  box(body, 0.22, 1.6, 0.22, cream, -1.2, 1.9, -1.6);
  box(body, 0.22, 1.6, 0.22, cream, 1.2, 1.9, -1.6);

  // Tail
  box(body, 6, 0.25, 1.6, red, 0, 1.0, 4.6);
  box(body, 0.25, 2.6, 1.8, cream, 0, 2.2, 4.6);

  // Landing gear
  for (const x of [-2, 2]) {
    box(body, 0.3, 1.8, 0.3, cream, x, -1.9, -1.6);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.6, 10), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, -2.9, -1.6);
    body.add(wheel);
  }

  box(body, 2.4, 1.0, 0.12, glass, 0, 2.1, 0.4); // windshield

  // Pilot
  const pilot = new THREE.Group();
  pilot.position.set(0, 1.9, 1.4);
  body.add(pilot);
  box(pilot, 1.5, 1.3, 1.3, brown);
  const head = new THREE.Group();
  head.position.y = 1.15;
  pilot.add(head);
  box(head, 1.1, 1.1, 1.1, skin);
  box(head, 1.22, 0.45, 1.22, brown, 0, 0.45, 0.05);
  box(head, 1.22, 0.8, 0.3, brown, 0, 0.1, 0.5);
  box(head, 1.26, 0.3, 0.2, dark, 0, 0.15, -0.55);
  box(head, 0.36, 0.3, 0.1, lens, -0.28, 0.15, -0.66);
  box(head, 0.36, 0.3, 0.1, lens, 0.28, 0.15, -0.66);

  // Scarf: a chain of segments that flaps in the wind
  const scarf = [];
  let parent = pilot;
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Group();
    if (i === 0) seg.position.set(0.35, 0.55, 0.6);
    else seg.position.z = 0.7;
    box(seg, 0.55, 0.14, 0.75, yellow, 0, 0, 0.35);
    parent.add(seg);
    parent = seg;
    scarf.push(seg);
  }

  root.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });

  return {
    root,
    setPilotVisible(v) {
      pilot.visible = v;
    },
    update(t, dt, flight) {
      propeller.rotation.z += dt * (flight.engine * 25 + flight.speed * 0.7);
      const air = flight.grounded ? 0 : 1;
      body.position.y = Math.sin(t * 2.2) * 0.18 * air;
      body.rotation.z = Math.sin(t * 1.3) * 0.02 * air;
      head.rotation.y = damp(head.rotation.y, flight.turnInput * 0.6, 4, dt);
      head.rotation.x = damp(head.rotation.x, -flight.pitch * 0.5, 4, dt);
      scarf.forEach((s, i) => {
        s.rotation.x = Math.sin(t * 14 + i * 1.1) * 0.25 + 0.12;
        s.rotation.y = Math.sin(t * 11 + i * 1.3) * 0.3;
      });
      root.updateMatrixWorld();
    },
  };
}

// Arcade flight model: always flying forward, steer/climb/boost.
export class Flight {
  constructor(root, islands) {
    this.root = root;
    this.pos = root.position;
    this.islands = islands;
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.speed = 40;
    this.forward = new THREE.Vector3(0, 0, -1);
    this.autopilot = null;
    this.turnInput = 0;
    this.boosting = false;
    this.outOfBounds = false;
    this.engine = 1;
    this.grounded = false;
  }

  // Used by scripted sequences (landing / takeoff) to drive the plane directly.
  applyPose() {
    const cp = Math.cos(this.pitch);
    this.forward.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    this.root.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
  }

  setAutopilot(center, radius, alt) {
    this.autopilot = center ? { center, radius, alt } : null;
  }

  update(dt, input) {
    let { turn, climb, boost } = input;
    const ap = this.autopilot;

    if (ap) {
      // Circle the target counter-clockwise, correcting toward the desired radius.
      const dx = this.pos.x - ap.center.x;
      const dz = this.pos.z - ap.center.z;
      const d = Math.hypot(dx, dz) || 1;
      const ux = dx / d, uz = dz / d;
      const err = clamp((d - ap.radius) / ap.radius, -1, 1);
      const tx = uz - ux * err * 1.5;
      const tz = -ux - uz * err * 1.5;
      turn = clamp(angDiff(Math.atan2(-tx, -tz), this.yaw) * 2.5, -1, 1);
      climb = clamp((ap.alt - this.pos.y) * 0.06, -1, 1);
      boost = false;
    }

    // Soft world border: steer back home
    const dist = Math.hypot(this.pos.x, this.pos.z);
    this.outOfBounds = dist > WORLD_RADIUS;
    if (this.outOfBounds) {
      turn = clamp(angDiff(Math.atan2(this.pos.x, this.pos.z), this.yaw) * 2, -1, 1);
    }

    this.turnInput = turn;
    this.boosting = boost;
    this.speed = damp(this.speed, boost ? 90 : ap ? 38 : 48, boost ? 1.5 : 1.0, dt);
    this.yaw += turn * 1.3 * dt;
    this.roll = damp(this.roll, turn * 0.8, 5, dt);
    this.pitch = damp(this.pitch, climb * 0.5, 3, dt);

    const cp = Math.cos(this.pitch);
    this.forward.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    this.pos.addScaledVector(this.forward, this.speed * dt);

    // Keep above water and island scenery
    let floor = MIN_ALT;
    for (const isl of this.islands) {
      const d = Math.hypot(this.pos.x - isl.center.x, this.pos.z - isl.center.z);
      floor = Math.max(floor, MIN_ALT + isl.clearance * (1 - smoothstep(isl.coreRadius, isl.coreRadius + 35, d)));
    }
    if (this.pos.y < floor) {
      this.pos.y = damp(this.pos.y, floor, 6, dt);
      this.pitch = damp(this.pitch, 0.3, 4, dt);
    }
    if (this.pos.y > MAX_ALT) this.pos.y = damp(this.pos.y, MAX_ALT, 4, dt);

    this.root.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
  }
}

// Little smoke puffs behind the plane
export function createTrail(scene) {
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const puffs = [];
  for (let i = 0; i < 70; i++) {
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, transparent: true, opacity: 0, depthWrite: false }),
    );
    m.visible = false;
    scene.add(m);
    puffs.push({ m, life: 0, max: 1 });
  }
  let idx = 0, acc = 0;
  const tmp = new THREE.Vector3();

  return {
    update(dt, root, flight) {
      acc += dt;
      const every = flight.boosting ? 0.022 : 0.055;
      if (flight.speed < 8) acc = 0;
      while (acc > every) {
        acc -= every;
        const pf = puffs[idx++ % puffs.length];
        tmp.set((Math.random() - 0.5) * 0.6, 0.3 + (Math.random() - 0.5) * 0.6, 5.4);
        root.localToWorld(tmp);
        pf.m.position.copy(tmp);
        pf.m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
        pf.life = 0;
        pf.max = 0.8 + Math.random() * 0.5;
        pf.m.visible = true;
      }
      for (const pf of puffs) {
        if (!pf.m.visible) continue;
        pf.life += dt;
        const k = pf.life / pf.max;
        if (k >= 1) { pf.m.visible = false; continue; }
        pf.m.scale.setScalar(0.35 + k * 2.1);
        pf.m.material.opacity = 0.5 * (1 - k);
        pf.m.position.y += dt * 2;
      }
    },
  };
}
