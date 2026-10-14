/* Results, payments and stats for one finished game. */
(function () {
  'use strict';
  const Results = window.Results = {};
  const h = U.h;
  let tab = 'results';

  Results.render = function (view) {
    const game = S.game(view.id);
    if (!game || !game.final) { App.view = null; return h('div', { class: 'muted' }, T('Game not found.')); }
    if (view.celebrate) { tab = 'results'; }
    const body = tab === 'payments' ? payments(game) : tab === 'stats' ? stats(game) : results(game, view.celebrate);
    if (view.celebrate) {
      view.celebrate = false;
      setTimeout(() => { Snd.fanfare(); FX.confetti(); }, 900);
    }
    const needsBackup = (S.db.lastBackup || 0) < (game.endedAt || 0);
    return h('div', { class: 'screen results' },
      h('div', { class: 'row between' },
        h('button', { class: 'btn ghost small', onclick: () => { App.view = null; App.render(); } }, '← ' + T('Back')),
        h('div', { class: 'row gap-s' },
          h('button', { class: 'icon-btn', title: T('Edit game'), 'aria-label': T('Edit game'), onclick: () => {
            U.ask({ title: T('Edit this game?'), body: T('It reopens at the counting stage. Payments marked as paid will reset.'), ok: T('Edit') }).then(ok => { if (ok) Game.editPast(game.id); });
          } }, '✏️'),
          h('button', { class: 'icon-btn', title: T('Delete game'), 'aria-label': T('Delete game'), onclick: () => {
            U.ask({ title: T('Delete this game?'), body: T('It is removed from history and lifetime stats.'), ok: T('Delete'), danger: true }).then(ok => {
              if (ok) S.commit(db => { db.games = db.games.filter(x => x.id !== game.id); App.view = null; });
            });
          } }, '🗑'))),
      h('div', { class: 'results-head' },
        h('h2', null, '🃏 ' + T('Poker night')),
        h('div', { class: 'muted' }, U.fmtDate(game.endedAt || game.startedAt) + ' · ' + game.config.currency + ' · ' + U.fmtDur((game.endedAt || Date.now()) - game.startedAt))),
      needsBackup ? h('button', { class: 'notice tap', onclick: () => { S.exportNow(); App.render(); } }, '💾 ' + T('Back up your data now (download a JSON file).')) : null,
      Setup.seg([['results', T('Results')], ['payments', T('Payments')], ['stats', T('Stats')]], tab, v => { tab = v; App.render(); }),
      body,
      h('div', { class: 'row gap' },
        h('button', { class: 'btn primary grow', onclick: () => share(game) }, '💬 ' + T('Share')),
        h('button', { class: 'btn grow', onclick: () => shareImage(game) }, '🖼 ' + T('Recap image'))));
  };

  function sortedRows(game) { return game.final.rows.filter(r => !r.hostOnly).slice().sort((a, b) => b.net - a.net); }

  function podium(rows, sym, animate) {
    const top = rows.slice(0, 3);
    const order = [1, 0, 2];
    const el = h('div', { class: 'podium' + (animate ? ' rise' : '') });
    order.forEach(rank => {
      const r = top[rank];
      if (!r) { el.append(h('div', { class: 'pod-col empty' })); return; }
      const amt = h('div', { class: 'pod-amt ' + (r.net > 0 ? 'win' : r.net < 0 ? 'loss' : '') }, Core.fmt(r.net, sym, true));
      el.append(h('div', { class: 'pod-col r' + (rank + 1) },
        h('div', { class: 'pod-name' }, r.name), amt,
        h('div', { class: 'pod-bar' }, h('span', { class: 'pod-medal' }, ['🥇', '🥈', '🥉'][rank]))));
      if (animate) {
        const sign = r.net < 0 ? -1 : 1;
        U.countUp(amt, Math.abs(r.net), v => Core.fmt(sign * v, sym, true), 1400);
      }
    });
    return el;
  }
  Results.podium = podium;

  function results(game, animate) {
    const f = game.final, sym = game.config.symbol;
    const rows = sortedRows(game);
    const house = f.rows.find(r => r.hostOnly);
    const anyAdj = f.rows.some(r => r.adj);
    return h('div', { class: 'stack' },
      podium(rows, sym, animate),
      h('div', { class: 'card' },
        h('table', { class: 'list-table' },
          h('thead', null, h('tr', null, h('th', null, T('Player')), h('th', { class: 'num' }, T('In')), h('th', { class: 'num' }, T('Chips')), h('th', { class: 'num' }, T('Result')))),
          h('tbody', null,
            rows.map(r => h('tr', null,
              h('td', null, r.name, r.fee ? h('span', { class: 'tag' }, '🏠 +' + Core.fmt(r.fee, sym)) : null),
              h('td', { class: 'num' }, Core.fmt(r.paid, sym)),
              h('td', { class: 'num' }, U.fmtChips(r.outChips), r.adj ? h('small', { class: 'muted' }, ' (' + (r.adj > 0 ? '+' : '') + r.adj + ')') : null),
              h('td', { class: 'num strong ' + (r.net > 0 ? 'win' : r.net < 0 ? 'loss' : '') }, Core.fmt(r.net, sym, true)))),
            house ? h('tr', null, h('td', null, '🏠 ' + house.name), h('td', { class: 'num' }, '—'), h('td', { class: 'num' }, U.fmtChips(f.rakeTotal)),
              h('td', { class: 'num strong win' }, Core.fmt(house.net, sym, true))) : null))),
      anyAdj ? h('div', { class: 'muted small' }, T('{n} chips were {what} and spread equally (numbers in brackets).', { n: U.fmtChips(Math.abs(f.diff)), what: f.diff < 0 ? T('missing') : T('extra') })) : null,
      h('div', { class: 'muted small' }, T('1 chip = {v} · result = chips × chip value − money in', { v: Core.fmt(game.config.cv, sym) })));
  }

  /* ---------- payments ---------- */
  const nameIn = (game, pid) => { const r = game.final.rows.find(x => x.pid === pid); return r ? r.name : S.nameOf(pid); };
  function handleText(pid) {
    const p = S.profile(pid) || {};
    const bits = [];
    if (p.etransfer) bits.push('e-Transfer: ' + p.etransfer);
    if (p.wechat) bits.push('WeChat: ' + p.wechat);
    return bits.join(' · ');
  }
  function payments(game) {
    const f = game.final, sym = game.config.symbol;
    if (!f.transfers.length) return h('div', { class: 'card center' }, h('div', { class: 'big-msg' }, '🤝'), T('Everyone is even. No payments needed.'));
    const byPayer = {};
    f.transfers.forEach(t => { (byPayer[t.from] = byPayer[t.from] || []).push(t); });
    const paidCount = f.transfers.filter(t => f.paidFlags[t.from + '>' + t.to]).length;
    return h('div', { class: 'stack' },
      h('div', { class: 'muted small' }, T('{n} payments, the fewest possible. Nobody both pays and receives.', { n: f.transfers.length }) + ' ' + T('{a} of {b} paid', { a: paidCount, b: f.transfers.length })),
      Object.keys(byPayer).map(from => h('div', { class: 'card pay-card' },
        h('div', { class: 'card-title' }, T('{name} pays', { name: nameIn(game, from) })),
        byPayer[from].map(t => {
          const key = t.from + '>' + t.to;
          const handle = handleText(t.to);
          return h('label', { class: 'pay-row' + (f.paidFlags[key] ? ' paid' : '') },
            h('input', { type: 'checkbox', checked: !!f.paidFlags[key], onchange: e => {
              if (e.target.checked) Snd.cash();
              S.commit(() => { f.paidFlags[key] = e.target.checked; });
            } }),
            h('div', { class: 'grow' },
              h('div', null, '→ ', h('strong', null, nameIn(game, t.to))),
              handle ? h('div', { class: 'muted small' }, handle) : h('button', { class: 'link small', onclick: e => { e.preventDefault(); Game.editHandles(t.to, () => App.render()); } }, T('Add e-Transfer / WeChat handle'))),
            h('strong', { class: 'pay-amt' }, Core.fmt(t.amt, sym)));
        }))));
  }

  Results.shareText = function (game) {
    const f = game.final, sym = game.config.symbol;
    const d = new Date(game.endedAt || game.startedAt);
    const date = d.toLocaleDateString(I18N.lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });
    const lines = ['🃏 ' + T('Poker night') + ', ' + date + ' (' + game.config.currency + ')'];
    if (!f.transfers.length) lines.push(T('Everyone is even. No payments needed.'));
    f.transfers.forEach(t => {
      const handle = handleText(t.to);
      lines.push(nameIn(game, t.from) + ' → ' + nameIn(game, t.to) + ': ' + Core.fmt(t.amt, sym) + (handle ? ' (' + handle + ')' : ''));
    });
    return lines.join('\n');
  };
  async function share(game) {
    const text = Results.shareText(game);
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const ok = await U.copy(text);
    U.toast(ok ? T('Copied. Paste it in the group chat.') : T('Could not copy'), ok ? 'good' : 'bad');
  }
  async function shareImage(game) {
    const blob = await FX.recap(game);
    if (!blob) { U.toast(T('Could not make the image'), 'bad'); return; }
    const file = new File([blob], 'poker-night.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: T('Poker night') }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    U.download(blob, 'poker-night.png');
  }

  /* ---------- stats ---------- */
  function stats(game) {
    const s = Core.gameStats(game), sym = game.config.symbol;
    const name = pid => nameIn(game, pid);
    const item = (label, value) => h('div', { class: 'stat' }, h('small', null, label), h('strong', null, value));
    const blocks = [
      item(T('Duration'), U.fmtDur(s.duration)),
      item(T('Total money in'), Core.fmt(s.totalIn, sym)),
      item(T('Buy-ins'), String(s.buyinCount)),
      item(T('Rebuys'), String(s.rebuys)),
      item(T('Biggest winner'), s.biggestWin ? s.biggestWin.name + ' ' + Core.fmt(s.biggestWin.net, sym, true) : '—'),
      item(T('Biggest loser'), s.biggestLoss ? s.biggestLoss.name + ' ' + Core.fmt(s.biggestLoss.net, sym, true) : '—'),
      item(T('Most rebuys'), s.mostRebuys ? s.mostRebuys.name + ' (' + s.mostRebuys.n + ')' : '—'),
      item(T('Rake taken'), game.config.fee.on ? Core.fmt(s.rake, sym) : '—'),
    ];
    const out = [h('div', { class: 'stat-grid' }, blocks)];
    if (game.config.mode === 'detailed') {
      if (!s.hands) out.push(h('div', { class: 'muted' }, T('No hands were recorded.')));
      else {
        out.push(h('div', { class: 'card-title' }, T('Hands')));
        out.push(h('div', { class: 'stat-grid' },
          item(T('Hands played'), String(s.hands)),
          item(T('Biggest pot'), s.biggestPot ? U.fmtChips(s.biggestPot.pot) + ' · ' + s.biggestPot.winners.map(name).join(' + ') : '—'),
          item(T('Longest win streak'), s.streak.n ? s.streak.n + ' · ' + name(s.streak.pid) : '—'),
          item(T('Tags'), Game.TAGS.map(([k, l]) => T(l) + ' ' + (s.tags[k] || 0)).join(' · '))));
        const ids = Object.keys(s.handsWon).sort((a, b) => s.handsWon[b] - s.handsWon[a]);
        out.push(h('div', { class: 'card' }, h('table', { class: 'list-table' },
          h('thead', null, h('tr', null, h('th', null, T('Player')), h('th', { class: 'num' }, T('Hands won')), h('th', { class: 'num' }, T('Chips won')))),
          h('tbody', null, ids.map(pid => h('tr', null, h('td', null, name(pid)), h('td', { class: 'num' }, String(s.handsWon[pid])), h('td', { class: 'num' }, U.fmtChips(s.potWon[pid] || 0))))))));
      }
    }
    return h('div', { class: 'stack' }, out);
  }
})();
