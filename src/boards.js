import * as THREE from 'three';

export const BOARD_W = 10;
export const BOARD_H = 6.4;
export const BOARD_LIFT = 2.4; // bottom edge above ground

const CW = 1600;
const CH = Math.round((CW * BOARD_H) / BOARD_W); // 1024
const PAD = 80;
const INK = '#1d2340';
const MUTED = '#5c6185';
const PAPER = '#fffaf0';

function wrap(ctx, text, maxW) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    lines.push(line);
  }
  return lines;
}

function fitFont(ctx, text, weight, size, family, maxW, min = 40) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxW && s > min) {
    s -= 4;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

// Lays out (and optionally paints) the body; returns the height used.
function body(ctx, b, top, fs, paint) {
  const maxW = CW - PAD * 2;
  const lh = fs * 1.38;
  let y = top;

  if (b.text) {
    ctx.font = `600 ${fs}px Nunito, sans-serif`;
    ctx.fillStyle = INK;
    for (const line of wrap(ctx, b.text, maxW)) {
      if (paint) ctx.fillText(line, PAD, y + fs);
      y += lh;
    }
    y += fs * 0.5;
  }

  if (b.bullets) {
    ctx.font = `600 ${fs}px Nunito, sans-serif`;
    for (const item of b.bullets) {
      const lines = wrap(ctx, item, maxW - 60);
      if (paint) {
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(PAD + 14, y + fs * 0.62, fs * 0.17, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const line of lines) {
        if (paint) ctx.fillText(line, PAD + 52, y + fs);
        y += lh;
      }
      y += fs * 0.2;
    }
    y += fs * 0.3;
  }

  if (b.tags) {
    const ts = Math.round(fs * 0.78);
    ctx.font = `800 ${ts}px Nunito, sans-serif`;
    const h = ts * 1.9;
    let x = PAD;
    for (const tag of b.tags) {
      const w = ctx.measureText(tag).width + ts * 1.4;
      if (x + w > CW - PAD) { x = PAD; y += h + 16; }
      if (paint) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, h / 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.fillText(tag, x + ts * 0.7, y + h * 0.66);
      }
      x += w + 16;
    }
    y += h + 20;
  }
  return y - top;
}

function paintBoard(ctx, b, color) {
  ctx.clearRect(0, 0, CW, CH);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, CW, CH);

  // header
  const headH = b.meta ? 250 : 200;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, CW, headH);
  ctx.fillStyle = INK;
  ctx.fillRect(0, headH, CW, 10);
  const ts = fitFont(ctx, b.title, 700, 104, 'Fredoka, Nunito, sans-serif', CW - PAD * 2);
  ctx.fillText(b.title, PAD, b.meta ? 128 : 100 + ts * 0.36);
  if (b.meta) {
    ctx.font = '800 44px Nunito, sans-serif';
    ctx.globalAlpha = 0.75;
    ctx.fillText(b.meta.toUpperCase(), PAD, 206);
    ctx.globalAlpha = 1;
  }

  // body: shrink font until it fits above the link button
  const top = headH + 60;
  const bottom = CH - (b.link ? 200 : 60);
  let fs = 54;
  while (fs > 32 && body(ctx, b, top, fs, false) > bottom - top) fs -= 2;
  body(ctx, b, top, fs, true);

  if (b.link) {
    const label = `${b.link.label}  ↗`;
    ctx.font = '700 54px Fredoka, Nunito, sans-serif';
    const w = ctx.measureText(label).width + 140;
    const h = 112, x = PAD, y = CH - 60 - h;
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.roundRect(x + 10, y + 10, w, h, 28); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 28); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.stroke();
    ctx.fillStyle = INK;
    ctx.fillText(label, x + 70, y + 74);
    ctx.font = '800 36px Nunito, sans-serif';
    ctx.fillStyle = MUTED;
    ctx.fillText('press Enter', x + w + 40, y + 70);
  }

  ctx.strokeStyle = INK;
  ctx.lineWidth = 24;
  ctx.strokeRect(0, 0, CW, CH);
}

const woodMat = new THREE.MeshStandardMaterial({ color: '#8d5b3a', flatShading: true, roughness: 0.9 });
const frameMat = new THREE.MeshStandardMaterial({ color: '#a8754a', flatShading: true, roughness: 0.9 });

// A wooden signboard; local +Z is the readable face.
export function createBoard(b, color) {
  const group = new THREE.Group();

  const canvas = document.createElement('canvas');
  canvas.width = CW;
  canvas.height = CH;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const draw = () => {
    paintBoard(ctx, b, color);
    tex.needsUpdate = true;
  };
  draw();
  document.fonts?.ready.then(draw);

  const cy = BOARD_LIFT + BOARD_H / 2;
  for (const x of [-BOARD_W / 2 + 0.8, BOARD_W / 2 - 0.8]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.45, cy + BOARD_H / 2, 0.45), woodMat);
    post.position.set(x, (cy + BOARD_H / 2) / 2, -0.35);
    group.add(post);
  }
  const frame = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W + 0.5, BOARD_H + 0.5, 0.35), frameMat);
  frame.position.y = cy;
  group.add(frame);
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_W + 1.4, 0.5, 1.4),
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8 }),
  );
  roof.position.set(0, cy + BOARD_H / 2 + 0.5, 0);
  group.add(roof);

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(BOARD_W, BOARD_H),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, fog: false }),
  );
  face.position.set(0, cy, 0.18);
  face.userData.noShadow = true;
  group.add(face);

  return { group, def: b, faceHeight: cy };
}
