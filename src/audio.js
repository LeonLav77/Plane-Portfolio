// Synthesized engine hum + discovery chime (no audio files needed).
export function createAudio() {
  let ctx = null;
  let master, filter, engine, engine2, lfo;
  let muted = false;

  return {
    start() {
      if (ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();

      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);

      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      filter.Q.value = 2;
      filter.connect(master);

      const mix = ctx.createGain();
      mix.gain.value = 0.6;
      mix.connect(filter);

      engine = ctx.createOscillator();
      engine.type = 'sawtooth';
      engine.frequency.value = 55;
      engine2 = ctx.createOscillator();
      engine2.type = 'triangle';
      engine2.frequency.value = 110;
      engine.connect(mix);
      engine2.connect(mix);

      // Amplitude wobble = propeller "chop"
      lfo = ctx.createOscillator();
      lfo.frequency.value = 18;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.25;
      lfo.connect(lfoGain);
      lfoGain.connect(mix.gain);

      engine.start();
      engine2.start();
      lfo.start();
    },

    update(speed, throttle = 1) {
      if (!ctx) return;
      const now = ctx.currentTime;
      const f = 40 + speed * 0.7;
      engine.frequency.setTargetAtTime(f, now, 0.15);
      engine2.frequency.setTargetAtTime(f * 2.01, now, 0.15);
      filter.frequency.setTargetAtTime(350 + speed * 9, now, 0.2);
      lfo.frequency.setTargetAtTime(10 + speed * 0.3, now, 0.2);
      master.gain.setTargetAtTime(muted ? 0 : 0.05 * throttle, now, 0.3);
    },

    chime() {
      if (!ctx || muted) return;
      [660, 880, 1320].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        const t0 = ctx.currentTime + i * 0.09;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.12, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(t0);
        o.stop(t0 + 0.7);
      });
    },

    toggleMute() {
      muted = !muted;
      return muted;
    },
  };
}
