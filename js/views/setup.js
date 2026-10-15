/* Game setup: one screen with two tabs. Basics (buy-in, the host's own chip set, players) is all a Simple game needs;
   More options lists every extra as a switch, all off until turned on. Detailed mode (the table, hands, seats) is one of them. */
(function () {
  'use strict';
  const Setup = window.Setup = {};
  const h = U.h;

  const DEFAULT_COLOURS = () => [
    { id: U.uid(), name: T('White'), color: '#f4f4f4', chips: 25, have: 150 },
    { id: U.uid(), name: T('Red'), color: '#d93a3a', chips: 100, have: 150 },
    { id: U.uid(), name: T('Green'), color: '#1a9e55', chips: 500, have: 100 },
    { id: U.uid(), name: T('Black'), color: '#222222', chips: 1000, have: 100 },
  ];
  const DEFAULT_LEVELS = () => [[25, 50], [50, 100], [100, 200], [200, 400], [300, 600], [500, 1000], [1000, 2000]].map(([sb, bb]) => ({ sb, bb }));
  const SIZES = [6, 8, 9, 10];

  const freshDraft = () => ({
    more: false, mode: 'simple', currency: 'CAD', symbol: '$',
    handMoney: '20', handChips: '1000', buyinFixed: false, leaderCap: false,
    chipSetId: U.uid(), chipSetName: '', colours: DEFAULT_COLOURS(), colourUnit: 'chips',
    fee: { on: false, pct: '5', minPot: '0' }, hostPlays: true, hostName: '',
    blinds: { on: false, minutes: '20', levels: DEFAULT_LEVELS() },
    pickSeats: false, seatsN: 6, seats: Array(6).fill(null), hostPid: null,
  });

  /* New game: the last game's buy-in and chips, no players, and every extra switched off (their numbers are kept for when they're turned on) */
  Setup.newDraft = function () {
    const last = S.lastGame();
    if (!last) { const d = freshDraft(), set = S.lastChipSet(); if (set) useSet(d, set); return d; }
    const d = Setup.fromGame(last);
    d.seatsN = 6; d.seats = Array(6).fill(null);
    d.mode = 'simple'; d.buyinFixed = false; d.leaderCap = false; d.fee.on = false; d.blinds.on = false;
    d.hostPlays = true; d.hostPid = null;
    return d;
  };

  /* Quick start: same players, colours, values and extras as the last finished game */
  Setup.fromGame = function (g) {
    const c = g.config;
    const d = freshDraft();
    Object.assign(d, {
      mode: c.mode, currency: c.currency, symbol: c.symbol,
      handMoney: (c.handCents / 100).toString(), handChips: String(c.handChips),
      buyinFixed: !!(c.buyin && c.buyin.fixed), leaderCap: !!(c.buyin && c.buyin.leaderCap),
      colours: U.clone(c.colours), seatsN: c.seats, seats: Array(c.seats).fill(null),
      fee: { on: c.fee.on, pct: (c.fee.bps / 100).toString(), minPot: String(c.fee.minPot || 0) },
      hostPlays: g.hostPlays !== false, hostPid: g.hostPlays !== false ? g.hostPid : null,
      hostName: g.hostPlays === false ? S.nameOf(g.hostPid) : '',
      blinds: { on: c.blinds.on, minutes: String(c.blinds.minutes), levels: U.clone(c.blinds.levels) },
    });
    /* the saved chip set the game used, with any counts changed since; older games start a new set from their colours */
    const set = S.chipSet(c.chipSetId);
    if (set) useSet(d, set);
    g.players.filter(p => !p.hostOnly && p.seat != null && p.seat < c.seats).forEach(p => { d.seats[p.seat] = p.pid; });
    return d;
  };

  function useSet(dr, set) {
    dr.chipSetId = set.id; dr.chipSetName = set.name; dr.colours = U.clone(set.colours);
  }

  const d = () => S.db.draft;
  const save = () => S.save();
  const handCents = () => Core.parseMoney(d().handMoney);
  const handChips = () => Core.parseInt0(d().handChips);
  const cv = () => Core.chipValue(handCents(), handChips());
  const sym = () => d().symbol || '$';
  const seated = () => d().seats.filter(Boolean);
  /* every change to the chip set is saved straight away, so it is ready next game */
  const keep = () => { const dr = d(); S.saveChipSet(dr.chipSetId, dr.chipSetName, dr.colours); };

  /* seat a player in the first free seat, growing the table when it is full; false when 10 are seated */
  function seatPlayer(dr, pid) {
    if (dr.seats.includes(pid)) return true;
    let i = dr.seats.indexOf(null);
    if (i < 0) {
      const n = SIZES.find(s => s > dr.seatsN);
      if (!n) return false;
      dr.seats = dr.seats.concat(Array(n - dr.seatsN).fill(null));
      dr.seatsN = n; i = dr.seats.indexOf(null);
    }
    dr.seats[i] = pid;
    return true;
  }
  function unseat(dr, pid) {
    dr.seats = dr.seats.map(x => (x === pid ? null : x));
    if (dr.hostPid === pid) dr.hostPid = null;
  }

  Setup.render = function () {
    const dr = d();
    if (!dr.chipSetId) { dr.chipSetId = U.uid(); dr.chipSetName = ''; delete dr.chipSet; } /* drafts saved before chip sets were kept */
    const err = h('div', { class: 'form-error', 'aria-live': 'polite' });
    const n = extrasOn().length;
    return h('div', { class: 'screen wizard' },
      h('h2', null, T('New game')),
      seg([['basic', T('Basics')], ['more', T('More options') + (n ? ' · ' + n : '')]], dr.more ? 'more' : 'basic',
        v => S.commit(() => { dr.more = v === 'more'; })),
      dr.more ? moreTab() : basicTab(),
      err,
      h('div', { class: 'wizard-foot' },
        h('button', { class: 'btn ghost', onclick: () => U.ask({ title: T('Discard this setup?'), ok: T('Discard'), danger: true }).then(ok => { if (ok) S.commit(db => { db.draft = null; }); }) }, T('Cancel')),
        h('button', { class: 'btn primary', onclick: () => go(err) }, T('Start game'))));
  };

  function showError(err, msg) {
    err.textContent = msg; err.classList.remove('shake'); void err.offsetWidth; err.classList.add('shake'); Snd.buzz();
  }

  /* the extras that are switched on, for the tab badge and the summary line under the basics */
  function extrasOn() {
    const dr = d();
    return [
      dr.mode === 'detailed' ? T('Detailed mode') : null,
      dr.buyinFixed ? T('Fixed buy-ins') : null,
      dr.leaderCap ? T('Chip-leader rule') : null,
      dr.fee.on ? T('Host fee {p}%', { p: dr.fee.pct }) : null,
      dr.blinds.on ? T('Blinds timer') : null,
      dr.pickSeats && dr.mode === 'detailed' ? T('Choose seats') : null,
    ].filter(Boolean);
  }

  function go(err) {
    const dr = d();
    /* each problem is shown on the tab where it can be fixed */
    const basic = validate('money') || validate('colours') || playersError();
    const msg = basic || hostError() || validate('extras');
    if (msg) {
      const more = !basic;
      if (dr.more !== more) { S.commit(() => { dr.more = more; }); err = document.querySelector('.form-error') || err; }
      showError(err, msg);
      return;
    }
    if (!dr.pickSeats || dr.mode !== 'detailed') {
      /* seat everyone side by side on the smallest table that fits */
      const people = seated();
      dr.seatsN = SIZES.find(s => s >= people.length);
      dr.seats = people.concat(Array(dr.seatsN - people.length).fill(null));
    }
    start();
  }

  /* ---------- basics: the buy-in, the chip set and the players ---------- */
  function basicTab() {
    const dr = d();

    /* players: saved profiles as toggles, seated ones first; type a name to add someone new */
    const counts = {};
    S.db.games.forEach(g => g.players.forEach(p => { counts[p.pid] = (counts[p.pid] || 0) + 1; }));
    const others = S.db.profiles.filter(p => !dr.seats.includes(p.id)).sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || a.name.localeCompare(b.name));
    const toggleP = pid => {
      if (dr.seats.includes(pid)) { Snd.tick(); S.commit(() => unseat(dr, pid)); return; }
      if (!seatPlayer(dr, pid)) { U.toast(T('A table seats 10 at most.'), 'bad'); Snd.buzz(); return; }
      Snd.clack(); S.commit();
    };
    const nameIn = h('input', { type: 'text', placeholder: T('New player name'), maxLength: 24, autocomplete: 'off', enterKeyHint: 'done', 'data-quick-name': '1' });
    const addName = () => {
      const name = nameIn.value.trim();
      if (!name) { nameIn.focus(); return; }
      const p = S.ensureProfile(name);
      if (dr.seats.includes(p.id)) { U.toast(T('{name} is already seated', { name: p.name }), 'bad'); Snd.buzz(); return; }
      if (!seatPlayer(dr, p.id)) { U.toast(T('A table seats 10 at most.'), 'bad'); Snd.buzz(); return; }
      Snd.clack(); S.commit();
      setTimeout(() => { const el = document.querySelector('[data-quick-name]'); if (el) el.focus(); });
    };
    nameIn.addEventListener('keydown', e => { if (e.key === 'Enter') addName(); });
    const extras = extrasOn();

    return h('div', { class: 'stack' },
      rateBlock(),
      h('div', { class: 'label' }, T('Your chips')),
      chipSetPicker(),
      colourEditor(),
      h('div', { class: 'label' }, T('Players') + (seated().length ? ' · ' + seated().length : '')),
      h('div', { class: 'row gap' }, nameIn, h('button', { class: 'btn', onclick: addName }, T('Add'))),
      h('div', { class: 'pill-list' },
        seated().map(pid => h('button', { class: 'pill on', onclick: () => toggleP(pid) }, '✓ ' + S.nameOf(pid))),
        others.map(p => h('button', { class: 'pill', onclick: () => toggleP(p.id) }, p.name))),
      extras.length ? h('div', { class: 'muted small' }, T('Also on: {list}', { list: extras.join(' · ') })) : null);
  }

  /* the host's saved chip sets as pills, a new one, and the name of the one being edited */
  function chipSetPicker() {
    const dr = d();
    const sets = S.db.chipSets;
    const saved = S.chipSet(dr.chipSetId);
    const newSet = () => S.commit(() => { dr.chipSetId = U.uid(); dr.chipSetName = ''; dr.colours = DEFAULT_COLOURS(); });
    const remove = () => U.ask({ title: T('Delete {name}?', { name: saved.name || T('My chips') }), ok: T('Delete'), danger: true }).then(ok => {
      if (!ok) return;
      S.commit(() => {
        S.deleteChipSet(saved.id);
        const next = S.lastChipSet();
        if (next) useSet(dr, next); else { dr.chipSetId = U.uid(); dr.chipSetName = ''; }
      });
    });
    return [
      sets.length ? h('div', { class: 'pill-list' },
        sets.map(set => h('button', { class: 'pill' + (set.id === dr.chipSetId ? ' on' : ''), onclick: () => { Snd.tick(); S.commit(() => useSet(dr, set)); } }, set.name || T('My chips'))),
        h('button', { class: 'pill', onclick: newSet }, '+ ' + T('New set'))) : null,
      h('div', { class: 'row gap' },
        h('input', { type: 'text', class: 'grow', value: dr.chipSetName, maxLength: 24, placeholder: T('Name this set, e.g. Home set'), 'aria-label': T('Chip set name'),
          oninput: e => { dr.chipSetName = e.target.value; keep(); } }),
        saved ? h('button', { class: 'btn ghost', onclick: remove }, T('Delete')) : null),
      h('div', { class: 'muted small' }, T('Saved on this phone as you type, ready for your next game.'))];
  }

  /* with a host fee: who collects it, one of the players or someone who isn't playing */
  function hostPicker() {
    const dr = d();
    return h('div', { class: 'stack-s' },
      h('div', { class: 'label' }, T('Who’s the host?')),
      h('div', { class: 'pill-list' },
        seated().map(pid => h('button', { class: 'pill' + (dr.hostPlays && dr.hostPid === pid ? ' on' : ''), onclick: () => S.commit(() => { dr.hostPlays = true; dr.hostPid = pid; }) }, S.nameOf(pid))),
        h('button', { class: 'pill' + (!dr.hostPlays ? ' on' : ''), onclick: () => S.commit(() => { dr.hostPlays = false; dr.hostPid = null; }) }, T('Someone not playing'))),
      !dr.hostPlays ? h('input', { type: 'text', value: dr.hostName, maxLength: 24, placeholder: T('Host name'), oninput: e => { dr.hostName = e.target.value; save(); } }) : null);
  }

  function playersError() {
    return seated().length < 2 ? T('Add at least two players.') : null;
  }
  function hostError() {
    const dr = d();
    if (dr.fee.on && dr.hostPlays && !seated().includes(dr.hostPid)) return T('Pick who’s hosting.');
    if (dr.fee.on && !dr.hostPlays) {
      const hp = S.findProfile(dr.hostName);
      if (hp && seated().includes(hp.id)) return T('{name} is seated. Pick them as the host instead.', { name: hp.name });
    }
    return null;
  }

  function validate(part) {
    const dr = d();
    if (part === 'money') {
      if (!handChips()) return T('Enter the number of chips as a whole number.');
      if (handCents() == null || handCents() <= 0) return T('Enter what those chips are worth, for example 20.');
      if (cv() == null) return T('One chip must be a whole number of cents.');
    }
    if (part === 'colours') {
      if (!dr.colours.length) return T('Add at least one chip colour.');
      if (dr.colours.some(c => !Number.isInteger(c.chips) || c.chips <= 0)) return T('Every colour needs a value in whole chips.');
    }
    if (part === 'extras') {
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
    return null;
  }

  function start() {
    const dr = d();
    const now = Date.now();
    const config = {
      mode: dr.mode, currency: dr.currency, symbol: sym(),
      handCents: handCents(), handChips: handChips(), cv: cv(),
      buyin: { fixed: !!dr.buyinFixed, leaderCap: !!dr.leaderCap },
      colours: U.clone(dr.colours).sort((a, b) => a.chips - b.chips), chipSetId: dr.chipSetId, seats: dr.seatsN,
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
    keep();
    Snd.cash();
    S.commit(db => { db.current = game; db.draft = null; });
  }

  /* currency plus "N chips = money" with the value of one chip; after() runs on every change */
  function rateBlock(after) {
    const dr = d();
    const out = h('div', { class: 'derived' });
    const symInput = h('input', { type: 'text', value: dr.symbol, maxLength: 4, class: 'w-sm', 'aria-label': T('Symbol'), oninput: e => { dr.symbol = e.target.value; save(); update(); } });
    const sel = h('select', {
      'aria-label': T('Currency'),
      onchange: e => {
        dr.currency = e.target.value;
        const c = Core.CURRENCIES.find(x => x.code === dr.currency);
        if (c) dr.symbol = c.symbol;
        S.commit();
      },
    }, Core.CURRENCIES.map(c => h('option', { value: c.code, selected: c.code === dr.currency }, c.code + ' ' + c.symbol)),
    h('option', { value: 'Custom', selected: !Core.CURRENCIES.some(c => c.code === dr.currency) }, T('Custom')));
    const custom = !Core.CURRENCIES.some(c => c.code === dr.currency);
    const money = h('input', { type: 'text', inputMode: 'decimal', class: 'grow', 'aria-label': T('Money'), value: dr.handMoney, oninput: e => { dr.handMoney = e.target.value; save(); update(); } });
    const chips = h('input', { type: 'text', inputMode: 'numeric', class: 'grow', 'aria-label': T('Chips'), value: dr.handChips, oninput: e => { dr.handChips = e.target.value; save(); update(); } });
    function update() {
      U.clear(out);
      out.className = 'derived';
      const hc = handCents(), hk = handChips();
      if (after) after();
      if (hc == null || !hk) { out.append(h('span', { class: 'muted' }, T('Enter both values to see the value of one chip.'))); return; }
      const v = Core.chipValue(hc, hk);
      if (v != null) {
        out.className = 'derived ok';
        out.append(h('span', null, T('1 chip = {v}', { v: Core.fmt(v, sym()) }) + '  ✓'));
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
      h('div', { class: 'label' }, T('Buy-in')),
      h('div', { class: 'rate-row' }, h('span', { class: 'rate-label' }, T('Costs')), sel, custom ? symInput : null, money),
      h('div', { class: 'rate-row' }, h('span', { class: 'rate-label' }, T('Gets')), chips, h('span', null, T('chips'))),
      out);
  }

  /* ---------- more options: every extra on one page, each a switch that is off by default ---------- */
  function moreTab() {
    const dr = d();
    const hc = handCents(), hk = handChips();
    const rate = hc != null && hk ? { chips: U.fmtChips(hk), money: Core.fmt(hc, sym()) } : null;
    return h('div', { class: 'stack' },
      option(T('Detailed mode'), T('Shows the poker table and records every hand: who won, the pot and a tag. Adds hand stats. When off, the game is a list of players and their buy-ins.'),
        dr.mode === 'detailed', v => { dr.mode = v ? 'detailed' : 'simple'; if (!v) dr.pickSeats = false; }),
      option(T('Fixed buy-ins only'), rate ? T('Every buy-in is exactly {chips} chips ({money}). No other amounts.', rate) : null,
        dr.buyinFixed, v => { dr.buyinFixed = v; }),
      option(T('No buying in for more than the chip leader has'),
        T('Only asked when someone buys in for more than {chips} chips: you enter the chip leader’s stack, and bigger buy-ins are blocked.', { chips: U.fmtChips(hk || 0) }),
        dr.leaderCap, v => { dr.leaderCap = v; }),
      option(T('Host fee (rake)'), T('The host takes a percentage of each pot.'),
        dr.fee.on, v => { dr.fee.on = v; }, feeEditor),
      option(T('Blinds timer'), T('Raises the blinds on a timer, with a bell at each new level.'),
        dr.blinds.on, v => { dr.blinds.on = v; }, blindsEditor),
      dr.mode === 'detailed' ? option(T('Choose seats'), T('When off, players sit side by side in the order you add them.'),
        dr.pickSeats, v => { dr.pickSeats = v; }, seatsEditor) : null);
  }

  function option(title, desc, on, set, body) {
    return h('div', { class: 'card stack-s' },
      toggle(title, on, v => S.commit(() => set(v))),
      desc ? h('div', { class: 'muted small' }, desc) : null,
      on && body ? h('div', { class: 'stack opt-body' }, body()) : null);
  }

  function colourEditor() {
    const dr = d();
    const value = cv();
    if (value == null) return h('div', { class: 'warn small' }, T('One chip must be a whole number of cents.'));
    const warn = h('div', { class: 'warn small' });
    const bankLine = h('div', { class: 'derived' });
    const checkHand = () => {
      warn.textContent = Core.exactMix(handChips(), dr.colours.filter(c => c.chips > 0)) ? '' : T('A buy-in of {n} chips can’t be made exactly with these colours.', { n: U.fmtChips(handChips()) });
      const counted = dr.colours.filter(c => Number.isInteger(c.have) && c.chips > 0);
      const pieces = counted.reduce((s, c) => s + c.have, 0), total = counted.reduce((s, c) => s + c.have * c.chips, 0);
      bankLine.textContent = counted.length
        ? T('The house has {n} chips worth {m}: enough for {k} buy-ins of {b}.', { n: U.fmtChips(pieces), m: Core.fmt(total * value, sym()), k: U.fmtChips(Math.floor(total / handChips())), b: Core.fmt(handCents(), sym()) })
        : T('Count the chips in your set so the app can split colours fairly and keep some in the bank.');
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
          keep(); showDerived(); checkHand();
        },
      });
      showDerived();
      const haveNote = h('span', { class: 'muted small' });
      const showHave = () => { haveNote.textContent = c.have == null ? T('how many?') : T('in the set'); };
      const have = h('input', {
        type: 'text', inputMode: 'numeric', class: 'w-sm', placeholder: '—', 'aria-label': T('How many the house has'),
        value: Number.isInteger(c.have) ? String(c.have) : '',
        oninput: e => { c.have = Core.parseInt0(e.target.value); keep(); showHave(); checkHand(); },
      });
      showHave();
      return h('div', { class: 'colour-row' },
        h('input', { type: 'color', value: c.color, 'aria-label': T('Colour'), oninput: e => { c.color = e.target.value; keep(); } }),
        h('input', { type: 'text', value: c.name, maxLength: 14, class: 'grow', 'aria-label': T('Name'), oninput: e => { c.name = e.target.value; keep(); } }),
        h('div', { class: 'col' }, h('div', { class: 'row gap-s' }, dr.colourUnit === 'money' ? h('span', null, sym()) : null, val), derived),
        h('div', { class: 'col' }, have, haveNote),
        h('button', { class: 'icon-btn', 'aria-label': T('Remove'), onclick: () => S.commit(() => { dr.colours = dr.colours.filter(x => x !== c); keep(); }) }, '✕'));
    });
    checkHand();
    return [
      h('div', { class: 'muted small' }, T('Set each colour’s value and how many of it the house has.')),
      seg([['chips', T('Value in chips')], ['money', T('Value in money')]], dr.colourUnit, v => S.commit(() => { dr.colourUnit = v; })),
      h('div', { class: 'stack-s' }, rows),
      h('button', { class: 'btn ghost', onclick: () => S.commit(() => { dr.colours.push({ id: U.uid(), name: T('Blue'), color: '#2f6fdb', chips: 5000, have: null }); keep(); }) }, '+ ' + T('Add colour')),
      bankLine, warn];
  }

  function feeEditor() {
    const dr = d();
    return [
      h('div', { class: 'grid2' },
        h('label', { class: 'field' }, h('span', null, T('Percent of pot')),
          h('div', { class: 'row gap-s' }, h('input', { type: 'text', inputMode: 'decimal', value: dr.fee.pct, oninput: e => { dr.fee.pct = e.target.value; save(); } }), h('span', null, '%'))),
        h('label', { class: 'field' }, h('span', null, T('No rake below (chips)')),
          h('input', { type: 'text', inputMode: 'numeric', value: dr.fee.minPot, oninput: e => { dr.fee.minPot = e.target.value; save(); } }))),
      hostPicker()];
  }

  function blindsEditor() {
    const dr = d();
    const levels = h('div', { class: 'stack-s' }, dr.blinds.levels.map((l, i) => h('div', { class: 'row gap-s level-row' },
      h('span', { class: 'muted small w-xs' }, String(i + 1)),
      h('input', { type: 'text', inputMode: 'numeric', value: String(l.sb), class: 'w-md', 'aria-label': T('Small blind'), oninput: e => { l.sb = Core.parseInt0(e.target.value) || 0; save(); } }),
      h('span', null, '/'),
      h('input', { type: 'text', inputMode: 'numeric', value: String(l.bb), class: 'w-md', 'aria-label': T('Big blind'), oninput: e => { l.bb = Core.parseInt0(e.target.value) || 0; save(); } }),
      h('button', { class: 'icon-btn', 'aria-label': T('Remove'), onclick: () => S.commit(() => { dr.blinds.levels.splice(i, 1); }) }, '✕'))));
    return [
      h('label', { class: 'field' }, h('span', null, T('Minutes per level')),
        h('input', { type: 'text', inputMode: 'numeric', class: 'w-md', value: dr.blinds.minutes, oninput: e => { dr.blinds.minutes = e.target.value; save(); } })),
      h('div', { class: 'label' }, T('Blind levels (small / big)')), levels,
      h('button', { class: 'btn ghost', onclick: () => S.commit(() => {
        const last = dr.blinds.levels[dr.blinds.levels.length - 1] || { sb: 25, bb: 50 };
        dr.blinds.levels.push({ sb: last.sb * 2, bb: last.bb * 2 });
      }) }, '+ ' + T('Add level'))];
  }

  function seatsEditor() {
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
          h('div', { class: 'muted small' }, T('{n} seated', { n: seated().length }))),
        seat: i => {
          const pid = dr.seats[i];
          if (!pid) return h('div', { class: 'seat empty' }, h('small', null, T('Seat {n}', { n: i + 1 })));
          return h('div', { class: 'seat filled' }, h('div', { class: 'avatar' }, initials(S.nameOf(pid))), h('div', { class: 'seat-name' }, S.nameOf(pid)));
        },
        /* players are added on Basics; here a tap only moves someone to another seat */
        onSeat: i => {
          const pid = dr.seats[i];
          if (!pid) return;
          U.sheet(api => h('div', { class: 'stack' }, h('h3', null, T('Move {name} to…', { name: S.nameOf(pid) })),
            h('div', { class: 'seat-grid' }, dr.seats.map((o, k) => h('button', { class: 'pill' + (k === i ? ' on' : ''), disabled: k === i, onclick: () => {
              S.commit(() => { dr.seats[i] = o; dr.seats[k] = pid; });
              Snd.card(); api.close();
            } }, T('Seat {n}', { n: k + 1 }) + (o && k !== i ? ' ⇄ ' + S.nameOf(o) : ''))))), { cls: 'small' });
        },
      }));
    };
    draw();
    const shuffle = () => {
      const t = tableHolder.firstChild;
      if (t && !U.reduced()) t.classList.add('shuffling');
      [0, 120, 240, 360, 480].forEach(ms => setTimeout(Snd.card, ms));
      setTimeout(() => {
        const people = seated();
        const order = Array.from({ length: dr.seatsN }, (_, i) => i);
        for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
        const seats = Array(dr.seatsN).fill(null);
        people.forEach((p, k) => { seats[order[k]] = p; });
        S.commit(() => { dr.seats = seats; });
      }, U.reduced() ? 0 : 650);
    };
    return [
      h('div', { class: 'row gap wrap' },
        h('span', { class: 'muted small' }, T('Seats')),
        seg(SIZES.map(n => [n, String(n)]), dr.seatsN, n => {
          const people = seated();
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
      h('button', { class: 'btn ghost', onclick: shuffle, disabled: seated().length < 2 }, '🔀 ' + T('Shuffle seats')),
      h('div', { class: 'muted small center' }, T('Tap a player to move them to another seat.'))];
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
