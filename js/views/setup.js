/* Setup wizard: game type, money, colours, host fee & extras, seats. */
(function () {
  'use strict';
  const Setup = window.Setup = {};
  const h = U.h;

  const DEFAULT_COLOURS = () => [
    { id: U.uid(), name: T('White'), color: '#f4f4f4', chips: 25 },
    { id: U.uid(), name: T('Red'), color: '#d93a3a', chips: 100 },
    { id: U.uid(), name: T('Green'), color: '#1a9e55', chips: 500 },
    { id: U.uid(), name: T('Black'), color: '#222222', chips: 1000 },
  ];
  const DEFAULT_LEVELS = () => [[25, 50], [50, 100], [100, 200], [200, 400], [300, 600], [500, 1000], [1000, 2000]].map(([sb, bb]) => ({ sb, bb }));
  const STEPS = ['Game type', 'Currency & hand value', 'Chip colours', 'Host fee & extras', 'Seat the players'];

  Setup.newDraft = () => ({
    step: 0, mode: 'simple', currency: 'CAD', symbol: '$',
    handMoney: '20', handChips: '1000', colours: DEFAULT_COLOURS(), colourUnit: 'chips',
    fee: { on: false, pct: '5', minPot: '0' }, hostPlays: true, hostName: '',
    blinds: { on: false, minutes: '20', levels: DEFAULT_LEVELS() },
    seatsN: 8, seats: Array(8).fill(null), hostPid: null,
  });

  /* Quick start: same players, seats, colours and values as the last finished game */
  Setup.fromGame = function (g) {
    const c = g.config;
    const d = Setup.newDraft();
    Object.assign(d, {
      step: 4, mode: c.mode, currency: c.currency, symbol: c.symbol,
      handMoney: (c.handCents / 100).toString(), handChips: String(c.handChips),
      colours: U.clone(c.colours), seatsN: c.seats, seats: Array(c.seats).fill(null),
      fee: { on: c.fee.on, pct: (c.fee.bps / 100).toString(), minPot: String(c.fee.minPot || 0) },
      hostPlays: g.hostPlays !== false, hostPid: g.hostPlays !== false ? g.hostPid : null,
      hostName: g.hostPlays === false ? S.nameOf(g.hostPid) : '',
      blinds: { on: c.blinds.on, minutes: String(c.blinds.minutes), levels: U.clone(c.blinds.levels) },
    });
    g.players.filter(p => !p.hostOnly && p.seat != null && p.seat < c.seats).forEach(p => { d.seats[p.seat] = p.pid; });
    return d;
  };

  const d = () => S.db.draft;
  const save = () => S.save();
  const handCents = () => Core.parseMoney(d().handMoney);
  const handChips = () => Core.parseInt0(d().handChips);
  const cv = () => Core.chipValue(handCents(), handChips());
  const sym = () => d().symbol || '$';

  Setup.render = function () {
    const dr = d();
    const body = [stepGameType, stepMoney, stepColours, stepHost, stepSeats][dr.step]();
    const err = h('div', { class: 'form-error', 'aria-live': 'polite' });
    const next = () => {
      const msg = validate(dr.step);
      if (msg) { err.textContent = msg; err.classList.remove('shake'); void err.offsetWidth; err.classList.add('shake'); Snd.buzz(); return; }
      if (dr.step === 4) { start(); return; }
      S.commit(() => { dr.step++; });
    };
    return h('div', { class: 'screen wizard' },
      h('div', { class: 'wizard-head' },
        h('div', { class: 'steps' }, STEPS.map((s, i) => h('button', {
          class: 'step-dot' + (i === dr.step ? ' on' : '') + (i < dr.step ? ' done' : ''),
          'aria-label': T(s), onclick: () => { if (i < dr.step) S.commit(() => { dr.step = i; }); },
        }))),
        h('div', { class: 'muted small' }, T('Step {a} of {b}', { a: dr.step + 1, b: STEPS.length })),
        h('h2', null, T(STEPS[dr.step]))),
      body, err,
      h('div', { class: 'wizard-foot' },
        h('button', { class: 'btn ghost', onclick: () => {
          if (dr.step === 0) U.ask({ title: T('Discard this setup?'), ok: T('Discard'), danger: true }).then(ok => { if (ok) S.commit(db => { db.draft = null; }); });
          else S.commit(() => { dr.step--; });
        } }, dr.step === 0 ? T('Cancel') : T('Back')),
        h('button', { class: 'btn primary', onclick: next }, dr.step === 4 ? T('Start game') : T('Next'))));
  };

  function validate(step) {
    const dr = d();
    if (step === 1) {
      if (handCents() == null || handCents() <= 0) return T('Enter the money per hand, for example 20.');
      if (!handChips()) return T('Enter the chips per hand as a whole number.');
      if (cv() == null) return T('One chip must be a whole number of cents.');
    }
    if (step === 2) {
      if (!dr.colours.length) return T('Add at least one chip colour.');
      if (dr.colours.some(c => !Number.isInteger(c.chips) || c.chips <= 0)) return T('Every colour needs a value in whole chips.');
    }
    if (step === 3) {
      if (dr.fee.on) {
        if (Core.parsePct(dr.fee.pct) == null || Core.parsePct(dr.fee.pct) === 0) return T('Enter a fee percentage, for example 2.5.');
        if (Core.parseInt0(dr.fee.minPot) == null) return T('Minimum pot must be a whole number of chips.');
        if (!dr.hostPlays && !dr.hostName.trim()) return T("Enter the host's name.");
      }
      if (dr.blinds.on) {
        if (!Core.parseInt0(dr.blinds.minutes)) return T('Enter minutes per blind level.');
        if (!dr.blinds.levels.length) return T('Add at least one blind level.');
      }
    }
    if (step === 4) {
      const seated = dr.seats.filter(Boolean);
      if (seated.length < 2) return T('Seat at least two players.');
      if (dr.fee.on && dr.hostPlays && !seated.includes(dr.hostPid)) return T('Tap the host’s seat and choose “Make host”.');
      if (dr.fee.on && !dr.hostPlays) {
        const hp = S.findProfile(dr.hostName);
        if (hp && seated.includes(hp.id)) return T('{name} is seated. Choose “Host plays” instead.', { name: hp.name });
      }
    }
    return null;
  }

  function start() {
    const dr = d();
    const now = Date.now();
    const config = {
      mode: dr.mode, currency: dr.currency, symbol: sym(),
      handCents: handCents(), handChips: handChips(), cv: cv(),
      colours: U.clone(dr.colours).sort((a, b) => a.chips - b.chips), seats: dr.seatsN,
      fee: { on: dr.fee.on, bps: dr.fee.on ? Core.parsePct(dr.fee.pct) : 0, minPot: dr.fee.on ? Core.parseInt0(dr.fee.minPot) : 0 },
      blinds: { on: dr.blinds.on, minutes: Core.parseInt0(dr.blinds.minutes) || 20, levels: U.clone(dr.blinds.levels) },
    };
    const players = [];
    dr.seats.forEach((pid, seat) => { if (pid) players.push(Game.newPlayer(pid, seat)); });
    let hostPid = null;
    if (dr.fee.on) {
      if (dr.hostPlays) hostPid = dr.hostPid;
      else {
        const hp = S.ensureProfile(dr.hostName);
        hostPid = hp.id;
        players.push({ pid: hp.id, name: hp.name, seat: null, hostOnly: true, buyins: [], cashedOut: null, finalChips: null });
      }
    }
    const game = {
      id: U.uid(), startedAt: now, endedAt: null, phase: 'play', config, players,
      hostPid, hostPlays: dr.fee.on ? dr.hostPlays : true, rake: [], hands: [], final: null,
      blinds: { level: 0, running: false, endsAt: null, remaining: config.blinds.minutes * 60000 },
    };
    Snd.cash();
    S.commit(db => { db.current = game; db.draft = null; });
  }

  /* ---------- step 1 ---------- */
  function stepGameType() {
    const dr = d();
    const opt = (mode, title, desc, icon) => h('button', {
      class: 'choice' + (dr.mode === mode ? ' on' : ''), onclick: () => S.commit(() => { dr.mode = mode; }),
    }, h('div', { class: 'choice-icon' }, icon), h('div', null, h('strong', null, T(title)), h('div', { class: 'muted small' }, T(desc))));
    return h('div', { class: 'stack' },
      opt('simple', 'Simple', 'Play only. No hand-by-hand recording. End-of-game stats included.', '♣'),
      opt('detailed', 'Detailed', 'Record every hand: who won, the pot and a tag. Adds hand stats.', '♠'));
  }

  /* ---------- step 2 ---------- */
  function stepMoney() {
    const dr = d();
    const out = h('div', { class: 'derived' });
    const symInput = h('input', { type: 'text', value: dr.symbol, maxLength: 4, class: 'w-sm', oninput: e => { dr.symbol = e.target.value; save(); update(); } });
    const sel = h('select', {
      onchange: e => {
        dr.currency = e.target.value;
        const c = Core.CURRENCIES.find(x => x.code === dr.currency);
        if (c) { dr.symbol = c.symbol; symInput.value = c.symbol; }
        save(); update();
      },
    }, Core.CURRENCIES.map(c => h('option', { value: c.code, selected: c.code === dr.currency }, c.code + ' ' + c.symbol)),
    h('option', { value: 'Custom', selected: !Core.CURRENCIES.some(c => c.code === dr.currency) }, T('Custom')));
    const money = h('input', { type: 'text', inputMode: 'decimal', value: dr.handMoney, oninput: e => { dr.handMoney = e.target.value; save(); update(); } });
    const chips = h('input', { type: 'text', inputMode: 'numeric', value: dr.handChips, oninput: e => { dr.handChips = e.target.value; save(); update(); } });
    function update() {
      U.clear(out);
      out.className = 'derived';
      const hc = handCents(), hk = handChips();
      if (hc == null || !hk) { out.append(h('span', { class: 'muted' }, T('Enter both values to see the value of one chip.'))); return; }
      const v = Core.chipValue(hc, hk);
      if (v != null) {
        out.className = 'derived ok';
        out.append(h('span', null, T('1 chip = {v}', { v: Core.fmt(v, sym()) }) + '  ✓'));
        out.append(h('div', { class: 'muted small' }, T('{chips} chips = {money}', { chips: U.fmtChips(hk), money: Core.fmt(hc, sym()) })));
      } else {
        out.className = 'derived bad';
        const near = Core.nearestChipsPerHand(hc, hk);
        out.append(h('div', null, T('1 chip would be {v}. Not a whole number of cents.', { v: sym() + (hc / hk / 100).toFixed(4) })));
        out.append(h('button', { class: 'btn small', onclick: () => { dr.handChips = String(near); chips.value = dr.handChips; save(); update(); } },
          T('Use {n} chips ({v} each)', { n: U.fmtChips(near), v: Core.fmt(hc / near, sym()) })));
      }
    }
    update();
    return h('div', { class: 'stack' },
      h('label', { class: 'field' }, h('span', null, T('Currency')), h('div', { class: 'row gap' }, sel, symInput)),
      h('div', { class: 'grid2' },
        h('label', { class: 'field' }, h('span', null, T('Money per hand')), money),
        h('label', { class: 'field' }, h('span', null, T('Chips per hand')), chips)),
      out);
  }

  /* ---------- step 3 ---------- */
  function stepColours() {
    const dr = d();
    const value = cv();
    const warn = h('div', { class: 'warn small' });
    const checkHand = () => {
      warn.textContent = Core.exactMix(handChips(), dr.colours.filter(c => c.chips > 0)) ? '' : T('A full hand of {n} chips can’t be made exactly with these colours.', { n: U.fmtChips(handChips()) });
    };
    const rows = dr.colours.map(c => {
      const derived = h('span', { class: 'muted small' });
      const showDerived = () => {
        derived.textContent = c.chips > 0 && Number.isInteger(c.chips)
          ? (dr.colourUnit === 'chips' ? '= ' + Core.fmt(c.chips * value, sym()) : '= ' + T('{n} chips', { n: U.fmtChips(c.chips) }))
          : T('invalid');
        derived.classList.toggle('bad-text', !(c.chips > 0));
      };
      const val = h('input', {
        type: 'text', inputMode: dr.colourUnit === 'chips' ? 'numeric' : 'decimal', class: 'w-md',
        value: dr.colourUnit === 'chips' ? String(c.chips) : (c.chips * value / 100).toFixed(2),
        oninput: e => {
          if (dr.colourUnit === 'chips') c.chips = Core.parseInt0(e.target.value) || 0;
          else {
            const cents = Core.parseMoney(e.target.value);
            c.chips = cents != null && cents % value === 0 ? cents / value : 0;
          }
          save(); showDerived(); checkHand();
        },
      });
      showDerived();
      return h('div', { class: 'colour-row' },
        h('input', { type: 'color', value: c.color, 'aria-label': T('Colour'), oninput: e => { c.color = e.target.value; save(); } }),
        h('input', { type: 'text', value: c.name, maxLength: 14, class: 'grow', 'aria-label': T('Name'), oninput: e => { c.name = e.target.value; save(); } }),
        h('div', { class: 'col' }, h('div', { class: 'row gap-s' }, dr.colourUnit === 'money' ? h('span', null, sym()) : null, val), derived),
        h('button', { class: 'icon-btn', 'aria-label': T('Remove'), onclick: () => S.commit(() => { dr.colours = dr.colours.filter(x => x !== c); }) }, '✕'));
    });
    checkHand();
    return h('div', { class: 'stack' },
      h('div', { class: 'muted small' }, T('1 chip = {v}', { v: Core.fmt(value, sym()) })),
      seg([['chips', T('Value in chips')], ['money', T('Value in money')]], dr.colourUnit, v => S.commit(() => { dr.colourUnit = v; })),
      h('div', { class: 'stack-s' }, rows),
      h('button', { class: 'btn ghost', onclick: () => S.commit(() => { dr.colours.push({ id: U.uid(), name: T('Blue'), color: '#2f6fdb', chips: 5000 }); }) }, '+ ' + T('Add colour')),
      warn);
  }

  /* ---------- step 4 ---------- */
  function stepHost() {
    const dr = d();
    const feeBox = h('div', { class: 'stack' + (dr.fee.on ? '' : ' hidden') },
      h('div', { class: 'grid2' },
        h('label', { class: 'field' }, h('span', null, T('Percent of pot')),
          h('div', { class: 'row gap-s' }, h('input', { type: 'text', inputMode: 'decimal', value: dr.fee.pct, oninput: e => { dr.fee.pct = e.target.value; save(); } }), h('span', null, '%'))),
        h('label', { class: 'field' }, h('span', null, T('No rake below (chips)')),
          h('input', { type: 'text', inputMode: 'numeric', value: dr.fee.minPot, oninput: e => { dr.fee.minPot = e.target.value; save(); } }))),
      seg([['plays', T('Host plays')], ['hosts', T('Host only hosts')]], dr.hostPlays ? 'plays' : 'hosts', v => S.commit(() => { dr.hostPlays = v === 'plays'; })),
      dr.hostPlays
        ? h('div', { class: 'muted small' }, T('You’ll pick the host from the seated players in the next step.'))
        : h('label', { class: 'field' }, h('span', null, T('Host name')),
          h('input', { type: 'text', value: dr.hostName, maxLength: 24, list: 'profile-names', oninput: e => { dr.hostName = e.target.value; save(); } }),
          h('datalist', { id: 'profile-names' }, S.db.profiles.map(p => h('option', { value: p.name })))));
    const levels = h('div', { class: 'stack-s' }, dr.blinds.levels.map((l, i) => h('div', { class: 'row gap-s level-row' },
      h('span', { class: 'muted small w-xs' }, String(i + 1)),
      h('input', { type: 'text', inputMode: 'numeric', value: String(l.sb), class: 'w-md', 'aria-label': T('Small blind'), oninput: e => { l.sb = Core.parseInt0(e.target.value) || 0; save(); } }),
      h('span', null, '/'),
      h('input', { type: 'text', inputMode: 'numeric', value: String(l.bb), class: 'w-md', 'aria-label': T('Big blind'), oninput: e => { l.bb = Core.parseInt0(e.target.value) || 0; save(); } }),
      h('button', { class: 'icon-btn', 'aria-label': T('Remove'), onclick: () => S.commit(() => { dr.blinds.levels.splice(i, 1); }) }, '✕'))));
    const blindsBox = h('div', { class: 'stack' + (dr.blinds.on ? '' : ' hidden') },
      h('label', { class: 'field' }, h('span', null, T('Minutes per level')),
        h('input', { type: 'text', inputMode: 'numeric', class: 'w-md', value: dr.blinds.minutes, oninput: e => { dr.blinds.minutes = e.target.value; save(); } })),
      h('div', { class: 'label' }, T('Blind levels (small / big)')), levels,
      h('button', { class: 'btn ghost', onclick: () => S.commit(() => {
        const last = dr.blinds.levels[dr.blinds.levels.length - 1] || { sb: 25, bb: 50 };
        dr.blinds.levels.push({ sb: last.sb * 2, bb: last.bb * 2 });
      }) }, '+ ' + T('Add level')));
    return h('div', { class: 'stack' },
      toggle(T('Host fee (rake)'), dr.fee.on, v => S.commit(() => { dr.fee.on = v; })), feeBox,
      h('hr'),
      toggle(T('Blinds timer'), dr.blinds.on, v => S.commit(() => { dr.blinds.on = v; })), blindsBox);
  }

  /* ---------- step 5 ---------- */
  function stepSeats() {
    const dr = d();
    const tableHolder = h('div');
    const draw = () => {
      U.clear(tableHolder);
      tableHolder.append(TV.table({
        n: dr.seatsN,
        dealer: dr.fee.on && dr.hostPlays && dr.hostPid ? dr.seats.indexOf(dr.hostPid) : null,
        centre: h('div', { class: 'centre-info' },
          h('div', { class: 'logo-mini' }, '♠'),
          dr.fee.on && !dr.hostPlays ? h('div', { class: 'house-spot' }, '🏠 ' + (dr.hostName || T('House'))) : null,
          h('div', { class: 'muted small' }, T('{n} seated', { n: dr.seats.filter(Boolean).length }))),
        seat: i => {
          const pid = dr.seats[i];
          if (!pid) return TV.emptySeat(i);
          return h('div', { class: 'seat filled' }, h('div', { class: 'avatar' }, initials(S.nameOf(pid))), h('div', { class: 'seat-name' }, S.nameOf(pid)));
        },
        onSeat: i => {
          const pid = dr.seats[i];
          if (!pid) {
            TV.pickPlayer({ exclude: dr.seats.filter(Boolean) }).then(p => { if (p) { Snd.clack(); S.commit(() => { dr.seats[i] = p.id; }); } });
            return;
          }
          U.sheet(api => h('div', { class: 'stack' },
            h('h3', null, S.nameOf(pid)),
            dr.fee.on && dr.hostPlays ? h('button', { class: 'btn', onclick: () => { api.close(); S.commit(() => { dr.hostPid = pid; }); } }, '🔘 ' + T('Make host (dealer button)')) : null,
            h('button', { class: 'btn danger ghost', onclick: () => { api.close(); S.commit(() => { dr.seats[i] = null; if (dr.hostPid === pid) dr.hostPid = null; }); } }, T('Remove from table'))), { cls: 'small' });
        },
      }));
    };
    draw();
    const shuffle = () => {
      const t = tableHolder.firstChild;
      if (t && !U.reduced()) t.classList.add('shuffling');
      [0, 120, 240, 360, 480].forEach(ms => setTimeout(Snd.card, ms));
      setTimeout(() => {
        const people = dr.seats.filter(Boolean);
        const order = Array.from({ length: dr.seatsN }, (_, i) => i);
        for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
        const seats = Array(dr.seatsN).fill(null);
        people.forEach((p, k) => { seats[order[k]] = p; });
        S.commit(() => { dr.seats = seats; });
      }, U.reduced() ? 0 : 650);
    };
    return h('div', { class: 'stack' },
      h('div', { class: 'row gap wrap' },
        h('span', { class: 'muted small' }, T('Seats')),
        seg([6, 8, 9, 10].map(n => [n, String(n)]), dr.seatsN, n => {
          const people = dr.seats.filter(Boolean);
          if (people.length > n) { U.toast(T('Too many players for {n} seats', { n }), 'bad'); Snd.buzz(); return; }
          S.commit(() => {
            const seats = Array(n).fill(null);
            const keep = dr.seats.slice(0, n);
            keep.forEach((p, i) => { seats[i] = p; });
            dr.seats.slice(n).filter(Boolean).forEach(p => { seats[seats.indexOf(null)] = p; });
            dr.seatsN = n; dr.seats = seats;
          });
        })),
      tableHolder,
      h('div', { class: 'row gap' },
        h('button', { class: 'btn ghost grow', onclick: shuffle, disabled: dr.seats.filter(Boolean).length < 2 }, '🔀 ' + T('Shuffle seats'))),
      h('div', { class: 'muted small center' }, T('Tap an empty seat to add a player.')));
  }

  /* ---------- little controls ---------- */
  function seg(options, value, onpick) {
    return h('div', { class: 'seg', role: 'radiogroup' }, options.map(([v, label]) => h('button', {
      class: 'seg-btn' + (v === value ? ' on' : ''), role: 'radio', 'aria-checked': String(v === value), onclick: () => onpick(v),
    }, label)));
  }
  function toggle(label, on, onchange) {
    return h('label', { class: 'toggle-row' }, h('span', null, label),
      h('input', { type: 'checkbox', class: 'switch', checked: on, onchange: e => onchange(e.target.checked) }));
  }
  function initials(name) { return String(name).trim().split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase(); }
  Setup.seg = seg; Setup.toggle = toggle; Setup.initials = initials;
})();
