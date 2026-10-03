const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

export function createInput(canvas) {
  const keys = new Set();
  const touch = { id: null, sx: 0, sy: 0, dx: 0, dy: 0 };
  let keyHandler = null;

  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    keyHandler?.(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  // Touch: drag anywhere on the canvas like a virtual joystick
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    Object.assign(touch, { id: e.pointerId, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0 });
  });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerId !== touch.id) return;
    touch.dx = clamp((e.clientX - touch.sx) / 70, -1, 1);
    touch.dy = clamp((e.clientY - touch.sy) / 70, -1, 1);
  });
  const end = (e) => {
    if (e.pointerId === touch.id) Object.assign(touch, { id: null, dx: 0, dy: 0 });
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);

  const k = (...codes) => (codes.some((c) => keys.has(c)) ? 1 : 0);

  return {
    onKey(fn) {
      keyHandler = fn;
    },
    isDown(...codes) {
      return k(...codes) === 1;
    },
    read() {
      return {
        turn: clamp(k('KeyA', 'ArrowLeft') - k('KeyD', 'ArrowRight') - touch.dx, -1, 1),
        climb: clamp(k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown') - touch.dy, -1, 1),
        boost: k('ShiftLeft', 'ShiftRight') === 1,
      };
    },
  };
}
