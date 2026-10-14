/* Live game: table, buy-ins, colour helper, rake, hands, blinds, counting and calculate.
   Everything here is shown in chips; money only appears in setup and the results. */
(function () {
  'use strict';
  const Game = window.Game = {};
  const h = U.h;

  const g = () => S.db.current;
  const cfg = () => g().config;
  const chipsText = n => T('{n} chips', { n: U.fmtChips(n) });
  /* Detailed mode shows the poker table and records hands; Simple mode is a plain list of players and their buy-ins */
  const detailed = () => cfg().mode === 'detailed';
  const seatPlayer = i => g().players.find(p => !p.hostOnly && p.seat === i) || null;
  const player = pid => g().players.find(p => p.pid === pid) || null;
  const seated = () => g().players.filter(p => !p.hostOnly);
  const active = () => seated().filter(p => !p.cashedOut);

  Game.newPlayer = (pid, seat) => ({ pid, name: S.nameOf(pid), seat, buyins: [], cashedOut: null, finalChips: null, mix: null });

  Game.render = function () {
    return g().phase === 'count' ? countScreen() : playScreen();
  };

  /* ---------- shared bits ---------- */
  function mixText(mix, colours) {
    return colours.filter(c => mix[c.id]).slice().sort((a, b) => b.chips - a.chips)
      .map(c => mix[c.id] + ' ' + c.name.toLowerCase()).join(', ');
  }
  Game.mixText = mixText;
  function tile(label, value, opts) {
    opts = opts || {};
    return h(opts.onclick ? 'button' : 'div', { class: 'tile' + (opts.cls ? ' ' + opts.cls : ''), onclick: opts.onclick },
      h('div', { class: 'tile-label' }, label), h('div', { class: 'tile-value', 'data-elapsed': opts.elapsed ? '1' : null }, value));
  }
  function rebuyLeader() {
    const ps = seated().filter(p => p.buyins.length > 1);
    if (!ps.length) return null;
    const m = Math.max(...ps.map(p => p.buyins.length));
    const top = ps.filter(p => p.buyins.length === m);
    return top.length === 1 ? top[0].pid : null;
  }

  function tableView(phase) {
    const game = g();
    const leader = rebuyLeader();
    const hostSeat = game.hostPlays && game.hostPid && player(game.hostPid) ? player(game.hostPid).seat : null;
    const hostOnly = game.players.find(p => p.hostOnly);
    const house = Core.rakeTotal(game);
    return TV.table({
      n: cfg().seats, dealer: hostSeat,
      centre: h('div', { class: 'centre-info' },
        h('div', { class: 'logo-mini' }, '♠'),
        cfg().fee.on ? h('button', { class: 'house-spot', onclick: houseSheet },
          '🏠 ' + (hostOnly ? hostOnly.name : T('House')), h('br'), h('small', null, U.fmtChips(house) + ' ' + T('chips'))) : null),
      seat: i => {
        const p = seatPlayer(i);
        if (!p) return TV.emptySeat(i, phase === 'play' ? T('Join') : '');
        if (phase === 'count') {
          const done = Core.isCounted(p);
          const chips = p.cashedOut ? p.cashedOut.chips : p.finalChips;
          return h('div', { class: 'seat filled ' + (done ? 'counted' : 'pending') },
            h('div', { class: 'seat-name' }, p.name),
            h('div', { class: 'seat-sub' }, done ? '✓ ' + U.fmtChips(chips) : T('counting…')));
        }
        return h('div', { class: 'seat filled' + (p.cashedOut ? ' out' : '') },
          TV.stack(Math.max(p.buyins.length, 0), cfg().colours),
          h('div', { class: 'seat-name' }, (leader === p.pid ? '🔁 ' : '') + p.name),
          h('div', { class: 'seat-sub' }, p.cashedOut ? T('out') : U.fmtChips(Core.paidChips(p))));
      },
      onSeat: i => {
        const p = seatPlayer(i);
        if (p) { if (phase === 'count') counter(p.pid); else panel(p.pid); return; }
        if (phase === 'count') return;
        lateJoiner(i);
      },
    });
  }

  /* add someone mid-game: at seat i on the table, or at the end of the list in Simple mode */
  function lateJoiner(i) {
    TV.pickPlayer({ exclude: g().players.map(x => x.pid), title: T('Late joiner') }).then(prof => {
      if (!prof) return;
      Snd.clack();
      S.commit(() => {
        const seat = i != null ? i : seated().reduce((m, p) => Math.max(m, p.seat + 1), 0);
        if (seat >= cfg().seats) cfg().seats = seat + 1;
        g().players.push(Game.newPlayer(prof.id, seat));
      });
      panel(prof.id);
    });
  }

  /* ---------- play screen ---------- */
  function playScreen() {
    const game = g(), c = cfg();
    const issued = Core.issuedChips(game);
    const tiles = [
      tile(T('Chips on table'), U.fmtChips(Core.inPlayChips(game))),
      tile(T('Chips bought'), U.fmtChips(issued)),
      tile(T('Elapsed'), U.fmtDur(Date.now() - game.startedAt), { elapsed: true }),
    ];
    if (Core.bankTracked(game)) tiles.push(tile(T('Bank'), U.fmtChips(bankChips()), { onclick: bankSheet, cls: 'tap' }));
    if (c.fee.on) tiles.push(tile(T('House pile'), U.fmtChips(Core.rakeTotal(game)), { onclick: houseSheet, cls: 'tap' }));
    if (c.mode === 'detailed') tiles.push(tile(T('Hands'), String(game.hands.length)));
    const actions = h('div', { class: 'actions' },
      c.fee.on ? h('button', { class: 'btn', onclick: () => rakeSheet() }, '🏠 ' + T('Rake')) : null,
      c.mode === 'detailed' ? h('button', { class: 'btn', onclick: handSheet }, '🂠 ' + T('Record hand')) : null,
      h('button', { class: 'btn primary', onclick: endGame }, T('End game') + ' →'));
    const everyone = issued === 0 && seated().length ? h('button', { class: 'btn primary block pulse', onclick: everyoneBuysIn }, T('Everyone buys in {m}', { m: chipsText(c.handChips) })) : null;
    if (!detailed()) {
      return h('div', { class: 'screen game' },
        h('div', { class: 'tiles' }, tiles),
        c.blinds.on ? blindsBar() : null,
        everyone,
        playerList(true),
        actions);
    }
    return h('div', { class: 'screen game' },
      h('div', { class: 'tiles' }, tiles),
      c.blinds.on ? blindsBar() : null,
      tableView('play'),
      everyone,
      actions,
      playerList(false),
      handLog());
  }

  function everyoneBuysIn() {
    const c = cfg();
    const n = active().length;
    /* the same mix for everyone; keep enough in the bank for everyone to rebuy once when possible */
    const mix = Core.bankMix(c.handChips, c.colours, Core.bank(g()), n * 2, n);
    const show = () => U.sheet(api => h('div', { class: 'stack' },
      h('h3', null, T('Everyone buys in')),
      h('p', null, T('Give each player {n} chips:', { n: U.fmtChips(c.handChips) })),
      mix.remainder ? h('div', { class: 'warn' }, T('Can’t be made exactly with your colours.')) : h('div', { class: 'big-mix' }, mixText(mix.mix, c.colours)),
      mix.short ? h('div', { class: 'warn small' }, T('The bank doesn’t have enough of some colours for everyone. Check the bank.')) : null,
      h('div', { class: 'muted small' }, seated().map(p => p.name).join(', ')),
      h('button', { class: 'btn primary block', onclick: () => {
        api.close();
        const t = Date.now();
        Snd.cash();
        S.commit(() => active().forEach(p => p.buyins.push({ id: U.uid(), t, chips: c.handChips, mix: mix.remainder ? null : mix.mix })));
      } }, T('Confirm {n} buy-ins', { n: active().length }))), { cls: 'small' });
    show();
  }

  /* the players and their buy-ins; in Simple mode this is the main view, with a one-tap buy-in on each row and a way to add late joiners */
  function playerList(main) {
    const c = cfg();
    const leader = rebuyLeader();
    const ps = seated().slice().sort((a, b) => a.seat - b.seat);
    if (!ps.length && !main) return null;
    return h('div', { class: 'card' + (main ? ' player-list' : '') },
      h('div', { class: 'card-title' }, T('Players')),
      h('table', { class: 'list-table' },
        h('thead', null, h('tr', null, h('th', null, T('Player')), h('th', { class: 'num' }, T('Buy-ins')), h('th', { class: 'num' }, T('In')), main ? h('th') : null)),
        h('tbody', null, ps.map(p => h('tr', { onclick: () => panel(p.pid), class: 'tap' },
          h('td', null, p.name, g().hostPid === p.pid ? h('span', { class: 'tag' }, T('host')) : null,
            leader === p.pid ? h('span', { class: 'tag' }, '🔁 ' + T('most rebuys')) : null,
            p.cashedOut ? h('span', { class: 'tag muted' }, T('cashed out')) : null),
          h('td', { class: 'num' }, String(p.buyins.length)),
          h('td', { class: 'num' }, U.fmtChips(Core.paidChips(p))),
          main ? h('td', { class: 'num' }, p.cashedOut ? null : h('button', {
            class: 'btn small', 'aria-label': T('Buy-in for {name}', { name: p.name }),
            onclick: e => { e.stopPropagation(); buy(p.pid, c.handChips); },
          }, '+' + U.fmtChips(c.handChips))) : null)))),
      main ? h('button', { class: 'btn ghost block', onclick: () => lateJoiner(null) }, '+ ' + T('Add player')) : null);
  }

  /* Simple mode's counting view: tap a player to count their chips */
  function countList() {
    const ps = seated().slice().sort((a, b) => a.seat - b.seat);
    return h('div', { class: 'card player-list' },
      h('div', { class: 'card-title' }, T('Players')),
      h('table', { class: 'list-table' },
        h('thead', null, h('tr', null, h('th', null, T('Player')), h('th', { class: 'num' }, T('In')), h('th', { class: 'num' }, T('Counted')))),
        h('tbody', null, ps.map(p => {
          const done = Core.isCounted(p);
          return h('tr', { onclick: () => counter(p.pid), class: 'tap' + (done ? '' : ' pending') },
            h('td', null, p.name),
            h('td', { class: 'num' }, U.fmtChips(Core.paidChips(p))),
            h('td', { class: 'num' }, done ? '✓ ' + U.fmtChips(p.cashedOut ? p.cashedOut.chips : p.finalChips) : h('span', { class: 'muted' }, T('counting…'))));
        }))));
  }

  /* ---------- player panel ---------- */
  function panel(pid) {
    const st = { other: false, more: false };
    U.sheet(api => {
      const p = player(pid);
      if (!p) { setTimeout(api.close); return h('div'); }
      const c = cfg();
      const prof = S.profile(pid) || {};
      const counting = g().phase === 'count';
      return h('div', { class: 'stack' },
        h('div', { class: 'row between' },
          h('h3', null, p.name, g().hostPid === pid ? h('span', { class: 'tag' }, T('host')) : null),
          detailed() ? h('div', { class: 'muted small' }, T('Seat {n}', { n: p.seat + 1 })) : null),
        h('div', { class: 'kpis' },
          h('div', null, h('small', null, T('Chips bought')), h('strong', null, U.fmtChips(Core.paidChips(p)))),
          h('div', null, h('small', null, T('Buy-ins')), h('strong', null, String(p.buyins.length)))),
        p.cashedOut ? h('div', { class: 'notice' },
          T('Cashed out {n} chips at {t}', { n: U.fmtChips(p.cashedOut.chips), t: U.fmtTime(p.cashedOut.t) }),
          h('button', { class: 'btn small', onclick: () => { S.commit(() => { p.cashedOut = null; p.finalChips = null; }); api.refresh(); } }, T('Undo cash-out'))) : null,
        !p.cashedOut ? buyBox(pid, api, st) : null,
        p.buyins.length ? h('div', { class: 'stack-s' },
          h('div', { class: 'label' }, T('Buy-in log')),
          p.buyins.slice().reverse().map(b => h('div', { class: 'log-row' },
            h('span', { class: 'muted' }, U.fmtTime(b.t)),
            h('span', { class: 'grow col' }, h('strong', null, chipsText(b.chips)),
              b.mix ? h('small', { class: 'muted' }, mixText(b.mix, c.colours)) : null),
            h('button', { class: 'icon-btn', 'aria-label': T('Change colours'), onclick: () => changeColours(pid, b.id, api) }, '✎'),
            h('button', { class: 'icon-btn', 'aria-label': T('Undo'), onclick: () => {
              U.ask({ title: T('Undo this buy-in?'), body: chipsText(b.chips) + ' · ' + U.fmtTime(b.t), ok: T('Undo'), danger: true }).then(ok => {
                if (!ok) return;
                S.commit(() => { p.buyins = p.buyins.filter(x => x.id !== b.id); });
                api.refresh();
              });
            } }, '↺')))) : null,
        h('div', { class: 'grid2' },
          counting
            ? h('button', { class: 'btn primary', onclick: () => { api.close(); counter(pid); } }, T('Count chips'))
            : !p.cashedOut ? h('button', { class: 'btn', onclick: () => { api.close(); counter(pid, true); } }, '💵 ' + T('Cash out')) : null,
          !p.cashedOut && !counting ? h('button', { class: 'btn', onclick: () => bust(pid, api) }, '💀 ' + T('Bust (0)')) : null),
        h('button', { class: 'btn ghost small', 'aria-expanded': String(st.more), onclick: () => { st.more = !st.more; api.refresh(); } },
          (st.more ? '▴ ' : '▾ ') + T('More')),
        st.more ? h('div', { class: 'grid2' },
          h('button', { class: 'btn ghost', onclick: () => rename(pid, api) }, T('Rename')),
          h('button', { class: 'btn ghost', onclick: () => handles(pid, api) }, T('Handles')),
          detailed() ? h('button', { class: 'btn ghost', onclick: () => moveSeat(pid, api) }, T('Move seat')) : null,
          g().config.fee.on && g().hostPlays && g().hostPid !== pid ? h('button', { class: 'btn ghost', onclick: () => { S.commit(() => { g().hostPid = pid; }); api.refresh(); } }, '🔘 ' + T('Make host')) : null,
          !p.buyins.length && g().hostPid !== pid ? h('button', { class: 'btn ghost danger', onclick: () => { api.close(); S.commit(() => { g().players = g().players.filter(x => x.pid !== pid); }); } }, T('Remove')) : null) : null,
        st.more && (prof.etransfer || prof.wechat) ? h('div', { class: 'muted small' },
          [prof.etransfer ? 'e-Transfer: ' + prof.etransfer : null, prof.wechat ? 'WeChat: ' + prof.wechat : null].filter(Boolean).join(' · ')) : null);
    });
  }
  Game.panel = panel;

  /* buy-ins the bank should still cover after this one: everyone not in yet, plus one rebuy each */
  function bankSlots(pid) {
    const act = active();
    return 1 + act.filter(p => p.pid !== pid && !p.buyins.length).length + act.length;
  }
  function bankChips() {
    const bank = Core.bank(g());
    return cfg().colours.reduce((s, col) => s + (bank[col.id] != null ? bank[col.id] * col.chips : 0), 0);
  }

  /* Buy-in buttons in the player panel: one tap records the buy-in with a suggested colour mix.
     Fixed mode: whole buy-ins only. Otherwise quick amounts plus "Other" for any number of chips. */
  function buyBox(pid, panelApi, st) {
    const c = cfg(), rules = c.buyin || {};
    const half = c.handChips % 2 === 0 ? c.handChips / 2 : null;
    const quick = rules.fixed
      ? [['+1 ' + T('buy-in') + ' · ' + U.fmtChips(c.handChips), c.handChips], ['+2 · ' + U.fmtChips(c.handChips * 2), c.handChips * 2]]
      : [half, c.handChips, c.handChips * 2].filter(Boolean).map(n => ['+' + U.fmtChips(n), n]);
    const buttons = quick.map(([label, chips]) => h('button', { class: 'btn', onclick: () => buy(pid, chips, panelApi) }, label));
    if (rules.fixed) return h('div', { class: 'stack-s' }, h('div', { class: 'quick-row' }, buttons));
    if (!st.other) {
      return h('div', { class: 'stack-s' },
        h('div', { class: 'quick-row' }, buttons,
          h('button', { class: 'btn ghost', onclick: () => { st.other = true; panelApi.refresh(); setTimeout(() => { const el = panelApi.panel.querySelector('[data-amount]'); if (el) el.focus(); }); } }, T('Other'))));
    }

    let typed = null;
    const out = h('div', { class: 'muted small' });
    const go = h('button', { class: 'btn primary', disabled: true, onclick: () => { if (typed) buy(pid, typed, panelApi); } }, T('Buy in'));
    const input = h('input', {
      type: 'text', inputMode: 'numeric', class: 'grow', 'data-amount': '1',
      placeholder: String(c.handChips), 'aria-label': T('Buy-in amount'),
      oninput: () => sync(), onkeydown: e => { if (e.key === 'Enter') go.click(); },
    });
    function sync() {
      const v = input.value.trim();
      typed = Core.parseInt0(v) || null;
      out.textContent = !v ? '' : typed ? '= ' + chipsText(typed) : T('Enter whole chips');
      out.className = 'small ' + (!v ? 'muted' : typed ? 'win' : 'bad-text');
      go.disabled = !typed;
    }
    return h('div', { class: 'stack-s' },
      h('div', { class: 'quick-row' }, buttons),
      h('div', { class: 'row gap-s' }, input, h('span', null, T('chips')), go),
      out);
  }

  /* With the chip-leader rule, a buy-in bigger than the standard one needs the leader's stack first. */
  function leaderCheck(pid, chips) {
    const c = cfg();
    const others = active().filter(x => x.pid !== pid && x.buyins.length);
    if (!(c.buyin && c.buyin.leaderCap) || g().phase !== 'play' || !others.length || chips <= c.handChips) return Promise.resolve(chips);
    return new Promise(resolve => {
      let done = false;
      U.sheet(api => {
        const onTable = Core.inPlayChips(g());
        const msg = h('div', { class: 'small muted' });
        const ok = h('button', { class: 'btn primary block', disabled: true });
        let leader = null;
        const input = h('input', { type: 'text', inputMode: 'numeric', class: 'big-input', placeholder: T('Chip leader’s stack'), 'aria-label': T('Chip leader’s stack'),
          oninput: () => sync(), onkeydown: e => { if (e.key === 'Enter') ok.click(); } });
        const sync = () => {
          const n = Core.parseInt0(input.value);
          leader = n && n <= onTable ? n : null;
          ok.disabled = !leader;
          if (!input.value.trim()) { msg.className = 'small muted'; msg.textContent = ''; ok.textContent = T('Buy in'); return; }
          if (!leader) { msg.className = 'small bad-text'; msg.textContent = T('At most the {n} chips on the table.', { n: U.fmtChips(onTable) }); ok.textContent = T('Buy in'); return; }
          const take = Math.min(chips, leader);
          msg.className = 'small ' + (take < chips ? 'bad-text' : 'win');
          msg.textContent = take < chips ? T('That’s more than the chip leader has. The most is {n} chips.', { n: U.fmtChips(leader) }) : '✓';
          ok.textContent = T('Buy in {m}', { m: chipsText(take) });
        };
        ok.addEventListener('click', () => {
          if (!leader) return;
          done = true; api.close();
          g().leaderChips = leader; S.save();
          resolve(Math.min(chips, leader));
        });
        setTimeout(() => input.focus(), 250);
        return h('div', { class: 'stack' },
          h('h3', null, T('How many chips does the chip leader have?')),
          h('div', { class: 'muted small' }, T('{name} wants {n} chips. Nobody can buy in for more than the chip leader has.', { name: player(pid).name, n: U.fmtChips(chips) })),
          input, msg, ok);
      }, { cls: 'small', onclose: () => { if (!done) resolve(null); } });
    });
  }

  /* one tap: record the buy-in with the suggested mix and say which chips to hand over (with Undo).
     When the mix can't be made from the bank or at all, open the colour helper instead. */
  function buy(pid, chips, panelApi) {
    leaderCheck(pid, chips).then(n => {
      if (!n) return;
      const c = cfg();
      const sugg = Core.bankMix(n, c.colours, Core.bank(g()), bankSlots(pid));
      if (sugg.remainder || sugg.short) { buyIn(pid, n, panelApi); return; }
      record(pid, n, sugg.mix, panelApi);
    });
  }
  function record(pid, chips, mix, panelApi) {
    const c = cfg(), p = player(pid), id = U.uid();
    Snd.clack();
    S.commit(() => { p.buyins.push({ id, t: Date.now(), chips, mix }); });
    U.toast(T('Give {name} {mix}', { name: p.name, mix: mixText(mix, c.colours) }) + ' · ' + chipsText(chips), 'good', {
      label: T('Undo'),
      fn: () => { S.commit(() => { p.buyins = p.buyins.filter(b => b.id !== id); }); if (panelApi) panelApi.refresh(); },
    });
    if (panelApi) panelApi.refresh();
  }

  /* the colour helper, for buy-ins one tap can't handle (or free mode) */
  function buyIn(pid, chips, panelApi) {
    const c = cfg();
    Helper.open({
      target: chips, title: T('Buy-in for {name}', { name: player(pid).name }), slots: bankSlots(pid),
      max: c.buyin && c.buyin.leaderCap ? Math.max(c.handChips, g().leaderChips || 0) : null,
      onConfirm: (total, mix) => record(pid, total, mix, panelApi),
    });
  }

  /* hand over different colours for a buy-in already recorded */
  function changeColours(pid, id, panelApi) {
    const b = player(pid).buyins.find(x => x.id === id);
    if (!b) return;
    Helper.open({
      target: b.chips, title: T('Colours for {name}', { name: player(pid).name }), slots: bankSlots(pid), current: b.mix, fixedTarget: true,
      onConfirm: (total, mix) => { S.commit(() => { b.mix = mix; }); if (panelApi) panelApi.refresh(); },
    });
  }

  function bankSheet() {
    U.sheet(() => {
      const c = cfg(), bank = Core.bank(g());
      const total = bankChips();
      const pieces = c.colours.reduce((s, col) => s + (bank[col.id] != null ? bank[col.id] : 0), 0);
      return h('div', { class: 'stack' },
        h('h3', null, '🏦 ' + T('Bank')),
        h('div', { class: 'kpis' },
          h('div', null, h('small', null, T('Pieces')), h('strong', null, U.fmtChips(pieces))),
          h('div', null, h('small', null, T('Chips')), h('strong', null, U.fmtChips(total)))),
        h('div', { class: 'stack-s' }, c.colours.slice().sort((a, b) => b.chips - a.chips).map(col => h('div', { class: 'count-row' },
          h('span', { class: 'swatch', style: { background: col.color } }),
          h('span', { class: 'grow' }, col.name, h('small', { class: 'muted' }, ' × ' + U.fmtChips(col.chips))),
          bank[col.id] == null ? h('span', { class: 'muted small' }, T('not counted'))
            : h('strong', { class: bank[col.id] < 0 ? 'bad-text' : null }, T('{a} of {b} left', { a: bank[col.id], b: col.have }))))),
        h('div', { class: 'muted small' }, T('Buy-ins take chips from the bank and cash-outs put them back. Suggested mixes keep some of every colour for later buy-ins.')));
    }, { cls: 'small' });
  }

  function bust(pid, panelApi) {
    const p = player(pid);
    U.ask({ title: T('{name} is bust?', { name: p.name }), body: T('Counts them as 0 chips and locks them.'), ok: T('Bust') }).then(ok => {
      if (!ok) return;
      Snd.buzz();
      S.commit(() => { p.cashedOut = { chips: 0, t: Date.now(), mix: null }; p.finalChips = 0; });
      if (panelApi) panelApi.refresh();
    });
  }

  function rename(pid, panelApi) {
    const p = player(pid);
    U.sheet(api => {
      const input = h('input', { type: 'text', value: p.name, maxLength: 24 });
      setTimeout(() => input.select(), 250);
      return h('div', { class: 'stack' }, h('h3', null, T('Rename')), input,
        h('button', { class: 'btn primary block', onclick: () => {
          const name = input.value.trim();
          if (!name) return;
          const other = S.findProfile(name);
          if (other && other.id !== pid) { U.toast(T('That name is taken by another player.'), 'bad'); Snd.buzz(); return; }
          S.commit(() => { p.name = name; const prof = S.profile(pid); if (prof) prof.name = name; });
          api.close(); if (panelApi) panelApi.refresh();
        } }, T('Save')));
    }, { cls: 'small' });
  }

  function handles(pid, panelApi) {
    Game.editHandles(pid, () => panelApi && panelApi.refresh());
  }
  Game.editHandles = function (pid, after) {
    const prof = S.profile(pid);
    if (!prof) return;
    U.sheet(api => {
      const et = h('input', { type: 'text', value: prof.etransfer || '', placeholder: 'name@email.com', inputMode: 'email' });
      const wc = h('input', { type: 'text', value: prof.wechat || '', placeholder: 'WeChat ID' });
      return h('div', { class: 'stack' }, h('h3', null, T('Payment handles') + ' · ' + prof.name),
        h('label', { class: 'field' }, h('span', null, 'e-Transfer'), et),
        h('label', { class: 'field' }, h('span', null, 'WeChat Pay'), wc),
        h('button', { class: 'btn primary block', onclick: () => {
          S.commit(() => { prof.etransfer = et.value.trim(); prof.wechat = wc.value.trim(); });
          api.close(); if (after) after();
        } }, T('Save')));
    }, { cls: 'small' });
  };

  function moveSeat(pid, panelApi) {
    const p = player(pid);
    U.sheet(api => h('div', { class: 'stack' }, h('h3', null, T('Move {name} to…', { name: p.name })),
      h('div', { class: 'seat-grid' }, Array.from({ length: cfg().seats }, (_, i) => {
        const o = seatPlayer(i);
        return h('button', { class: 'pill' + (i === p.seat ? ' on' : ''), disabled: i === p.seat, onclick: () => {
          S.commit(() => { if (o) o.seat = p.seat; p.seat = i; });
          Snd.card(); api.close(); if (panelApi) panelApi.refresh();
        } }, T('Seat {n}', { n: i + 1 }) + (o && i !== p.seat ? ' ⇄ ' + o.name : ''));
      }))), { cls: 'small' });
  }

  /* ---------- colour counter (cash out & end of game) ---------- */
  function counter(pid, cashOut) {
    const p = player(pid);
    const c = cfg();
    const prev = p.cashedOut ? p.cashedOut.mix : p.mix;
    const counts = {};
    c.colours.forEach(col => { counts[col.id] = prev && prev[col.id] || 0; });
    const prevTotal = p.cashedOut ? p.cashedOut.chips : p.finalChips;
    let extra = prev ? (prevTotal || 0) - Core.mixTotal(prev, c.colours) : (prevTotal || 0);
    U.sheet(api => {
      const totalEl = h('strong', { class: 'count-total' });
      const valueEl = h('div', { class: 'muted' });
      const update = () => {
        const tot = Core.mixTotal(counts, c.colours) + extra;
        totalEl.textContent = chipsText(tot);
        const net = tot - Core.paidChips(p);
        valueEl.textContent = T('result') + ' ' + (net > 0 ? '+' : '') + chipsText(net);
        valueEl.className = net > 0 ? 'win' : net < 0 ? 'loss' : 'muted';
      };
      const rows = c.colours.slice().sort((a, b) => b.chips - a.chips).map(col => {
        const inp = h('input', { type: 'text', inputMode: 'numeric', class: 'count-input', value: counts[col.id] ? String(counts[col.id]) : '', placeholder: '0',
          oninput: e => { counts[col.id] = Core.parseInt0(e.target.value) || 0; update(); } });
        const bump = d => {
          counts[col.id] = Math.max(0, counts[col.id] + d);
          inp.value = counts[col.id] ? String(counts[col.id]) : '';
          inp.classList.remove('pop'); void inp.offsetWidth; inp.classList.add('pop');
          Snd.clack(); update();
        };
        return h('div', { class: 'count-row' },
          h('span', { class: 'swatch', style: { background: col.color } }),
          h('span', { class: 'grow' }, col.name, h('small', { class: 'muted' }, ' × ' + U.fmtChips(col.chips))),
          h('button', { class: 'round-btn', onclick: () => bump(-1), 'aria-label': '−' }, '−'), inp,
          h('button', { class: 'round-btn', onclick: () => bump(1), 'aria-label': '+' }, '+'));
      });
      const extraInp = h('input', { type: 'text', inputMode: 'numeric', class: 'count-input wide', value: extra ? String(extra) : '', placeholder: '0',
        oninput: e => { extra = Core.parseInt0(e.target.value) || 0; update(); } });
      update();
      const saveCount = chips => {
        const mix = Object.assign({}, counts);
        Snd.cash();
        S.commit(() => {
          if (cashOut || p.cashedOut) p.cashedOut = { chips, t: p.cashedOut ? p.cashedOut.t : Date.now(), mix };
          else { p.finalChips = chips; p.mix = mix; }
          if (p.cashedOut) p.finalChips = chips;
        });
        api.close();
      };
      return h('div', { class: 'stack' },
        h('h3', null, (cashOut ? T('Cash out') : T('Count chips')) + ' · ' + p.name),
        h('div', { class: 'muted small' }, T('Bought {n} chips', { n: U.fmtChips(Core.paidChips(p)) })),
        h('div', { class: 'stack-s' }, rows),
        h('div', { class: 'count-row' }, h('span', { class: 'grow muted small' }, T('Other chips (loose total)')), extraInp),
        h('div', { class: 'count-sum' }, totalEl, valueEl),
        h('div', { class: 'grid2' },
          h('button', { class: 'btn ghost', onclick: () => { Snd.buzz(); Object.keys(counts).forEach(k => { counts[k] = 0; }); extra = 0; saveCount(0); } }, '💀 ' + T('Bust (0)')),
          h('button', { class: 'btn primary', onclick: () => saveCount(Core.mixTotal(counts, c.colours) + extra) }, cashOut ? T('Cash out') : T('Save count'))),
        g().phase === 'count' ? h('button', { class: 'btn ghost small', onclick: () => { api.close(); panel(pid); } }, T('Fix buy-ins…')) : null);
    });
  }

  /* ---------- rake ---------- */
  function rakeSheet(prefill) {
    const c = cfg();
    U.sheet(api => {
      const out = h('div', { class: 'rake-out' });
      const input = h('input', { type: 'text', inputMode: 'numeric', class: 'big-input', placeholder: T('Chips in pot'), value: prefill ? String(prefill) : '' });
      const addBtn = h('button', { class: 'btn primary block', disabled: true }, T('Add to house pile'));
      let take = 0, pot = 0;
      const update = () => {
        pot = Core.parseInt0(input.value) || 0;
        take = Core.rakeChips(pot, c.fee.bps, c.fee.minPot);
        U.clear(out);
        addBtn.disabled = !take;
        if (!pot) return;
        if (pot < c.fee.minPot) { out.append(h('div', { class: 'big-msg' }, T('No rake.')), h('div', { class: 'muted small' }, T('Pot is below {n} chips.', { n: U.fmtChips(c.fee.minPot) }))); return; }
        if (!take) { out.append(h('div', { class: 'big-msg' }, T('No rake.')), h('div', { class: 'muted small' }, T('Fee rounds down to 0 chips.'))); return; }
        const grab = Core.grabMix(take, c.colours);
        U.append(out, [
          h('div', { class: 'big-msg' }, T('Take out {n} chips', { n: U.fmtChips(take) })),
          h('div', { class: 'muted small' }, Core.fmtPct(c.fee.bps) + ' × ' + U.fmtChips(pot)),
          h('div', { class: 'mix-chips' }, c.colours.filter(col => grab.mix[col.id]).slice().sort((a, b) => b.chips - a.chips).map(col =>
            h('span', { class: 'mix-chip' }, h('span', { class: 'swatch', style: { background: col.color } }), grab.mix[col.id] + ' × ' + col.name))),
          grab.remainder ? h('div', { class: 'warn small' }, T('{n} chips can’t be grabbed exactly. Make change from the pot.', { n: grab.remainder })) : null]);
      };
      input.addEventListener('input', update);
      addBtn.addEventListener('click', () => {
        if (!take) return;
        Snd.clack(); setTimeout(Snd.clack, 90);
        S.commit(() => { g().rake.push({ id: U.uid(), t: Date.now(), chips: take, pot }); });
        U.toast('🏠 +' + U.fmtChips(take) + ' ' + T('chips'), 'good');
        api.close();
      });
      setTimeout(() => { input.focus(); update(); }, 250);
      return h('div', { class: 'stack' },
        h('h3', null, T('Rake')),
        h('div', { class: 'muted small' }, Core.fmtPct(c.fee.bps) + (c.fee.minPot ? ' · ' + T('no rake below {n} chips', { n: U.fmtChips(c.fee.minPot) }) : '')),
        input, out, addBtn);
    }, { cls: 'small' });
  }

  function houseSheet() {
    U.sheet(api => {
      const game = g(), c = cfg();
      const total = Core.rakeTotal(game);
      return h('div', { class: 'stack' },
        h('h3', null, '🏠 ' + T('House pile')),
        h('div', { class: 'kpis' },
          h('div', null, h('small', null, T('Chips')), h('strong', null, U.fmtChips(total)))),
        game.rake.length ? game.rake.slice().reverse().map(r => h('div', { class: 'log-row' },
          h('span', { class: 'muted' }, U.fmtTime(r.t)),
          h('span', { class: 'grow' }, T('pot {n}', { n: U.fmtChips(r.pot) })),
          h('strong', null, '+' + U.fmtChips(r.chips)),
          game.phase === 'play' ? h('button', { class: 'icon-btn', 'aria-label': T('Undo'), onclick: () => {
            S.commit(() => { game.rake = game.rake.filter(x => x.id !== r.id); });
            api.refresh();
          } }, '↺') : null)) : h('div', { class: 'muted' }, T('Nothing raked yet.')),
        game.phase === 'play' ? h('button', { class: 'btn primary block', onclick: () => { api.close(); rakeSheet(); } }, T('Rake a pot')) : null);
    }, { cls: 'small' });
  }

  /* ---------- hands (Detailed mode) ---------- */
  const TAGS = [['showdown', 'Showdown'], ['fold', 'Everyone folded'], ['allin', 'All-in']];
  Game.TAGS = TAGS;
  function handSheet() {
    const winners = new Set();
    let tag = 'showdown';
    let potStr = '';
    U.sheet(api => {
      const c = cfg();
      const ps = active();
      const pot = h('input', { type: 'text', inputMode: 'numeric', placeholder: T('Pot (optional)'), value: potStr, oninput: e => { potStr = e.target.value; } });
      return h('div', { class: 'stack' },
        h('h3', null, T('Hand #{n}', { n: g().hands.length + 1 })),
        h('div', { class: 'label' }, T('Winner(s)') + ' · ' + T('select several for a split pot')),
        h('div', { class: 'pill-list' }, ps.map(p => h('button', {
          class: 'pill' + (winners.has(p.pid) ? ' on' : ''),
          onclick: () => { winners.has(p.pid) ? winners.delete(p.pid) : winners.add(p.pid); Snd.tick(); api.refresh(); },
        }, p.name))),
        pot,
        Setup.seg(TAGS.map(([k, l]) => [k, T(l)]), tag, v => { tag = v; api.refresh(); }),
        h('button', { class: 'btn primary block', disabled: !winners.size, onclick: () => {
          const potChips = Core.parseInt0(potStr) || 0;
          Snd.card();
          S.commit(() => { g().hands.push({ id: U.uid(), t: Date.now(), winners: Array.from(winners), pot: potChips || null, tag }); });
          api.close();
          if (c.fee.on && potChips && Core.rakeChips(potChips, c.fee.bps, c.fee.minPot) > 0) rakeSheet(potChips);
        } }, T('Save hand')));
    }, { cls: 'small' });
  }

  function handLog() {
    const hands = g().hands;
    return h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('div', { class: 'card-title' }, T('Hand log')),
        hands.length ? h('button', { class: 'btn small ghost', onclick: () => {
          U.ask({ title: T('Undo the last hand?'), ok: T('Undo'), danger: true }).then(ok => { if (ok) S.commit(() => { g().hands.pop(); }); });
        } }, '↺ ' + T('Undo last')) : null),
      hands.length ? hands.slice(-8).reverse().map((hd, k) => h('div', { class: 'log-row' },
        h('span', { class: 'muted' }, '#' + (hands.length - k)),
        h('span', { class: 'grow' }, hd.winners.map(w => (player(w) || {}).name || S.nameOf(w)).join(' + ')),
        h('span', { class: 'tag' }, T((TAGS.find(t => t[0] === hd.tag) || [0, ''])[1])),
        h('span', { class: 'muted' }, hd.pot ? U.fmtChips(hd.pot) : '—'))) : h('div', { class: 'muted small' }, T('No hands yet. Tap “Record hand”.')));
  }

  /* ---------- blinds ---------- */
  function blindsBar() {
    const b = g().blinds, lv = cfg().blinds.levels;
    const cur = lv[Math.min(b.level, lv.length - 1)] || { sb: 0, bb: 0 };
    const nxt = lv[b.level + 1];
    return h('div', { class: 'blinds' },
      h('div', null, h('div', { class: 'muted small' }, T('Level {n}', { n: b.level + 1 })), h('strong', { class: 'blinds-now' }, U.fmtChips(cur.sb) + '/' + U.fmtChips(cur.bb))),
      h('div', { class: 'blinds-clock', 'data-blinds': '1' }, U.fmtDur(Game.blindsRemaining())),
      h('div', { class: 'muted small' }, nxt ? T('Next {a}/{b}', { a: U.fmtChips(nxt.sb), b: U.fmtChips(nxt.bb) }) : T('Last level')),
      h('div', { class: 'row gap-s' },
        h('button', { class: 'icon-btn', 'aria-label': T('Previous level'), onclick: () => setLevel(b.level - 1) }, '⏮'),
        h('button', { class: 'icon-btn strong', onclick: toggleBlinds, 'aria-label': b.running ? T('Pause') : T('Start') }, b.running ? '⏸' : '▶'),
        h('button', { class: 'icon-btn', 'aria-label': T('Next level'), onclick: () => setLevel(b.level + 1) }, '⏭')));
  }
  Game.blindsRemaining = function () {
    const b = g().blinds;
    return b.running ? Math.max(0, b.endsAt - Date.now()) : b.remaining;
  };
  function toggleBlinds() {
    const b = g().blinds;
    S.commit(() => {
      if (b.running) { b.remaining = Math.max(0, b.endsAt - Date.now()); b.running = false; b.endsAt = null; }
      else { b.running = true; b.endsAt = Date.now() + (b.remaining || cfg().blinds.minutes * 60000); }
    });
  }
  function setLevel(n) {
    const lv = cfg().blinds.levels;
    if (n < 0 || n >= lv.length) return;
    const b = g().blinds;
    S.commit(() => {
      b.level = n;
      b.remaining = cfg().blinds.minutes * 60000;
      if (b.running) b.endsAt = Date.now() + b.remaining;
    });
  }
  /* called every second by the app */
  Game.tick = function () {
    const game = g();
    if (!game) return;
    document.querySelectorAll('[data-elapsed]').forEach(el => { el.textContent = U.fmtDur(Date.now() - game.startedAt); });
    if (!game.config.blinds.on || game.phase !== 'play') return;
    const b = game.blinds;
    if (b.running && Date.now() >= b.endsAt) {
      const lv = game.config.blinds.levels;
      if (b.level < lv.length - 1) {
        b.level++;
        b.endsAt += game.config.blinds.minutes * 60000;
        if (b.endsAt < Date.now()) b.endsAt = Date.now() + game.config.blinds.minutes * 60000;
        const l = lv[b.level];
        Snd.bell();
        U.toast('🔔 ' + T('Blinds up: {a}/{b}', { a: U.fmtChips(l.sb), b: U.fmtChips(l.bb) }), 'big');
      } else { b.running = false; b.remaining = 0; b.endsAt = null; Snd.bell(); }
      S.commit();
      return;
    }
    document.querySelectorAll('[data-blinds]').forEach(el => { el.textContent = U.fmtDur(Game.blindsRemaining()); });
  };

  /* ---------- end of game ---------- */
  function endGame() {
    if (!Core.issuedChips(g())) { U.toast(T('Nobody has bought in yet.'), 'bad'); Snd.buzz(); return; }
    U.ask({ title: T('End the game and count chips?'), body: T('You can still fix buy-ins while counting.'), ok: T('Start counting') }).then(ok => {
      if (!ok) return;
      Snd.card();
      S.commit(() => {
        const b = g().blinds;
        if (b.running) { b.remaining = Math.max(0, b.endsAt - Date.now()); b.running = false; b.endsAt = null; }
        g().phase = 'count';
      });
    });
  }

  function countScreen() {
    const game = g();
    const pending = Core.pendingCount(game);
    const counted = seated().filter(Core.isCounted).reduce((s, p) => s + (p.cashedOut ? p.cashedOut.chips : p.finalChips), 0);
    return h('div', { class: 'screen game counting' },
      h('div', { class: 'banner' }, game.editOf ? '✏️ ' + T('Editing a past game')
        : '🧮 ' + (detailed() ? T('Count each player’s chips. Tap seats in any order.') : T('Count each player’s chips. Tap players in any order.'))),
      h('div', { class: 'tiles' },
        tile(T('Chips handed out'), U.fmtChips(Core.issuedChips(game))),
        tile(T('Counted so far'), U.fmtChips(counted)),
        game.config.fee.on ? tile(T('House pile'), U.fmtChips(Core.rakeTotal(game)), { onclick: houseSheet, cls: 'tap' }) : null),
      detailed() ? tableView('count') : countList(),
      h('button', { class: 'btn primary block big', disabled: pending > 0, onclick: calculate },
        pending ? T('{n} players still counting', { n: pending }) : T('Calculate')),
      h('div', { class: 'row gap center' },
        game.editOf
          ? h('button', { class: 'btn ghost', onclick: () => U.ask({ title: T('Discard your edits?'), body: T('The saved game stays as it was.'), ok: T('Discard'), danger: true }).then(ok => {
            if (ok) S.commit(db => { db.current = null; App.view = { name: 'results', id: game.editOf }; });
          }) }, T('Discard edits'))
          : h('button', { class: 'btn ghost', onclick: () => S.commit(() => { game.phase = 'play'; }) }, '← ' + T('Back to game'))));
  }

  function calculate() {
    const f = Core.computeFinal(g(), false);
    if (f.diff === 0) { finalize(false); return; }
    Snd.buzz();
    const n = Math.abs(f.diff);
    U.sheet(api => h('div', { class: 'stack alert-box shake' },
      h('div', { class: 'alert-icon' }, '⚠️'),
      h('h3', null, T('Something’s off: {n} chips {what}.', { n: U.fmtChips(n), what: f.diff < 0 ? T('missing') : T('extra') })),
      h('div', { class: 'muted small' }, T('Handed out {a} · counted {b} (incl. house {c})', { a: U.fmtChips(f.issued), b: U.fmtChips(f.counted), c: U.fmtChips(f.rakeTotal) })),
      h('button', { class: 'btn primary block', onclick: () => api.close() }, T('Recount')),
      h('button', { class: 'btn ghost block', onclick: () => { api.close(); finalize(true); } },
        T('Distribute the difference ({n} chips each, roughly)', { n: U.fmtChips(Math.ceil(n / seated().length)) }))), { cls: 'small alert' });
  }

  function finalize(distribute) {
    const game = g();
    game.players.forEach(p => { const prof = S.profile(p.pid); if (prof) p.name = prof.name; });
    const f = Core.computeFinal(game, distribute);
    f.paidFlags = {};
    S.commit(db => {
      game.final = f;
      game.phase = 'done';
      game.endedAt = game.endedAt || Date.now();
      if (game.editOf) {
        const id = game.editOf;
        delete game.editOf;
        game.id = id;
        const i = db.games.findIndex(x => x.id === id);
        if (i >= 0) db.games[i] = game; else db.games.push(game);
      } else db.games.push(game);
      db.current = null;
      App.view = { name: 'results', id: game.id, celebrate: true };
    });
  }

  /* reopen a finished game at the counting stage */
  Game.editPast = function (id) {
    if (S.db.current) { U.toast(T('Finish or discard the current game first.'), 'bad'); Snd.buzz(); return; }
    const old = S.game(id);
    if (!old) return;
    const copy = U.clone(old);
    copy.editOf = id; copy.id = U.uid(); copy.phase = 'count'; copy.final = null;
    S.commit(db => { db.current = copy; App.view = null; App.tab = 'play'; });
  };
})();
