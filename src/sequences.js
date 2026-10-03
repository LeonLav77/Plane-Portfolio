import * as THREE from 'three';

const { damp, clamp } = THREE.MathUtils;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// Curved approach -> flare -> touchdown -> roll to a stop on the island strip.
export function createLanding(flight, island) {
  const s = island.strip;
  const fwd = new THREE.Vector3(flight.forward.x, 0, flight.forward.z).normalize();
  const p0 = flight.pos.clone();
  const p1 = p0.clone().addScaledVector(fwd, 70);
  p1.y = Math.max(p0.y, island.clearance + 35);
  const p2 = s.touchdown.clone().addScaledVector(s.dir, -120);
  p2.y = s.touchdown.y + 18;
  const curve = new THREE.CubicBezierCurve3(p0, p1, p2, s.touchdown.clone());
  curve.arcLengthDivisions = 400;
  const len = curve.getLength();
  const rollLen = s.park.distanceTo(s.touchdown);
  const tan = new THREE.Vector3();

  let phase = 'air';
  let dist = 0;
  let rolled = 0;
  let speed = Math.max(flight.speed, 45);
  flight.setAutopilot(null);

  return {
    get phase() {
      return phase;
    },
    update(dt) {
      if (phase === 'air') {
        speed = damp(speed, 26 + (1 - dist / len) * 26, 1.5, dt);
        dist = Math.min(len, dist + speed * dt);
        const u = dist / len;
        curve.getPointAt(u, flight.pos);
        curve.getTangentAt(u, tan);
        const dy = angDiff(Math.atan2(-tan.x, -tan.z), flight.yaw);
        flight.yaw += dy;
        flight.roll = damp(flight.roll, clamp((dy / Math.max(dt, 1e-3)) * 0.5, -0.9, 0.9), 4, dt);
        flight.pitch = damp(flight.pitch, Math.asin(clamp(tan.y, -1, 1)) * 0.8 + (u > 0.9 ? 0.15 : 0), 4, dt);
        if (dist >= len) phase = 'roll';
      } else if (phase === 'roll') {
        flight.grounded = true;
        speed = Math.max(2, Math.min(speed, Math.sqrt(2 * 12 * Math.max(rollLen - rolled, 0))));
        rolled = Math.min(rollLen, rolled + speed * dt);
        flight.pos.copy(s.touchdown).addScaledVector(s.dir, rolled);
        flight.yaw += angDiff(s.yaw, flight.yaw) * (1 - Math.exp(-8 * dt));
        flight.roll = damp(flight.roll, 0, 6, dt);
        flight.pitch = damp(flight.pitch, 0.03, 5, dt);
        if (rolled >= rollLen - 0.01) {
          phase = 'done';
          speed = 0;
        }
      }
      flight.speed = speed;
      flight.engine = phase === 'air' ? 1 : damp(flight.engine, 0.15, 1.5, dt);
      flight.applyPose();
      return phase === 'done';
    },
  };
}

// Spin around on the strip, roll back down it and climb out.
export function createTakeoff(flight, island) {
  const s = island.strip;
  const groundY = s.park.y;
  const startYaw = flight.yaw;
  const targetYaw = startYaw + angDiff(s.yaw + Math.PI, startYaw);
  let t = 0;
  let speed = 0;
  flight.grounded = true;

  return {
    update(dt) {
      t += dt;
      flight.engine = damp(flight.engine, 1, 3, dt);
      if (t < 1.1) {
        const k = t / 1.1;
        flight.yaw = startYaw + (targetYaw - startYaw) * (k * k * (3 - 2 * k));
        flight.applyPose();
        return false;
      }
      speed = Math.min(52, speed + 22 * dt);
      flight.pitch = damp(flight.pitch, speed > 24 ? 0.32 : 0.02, 2.5, dt);
      flight.roll = damp(flight.roll, 0, 4, dt);
      flight.speed = speed;
      flight.applyPose();
      flight.pos.addScaledVector(flight.forward, speed * dt);
      if (flight.pos.y < groundY) flight.pos.y = groundY;
      flight.grounded = flight.pos.y <= groundY + 0.01;
      return flight.pos.y > groundY + 30 || t > 9;
    },
  };
}
