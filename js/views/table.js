/* The oval poker table and the seat/player picker. */
(function () {
  'use strict';
  const TV = window.TV = {};
  const h = U.h;

  /* seat position around the oval (percent of container). Seat 0 sits bottom centre. */
  TV.pos = function (i, n, rx, ry) {
    const a = Math.PI / 2 + (2 * Math.PI * i) / n;
    return { x: 50 + (rx || 41) * Math.cos(a), y: 50 + (ry || 43) * Math.sin(a) };
  };

  /* o: {n, seat(i) -> node, onSeat(i), dealer: seatIndex|null, centre: node, cls} */
  TV.table = function (o) {
    const felt = h('div', { class: 'felt' }, h('div', { class: 'felt-inner' }, o.centre || null));
    const wrap = h('div', { class: 'table-wrap ' + (o.cls || '') + ' seats-' + o.n }, felt);
    for (let i = 0; i < o.n; i++) {
      const p = TV.pos(i, o.n);
      const node = o.seat(i);
      const btn = h('button', {
        class: 'seat-slot', style: { left: p.x + '%', top: p.y + '%', animationDelay: (i * 30) + 'ms' },
        onclick: () => o.onSeat && o.onSeat(i), 'aria-label': T('Seat {n}', { n: i + 1 }),
      }, node);
      wrap.append(btn);
      if (o.dealer === i) {
        const d = TV.pos(i, o.n, 27, 29);
        wrap.append(h('div', { class: 'dealer', style: { left: d.x + '%', top: d.y + '%' }, title: T('Host') }, 'D'));
      }
    }
    return wrap;
  };

  TV.emptySeat = (i, label) => h('div', { class: 'seat empty' }, h('span', { class: 'plus' }, '+'), h('small', null, label || T('Seat {n}', { n: i + 1 })));

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
