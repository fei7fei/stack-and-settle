/* All sounds are synthesised with Web Audio. No audio files. */
(function () {
  'use strict';
  const Snd = window.Snd = {};
  let ctx = null;

  function ac() {
    if (!S.db.settings.sound) return null;
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) { return null; }
  }
  function tone(c, freq, start, dur, type, vol, slideTo) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, start);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(c.destination);
    o.start(start); o.stop(start + dur + 0.02);
  }
  function noise(c, start, dur, freq, q, vol) {
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    const g = c.createGain(); g.gain.value = vol || 0.4;
    src.connect(f).connect(g).connect(c.destination);
    src.start(start);
  }

  Snd.clack = function () {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    noise(c, t, 0.05, 3200, 4, 0.5);
    tone(c, 2400, t, 0.04, 'triangle', 0.08);
    noise(c, t + 0.045, 0.04, 2600, 5, 0.3);
  };
  Snd.card = function () {
    const c = ac(); if (!c) return;
    noise(c, c.currentTime, 0.09, 1800, 0.7, 0.35);
  };
  Snd.cash = function () {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    [1318, 1760, 2093].forEach((f, i) => tone(c, f, t + i * 0.07, 0.25, 'triangle', 0.12));
    noise(c, t, 0.15, 4000, 2, 0.2);
  };
  Snd.bell = function () {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    [880, 1760, 2640].forEach((f, i) => tone(c, f, t, 1.6 - i * 0.4, 'sine', 0.18 / (i + 1)));
    [880, 1760].forEach((f, i) => tone(c, f, t + 0.45, 1.2 - i * 0.3, 'sine', 0.12 / (i + 1)));
  };
  Snd.buzz = function () {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    tone(c, 140, t, 0.18, 'square', 0.12);
    tone(c, 120, t + 0.2, 0.25, 'square', 0.12);
  };
  Snd.fanfare = function () {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.38]].forEach(([f, d]) => tone(c, f, t + d, 0.3, 'triangle', 0.14));
    [523, 659, 784, 1047].forEach(f => tone(c, f, t + 0.56, 0.9, 'triangle', 0.08));
  };
  Snd.tick = function () {
    const c = ac(); if (!c) return;
    tone(c, 1200, c.currentTime, 0.03, 'square', 0.04);
  };
})();
