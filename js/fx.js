/* Visual effects: opening sequence, confetti, shareable recap image. */
(function () {
  'use strict';
  const FX = window.FX = {};
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function chip(ctx, x, y, r, color) {
    const th = r * 0.28;
    ctx.fillStyle = shade(color, -0.35);
    ctx.beginPath(); ctx.ellipse(x, y + th, r, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(x - r, y, r * 2, th);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = r * 0.12;
    ctx.setLineDash([r * 0.32, r * 0.42]);
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.8, r * 0.33, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
  function shade(hex, k) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return hex;
    const n = parseInt(m[1], 16);
    const f = c => Math.max(0, Math.min(255, Math.round(c + (k < 0 ? c * k : (255 - c) * k))));
    return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
  }
  FX.shade = shade;
  function card(ctx, w, hgt, label, suit, red) {
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
    roundRect(ctx, -w / 2, -hgt / 2, w, hgt, w * 0.1); ctx.fill(); ctx.stroke();
    ctx.fillStyle = red ? '#d93a3a' : '#111';
    ctx.font = '700 ' + Math.round(w * 0.26) + 'px system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(label, -w / 2 + w * 0.1, -hgt / 2 + w * 0.08);
    ctx.font = Math.round(w * 0.5) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(suit, 0, hgt * 0.06);
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  FX.roundRect = roundRect;

  /* ~3 s opening: chips drop and stack, cards fan out, then the logo. Tap to skip. */
  FX.intro = function () {
    return new Promise(resolve => {
      let played = false;
      try { played = sessionStorage.getItem('ss.intro') === '1'; sessionStorage.setItem('ss.intro', '1'); } catch (e) { played = false; }
      if (played) { resolve(); return; }
      const reduced = U.reduced();
      const wrap = U.h('div', { class: 'intro', 'aria-label': 'Stack & Settle' });
      const cv = U.h('canvas');
      const logo = U.h('div', { class: 'intro-logo' },
        U.h('div', { class: 'logo-mark' }, '♠'), U.h('div', { class: 'logo-text' }, 'Stack & Settle'),
        U.h('div', { class: 'logo-sub' }, T('Tap to skip')));
      wrap.append(cv, logo);
      document.body.append(wrap);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = innerWidth, H = innerHeight;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
      const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
      const colours = ['#f4f4f4', '#d93a3a', '#1a9e55', '#222222', '#2f6fdb'];
      const r = Math.min(W, H) * 0.075;
      const stacks = [W / 2 - r * 2.6, W / 2, W / 2 + r * 2.6];
      const baseY = H * 0.62;
      const chips = [];
      for (let i = 0; i < 15; i++) {
        const s = i % 3, lvl = Math.floor(i / 3);
        chips.push({ x: stacks[s], y: baseY - lvl * r * 0.3 - (s === 1 ? r * 0.3 : 0), t0: i * 70, color: colours[(i * 2 + s) % colours.length] });
      }
      const cards = [['A', '♠', 0], ['K', '♥', 1], ['Q', '♣', 0], ['J', '♦', 1], ['10', '♠', 0]];
      const total = reduced ? 900 : 3000;
      const t0 = performance.now();
      let done = false, raf = 0;
      const bg = css('--bg') || '#fff';
      function finish() {
        if (done) return; done = true;
        cancelAnimationFrame(raf);
        wrap.classList.add('out');
        setTimeout(() => { wrap.remove(); resolve(); }, 350);
      }
      wrap.addEventListener('click', finish);
      function frame(now) {
        const t = now - t0;
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
        if (!reduced) {
          // cards fan out behind the chips
          const cw = r * 1.9, ch = cw * 1.4;
          const fk = Math.max(0, Math.min(1, (t - 1150) / 650));
          const fe = 1 - Math.pow(1 - fk, 3);
          if (t > 1100) {
            cards.forEach((c, i) => {
              ctx.save();
              ctx.translate(W / 2, baseY - r * 2.2);
              ctx.rotate((i - 2) * 0.32 * fe);
              ctx.translate(0, -ch * 0.35 * fe);
              ctx.globalAlpha = Math.min(1, fk * 3);
              card(ctx, cw, ch, c[0], c[1], c[2]);
              ctx.restore();
            });
          }
          // chips drop with a little bounce
          chips.forEach(c => {
            const k = Math.max(0, Math.min(1, (t - c.t0) / 420));
            if (k <= 0) return;
            const b = k < 0.75 ? Math.pow(k / 0.75, 2) : 1 - Math.sin((k - 0.75) / 0.25 * Math.PI) * 0.06;
            const y = -r * 2 + (c.y + r * 2) * b;
            chip(ctx, c.x, y, r, c.color);
          });
        }
        const lk = reduced ? 1 : Math.max(0, Math.min(1, (t - 1900) / 600));
        logo.style.opacity = lk;
        logo.style.transform = 'translateY(' + (1 - lk) * 14 + 'px)';
        if (t < total) raf = requestAnimationFrame(frame); else setTimeout(finish, reduced ? 200 : 350);
      }
      raf = requestAnimationFrame(frame);
    });
  };

  /* confetti burst over the whole screen */
  FX.confetti = function () {
    if (U.reduced()) return;
    const cv = U.h('canvas', { class: 'confetti' });
    document.body.append(cv);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    const cols = ['#1a9e55', '#d93a3a', '#f2c94c', '#2f6fdb', '#111', '#bbb'];
    const ps = Array.from({ length: 140 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35,
      vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 13 - 4,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
      w: 6 + Math.random() * 6, hgt: 8 + Math.random() * 8, c: cols[Math.floor(Math.random() * cols.length)],
    }));
    const t0 = performance.now();
    (function step(now) {
      const t = now - t0;
      ctx.clearRect(0, 0, W, H);
      ps.forEach(p => {
        p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.globalAlpha = Math.max(0, 1 - t / 2800);
        ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.hgt / 2, p.w, p.hgt * Math.abs(Math.cos(p.r)));
        ctx.restore();
      });
      if (t < 2800) requestAnimationFrame(step); else cv.remove();
    })(t0);
  };

  /* Recap PNG: podium plus payments. Returns a Promise<Blob>. */
  FX.recap = function (game) {
    const f = game.final;
    const sym = game.config.symbol;
    const rows = f.rows.filter(r => !r.hostOnly).slice().sort((a, b) => b.net - a.net);
    const pays = f.transfers;
    const W = 1080, H = 760 + Math.max(1, pays.length) * 74 + 80;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#0d0d0d'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '700 56px system-ui, sans-serif';
    ctx.fillText('🃏 ' + T('Poker night'), W / 2, 100);
    ctx.font = '400 32px system-ui, sans-serif'; ctx.fillStyle = '#aaa';
    ctx.fillText(U.fmtDate(game.endedAt || game.startedAt) + ' · ' + game.config.currency, W / 2, 150);
    // podium
    const order = [1, 0, 2], heights = [300, 220, 160], medal = ['🥇', '🥈', '🥉'];
    const bw = 260, gap = 30, x0 = (W - (bw * 3 + gap * 2)) / 2, floor = 640;
    order.forEach((rank, col) => {
      const r = rows[rank]; if (!r) return;
      const hh = heights[rank], x = x0 + col * (bw + gap);
      ctx.fillStyle = rank === 0 ? '#ffffff' : rank === 1 ? '#cfcfcf' : '#9a9a9a';
      roundRect(ctx, x, floor - hh, bw, hh, 18); ctx.fill();
      ctx.font = '64px system-ui, sans-serif'; ctx.fillStyle = '#000';
      ctx.fillText(medal[rank], x + bw / 2, floor - hh + 84);
      ctx.fillStyle = '#fff'; ctx.font = '600 36px system-ui, sans-serif';
      ctx.fillText(r.name.slice(0, 12), x + bw / 2, floor - hh - 62);
      ctx.fillStyle = r.net >= 0 ? '#3ad07f' : '#ff6b6b'; ctx.font = '700 34px system-ui, sans-serif';
      ctx.fillText(Core.fmt(r.net, sym, true), x + bw / 2, floor - hh - 18);
    });
    // payments
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '700 40px system-ui, sans-serif';
    ctx.fillText(T('Payments'), 80, 730);
    ctx.font = '400 36px system-ui, sans-serif';
    if (!pays.length) { ctx.fillStyle = '#aaa'; ctx.fillText(T('Everyone is even. No payments needed.'), 80, 800); }
    pays.forEach((p, i) => {
      const y = 800 + i * 74;
      ctx.fillStyle = '#ddd'; ctx.textAlign = 'left';
      ctx.fillText(nameIn(game, p.from) + '  →  ' + nameIn(game, p.to), 80, y);
      ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.font = '700 36px system-ui, sans-serif';
      ctx.fillText(Core.fmt(p.amt, sym), W - 80, y);
      ctx.font = '400 36px system-ui, sans-serif';
    });
    ctx.textAlign = 'center'; ctx.fillStyle = '#666'; ctx.font = '400 26px system-ui, sans-serif';
    ctx.fillText('Stack & Settle', W / 2, H - 36);
    return new Promise(res => cv.toBlob(res, 'image/png'));
  };
  function nameIn(game, pid) { const r = game.final.rows.find(x => x.pid === pid); return r ? r.name : S.nameOf(pid); }
})();
