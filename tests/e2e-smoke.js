// End-to-end smoke test: static server + headless Edge (Windows) driven over CDP. Needs Node 22+ (global WebSocket).
// usage: node tests/e2e-smoke.js <projectDir> <outDir>   -> writes <outDir>/log.txt and numbered screenshots
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const [root, out] = process.argv.slice(2).map(p => path.resolve(p));
fs.mkdirSync(out, { recursive: true });
const LOG = path.join(out, 'log.txt');
fs.writeFileSync(LOG, '');
console.log = (...a) => fs.appendFileSync(LOG, a.join(' ') + '\n');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(data);
  });
}).listen(8765);

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const edge = spawn(EDGE, ['--headless=new', '--remote-debugging-port=9333', '--user-data-dir=' + path.join(out, 'profile'),
  '--window-size=390,844', '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, seq = 0;
const pending = new Map();
const errors = [];
function send(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
}
async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: '(async()=>{' + expr + '})()', awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('evaluate failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 600));
  return r.result.value;
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(r.data, 'base64'));
}
// page-side helpers
const HELPERS = `
window.$q = s => document.querySelector(s);
window.$all = s => Array.from(document.querySelectorAll(s));
window.btn = (text, scope) => {
  const root = scope ? (typeof scope === 'string' ? document.querySelector(scope) : scope) : document;
  const all = Array.from(root.querySelectorAll('button')).filter(b => !b.disabled && b.offsetParent !== null);
  const b = all.find(b => b.textContent.trim() === text) || all.find(b => b.textContent.includes(text));
  if (!b) throw new Error('no button: ' + text + ' | have: ' + all.map(x => x.textContent.trim()).join(' / '));
  b.click(); return true;
};
window.sheet = () => { const s = $all('.sheet-back'); return s[s.length - 1].querySelector('.sheet'); };
window.type = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
window.wait = ms => new Promise(r => setTimeout(r, ms));
window.seat = i => $all('.seat-slot')[i].click();
`;

(async () => {
  let info;
  for (let i = 0; i < 50; i++) {
    try { info = await (await fetch('http://127.0.0.1:9333/json/list')).json(); if (info.length) break; } catch (e) { /* not up yet */ }
    await sleep(200);
  }
  const page = info.find(t => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', m => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result); }
    if (msg.method === 'Runtime.exceptionThrown') errors.push('EXCEPTION ' + JSON.stringify(msg.params.exceptionDetails.exception && msg.params.exceptionDetails.exception.description || msg.params.exceptionDetails.text));
    if (msg.method === 'Runtime.consoleAPICalled' && (msg.params.type === 'error' || msg.params.type === 'warning')) errors.push('CONSOLE ' + msg.params.args.map(a => a.value || a.description).join(' '));
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') errors.push('LOG ' + msg.params.entry.text + ' ' + (msg.params.entry.url || ''));
  });
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  const step = async (name, code, wait) => {
    try { const v = await ev(HELPERS + code); await sleep(wait == null ? 450 : wait); console.log('✔ ' + name + (v !== undefined ? ' → ' + JSON.stringify(v) : '')); return v; }
    catch (e) { console.log('✖ ' + name + ': ' + e.message); await shot('FAIL-' + name.replace(/\W+/g, '_')); throw e; }
  };

  await send('Page.navigate', { url: 'http://127.0.0.1:8765/index.html' });
  await sleep(1200);
  await shot('01-intro');
  await sleep(2600);
  await step('intro finished', `return !!$q('.intro') ? 'still showing' : 'gone';`);
  await shot('02-home');

  await step('new game opens quick setup', `btn('New game'); await wait(100); return [S.db.draft.quick, $q('.wizard h2').textContent];`);
  for (const name of ['Alex', 'Ben', 'Cara']) {
    await step('quick add ' + name, `type($q('[data-quick-name]'), '${name}'); btn('Add'); await wait(100); return S.db.draft.seats.filter(Boolean).length;`);
  }
  await step('300-chip set', `btn('300-chip set'); await wait(100); return $q('.mix-chips').textContent;`);
  await step('500-chip set', `btn('500-chip set'); await wait(100); return S.db.draft.colours.map(c => c.chips + 'x' + c.have).join(' ');`);
  await shot('03-quick-setup');
  await step('more options', `btn('More options'); return [S.db.draft.quick, S.db.draft.step];`);
  await step('choose detailed', `btn('Detailed');`);
  await shot('03b-type');
  await step('next to money', `btn('Next');`);
  await step('bad chip value rejected', `const ins = $all('.wizard input'); type(ins[1], '300'); type(ins[0], '10'); await wait(50); return $q('.derived').textContent;`, 200);
  await shot('04-money-bad');
  await step('use suggestion', `btn('Use 250'); await wait(50); type($all('.wizard input')[0], '20'); type($all('.wizard input')[1], '1000'); return $q('.derived').textContent;`);
  await step('chip leader rule on', `const sw = $q('.wizard .switch'); sw.checked = true; sw.dispatchEvent(new Event('change')); await wait(50); return S.db.draft.leaderCap;`);
  await shot('04b-money-rules');
  await step('next to colours', `btn('Next'); return $q('.wizard .derived').textContent;`);
  await shot('05-colours');
  await step('next to host', `btn('Next');`);
  await step('enable fee', `const sw = $all('.switch')[0]; sw.checked = true; sw.dispatchEvent(new Event('change'));`);
  await step('set fee', `const ins = $all('.wizard input[type=text]'); type(ins[0], '5'); type(ins[1], '100'); return S.db.draft.fee;`);
  await step('enable blinds', `const sw = $all('.switch')[1]; sw.checked = true; sw.dispatchEvent(new Event('change'));`);
  await shot('06-host');
  await step('next to seats', `btn('Next'); return S.db.draft.seatsN;`);
  await step('seat Dan from the table', `seat(4); await wait(350); type(sheet().querySelector('input'), 'Dan'); btn('Add', sheet()); return S.db.draft.seats.filter(Boolean).length;`);
  await step('start without host fails', `btn('Start game'); await wait(50); return $q('.form-error').textContent;`);
  await step('make Alex host', `seat(0); await wait(350); btn('Make host', sheet());`);
  await step('shuffle', `btn('Shuffle seats');`, 900);
  await shot('07-seats');
  await step('start game', `btn('Start game'); return S.db.current && S.db.current.players.length;`, 700);
  await shot('08-table');

  await step('everyone buys in', `btn('Everyone buys in'); await wait(350); const mix = sheet().querySelector('.big-mix').textContent; btn('Confirm', sheet()); return [Core.issuedChips(S.db.current), mix];`);
  await step('ben rebuys $20 in one tap', `const ben = S.db.current.players.find(p => p.name === 'Ben'); seat(ben.seat); await wait(350); btn('+$20.00', sheet()); await wait(150);
    return [Core.paidChips(S.db.current.players.find(p => p.name === 'Ben')), $q('.toast').textContent];`);
  await shot('09-one-tap');
  await step('big buy-in asks for the chip leader', `btn('+$40.00', sheet()); await wait(350); const s = sheet(); type(s.querySelector('input'), '1500'); await wait(50);
    const a = [s.querySelector('h3').textContent, s.querySelector('.bad-text').textContent, s.querySelector('.btn.primary').textContent];
    type(s.querySelector('input'), '99999'); await wait(50); a.push(s.querySelector('.btn.primary').disabled); return a;`);
  await shot('09a-leader');
  await step('cancel the big buy-in', `const b = $all('.sheet-back'); b[b.length - 1].click(); await wait(300); return Core.paidChips(S.db.current.players.find(p => p.name === 'Ben'));`);
  await step('panel More', `btn('More', sheet()); await wait(100); return Array.from(sheet().querySelectorAll('.grid2 .btn')).map(b => b.textContent.trim());`);
  await step('close panel', `$all('.sheet-back').forEach(b => b.click());`);
  await step('helper: impossible target warns', `const ben = S.db.current.players.find(p => p.name === 'Ben'); seat(ben.seat); await wait(350); btn('Other', sheet()); await wait(100);
    type(sheet().querySelector('[data-amount]'), '10.10'); btn('Buy in', sheet()); await wait(350); const w = sheet().querySelector('.warn'); return w && w.textContent;`);
  await shot('09b-helper-warn');
  await step('helper: free mode', `btn('Build by colours (free mode)', sheet()); await wait(100); const plus = sheet().querySelectorAll('.round-btn'); plus[plus.length - 1].click(); await wait(50); btn('Confirm', sheet()); return Core.paidChips(S.db.current.players.find(p => p.name === 'Ben'));`);
  await step('change colours of a buy-in', `const b = sheet().querySelector('[aria-label="Change colours"]'); b.click(); await wait(350); const t = sheet().querySelector('.helper-total').textContent; btn('Confirm', sheet()); await wait(100); return t;`);
  await step('close panel 2', `$all('.sheet-back').forEach(b => b.click());`);
  await step('rake below minimum', `btn('Rake'); await wait(350); type(sheet().querySelector('input'), '80'); return sheet().querySelector('.rake-out').textContent;`);
  await step('rake 5% of 1990', `type(sheet().querySelector('input'), '1990'); const t = sheet().querySelector('.rake-out').textContent; btn('Add to house pile', sheet()); return t;`);
  await step('record hand + auto rake', `btn('Record hand'); await wait(350); btn('Alex', sheet()); await wait(100); type(sheet().querySelector('input'), '1000'); btn('Save hand', sheet()); await wait(450); const t = sheet().querySelector('.rake-out').textContent; btn('Add to house pile', sheet()); return t;`);
  await step('bank sheet', `btn('Bank'); await wait(350); const t = sheet().textContent; return t.slice(0, 160);`);
  await shot('10a-bank');
  await step('close bank', `$all('.sheet-back').forEach(b => b.click());`);
  await step('blinds start', `$q('.blinds .icon-btn.strong').click(); await wait(1200); return $q('[data-blinds]').textContent;`, 300);
  await shot('10-dashboard');
  await step('dan cashes out early 800', `const p = S.db.current.players.find(p => p.name === 'Dan'); seat(p.seat); await wait(350); btn('Cash out', sheet()); await wait(350); type(sheet().querySelector('.count-input.wide'), '800'); btn('Cash out', sheet()); return S.db.current.players.find(p => p.name === 'Dan').cashedOut.chips;`);
  await step('close panel 3', `$all('.sheet-back').forEach(b => b.click());`);
  await step('end game', `btn('End game'); await wait(350); btn('Start counting', sheet()); return S.db.current.phase;`);
  await step('calculate locked', `return $all('button').find(b => b.textContent.includes('still counting')).textContent;`);
  // issued: 4x1000 + 1000 + 25 (free mode white) = 5025; rake 99 + 50 = 149; Dan 800 → 4076 left for Alex/Ben/Cara
  await step('count Ben by colours', `const p = S.db.current.players.find(p => p.name === 'Ben'); seat(p.seat); await wait(350);
    const ins = sheet().querySelectorAll('.count-input'); type(ins[0], '1'); type(ins[2], '3'); type(ins[3], '1'); /* 1000 + 300 + 25 */
    const t = sheet().querySelector('.count-total').textContent; btn('Save count', sheet()); return t;`);
  await step('count Cara as bust', `const p = S.db.current.players.find(p => p.name === 'Cara'); seat(p.seat); await wait(350); btn('Bust (0)', sheet()); return S.db.current.players.find(p => p.name === 'Cara').finalChips;`);
  await step('count Alex with a mistake', `const p = S.db.current.players.find(p => p.name === 'Alex'); seat(p.seat); await wait(350); type(sheet().querySelector('.count-input.wide'), '2700'); btn('Save count', sheet()); return Core.pendingCount(S.db.current);`);
  await shot('11-counting');
  await step('mismatch alert', `btn('Calculate'); await wait(400); return sheet().querySelector('h3').textContent;`, 600);
  await shot('12-mismatch');
  await step('recount Alex', `btn('Recount', sheet()); await wait(300); const p = S.db.current.players.find(p => p.name === 'Alex'); seat(p.seat); await wait(350); type(sheet().querySelector('.count-input.wide'), '2751'); btn('Save count', sheet());`);
  await step('calculate', `btn('Calculate'); await wait(300); const g = S.db.games[S.db.games.length - 1]; return { rows: g.final.rows.map(r => [r.name, r.net, r.fee]), transfers: g.final.transfers, sum: g.final.rows.reduce((s, r) => s + r.net, 0) };`, 2500);
  await shot('13-results');
  await step('payments tab', `btn('Payments'); await wait(200); return $all('.pay-row').length;`);
  await shot('14-payments');
  await step('share text', `return Results.shareText(S.db.games[S.db.games.length - 1]);`);
  await step('stats tab', `btn('Stats'); await wait(200); return $all('.stat').length;`);
  await shot('15-stats');
  await step('recap image', `const b = await FX.recap(S.db.games[0]); return b.size > 10000;`);

  // second game via quick start, simple mode with a host who only hosts + distribute
  await step('players tab', `btn('Players'); return $all('.player-row').length;`);
  await shot('16-players');
  await step('profile sheet', `$q('.player-row').click(); await wait(350); return sheet().querySelectorAll('.stat').length;`);
  await shot('17-profile');
  await step('close profile', `$all('.sheet-back').forEach(b => b.click());`);
  await step('quick start', `btn('Play'); await wait(100); btn('Quick start from last game'); return [S.db.draft.quick, S.db.draft.seats.filter(Boolean).length, $q('.wizard h2').textContent];`);
  await step('rules in more options', `btn('More options'); await wait(100); btn('Next'); await wait(100); btn('Fixed amount only'); await wait(100);
    const sw = $q('.wizard .switch'); sw.checked = false; sw.dispatchEvent(new Event('change')); return [S.db.draft.buyinFixed, S.db.draft.leaderCap];`);
  await step('back to quick setup', `btn('Back'); await wait(100); btn('Quick setup'); await wait(100); return [S.db.draft.quick, $all('.pill.on').length];`);
  await shot('17a-quick-again');
  await step('start quick game', `btn('Start game'); return [S.db.current.phase, S.db.current.config.buyin, S.db.current.config.seats];`);
  await step('buy-ins game 2', `btn('Everyone buys in'); await wait(350); btn('Confirm', sheet()); return Core.issuedChips(S.db.current);`);
  await step('fixed mode panel', `seat(S.db.current.players.find(p => p.name === 'Ben').seat); await wait(350); const s = sheet();
    return { buttons: Array.from(s.querySelectorAll('.quick-row button')).map(b => b.textContent), inputs: s.querySelectorAll('input').length };`);
  await shot('17b-fixed-panel');
  await step('one tap then undo from the toast', `btn('+1 buy-in', sheet()); await wait(150); const before = Core.paidChips(S.db.current.players.find(p => p.name === 'Ben'));
    $all('.toast-action').pop().click(); await wait(100); return [before, Core.paidChips(S.db.current.players.find(p => p.name === 'Ben'))];`);
  await step('close fixed panel', `$all('.sheet-back').forEach(b => b.click());`);
  await step('end and count with extra chips', `btn('End game'); await wait(350); btn('Start counting', sheet()); await wait(300);
    for (const p of S.db.current.players.filter(p => !p.hostOnly)) { seat(p.seat); await wait(350); type(sheet().querySelector('.count-input.wide'), String(p.name === 'Alex' ? 1503 : 833)); btn('Save count', sheet()); await wait(300); }
    btn('Calculate'); await wait(400); btn('Distribute', sheet()); await wait(400);
    const g = S.db.games[S.db.games.length - 1]; return { diff: g.final.diff, adj: g.final.rows.map(r => [r.name, r.adj, r.net]), sum: g.final.rows.reduce((s, r) => s + r.net, 0) };`, 1500);
  await step('history', `btn('History'); return $all('.game-card').length;`);
  await shot('18-history');
  await step('edit past game', `$all('.game-card')[1].click(); await wait(300); $q('[aria-label="Edit game"]').click(); await wait(350); btn('Edit', sheet()); await wait(300); return S.db.current && S.db.current.phase + ':' + !!S.db.current.editOf;`);
  await step('fix count and recalc', `const p = S.db.current.players.find(p => p.name === 'Ben'); seat(p.seat); await wait(350); btn('Fix buy-ins', sheet()); await wait(350); btn('Count chips', sheet()); await wait(350); btn('Save count', sheet()); await wait(200); btn('Calculate'); await wait(500); return { games: S.db.games.length, current: S.db.current };`, 1500);
  await step('zh + dark', `S.db.settings.lang = 'zh'; S.db.settings.theme = 'dark'; S.save(); App.applySettings(); App.render(); btn('设置'); return document.querySelector('h2').textContent;`);
  await shot('19-settings-zh-dark');
  await step('players zh dark', `btn('玩家');`);
  await shot('20-players-zh-dark');
  await step('reload keeps data', `location.reload();`, 1500);
  await step('after reload', `return { games: S.db.games.length, profiles: S.db.profiles.length, lang: I18N.lang };`);

  console.log('\nERRORS:', errors.length ? '\n' + errors.join('\n') : 'none');
  finish(errors.length ? 1 : 0);
})().catch(e => { console.log('FATAL', e.message); console.log('ERRORS:', errors.join('\n')); finish(1); });

function finish(code) { try { ws.close(); } catch (e) { /* ignore */ } edge.kill(); server.close(); setTimeout(() => process.exit(code), 300); }
