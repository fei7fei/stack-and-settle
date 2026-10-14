/* Run with: node --test   (Node 18+) */
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../js/core.js');

const COLOURS = [
  { id: 'w', chips: 25 }, { id: 'r', chips: 100 }, { id: 'g', chips: 500 }, { id: 'b', chips: 1000 },
];

test('money formatting and parsing are exact', () => {
  assert.equal(Core.fmt(2000, '$'), '$20.00');
  assert.equal(Core.fmt(-1234567, '$'), '−$12,345.67');
  assert.equal(Core.fmt(5, '¥', true), '+¥0.05');
  assert.equal(Core.parseMoney('20'), 2000);
  assert.equal(Core.parseMoney('$1,234.5'), 123450);
  assert.equal(Core.parseMoney('0.07'), 7);
  assert.equal(Core.parseMoney('1.234'), null);
  assert.equal(Core.parseMoney('abc'), null);
  assert.equal(Core.parseInt0('1,000'), 1000);
  assert.equal(Core.parseInt0('1.5'), null);
});

test('chip value must be a whole number of cents', () => {
  assert.equal(Core.chipValue(2000, 1000), 2);
  assert.equal(Core.chipValue(1000, 300), null);
  assert.equal(Core.nearestChipsPerHand(1000, 300), 250);
  assert.equal(Core.chipValue(1000, Core.nearestChipsPerHand(1000, 300)), 4);
  assert.equal(Core.chipValue(0, 100), null);
});

test('mixes hit the target exactly when possible', () => {
  const s = Core.suggestMix(500, COLOURS);
  assert.equal(s.remainder, 0);
  assert.equal(Core.mixTotal(s.mix, COLOURS), 500);
  const big = Core.suggestMix(1000, COLOURS);
  assert.equal(Core.mixTotal(big.mix, COLOURS), 1000);
  assert.ok(Object.values(big.mix).filter(Boolean).length >= 2, 'spreads over colours');
  assert.equal(Core.suggestMix(510, COLOURS).remainder > 0, true);
  assert.equal(Core.exactMix(510, COLOURS), null);
  const odd = [{ id: 'a', chips: 30 }, { id: 'b', chips: 70 }];
  assert.equal(Core.mixTotal(Core.suggestMix(100, odd).mix, odd), 100);
  assert.deepEqual(Core.exactMix(0, odd), { a: 0, b: 0 });
});

test('grab mix for rake', () => {
  const g = Core.grabMix(125, COLOURS);
  assert.deepEqual(g, { mix: { w: 1, r: 1, g: 0, b: 0 }, remainder: 0 });
  assert.equal(Core.grabMix(130, COLOURS).remainder, 5);
});

test('rake is whole chips rounded down with a minimum pot', () => {
  assert.equal(Core.parsePct('2.5'), 250);
  assert.equal(Core.parsePct('5%'), 500);
  assert.equal(Core.parsePct('2.555'), null);
  assert.equal(Core.parsePct('101'), null);
  assert.equal(Core.rakeChips(1999, 250, 0), 49);
  assert.equal(Core.rakeChips(400, 500, 500), 0);
  assert.equal(Core.rakeChips(500, 500, 500), 25);
});

test('distribute spreads whole units with leftovers in order', () => {
  assert.deepEqual(Core.distribute(10, 3), [4, 3, 3]);
  assert.deepEqual(Core.distribute(-10, 3), [-4, -3, -3]);
  assert.deepEqual(Core.distribute(2, 4), [1, 1, 0, 0]);
  assert.equal(Core.distribute(-7, 4).reduce((a, b) => a + b, 0), -7);
});

function sumBy(transfers, nets) {
  const bal = Object.fromEntries(nets.map(n => [n.id, n.amt]));
  transfers.forEach(t => { bal[t.from] += t.amt; bal[t.to] -= t.amt; });
  return bal;
}

test('settlement clears every balance with the minimum number of payments', () => {
  // two independent pairs: 2 payments, not 3
  const nets = [{ id: 'a', amt: 500 }, { id: 'b', amt: -500 }, { id: 'c', amt: 300 }, { id: 'd', amt: -300 }];
  const t = Core.settle(nets);
  assert.equal(t.length, 2);
  Object.values(sumBy(t, nets)).forEach(v => assert.equal(v, 0));

  const n2 = [{ id: 'a', amt: 700 }, { id: 'b', amt: -200 }, { id: 'c', amt: -300 }, { id: 'd', amt: -400 }, { id: 'e', amt: 200 }];
  const t2 = Core.settle(n2);
  assert.equal(t2.length, 3);
  Object.values(sumBy(t2, n2)).forEach(v => assert.equal(v, 0));
  const payers = new Set(t2.map(x => x.from)), payees = new Set(t2.map(x => x.to));
  payers.forEach(p => assert.ok(!payees.has(p), 'nobody both pays and receives'));
  assert.deepEqual(Core.settle([{ id: 'a', amt: 0 }]), []);
});

test('settlement stays exact for many players', () => {
  const nets = [];
  let s = 0;
  for (let i = 0; i < 17; i++) { const v = ((i * 7919) % 2001) - 1000; nets.push({ id: 'p' + i, amt: v }); s += v; }
  nets.push({ id: 'last', amt: -s });
  const t = Core.settle(nets);
  Object.values(sumBy(t, nets)).forEach(v => assert.equal(v, 0));
  assert.ok(t.length <= nets.length - 1);
});

function game(extra) {
  return Object.assign({
    config: { cv: 2 }, rake: [], hands: [], startedAt: 0, hostPid: null,
    players: [
      { pid: 'a', name: 'A', seat: 0, buyins: [{ chips: 1000 }], finalChips: 1500 },
      { pid: 'b', name: 'B', seat: 1, buyins: [{ chips: 1000 }, { chips: 500 }], finalChips: 600 },
      { pid: 'c', name: 'C', seat: 2, buyins: [{ chips: 1000 }], cashedOut: { chips: 400 } },
    ],
  }, extra);
}

test('final results add up to zero and match the chip check', () => {
  const f = Core.computeFinal(game());
  assert.equal(f.issued, 3500);
  assert.equal(f.counted, 2500);
  assert.equal(f.diff, -1000);
  assert.deepEqual(f.transfers, [], 'no plan until resolved');
  const ok = Core.computeFinal(game({ players: game().players.map(p => p.pid === 'a' ? { ...p, finalChips: 2500 } : p) }));
  assert.equal(ok.diff, 0);
  assert.equal(ok.rows.reduce((s, r) => s + r.net, 0), 0);
  assert.deepEqual(ok.rows.map(r => r.net), [3000, -1800, -1200]);
});

test('distributing the difference keeps results exactly zero-sum', () => {
  const f = Core.computeFinal(game(), true);
  assert.ok(f.distributed);
  assert.deepEqual(f.rows.map(r => r.adj), [334, 333, 333]);
  assert.equal(f.rows.reduce((s, r) => s + r.net, 0), 0);
  assert.ok(f.transfers.length > 0);
});

test('rake goes to the host whether they play or only host', () => {
  const base = game();
  base.players[0].finalChips = 2400;
  const plays = Core.computeFinal({ ...base, rake: [{ chips: 100 }], hostPid: 'b' });
  assert.equal(plays.diff, 0);
  assert.equal(plays.rows.find(r => r.pid === 'b').fee, 200);
  assert.equal(plays.rows.reduce((s, r) => s + r.net, 0), 0);

  const hostOnly = { ...base, rake: [{ chips: 100 }], hostPid: 'h',
    players: base.players.concat([{ pid: 'h', name: 'House', hostOnly: true, buyins: [] }]) };
  const f = Core.computeFinal(hostOnly);
  assert.equal(f.rows.find(r => r.pid === 'h').net, 200);
  assert.equal(f.rows.reduce((s, r) => s + r.net, 0), 0);
  assert.equal(Core.pendingCount(hostOnly), 0);
});

test('lifetime stats, streaks and badges', () => {
  const mk = (t, nets) => ({
    startedAt: t, endedAt: t + 1, config: { cv: 1 }, hands: [],
    players: Object.keys(nets).map(pid => ({ pid, buyins: [{ chips: 100 }] })),
    final: { rows: Object.entries(nets).map(([pid, net]) => ({ pid, net, paid: 100 })).concat([{ pid: 'h', hostOnly: true, net: 5, paid: 0 }]) },
  });
  const games = [mk(1, { a: 50, b: -50 }), mk(2, { a: 20, b: -20 }), mk(3, { a: 10, b: -10 })];
  const st = Core.allStats(games, [{ id: 'a' }, { id: 'b' }, { id: 'h' }]);
  assert.equal(st.a.net, 80);
  assert.equal(st.a.streak, 3);
  assert.equal(st.b.streak, -3);
  assert.equal(st.a.bestWin, 50);
  assert.equal(st.b.worstLoss, -50);
  assert.equal(st.a.roi, 80 / 300);
  assert.equal(st.h.games, 0, 'host-only payee is not a player');
  assert.deepEqual(st.a.series.map(p => p.v), [50, 70, 80]);
  const b = Core.badges(st);
  const ids = pid => (b[pid] || []).map(x => x.id);
  assert.ok(ids('a').includes('hot') && ids('a').includes('king') && ids('a').includes('bigwin'));
  assert.ok(ids('b').includes('cold') && ids('b').includes('donor'));
});

test('game stats including hand stats', () => {
  const g = game({
    hands: [
      { winners: ['a'], pot: 300, tag: 'showdown' },
      { winners: ['a'], pot: 900, tag: 'fold' },
      { winners: ['a', 'b'], pot: 401, tag: 'showdown' },
      { winners: ['b'], tag: 'allin' },
    ],
  });
  g.players[0].finalChips = 2500;
  g.final = Core.computeFinal(g);
  const s = Core.gameStats(g);
  assert.equal(s.rebuys, 1);
  assert.equal(s.buyinCount, 4);
  assert.equal(s.totalIn, 7000);
  assert.equal(s.biggestWin.pid, 'a');
  assert.equal(s.mostRebuys.name, 'B');
  assert.deepEqual(s.handsWon, { a: 3, b: 2 });
  assert.equal(s.biggestPot.pot, 900);
  assert.deepEqual(s.streak, { n: 2, pid: 'a' });
  assert.deepEqual(s.tags, { showdown: 2, fold: 1, allin: 1 });
});
