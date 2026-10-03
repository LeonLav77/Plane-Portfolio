import * as THREE from 'three';
import './style.css';
import { ISLANDS } from './content.js';
import { createWorld } from './world.js';
import { buildIsland } from './islands.js';
import { BOARD_W, BOARD_H } from './boards.js';
import { createPlane, createTrail, Flight } from './plane.js';
import { createCharacter, Walker, createHop } from './character.js';
import { createLanding, createTakeoff } from './sequences.js';
import { createInput } from './input.js';
import { createUI } from './ui.js';
import { createAudio } from './audio.js';

const { damp } = THREE.MathUtils;

// ---------- renderer / scene ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.5, 6000);

const islands = ISLANDS.map((def, i) => {
  const isl = buildIsland(def, i);
  scene.add(isl.group);
  return isl;
});
const home = islands[0];
const world = createWorld(scene, islands);

const plane = createPlane();
scene.add(plane.root);
const flight = new Flight(plane.root, islands);
plane.root.position.set(home.center.x + 95, 45, home.center.z);
flight.setAutopilot(home.center, 95, 45);

const pilot = createCharacter();
pilot.root.visible = false;
scene.add(pilot.root);
const walker = new Walker(pilot);

// Bouncing marker over whatever you can interact with
const marker = new THREE.Mesh(
  new THREE.ConeGeometry(0.9, 1.8, 4).rotateX(Math.PI),
  new THREE.MeshStandardMaterial({ color: '#ffd166', emissive: '#ffb703', emissiveIntensity: 0.6, flatShading: true }),
);
marker.visible = false;
scene.add(marker);

const trail = createTrail(scene);
const input = createInput(canvas);
const ui = createUI(islands);
const audio = createAudio();

// ---------- game state ----------
// intro → flying → landing → hopout → walking ⇄ reading → hopin → takeoff → flying
let mode = 'intro';
let island = null; // island we're on / landing at
let seq = null; // active landing / takeoff / hop sequence
let target = null; // { type: 'board' | 'plane' | 'island', ... }
let reading = null; // board being read
let wasOutOfBounds = false;
let time = 0;
const visited = new Set();
const timer = new THREE.Timer();
const tmp = new THREE.Vector3();

function setMode(m) {
  mode = m;
  ui.setHint(m === 'flying' ? 'flying' : m === 'walking' ? 'walking' : 'none');
  ui.setReading(m === 'reading' ? reading : null, island?.def.color);
}

function takeOff() {
  if (mode !== 'intro') return;
  ui.hideIntro();
  audio.start();
  setTimeout(() => ui.toast('Fly to the <b>glowing beacons</b> ✦'), 900);
  flight.setAutopilot(null);
  setMode('flying');
}

function startLanding(isl) {
  island = isl;
  seq = createLanding(flight, isl);
  setMode('landing');
}

function cockpitPos() {
  return plane.root.localToWorld(new THREE.Vector3(0, 0.6, 1.4));
}

function hopOut() {
  plane.setPilotVisible(false);
  pilot.root.visible = true;
  walker.groundY = island.top;
  // land just ahead of the plane's nose so the camera has a clear view
  const to = island.strip.park.clone().addScaledVector(island.strip.dir, 9).addScaledVector(island.strip.inward, 6).setY(island.top);
  seq = createHop(cockpitPos(), to, 5, 0.8);
  setMode('hopout');
  if (!visited.has(island.id)) {
    visited.add(island.id);
    island.setVisited();
    audio.chime();
    ui.setFound(visited.size, islands.length);
    ui.toast(
      visited.size === islands.length
        ? '🏆 All islands found — certified pilot!'
        : `🏝️ Welcome to <b>${island.def.name}</b>`,
    );
  }
}

function hopIn() {
  const from = pilot.root.position.clone();
  const to = cockpitPos();
  const d = from.distanceTo(to);
  seq = createHop(from, to, 4 + d * 0.2, 0.6 + d / 50);
  setMode('hopin');
}

function startReading(board) {
  reading = board;
  pilot.root.visible = false;
  setMode('reading');
}

function stopReading() {
  const b = reading;
  const spot = b.base.clone().addScaledVector(b.normal, 5.5);
  walker.place(spot, Math.atan2(b.normal.x, b.normal.z));
  pilot.root.visible = true;
  reading = null;
  setMode('walking');
}

// dir: -1 = left on screen, +1 = right on screen
function cycleBoard(dir) {
  const right = new THREE.Vector3(reading.normal.z, 0, -reading.normal.x);
  const boards = island.boards;
  const cand = [boards[reading.index - 1], boards[reading.index + 1]].filter(Boolean);
  const next = cand.find((b) => Math.sign(tmp.subVectors(b.base, reading.base).dot(right)) === dir);
  if (next) {
    reading = next;
    ui.setReading(reading, island.def.color);
  }
}

function openLink() {
  const link = reading?.def.link;
  if (link) window.open(link.url, '_blank', 'noopener');
}

function interact() {
  if (mode === 'flying' && target?.type === 'island') startLanding(target.island);
  else if (mode === 'walking' && target?.type === 'board') startReading(target.board);
  else if (mode === 'walking' && target?.type === 'plane') hopIn();
  else if (mode === 'reading') stopReading();
}

input.onKey((code) => {
  if (code === 'KeyM') {
    const muted = audio.toggleMute();
    if (mode !== 'intro') ui.toast(muted ? '🔇 Sound off' : '🔊 Sound on', 1200);
    return;
  }
  if (mode === 'intro') return takeOff();
  if (code === 'KeyE' || (code === 'Enter' && mode !== 'reading')) interact();
  if (mode === 'walking' && code === 'Space') walker.jump();
  if (mode === 'walking' && code === 'Escape') hopIn();
  if (mode === 'reading') {
    if (code === 'Escape') stopReading();
    if (code === 'Enter') openLink();
    if (code === 'KeyA' || code === 'ArrowLeft') cycleBoard(-1);
    if (code === 'KeyD' || code === 'ArrowRight') cycleBoard(1);
  }
});
ui.on('start', takeOff);
ui.on('prompt', interact);
ui.on('read', (act) => {
  if (act === 'back') stopReading();
  if (act === 'open') openLink();
  if (act === 'prev') cycleBoard(-1);
  if (act === 'next') cycleBoard(1);
});
canvas.addEventListener('click', () => {
  if (mode === 'reading') openLink();
});

// ---------- interaction targets ----------
function findTarget() {
  if (mode === 'flying') {
    let best = null, bestD = Infinity;
    for (const isl of islands) {
      const d = Math.hypot(flight.pos.x - isl.center.x, flight.pos.z - isl.center.z);
      if (d < isl.radius + 60 && d < bestD) { bestD = d; best = isl; }
    }
    return best && { type: 'island', island: best };
  }
  if (mode === 'walking') {
    const p = walker.pos;
    let best = null, bestD = Infinity;
    for (const b of island.boards) {
      tmp.subVectors(p, b.base);
      const front = tmp.dot(b.normal);
      const side = Math.abs(tmp.dot(b.tangent));
      if (front > 0 && front < 11 && side < BOARD_W / 2 + 1 && front < bestD) { bestD = front; best = b; }
    }
    const dPlane = Math.hypot(p.x - flight.pos.x, p.z - flight.pos.z);
    if (dPlane < 10 && dPlane < bestD) return { type: 'plane' };
    return best && { type: 'board', board: best };
  }
  return null;
}

function updateTarget(t) {
  target = findTarget();
  if (!target) ui.setPrompt(null);
  else if (target.type === 'island') ui.setPrompt(`Land at <b>${target.island.def.name}</b>`, target.island.def.color);
  else if (target.type === 'board') ui.setPrompt(`Read <b>${target.board.def.title}</b>`, island.def.color);
  else ui.setPrompt('<b>Take off</b>', '#7bd88f');

  marker.visible = target?.type === 'board' || target?.type === 'plane';
  if (marker.visible) {
    if (target.type === 'board') marker.position.copy(target.board.face).setY(target.board.face.y + BOARD_H / 2 + 2.4);
    else marker.position.copy(flight.pos).setY(flight.pos.y + 6);
    marker.position.y += Math.sin(t * 5) * 0.4;
    marker.rotation.y = t * 2;
  }
}

// ---------- camera ----------
const desired = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const camLook = new THREE.Vector3().copy(plane.root.position);
const focus = new THREE.Vector3();
const walkOut = new THREE.Vector3(0, 0, 1);
let viewShift = 0;
camera.position.set(home.center.x + 160, 70, home.center.z + 80);

function chaseCam() {
  const p = plane.root.position;
  const dist = 24 + (flight.speed - 48) * 0.12;
  desired.set(p.x + Math.sin(flight.yaw) * dist, p.y + 7 - flight.pitch * 8, p.z + Math.cos(flight.yaw) * dist);
  lookTarget.copy(p).addScaledVector(flight.forward, 14);
  focus.copy(p);
}

function updateCamera(dt, t) {
  const p = plane.root.position;
  let k = 4;
  let shiftTarget = 0;
  let fovTarget = 60;

  if (mode === 'intro') {
    const a = flight.yaw + Math.PI / 2 + Math.sin(t * 0.25) * 0.9;
    desired.set(p.x + Math.sin(a) * 28, p.y + 5, p.z + Math.cos(a) * 28);
    lookTarget.copy(p);
    k = 6;
    shiftTarget = innerWidth > 760 ? -0.2 : 0;
    focus.copy(p);
  } else if (mode === 'flying' || mode === 'landing' || mode === 'takeoff') {
    chaseCam();
    if (mode === 'flying' && flight.boosting) fovTarget = 76;
  } else if (mode === 'reading') {
    // Frame the board so it fills the screen
    const tanV = Math.tan(THREE.MathUtils.degToRad(30));
    const d = Math.max((BOARD_H / 2 + 1.1) / tanV, (BOARD_W / 2 + 0.9) / (tanV * (camera.aspect || 1)));
    desired.copy(reading.face).addScaledVector(reading.normal, d);
    lookTarget.copy(reading.face);
    k = 5;
    focus.copy(reading.base);
  } else {
    // On foot: camera sits outside the character, looking in toward the island centre
    const c = pilot.root.position;
    tmp.set(c.x - island.center.x, 0, c.z - island.center.z);
    if (tmp.length() > 8) walkOut.lerp(tmp.normalize(), 1 - Math.exp(-2.5 * dt)).normalize();
    desired.copy(c).addScaledVector(walkOut, 16);
    desired.y = c.y + 8;
    lookTarget.copy(c).setY(c.y + 3);
    k = mode === 'walking' ? 5 : 3;
    focus.copy(c);
  }

  camera.position.lerp(desired, 1 - Math.exp(-k * dt));
  camLook.lerp(lookTarget, 1 - Math.exp(-k * 1.5 * dt));
  camera.lookAt(camLook);
  camera.fov = damp(camera.fov, fovTarget, 3, dt);
  viewShift = damp(viewShift, shiftTarget, 2.5, dt);
  if (innerWidth && innerHeight) camera.setViewOffset(innerWidth, innerHeight, innerWidth * viewShift, 0, innerWidth, innerHeight);
  camera.updateProjectionMatrix();
}

// ---------- loop ----------
const NO_INPUT = { turn: 0, climb: 0, boost: false };
const camFwd = new THREE.Vector3();

function tick(dt) {
  time += dt;
  const t = time;

  if (mode === 'intro' || mode === 'flying') {
    flight.update(dt, mode === 'flying' ? input.read() : NO_INPUT);
    if (mode === 'flying') {
      if (flight.outOfBounds && !wasOutOfBounds) ui.toast('🌊 Nothing out there but ocean — turning back');
      wasOutOfBounds = flight.outOfBounds;
    }
  } else if (mode === 'landing') {
    if (seq.update(dt)) hopOut();
  } else if (mode === 'takeoff') {
    if (seq.update(dt)) {
      flight.grounded = false;
      island = null;
      setMode('flying');
    }
  } else if (mode === 'hopout' || mode === 'hopin') {
    const done = seq.update(dt);
    pilot.root.position.copy(seq.pos);
    pilot.root.rotation.y = seq.yaw;
    pilot.update(t, dt, 0, false);
    if (done && mode === 'hopout') {
      walker.place(seq.pos, seq.yaw);
      setMode('walking');
    } else if (done) {
      pilot.root.visible = false;
      plane.setPilotVisible(true);
      seq = createTakeoff(flight, island);
      setMode('takeoff');
    }
  } else if (mode === 'walking') {
    const raw = input.read();
    camFwd.set(-walkOut.x, 0, -walkOut.z);
    walker.update(dt, { x: -raw.turn, y: raw.climb }, input.isDown('ShiftLeft', 'ShiftRight'), camFwd, island);
    pilot.update(t, dt, walker.speed, walker.grounded);
  }

  plane.update(t, dt, flight);
  trail.update(dt, plane.root, flight);
  for (const isl of islands) isl.update(t, dt, camera);
  updateTarget(t);

  updateCamera(dt, t);
  world.update(t, dt, camera, focus);
  const onFoot = mode === 'walking' || mode === 'reading' || mode === 'hopout' || mode === 'hopin';
  ui.update(
    onFoot ? pilot.root.position : flight.pos,
    onFoot ? walker.yaw : flight.yaw,
    onFoot ? walker.speed * 1.5 : flight.speed * 2.2,
    onFoot ? 0 : flight.pos.y * 10,
    visited,
  );
  audio.update(flight.speed, flight.engine);

  renderer.render(scene, camera);
}

function frame(now) {
  timer.update(now);
  tick(Math.min(timer.getDelta(), 0.05));
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (import.meta.env.DEV) {
  window.__game = {
    flight, islands, camera, walker,
    get mode() { return mode; },
    takeOff, startLanding, interact,
    step: (n = 60) => { for (let i = 0; i < n; i++) tick(1 / 60); },
  };
}

window.addEventListener('resize', () => {
  if (!innerWidth || !innerHeight) return; // hidden/minimised window
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
