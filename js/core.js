/* Core logic: exact integer money maths, mixes, rake, settlement, stats.
   Money is always integer cents. Chips are always whole numbers. */
(function (root) {
  'use strict';
  const Core = {};

  Core.CURRENCIES = [
    { code: 'USD', symbol: '$' }, { code: 'CAD', symbol: '$' }, { code: 'CNY', symbol: '¥' },
    { code: 'EUR', symbol: '€' }, { code: 'GBP', symbol: '£' }, { code: 'AUD', symbol: '$' },
    { code: 'HKD', symbol: '$' }, { code: 'SGD', symbol: '$' }, { code: 'NZD', symbol: '$' },
  ];

  /* ---------- money ---------- */
  Core.fmt = function (cents, sym, plus) {
    sym = sym == null ? '$' : sym;
    const abs = Math.abs(cents);
    const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const frac = String(abs % 100).padStart(2, '0');
    const sign = cents < 0 ? '−' : (plus && cents > 0 ? '+' : '');
    return sign + sym + whole + '.' + frac;
  };
  Core.parseMoney = function (str) {
    str = String(str == null ? '' : str).trim().replace(/[,$¥€£\s]/g, '');
    if (!/^\d+(\.\d{1,2})?$/.test(str)) return null;
    const [w, f = ''] = str.split('.');
    return parseInt(w, 10) * 100 + parseInt((f + '00').slice(0, 2), 10);
  };
  Core.parseInt0 = function (str) {
    str = String(str == null ? '' : str).trim().replace(/,/g, '');
    return /^\d+$/.test(str) ? parseInt(str, 10) : null;
  };

  /* value of one chip in cents; null when it is not a whole number of cents */
  Core.chipValue = function (handCents, handChips) {
    if (!handCents || !handChips || handCents <= 0 || handChips <= 0) return null;
    return handCents % handChips === 0 ? handCents / handChips : null;
  };
  /* nearest chips-per-hand that divides the money evenly */
  Core.nearestChipsPerHand = function (handCents, handChips) {
    let best = null;
    for (let d = 1; d <= handCents; d++) {
      if (handCents % d === 0 && (best === null || Math.abs(d - handChips) < Math.abs(best - handChips))) best = d;
    }
    return best;
  };

  /* ---------- chip mixes ---------- */
  Core.mixTotal = function (mix, colours) {
    return colours.reduce((s, c) => s + (mix[c.id] || 0) * c.chips, 0);
  };
  /* Suggest a spread of colours for `target` chips: spread value evenly, then top up greedily. */
  Core.suggestMix = function (target, colours) {
    const sorted = colours.slice().sort((a, b) => b.chips - a.chips);
    const mix = {};
    sorted.forEach(c => { mix[c.id] = 0; });
    if (!sorted.length || target <= 0) return { mix, remainder: Math.max(target, 0) };
    let rem = target;
    const share = Math.floor(target / sorted.length);
    sorted.forEach(c => {
      const n = Math.floor(Math.min(share, rem) / c.chips);
      mix[c.id] += n; rem -= n * c.chips;
    });
    sorted.forEach(c => {
      const n = Math.floor(rem / c.chips);
      mix[c.id] += n; rem -= n * c.chips;
    });
    if (rem > 0) {
      const exact = Core.exactMix(target, colours);
      if (exact) return { mix: exact, remainder: 0 };
    }
    return { mix, remainder: rem };
  };
  /* Fewest chips that make `target` exactly, or null when impossible. */
  Core.exactMix = function (target, colours) {
    if (target === 0) return Object.fromEntries(colours.map(c => [c.id, 0]));
    if (!colours.length || target < 0 || target > 2e6) return null;
    const cnt = new Int32Array(target + 1).fill(-1), from = new Int32Array(target + 1);
    cnt[0] = 0;
    for (let v = 1; v <= target; v++) {
      for (let k = 0; k < colours.length; k++) {
        const c = colours[k].chips, p = v - c;
        if (c > 0 && p >= 0 && cnt[p] >= 0 && (cnt[v] < 0 || cnt[p] + 1 < cnt[v])) { cnt[v] = cnt[p] + 1; from[v] = k; }
      }
    }
    if (cnt[target] < 0) return null;
    const mix = Object.fromEntries(colours.map(c => [c.id, 0]));
    for (let v = target; v > 0; v -= colours[from[v]].chips) mix[colours[from[v]].id]++;
    return mix;
  };
  /* Which chips to physically grab for `n` chips: largest colours first. */
  Core.grabMix = function (n, colours) {
    const exact = Core.exactMix(n, colours);
    if (exact) return { mix: exact, remainder: 0 };
    const sorted = colours.slice().sort((a, b) => b.chips - a.chips);
    const mix = {}; let rem = n;
    sorted.forEach(c => { const k = Math.floor(rem / c.chips); mix[c.id] = k; rem -= k * c.chips; });
    return { mix, remainder: rem };
  };

  /* ---------- chip set presets ---------- */
  /* pieces per colour (smallest value first) in common boxed sets */
  Core.CHIP_SETS = { 300: [100, 100, 50, 50], 500: [150, 150, 100, 100] };
  /* four colour values that suit a buy-in of `buyin` chips (about 40 of the smallest per buy-in, and the
     buy-in can always be made exactly), with the piece counts of `set` -> [{chips, have}] */
  Core.presetColours = function (buyin, set) {
    const ladders = [[1000, [1000, 5000, 25000, 100000]], [100, [100, 500, 1000, 5000]], [25, [25, 100, 500, 1000]], [5, [5, 25, 100, 500]], [1, [1, 5, 25, 100]]];
    const pick = ladders.find(([b]) => b * 20 <= buyin && buyin % b === 0) || ladders[ladders.length - 1];
    const counts = Core.CHIP_SETS[set] || Core.CHIP_SETS[500];
    return pick[1].map((chips, i) => ({ chips, have: counts[i] }));
  };

  /* ---------- the bank (chips the house still holds) ---------- */
  /* colour id -> chips of that colour left with the house; null when the colour wasn't counted at setup.
     Buy-ins take chips out, cash-outs put them back. The house pile (rake) is kept apart. */
  Core.bank = function (g) {
    const out = {};
    g.config.colours.forEach(c => { out[c.id] = Number.isInteger(c.have) ? c.have : null; });
    const move = (mix, sign) => { if (mix) Object.keys(mix).forEach(id => { if (out[id] != null) out[id] += sign * (mix[id] || 0); }); };
    g.players.forEach(p => {
      p.buyins.forEach(b => move(b.mix, -1));
      if (p.cashedOut) move(p.cashedOut.mix, 1);
    });
    return out;
  };
  Core.bankTracked = g => g.config.colours.some(c => Number.isInteger(c.have));

  /* Mix for `target` chips that the bank can pay out: as close as possible to an even spread of value over
     the colours, while taking at most 1/slots of what is left of each colour, so the bank keeps some of every
     colour for later buy-ins. slots is relaxed down to minSlots when that is too strict. When even minSlots
     can't be met it falls back to suggestMix and sets `short`. bank[id] null = not counted (no limit). */
  Core.bankMix = function (target, colours, bank, slots, minSlots) {
    minSlots = Math.max(1, minSlots || 1);
    slots = Math.max(minSlots, slots || 1);
    const avail = c => (bank && bank[c.id] != null ? Math.max(0, bank[c.id]) : Infinity);
    const usable = colours.filter(c => c.chips > 0 && c.chips <= target && avail(c) > 0);
    const fallback = short => { const r = Core.suggestMix(target, colours); r.short = short && r.remainder === 0; return r; };
    if (target <= 0) return { mix: Object.fromEntries(colours.map(c => [c.id, 0])), remainder: 0, short: false };
    if (!usable.length) return fallback(true);
    if (usable.every(c => avail(c) === Infinity)) return fallback(false);
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    const g = usable.reduce((a, c) => gcd(a, c.chips), 0);
    if (target % g || target / g > 5000) return fallback(false);
    const U = target / g;
    const ideal = usable.map(c => target / usable.length / c.chips);
    const solve = s => {
      let cost = new Float64Array(U + 1).fill(Infinity);
      cost[0] = 0;
      const picks = [];
      usable.forEach((c, i) => {
        const w = c.chips / g, cap = Math.min(Math.floor(avail(c) / s), Math.floor(U / w));
        const next = new Float64Array(U + 1).fill(Infinity), pick = new Int32Array(U + 1);
        for (let v = 0; v <= U; v++) {
          if (cost[v] === Infinity) continue;
          for (let n = 0; n <= cap && v + n * w <= U; n++) {
            const d = (n - ideal[i]) * c.chips, k = cost[v] + d * d;
            if (k < next[v + n * w]) { next[v + n * w] = k; pick[v + n * w] = n; }
          }
        }
        cost = next; picks.push(pick);
      });
      if (cost[U] === Infinity) return null;
      const mix = Object.fromEntries(colours.map(c => [c.id, 0]));
      for (let i = usable.length - 1, v = U; i >= 0; i--) { const n = picks[i][v]; mix[usable[i].id] = n; v -= n * usable[i].chips / g; }
      return mix;
    };
    /* bigger slots = stricter caps, so find the largest slots that still works */
    let lo = minSlots, hi = slots, best = solve(lo);
    if (!best) return fallback(true);
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2), m = solve(mid);
      if (m) { lo = mid; best = m; } else hi = mid - 1;
    }
    return { mix: best, remainder: 0, short: false };
  };

  /* ---------- rake ---------- */
  /* "2.5" -> 250 basis points (hundredths of a percent); null when invalid */
  Core.parsePct = function (str) {
    str = String(str == null ? '' : str).trim().replace('%', '');
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(str)) return null;
    const [w, f = ''] = str.split('.');
    const bps = parseInt(w, 10) * 100 + parseInt((f + '00').slice(0, 2), 10);
    return bps <= 10000 ? bps : null;
  };
  Core.fmtPct = bps => (bps / 100).toString() + '%';
  Core.rakeChips = function (pot, bps, minPot) {
    if (!pot || pot < 0 || pot < (minPot || 0)) return 0;
    return Math.floor(pot * bps / 10000);
  };

  /* ---------- settlement ---------- */
  function greedyGroup(group) {
    const cr = group.filter(x => x.amt > 0).map(x => ({ id: x.id, amt: x.amt })).sort((a, b) => b.amt - a.amt);
    const de = group.filter(x => x.amt < 0).map(x => ({ id: x.id, amt: -x.amt })).sort((a, b) => b.amt - a.amt);
    const out = [];
    let i = 0, j = 0;
    while (i < de.length && j < cr.length) {
      const a = Math.min(de[i].amt, cr[j].amt);
      out.push({ from: de[i].id, to: cr[j].id, amt: a });
      de[i].amt -= a; cr[j].amt -= a;
      if (de[i].amt === 0) i++;
      if (cr[j].amt === 0) j++;
    }
    return out;
  }
  /* Split into the maximum number of zero-sum groups (fewest payments = n - groups). */
  function bestGroups(items) {
    const n = items.length, N = 1 << n;
    const sum = new Int32Array(N);
    for (let m = 1; m < N; m++) {
      const low = m & -m;
      sum[m] = sum[m ^ low] + items[31 - Math.clz32(low)].amt;
    }
    const dp = new Int8Array(N), par = new Int8Array(N);
    for (let m = 1; m < N; m++) {
      let best = -1, bi = 0;
      for (let i = 0; i < n; i++) {
        if (m & (1 << i)) {
          const v = dp[m ^ (1 << i)];
          if (v > best) { best = v; bi = i; }
        }
      }
      dp[m] = best + (sum[m] === 0 ? 1 : 0);
      par[m] = bi;
    }
    const order = [];
    for (let m = N - 1; m; m ^= 1 << par[m]) order.push(par[m]);
    order.reverse();
    const groups = [];
    let cur = [], run = 0;
    for (const i of order) {
      cur.push(items[i]); run += items[i].amt;
      if (run === 0) { groups.push(cur); cur = []; }
    }
    if (cur.length) groups.push(cur);
    return groups;
  }
  /* nets: [{id, amt}] summing to 0 -> [{from, to, amt}] */
  Core.settle = function (nets) {
    const items = nets.filter(x => x.amt !== 0);
    if (!items.length) return [];
    const groups = items.length <= 20 ? bestGroups(items) : [items];
    const out = [];
    groups.forEach(g => out.push(...greedyGroup(g)));
    out.sort((a, b) => b.amt - a.amt);
    return out;
  };

  /* ---------- game maths ---------- */
  Core.rakeTotal = g => (g.rake || []).reduce((s, r) => s + r.chips, 0);
  Core.paidChips = p => p.buyins.reduce((s, b) => s + b.chips, 0);
  Core.issuedChips = g => g.players.reduce((s, p) => s + Core.paidChips(p), 0);
  Core.cashedChips = g => g.players.reduce((s, p) => s + (p.cashedOut ? p.cashedOut.chips : 0), 0);
  Core.inPlayChips = g => Core.issuedChips(g) - Core.cashedChips(g) - Core.rakeTotal(g);
  Core.paidCents = g => Core.issuedChips(g) * g.config.cv;
  /* a player's chips are "counted" at the end once finalChips is a number (or they cashed out) */
  Core.isCounted = p => !!p.cashedOut || typeof p.finalChips === 'number';
  Core.pendingCount = g => g.players.filter(p => !p.hostOnly && !Core.isCounted(p)).length;

  /* spread S (whole chips) equally over n people; leftovers go one at a time to the first |r| in order */
  Core.distribute = function (S, n) {
    const base = Math.trunc(S / n);
    const r = S - base * n;
    const out = new Array(n).fill(base);
    for (let i = 0; i < Math.abs(r); i++) out[i] += r > 0 ? 1 : -1;
    return out;
  };

  Core.computeFinal = function (g, distribute) {
    const cv = g.config.cv;
    const rakeTotal = Core.rakeTotal(g);
    const players = g.players.slice().sort((a, b) => (a.seat ?? 99) - (b.seat ?? 99));
    const rows = players.map(p => {
      const paidChips = Core.paidChips(p);
      const outChips = p.cashedOut ? p.cashedOut.chips : (p.finalChips || 0);
      return {
        pid: p.pid, name: p.name, hostOnly: !!p.hostOnly, paidChips, outChips,
        paid: paidChips * cv, value: outChips * cv, net: (outChips - paidChips) * cv, fee: 0, adj: 0,
      };
    });
    const issued = rows.reduce((s, r) => s + r.paidChips, 0);
    const counted = rows.reduce((s, r) => s + r.outChips, 0) + rakeTotal;
    const diff = counted - issued;
    let distributed = false;
    if (diff !== 0 && distribute) {
      /* missing chips are added, extra chips removed, equally in whole chips, leftovers in seat order */
      const targets = rows.filter(r => !r.hostOnly);
      if (targets.length) {
        const adj = Core.distribute(-diff, targets.length);
        targets.forEach((r, i) => {
          r.adj = adj[i]; r.outChips += adj[i]; r.value = r.outChips * cv; r.net = (r.outChips - r.paidChips) * cv;
        });
        distributed = true;
      }
    }
    const host = rows.find(r => r.pid === g.hostPid);
    if (host && rakeTotal) { host.fee = rakeTotal * cv; host.net += host.fee; }
    const transfers = (diff === 0 || distributed) ? Core.settle(rows.map(r => ({ id: r.pid, amt: r.net }))) : [];
    return { rows, issued, counted, diff, rakeTotal, distributed, transfers, paidFlags: {} };
  };

  /* ---------- lifetime stats ---------- */
  Core.doneGames = games => games.filter(g => g.final).slice().sort((a, b) => (a.endedAt || a.startedAt) - (b.endedAt || b.startedAt));

  Core.playerStats = function (games, pid) {
    const rowOf = g => g.final.rows.find(r => r.pid === pid && !r.hostOnly);
    const list = Core.doneGames(games).filter(rowOf);
    const nets = list.map(g => rowOf(g).net);
    const paid = list.reduce((s, g) => s + rowOf(g).paid, 0);
    let run = 0, bestW = 0, worstL = 0, w = 0, l = 0;
    nets.forEach(n => {
      if (n > 0) { w++; l = 0; } else if (n < 0) { l++; w = 0; } else { w = 0; l = 0; }
      bestW = Math.max(bestW, w); worstL = Math.max(worstL, l);
    });
    for (let i = nets.length - 1; i >= 0; i--) {
      const s = Math.sign(nets[i]);
      if (!s) break;
      if (run === 0) run = s; else if (Math.sign(run) !== s) break; else run += s;
    }
    let cum = 0;
    const series = list.map((g, i) => { cum += nets[i]; return { t: g.endedAt || g.startedAt, v: cum }; });
    const handsWon = list.reduce((s, g) => s + (g.hands || []).filter(h => h.winners.includes(pid)).length, 0);
    return {
      pid, games: list.length, net: nets.reduce((a, b) => a + b, 0), wins: nets.filter(n => n > 0).length,
      losses: nets.filter(n => n < 0).length, bestWin: Math.max(0, ...nets), worstLoss: Math.min(0, ...nets),
      avg: nets.length ? Math.trunc(nets.reduce((a, b) => a + b, 0) / nets.length) : 0,
      winRate: nets.length ? nets.filter(n => n > 0).length / nets.length : 0,
      paid, roi: paid ? nets.reduce((a, b) => a + b, 0) / paid : 0,
      streak: run, bestWinStreak: bestW, worstLossStreak: worstL, series, handsWon,
      avgBuyins: list.length ? list.reduce((s, g) => s + (g.players.find(p => p.pid === pid)?.buyins.length || 0), 0) / list.length : 0,
    };
  };

  Core.allStats = function (games, players) {
    const out = {};
    players.forEach(p => { out[p.id] = Core.playerStats(games, p.id); });
    return out;
  };

  Core.badges = function (stats) {
    const all = Object.values(stats).filter(s => s.games > 0);
    const out = {};
    const add = (pid, b) => { (out[pid] = out[pid] || []).push(b); };
    all.forEach(s => {
      if (s.streak >= 3) add(s.pid, { id: 'hot', emoji: '🔥', label: 'Hot streak' });
      if (s.streak <= -3) add(s.pid, { id: 'cold', emoji: '🧊', label: 'Cold streak' });
    });
    const top = (arr, f, min) => { const c = arr.filter(min || (() => true)); if (!c.length) return null; const m = Math.max(...c.map(f)); return m > 0 ? c.filter(s => f(s) === m) : null; };
    (top(all, s => s.net) || []).forEach(s => add(s.pid, { id: 'king', emoji: '👑', label: 'All-time leader' }));
    (top(all, s => s.bestWin) || []).forEach(s => add(s.pid, { id: 'bigwin', emoji: '💰', label: 'Biggest single win' }));
    (top(all, s => -s.worstLoss) || []).forEach(s => add(s.pid, { id: 'donor', emoji: '🎁', label: 'Generous donor' }));
    (top(all, s => s.games, s => s.games >= 3) || []).forEach(s => add(s.pid, { id: 'regular', emoji: '🪑', label: 'Regular' }));
    (top(all, s => Math.round(s.roi * 10000), s => s.games >= 3) || []).forEach(s => add(s.pid, { id: 'sharp', emoji: '🎯', label: 'Best ROI' }));
    (top(all, s => Math.round(s.avgBuyins * 100), s => s.games >= 2) || []).forEach(s => add(s.pid, { id: 'rebuy', emoji: '🔁', label: 'Rebuy king' }));
    return out;
  };

  /* ---------- single game stats ---------- */
  Core.gameStats = function (g) {
    const f = g.final;
    const end = g.endedAt || Date.now();
    const rows = f ? f.rows : [];
    const rebuys = g.players.reduce((s, p) => s + Math.max(0, p.buyins.length - 1), 0);
    const byRebuy = g.players.slice().sort((a, b) => b.buyins.length - a.buyins.length)[0];
    const win = rows.slice().sort((a, b) => b.net - a.net)[0];
    const loss = rows.slice().sort((a, b) => a.net - b.net)[0];
    const s = {
      duration: end - g.startedAt, rebuys, totalIn: Core.paidCents(g), issued: Core.issuedChips(g),
      buyinCount: g.players.reduce((n, p) => n + p.buyins.length, 0),
      biggestWin: win && win.net > 0 ? win : null, biggestLoss: loss && loss.net < 0 ? loss : null,
      mostRebuys: byRebuy && byRebuy.buyins.length > 1 ? { name: byRebuy.name, n: byRebuy.buyins.length } : null,
      rake: Core.rakeTotal(g) * g.config.cv, hands: (g.hands || []).length,
    };
    if ((g.hands || []).length) {
      const won = {}, chips = {};
      let biggest = null, streak = { n: 0, pid: null }, cur = { n: 0, pid: null };
      g.hands.forEach(h => {
        h.winners.forEach(w => { won[w] = (won[w] || 0) + 1; chips[w] = (chips[w] || 0) + Math.floor((h.pot || 0) / h.winners.length); });
        if (h.pot && (!biggest || h.pot > biggest.pot)) biggest = h;
        if (h.winners.length === 1) {
          cur = cur.pid === h.winners[0] ? { n: cur.n + 1, pid: cur.pid } : { n: 1, pid: h.winners[0] };
          if (cur.n > streak.n) streak = { ...cur };
        } else cur = { n: 0, pid: null };
      });
      s.handsWon = won; s.potWon = chips; s.biggestPot = biggest; s.streak = streak;
      s.tags = g.hands.reduce((m, h) => { if (h.tag) m[h.tag] = (m[h.tag] || 0) + 1; return m; }, {});
    }
    return s;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
  else root.Core = Core;
})(typeof window !== 'undefined' ? window : globalThis);
