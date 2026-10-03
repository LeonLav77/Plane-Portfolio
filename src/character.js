import * as THREE from 'three';

const { damp, clamp } = THREE.MathUtils;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.75, ...extra });
}
function box(parent, w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// The pilot on foot. Faces -Z, feet at y = 0.
export function createCharacter() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const jacket = mat('#6b3e26');
  const pants = mat('#3b4a6b');
  const boots = mat('#2a2230');
  const skin = mat('#f5c29b');
  const dark = mat('#2a2230');
  const lens = mat('#7fd1ff', { roughness: 0.1, metalness: 0.3 });
  const yellow = mat('#ffd23f');

  const leg = (x) => {
    const g = new THREE.Group();
    g.position.set(x, 1.3, 0);
    body.add(g);
    box(g, 0.55, 1.15, 0.6, pants, 0, -0.55, 0);
    box(g, 0.62, 0.38, 0.85, boots, 0, -1.12, -0.1);
    return g;
  };
  const legL = leg(-0.38);
  const legR = leg(0.38);

  box(body, 1.5, 1.4, 0.95, jacket, 0, 2.0, 0);
  box(body, 1.56, 0.22, 1.0, dark, 0, 1.4, 0);
  box(body, 0.5, 0.5, 0.1, mat('#c08a5a'), 0.35, 2.2, -0.5);

  const arm = (x) => {
    const g = new THREE.Group();
    g.position.set(x, 2.55, 0);
    body.add(g);
    box(g, 0.45, 1.2, 0.5, jacket, 0, -0.55, 0);
    box(g, 0.42, 0.35, 0.45, skin, 0, -1.3, 0);
    return g;
  };
  const armL = arm(-0.98);
  const armR = arm(0.98);

  const head = new THREE.Group();
  head.position.y = 2.7;
  body.add(head);
  box(head, 1.1, 1.1, 1.1, skin, 0, 0.55, 0);
  box(head, 1.22, 0.45, 1.22, jacket, 0, 1.05, 0.05);
  box(head, 1.22, 0.8, 0.3, jacket, 0, 0.65, 0.5);
  box(head, 0.16, 0.16, 0.05, dark, -0.25, 0.6, -0.56);
  box(head, 0.16, 0.16, 0.05, dark, 0.25, 0.6, -0.56);
  box(head, 1.26, 0.28, 0.25, dark, 0, 1.0, -0.55); // goggles pushed up on the cap
  box(head, 0.36, 0.26, 0.1, lens, -0.28, 1.0, -0.68);
  box(head, 0.36, 0.26, 0.1, lens, 0.28, 1.0, -0.68);

  const scarf = [];
  let parent = body;
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Group();
    if (i === 0) seg.position.set(0.3, 2.65, 0.45);
    else seg.position.z = 0.6;
    box(seg, 0.5, 0.14, 0.65, yellow, 0, 0, 0.3);
    parent.add(seg);
    parent = seg;
    scarf.push(seg);
  }

  root.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });

  let phase = 0;
  return {
    root,
    update(t, dt, speed, grounded) {
      const amp = clamp(speed / 11, 0, 1.4);
      phase += dt * speed * 0.85;
      const swing = Math.sin(phase) * 0.75 * amp;
      const k = 14;
      legL.rotation.x = damp(legL.rotation.x, grounded ? swing : -0.7, k, dt);
      legR.rotation.x = damp(legR.rotation.x, grounded ? -swing : 0.5, k, dt);
      armL.rotation.x = damp(armL.rotation.x, grounded ? -swing * 0.9 : 0, k, dt);
      armR.rotation.x = damp(armR.rotation.x, grounded ? swing * 0.9 : 0, k, dt);
      armL.rotation.z = damp(armL.rotation.z, grounded ? 0 : -2.5, 10, dt);
      armR.rotation.z = damp(armR.rotation.z, grounded ? 0 : 2.5, 10, dt);
      body.position.y = grounded ? Math.abs(Math.sin(phase)) * 0.2 * amp + Math.sin(t * 2.4) * 0.03 : 0;
      body.rotation.x = damp(body.rotation.x, -amp * 0.12, 6, dt);
      head.rotation.y = Math.sin(t * 0.7) * 0.15 * (1 - Math.min(amp, 1));
      scarf.forEach((s, i) => {
        const a = 0.15 + amp * 0.3 + (grounded ? 0 : 0.4);
        s.rotation.x = Math.sin(t * (6 + amp * 8) + i * 1.1) * a * 0.6 + (amp > 0.1 ? 0.15 : 0.5);
        s.rotation.y = Math.sin(t * 5 + i * 1.3) * a * 0.5;
      });
    },
  };
}

// Third-person movement on an island: camera-relative, with jump + simple circle colliders.
export class Walker {
  constructor(character) {
    this.char = character;
    this.pos = character.root.position;
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.yaw = 0;
    this.grounded = true;
    this.groundY = 0;
  }

  place(p, yaw = this.yaw) {
    this.pos.copy(p);
    this.vel.set(0, 0, 0);
    this.vy = 0;
    this.yaw = yaw;
    this.grounded = true;
    this.char.root.rotation.y = yaw;
  }

  jump() {
    if (!this.grounded) return;
    this.vy = 12;
    this.grounded = false;
  }

  get speed() {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  update(dt, move, sprint, camForward, island) {
    const fx = camForward.x, fz = camForward.z;
    let wx = fx * move.y - fz * move.x;
    let wz = fz * move.y + fx * move.x;
    const len = Math.hypot(wx, wz);
    if (len > 1) { wx /= len; wz /= len; }

    const top = sprint ? 20 : 11;
    const accel = this.grounded ? 10 : 3;
    this.vel.x = damp(this.vel.x, wx * top, accel, dt);
    this.vel.z = damp(this.vel.z, wz * top, accel, dt);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    if (len > 0.1) {
      const target = Math.atan2(-wx, -wz);
      this.yaw += angDiff(target, this.yaw) * (1 - Math.exp(-12 * dt));
    }

    this.vy -= 32 * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y <= this.groundY) {
      this.pos.y = this.groundY;
      this.vy = 0;
      this.grounded = true;
    }

    // Push out of props, keep on the island
    for (const c of island.colliders) {
      const dx = this.pos.x - c.x, dz = this.pos.z - c.z;
      const d = Math.hypot(dx, dz);
      const min = c.r + 0.9;
      if (d < min && d > 1e-4) {
        this.pos.x = c.x + (dx / d) * min;
        this.pos.z = c.z + (dz / d) * min;
      }
    }
    const ox = this.pos.x - island.center.x, oz = this.pos.z - island.center.z;
    const od = Math.hypot(ox, oz);
    if (od > island.walkRadius) {
      this.pos.x = island.center.x + (ox / od) * island.walkRadius;
      this.pos.z = island.center.z + (oz / od) * island.walkRadius;
    }

    this.char.root.rotation.y = this.yaw;
  }
}

// A cartoon jump from A to B (hopping in/out of the plane).
export function createHop(from, to, height, duration) {
  let t = 0;
  const pos = new THREE.Vector3();
  return {
    pos,
    yaw: Math.atan2(-(to.x - from.x), -(to.z - from.z)),
    update(dt) {
      t = Math.min(1, t + dt / duration);
      pos.lerpVectors(from, to, t);
      pos.y += Math.sin(t * Math.PI) * height;
      return t >= 1;
    },
  };
}
