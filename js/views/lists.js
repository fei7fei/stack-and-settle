/* Home, History, Players (lifetime stats) and Settings screens. */
(function () {
  'use strict';
  const Lists = window.Lists = {};
  const h = U.h;
  const PALETTE = ['#1a9e55', '#d93a3a', '#2f6fdb', '#e0a100', '#8e44ad', '#16a2b8', '#e8590c', '#6c757d', '#c2255c', '#2b8a3e'];
  let chartFocus = null;

  const symNow = () => { const g = S.lastGame(); return g ? g.config.symbol : '$'; };

  /* ---------- home ---------- */
  Lists.home = function () {
    const last = S.lastGame();
    return h('div', { class: 'screen home' },
      h('div', { class: 'hero' },
        h('div', { class: 'hero-chips' }, ['#d93a3a', '#222', '#1a9e55', '#f4f4f4'].map((c, i) => h('i', { style: { background: c, animationDelay: i * 90 + 'ms' } }))),
        h('h1', null, 'Stack & Settle'),
        h('p', { class: 'muted' }, T('Buy-ins, rake, chip counts and the fewest payments to settle up.'))),
      h('button', { class: 'btn primary block big', onclick: () => { Snd.card(); S.commit(db => { db.draft = Setup.newDraft(); }); } }, '＋ ' + T('New game')),
      last ? h('button', { class: 'btn block', onclick: () => { Snd.card(); S.commit(db => { db.draft = Setup.fromGame(last); }); } },
        '⚡ ' + T('Quick start from last game'), h('div', { class: 'muted small' }, last.players.filter(p => !p.hostOnly).map(p => p.name).join(', '))) : null,
      last ? h('div', { class: 'stack-s' }, h('div', { class: 'label' }, T('Last game')), gameCard(last)) : null);
  };

  function gameCard(g) {
    const f = g.final, sym = g.config.symbol;
    const rows = f.rows.filter(r => !r.hostOnly).slice().sort((a, b) => b.net - a.net);
    const top = rows[0];
    return h('button', { class: 'card game-card tap', onclick: () => { App.view = { name: 'results', id: g.id }; App.tab = 'history'; App.render(); } },
      h('div', { class: 'row between' },
        h('strong', null, U.fmtDate(g.endedAt || g.startedAt)),
        h('span', { class: 'muted small' }, g.config.currency + ' · ' + T(g.config.mode === 'detailed' ? 'Detailed' : 'Simple'))),
      h('div', { class: 'muted small' }, T('{n} players', { n: rows.length }) + ' · ' + Core.fmt(Core.paidCents(g), sym) + ' ' + T('in') + ' · ' + U.fmtDur((g.endedAt || g.startedAt) - g.startedAt)),
      top && top.net > 0 ? h('div', { class: 'small' }, '🥇 ' + top.name + ' ', h('span', { class: 'win' }, Core.fmt(top.net, sym, true))) : null);
  }

  /* ---------- history ---------- */
  Lists.history = function () {
    const games = Core.doneGames(S.db.games).slice().reverse();
    return h('div', { class: 'screen' },
      h('h2', null, T('History')),
      games.length ? h('div', { class: 'stack-s' }, games.map(gameCard))
        : h('div', { class: 'empty-state' }, h('div', { class: 'big-msg' }, '🗂'), T('Finished games show up here.')));
  };

  /* ---------- players & lifetime ---------- */
  Lists.players = function () {
    const stats = Core.allStats(S.db.games, S.db.profiles);
    const badges = Core.badges(stats);
    const sym = symNow();
    const withGames = S.db.profiles.filter(p => stats[p.id].games > 0)
      .sort((a, b) => stats[b.id].net - stats[a.id].net);
    const without = S.db.profiles.filter(p => !stats[p.id].games);
    const podiumRows = withGames.map(p => ({ name: p.name, net: stats[p.id].net }));
    return h('div', { class: 'screen' },
      h('h2', null, T('Players')),
      withGames.length ? h('div', { class: 'stack' },
        h('div', { class: 'card-title' }, '🏆 ' + T('All-time podium')),
        Results.podium(podiumRows, sym, false),
        h('div', { class: 'card' }, h('div', { class: 'card-title' }, T('Running total')), chart(withGames, stats, sym))) : null,
      h('div', { class: 'stack-s' },
        withGames.map(p => {
          const s = stats[p.id];
          return h('button', { class: 'card player-row tap', onclick: () => profileSheet(p.id) },
            h('div', { class: 'avatar' }, Setup.initials(p.name)),
            h('div', { class: 'grow' },
              h('div', null, h('strong', null, p.name), ' ', (badges[p.id] || []).map(b => h('span', { title: T(b.label), class: 'badge' }, b.emoji))),
              h('div', { class: 'muted small' }, T('{n} games', { n: s.games }) + ' · ' + T('win rate {p}%', { p: Math.round(s.winRate * 100) }))),
            h('strong', { class: s.net > 0 ? 'win' : s.net < 0 ? 'loss' : '' }, Core.fmt(s.net, sym, true)));
        }),
        without.map(p => h('button', { class: 'card player-row tap', onclick: () => profileSheet(p.id) },
          h('div', { class: 'avatar' }, Setup.initials(p.name)),
          h('div', { class: 'grow' }, h('strong', null, p.name), h('div', { class: 'muted small' }, T('No finished games yet'))))),
        !S.db.profiles.length ? h('div', { class: 'empty-state' }, h('div', { class: 'big-msg' }, '🪑'), T('Players you seat are saved here.')) : null),
      withGames.length ? h('div', { class: 'card' }, h('div', { class: 'card-title' }, T('Badges')),
        h('div', { class: 'badge-key' }, [['🔥', 'Hot streak (3+ wins in a row)'], ['🧊', 'Cold streak (3+ losses in a row)'], ['👑', 'All-time leader'], ['💰', 'Biggest single win'],
          ['🎁', 'Generous donor (biggest single loss)'], ['🪑', 'Regular (most games)'], ['🎯', 'Best ROI (3+ games)'], ['🔁', 'Rebuy king (most buy-ins per game)']]
          .map(([e, l]) => h('div', null, e + ' ' + T(l))))) : null);
  };

  function chart(profiles, stats, sym) {
    const games = Core.doneGames(S.db.games);
    const idx = new Map(games.map((g, i) => [g.endedAt || g.startedAt, i]));
    const W = 340, H = 190, P = { l: 8, r: 8, t: 10, b: 18 };
    const series = profiles.map((p, k) => ({ p, color: PALETTE[k % PALETTE.length], pts: stats[p.id].series.map(pt => ({ x: idx.get(pt.t) || 0, y: pt.v })) }));
    const ys = series.flatMap(s => s.pts.map(pt => pt.y)).concat([0]);
    const ymin = Math.min(...ys), ymax = Math.max(...ys);
    const span = ymax - ymin || 1;
    const nx = Math.max(1, games.length - 1);
    const X = x => P.l + (W - P.l - P.r) * (x / nx);
    const Y = y => P.t + (H - P.t - P.b) * (1 - (y - ymin) / span);
    const lines = series.map(s => {
      const dim = chartFocus && chartFocus !== s.p.id;
      const d = s.pts.map((pt, i) => (i ? 'L' : 'M') + X(pt.x).toFixed(1) + ' ' + Y(pt.y).toFixed(1)).join(' ');
      const dots = s.pts.map(pt => '<circle cx="' + X(pt.x).toFixed(1) + '" cy="' + Y(pt.y).toFixed(1) + '" r="2.6" fill="' + s.color + '"/>').join('');
      return '<g opacity="' + (dim ? 0.15 : 1) + '"><path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" class="chart-line"/>' + dots + '</g>';
    }).join('');
    const svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" role="img" aria-label="' + T('Running total') + '">' +
      '<line x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + Y(0) + '" y2="' + Y(0) + '" class="zero"/>' +
      '<text x="' + P.l + '" y="' + (H - 4) + '" class="axis">' + (games[0] ? U.fmtShortDate(games[0].endedAt || games[0].startedAt) : '') + '</text>' +
      '<text x="' + (W - P.r) + '" y="' + (H - 4) + '" text-anchor="end" class="axis">' + (games.length ? U.fmtShortDate(games[games.length - 1].endedAt || games[games.length - 1].startedAt) : '') + '</text>' +
      lines + '</svg>';
    return h('div', null,
      h('div', { html: svg }),
      h('div', { class: 'legend' }, series.map(s => h('button', {
        class: 'legend-item' + (chartFocus === s.p.id ? ' on' : ''),
        onclick: () => { chartFocus = chartFocus === s.p.id ? null : s.p.id; App.render(); },
      }, h('i', { style: { background: s.color } }), s.p.name + ' ' + Core.fmt(stats[s.p.id].net, sym, true)))));
  }

  function profileSheet(pid) {
    U.sheet(api => {
      const p = S.profile(pid);
      if (!p) { setTimeout(api.close); return h('div'); }
      const all = Core.allStats(S.db.games, S.db.profiles);
      const s = all[pid];
      const b = Core.badges(all)[pid] || [];
      const sym = symNow();
      const item = (label, value, cls) => h('div', { class: 'stat' }, h('small', null, label), h('strong', { class: cls || '' }, value));
      const sign = v => v > 0 ? 'win' : v < 0 ? 'loss' : '';
      return h('div', { class: 'stack' },
        h('div', { class: 'row gap' }, h('div', { class: 'avatar big' }, Setup.initials(p.name)),
          h('div', null, h('h3', null, p.name), h('div', null, b.map(x => h('span', { class: 'badge-chip' }, x.emoji + ' ' + T(x.label)))))),
        s.games ? h('div', { class: 'stat-grid' },
          item(T('Games played'), String(s.games)),
          item(T('Lifetime result'), Core.fmt(s.net, sym, true), sign(s.net)),
          item(T('Biggest win'), Core.fmt(s.bestWin, sym, true), sign(s.bestWin)),
          item(T('Biggest loss'), Core.fmt(s.worstLoss, sym, true), sign(s.worstLoss)),
          item(T('Win rate'), Math.round(s.winRate * 100) + '%'),
          item(T('Average per game'), Core.fmt(s.avg, sym, true), sign(s.avg)),
          item('ROI', (s.roi * 100).toFixed(1) + '%', sign(s.roi)),
          item(T('Total bought in'), Core.fmt(s.paid, sym)),
          s.handsWon ? item(T('Hands won'), String(s.handsWon)) : null,
          item(T('Current streak'), s.streak > 0 ? '🔥 ' + s.streak + ' ' + T('wins') : s.streak < 0 ? '🧊 ' + (-s.streak) + ' ' + T('losses') : '—'))
          : h('div', { class: 'muted' }, T('No finished games yet')),
        h('div', { class: 'card' },
          h('div', { class: 'card-title' }, T('Payment handles')),
          h('div', { class: 'small' }, 'e-Transfer: ' + (p.etransfer || '—')),
          h('div', { class: 'small' }, 'WeChat: ' + (p.wechat || '—')),
          h('button', { class: 'btn small', onclick: () => Game.editHandles(pid, () => api.refresh()) }, T('Edit handles'))),
        h('div', { class: 'grid2' },
          h('button', { class: 'btn ghost', onclick: () => renameProfile(pid, api) }, T('Rename')),
          !s.games && !(S.db.current && S.db.current.players.some(x => x.pid === pid))
            ? h('button', { class: 'btn ghost danger', onclick: () => U.ask({ title: T('Delete {name}?', { name: p.name }), ok: T('Delete'), danger: true }).then(ok => {
              if (ok) { S.commit(db => { db.profiles = db.profiles.filter(x => x.id !== pid); }); api.close(); }
            }) }, T('Delete player')) : null));
    });
  }

  function renameProfile(pid, parent) {
    const p = S.profile(pid);
    U.sheet(api => {
      const input = h('input', { type: 'text', value: p.name, maxLength: 24 });
      return h('div', { class: 'stack' }, h('h3', null, T('Rename')), input,
        h('div', { class: 'muted small' }, T('Past games keep the name they were played under.')),
        h('button', { class: 'btn primary block', onclick: () => {
          const name = input.value.trim();
          const other = S.findProfile(name);
          if (!name) return;
          if (other && other.id !== pid) { U.toast(T('That name is taken by another player.'), 'bad'); return; }
          S.commit(() => { p.name = name; });
          api.close(); parent.refresh();
        } }, T('Save')));
    }, { cls: 'small' });
  }

  /* ---------- settings ---------- */
  Lists.settings = function () {
    const st = S.db.settings;
    const file = h('input', { type: 'file', accept: 'application/json,.json', class: 'hidden', onchange: e => {
      const f = e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        let obj = null;
        try { obj = JSON.parse(reader.result); } catch (err) { obj = null; }
        if (!S.validImport(obj)) { U.toast(T('That file is not a Stack & Settle backup.'), 'bad'); Snd.buzz(); return; }
        U.ask({ title: T('Replace all data with this backup?'), body: T('{g} games, {p} players. Your current data will be overwritten.', { g: obj.games.length, p: obj.profiles.length }), ok: T('Import'), danger: true })
          .then(ok => { if (ok) { S.importData(obj); App.applySettings(); App.render(); U.toast(T('Backup imported'), 'good'); } });
      };
      reader.readAsText(f);
      e.target.value = '';
    } });
    return h('div', { class: 'screen' },
      h('h2', null, T('Settings')),
      h('div', { class: 'card stack' },
        h('div', { class: 'label' }, T('Theme')),
        Setup.seg([['auto', T('Follow phone')], ['light', T('Light')], ['dark', T('Dark')]], st.theme, v => { st.theme = v; S.save(); App.applySettings(); App.render(); }),
        h('div', { class: 'label' }, T('Language')),
        Setup.seg([['en', 'English'], ['zh', '中文']], st.lang, v => { st.lang = v; S.save(); App.applySettings(); App.render(); }),
        Setup.toggle(T('Sound'), st.sound, v => { st.sound = v; S.save(); App.render(); if (v) Snd.clack(); })),
      h('div', { class: 'card stack' },
        h('div', { class: 'card-title' }, T('Backup')),
        h('div', { class: 'muted small' }, T('All data lives only in this browser on this phone. Export a backup regularly, or before changing phones.')),
        h('div', { class: 'muted small' }, T('Last backup: {d}', { d: S.db.lastBackup ? U.fmtDate(S.db.lastBackup) + ' ' + U.fmtTime(S.db.lastBackup) : T('never') })),
        h('div', { class: 'grid2' },
          h('button', { class: 'btn', onclick: () => { S.exportNow(); App.render(); U.toast(T('Backup downloaded'), 'good'); } }, '⬇ ' + T('Export')),
          h('button', { class: 'btn', onclick: () => file.click() }, '⬆ ' + T('Import'))), file),
      h('div', { class: 'card stack' },
        h('div', { class: 'card-title danger-text' }, T('Danger zone')),
        h('button', { class: 'btn danger', onclick: () => U.ask({ title: T('Delete all data?'), body: T('Every game, player and the current game will be erased. This cannot be undone.'), ok: T('Delete everything'), danger: true })
          .then(ok => ok && U.ask({ title: T('Are you sure?'), body: T('Last chance. Consider exporting a backup first.'), ok: T('Yes, delete'), danger: true }))
          .then(ok => { if (ok) { S.wipe(); App.view = null; App.render(); U.toast(T('All data deleted')); } }) }, T('Delete all data'))),
      h('div', { class: 'muted small center' }, 'Stack & Settle'));
  };
})();
