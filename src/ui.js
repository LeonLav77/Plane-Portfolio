import { WORLD_RADIUS } from './plane.js';

const HINTS = {
  flying: '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> fly · <kbd>Shift</kbd> boost · <kbd>E</kbd> land · <kbd>M</kbd> sound',
  walking: '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk · <kbd>Shift</kbd> run · <kbd>Space</kbd> jump · <kbd>E</kbd> interact · <kbd>Esc</kbd> fly',
  none: '',
};

export function createUI(islands) {
  const $ = (id) => document.getElementById(id);
  const intro = $('intro');
  const hud = $('hud');
  const prompt = $('prompt');
  const toastEl = $('toast');
  const hint = $('keys-hint');
  const readbar = $('readbar');
  const openBtn = readbar.querySelector('[data-act="open"]');
  const spd = $('spd');
  const alt = $('alt');
  const found = $('found');
  const map = $('minimap');
  const mctx = map.getContext('2d');

  const handlers = {};
  $('start').addEventListener('click', () => handlers.start?.());
  prompt.addEventListener('click', () => handlers.prompt?.());
  readbar.addEventListener('click', (e) => {
    const act = e.target.closest('button')?.dataset.act;
    if (act) handlers.read?.(act);
  });

  let currentPrompt = null;
  let currentHint = null;
  let toastTimer;

  function drawMap(pos, yaw, visited) {
    const W = map.width, H = map.height, cx = W / 2, cy = H / 2;
    const s = (W / 2 - 18) / WORLD_RADIUS;
    mctx.clearRect(0, 0, W, H);
    mctx.strokeStyle = 'rgba(255,255,255,0.25)';
    mctx.lineWidth = 2;
    for (const rr of [0.33, 0.66, 1]) {
      mctx.beginPath();
      mctx.arc(cx, cy, WORLD_RADIUS * s * rr, 0, Math.PI * 2);
      mctx.stroke();
    }
    for (const isl of islands) {
      const x = cx + isl.center.x * s, y = cy + isl.center.z * s;
      mctx.fillStyle = isl.def.color;
      mctx.strokeStyle = '#1d2340';
      mctx.lineWidth = 4;
      mctx.beginPath();
      mctx.arc(x, y, Math.max(9, isl.radius * s * 1.3), 0, Math.PI * 2);
      mctx.fill();
      mctx.stroke();
      if (visited.has(isl.id)) {
        mctx.beginPath();
        mctx.moveTo(x - 5, y);
        mctx.lineTo(x - 1, y + 5);
        mctx.lineTo(x + 6, y - 5);
        mctx.stroke();
      }
    }
    mctx.save();
    mctx.translate(cx + pos.x * s, cy + pos.z * s);
    mctx.rotate(-yaw);
    mctx.fillStyle = '#fffaf0';
    mctx.strokeStyle = '#1d2340';
    mctx.lineWidth = 4;
    mctx.beginPath();
    mctx.moveTo(0, -16);
    mctx.lineTo(11, 12);
    mctx.lineTo(0, 6);
    mctx.lineTo(-11, 12);
    mctx.closePath();
    mctx.fill();
    mctx.stroke();
    mctx.restore();
  }

  return {
    on(name, fn) {
      handlers[name] = fn;
    },
    hideIntro() {
      intro.classList.add('gone');
      hud.classList.remove('hidden');
    },
    // html = null hides the prompt
    setPrompt(html, color = '#ff5a5f') {
      const key = html && html + color;
      if (key === currentPrompt) return;
      currentPrompt = key;
      if (html) {
        prompt.innerHTML = `<kbd>E</kbd> ${html}`;
        prompt.style.setProperty('--c', color);
        prompt.classList.remove('hidden');
      } else {
        prompt.classList.add('hidden');
      }
    },
    setHint(mode) {
      if (mode === currentHint) return;
      currentHint = mode;
      hint.innerHTML = HINTS[mode] ?? '';
      hint.style.display = HINTS[mode] ? '' : 'none';
    },
    setReading(board, color) {
      readbar.classList.toggle('hidden', !board);
      hud.classList.toggle('reading', !!board);
      if (board) {
        readbar.style.setProperty('--c', color);
        openBtn.style.display = board.def.link ? '' : 'none';
      }
    },
    toast(html, ms = 2600) {
      toastEl.innerHTML = html;
      toastEl.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
    },
    setFound(n, total) {
      found.textContent = `${n}/${total}`;
    },
    update(pos, yaw, speed, altitude, visited) {
      spd.textContent = Math.round(speed);
      alt.textContent = Math.round(altitude);
      drawMap(pos, yaw, visited);
    },
  };
}
