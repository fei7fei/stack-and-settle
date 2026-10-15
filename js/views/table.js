/* The oval poker table and the seat/player picker. */
(function () {
  'use strict';
  const TV = window.TV = {};
  const h = U.h;

  /* The table is a landscape oval with the dealer at the top centre. Seats are spaced evenly by arc length around
     the rail, so the gaps stay even however many there are. Phones get a slightly taller oval to fit the felt print. */
  const RX = 42, RY = 40;
  const aspect = () => (window.innerWidth < 600 ? 4 / 3 : 3 / 2);

  /* n points evenly spaced by arc length around an ellipse (percent of the box), clockwise from the top centre */
  TV.ring = function (n, rx, ry, ratio) {
    const STEPS = 720, ax = rx * ratio, pts = [], len = [0];
    for (let k = 0; k <= STEPS; k++) {
      const a = -Math.PI / 2 + (2 * Math.PI * k) / STEPS;
      pts.push([Math.cos(a), Math.sin(a)]);
      if (k) len.push(len[k - 1] + Math.hypot((pts[k][0] - pts[k - 1][0]) * ax, (pts[k][1] - pts[k - 1][1]) * ry));
    }
    const total = len[STEPS], out = [];
    let k = 0;
    for (let i = 0; i < n; i++) {
      const at = (total * i) / n;
      while (len[k + 1] < at) k++;
      const f = (at - len[k]) / (len[k + 1] - len[k] || 1);
      out.push({ x: 50 + rx * (pts[k][0] + f * (pts[k + 1][0] - pts[k][0])), y: 50 + ry * (pts[k][1] + f * (pts[k + 1][1] - pts[k][1])) });
    }
    /* the gap between neighbours as a percent of the table's width, for sizing the seats */
    out.gap = total / ratio / n;
    return out;
  };

  /* o: {slots: [{id, node, onclick, label}], dealer: index of the slot with the dealer button|null, centre: node, cls} */
  TV.table = function (o) {
    const ratio = aspect();
    const pos = TV.ring(o.slots.length + 1, RX, RY, ratio);
    const felt = h('div', { class: 'felt' }, h('div', { class: 'felt-inner' }, o.centre || null));
    const wrap = h('div', { class: 'table-wrap ' + (o.cls || '') },
      felt, h('div', { class: 'croupier', style: { left: pos[0].x + '%', top: pos[0].y + '%' }, role: 'img', 'aria-label': T('Dealer'), html: DEALER }));
    wrap.style.aspectRatio = String(ratio);
    wrap.style.setProperty('--seat-w', 'min(96px, 19cqw, ' + (pos.gap * 0.78).toFixed(2) + 'cqw)');
    if (pos.gap < 22) wrap.classList.add('crowded');
    o.slots.forEach((s, i) => {
      const p = pos[i + 1];
      wrap.append(h('button', {
        class: 'seat-slot', 'data-seat': s.id, style: { left: p.x + '%', top: p.y + '%', animationDelay: (i * 30) + 'ms' },
        onclick: s.onclick, 'aria-label': s.label,
      }, s.node, o.dealer === i ? h('span', { class: 'dealer', title: T('Host') }, 'D') : null));
    });
    return wrap;
  };

  /* a cartoon croupier leaning on the rail: eyeshade visor, waistcoat, bow tie, a deck in hand */
  const DEALER = '<svg viewBox="0 0 120 96" aria-hidden="true">'
    + '<path class="d-vest" d="M14 96c2-22 18-34 46-34s44 12 46 34z"/>'
    + '<path class="d-shirt" d="M47 63l13 24 13-24c-4-1-8-1-13-1s-9 0-13 1z"/>'
    + '<path class="d-tie" d="M50 66l10 5-10 5zM70 66l-10 5 10 5z"/><circle class="d-tie" cx="60" cy="71" r="2.6"/>'
    + '<rect class="d-skin" x="53" y="50" width="14" height="14" rx="5"/>'
    + '<circle class="d-skin" cx="60" cy="36" r="19"/>'
    + '<path class="d-hair" d="M41 34c0-14 9-21 19-21s19 7 19 21c-4-6-11-9-19-9s-15 3-19 9z"/>'
    + '<path class="d-visor" d="M36 30c6-5 15-7 24-7s18 2 24 7l-3 4c-6-3-13-4-21-4s-15 1-21 4z"/>'
    + '<circle class="d-ink" cx="53" cy="38" r="2.2"/><circle class="d-ink" cx="67" cy="38" r="2.2"/>'
    + '<circle class="d-cheek" cx="48" cy="44" r="3"/><circle class="d-cheek" cx="72" cy="44" r="3"/>'
    + '<path class="d-smile" d="M54 45c3 3 9 3 12 0"/>'
    + '<path class="d-hair" d="M54 47c2-1.5 4-1.5 6 0 2-1.5 4-1.5 6 0-2 1.6-4 1.6-6 .4-2 1.2-4 1.2-6-.4z"/>'
    + '<rect class="d-card" x="52" y="78" width="16" height="12" rx="2"/><rect class="d-card-back" x="54.5" y="80.5" width="11" height="7" rx="1"/>'
    + '<circle class="d-skin" cx="48" cy="86" r="6"/><circle class="d-skin" cx="72" cy="86" r="6"/>'
    + '</svg>';

  TV.emptySeat = label => h('div', { class: 'seat empty' }, h('span', { class: 'plus' }, '+'), h('small', null, label));

  /* little chip stack: one disc per buy-in, coloured from the chip set */
  TV.stack = function (count, colours) {
    const el = h('div', { class: 'mini-stack' });
    const n = Math.min(count, 6);
    for (let i = 0; i < n; i++) {
      const c = colours[(colours.length - 1 - (i % colours.length) + colours.length) % colours.length];
      el.append(h('i', { style: { background: c ? c.color : '#888', bottom: (i * 3) + 'px' } }));
    }
    return el;
  };

  /* pick a saved player or type a new one -> Promise<profile|null> */
  TV.pickPlayer = function (opts) {
    opts = opts || {};
    const exclude = new Set(opts.exclude || []);
    return new Promise(resolve => {
      let done = false;
      const finish = (api, p) => { done = true; api.close(); resolve(p); };
      U.sheet(api => {
        const counts = {};
        S.db.games.forEach(g => g.players.forEach(p => { counts[p.pid] = (counts[p.pid] || 0) + 1; }));
        const saved = S.db.profiles.filter(p => !exclude.has(p.id)).sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || a.name.localeCompare(b.name));
        const input = h('input', { type: 'text', placeholder: T('New player name'), maxLength: 24, autocomplete: 'off', enterKeyHint: 'done' });
        const add = () => {
          const name = input.value.trim();
          if (!name) { input.focus(); return; }
          const existing = S.findProfile(name);
          if (existing && exclude.has(existing.id)) { U.toast(T('{name} is already seated', { name: existing.name }), 'bad'); Snd.buzz(); return; }
          const p = S.ensureProfile(name);
          S.save();
          finish(api, p);
        };
        input.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
        setTimeout(() => { if (!saved.length) input.focus(); }, 250);
        return h('div', null,
          h('h3', null, opts.title || T('Add player')),
          h('div', { class: 'row gap' }, input, h('button', { class: 'btn primary', onclick: add }, T('Add'))),
          saved.length ? h('div', { class: 'label' }, T('Saved players')) : null,
          h('div', { class: 'pill-list' }, saved.map(p => h('button', { class: 'pill', onclick: () => finish(api, p) }, p.name))));
      }, { onclose: () => { if (!done) resolve(null); } });
    });
  };
})();
