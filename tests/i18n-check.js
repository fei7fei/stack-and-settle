// Lists T("...") strings missing from the zh dictionary (and unused keys). usage: node tests/i18n-check.js <projectDir>
const fs = require('fs'), path = require('path');
const root = path.resolve(process.argv[2] || '.');
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } })(path.join(root, 'js'));
const found = new Set();
const re = /\bT\(\s*(['"])((?:\\.|(?!\1).)*)\1/g;
for (const f of files) { const src = fs.readFileSync(f, 'utf8'); let m; while ((m = re.exec(src))) found.add(m[2].replace(/\\'/g, "'")); }
// strings passed indirectly: STEPS, TAGS, badge labels, option titles
const extra = ['Game type', 'Currency & hand value', 'Chip colours', 'Host fee & extras', 'Seat the players', 'Showdown', 'Everyone folded', 'All-in',
  'Hot streak', 'Cold streak', 'All-time leader', 'Biggest single win', 'Generous donor', 'Regular', 'Best ROI', 'Rebuy king',
  'Simple', 'Detailed', 'Play only. No hand-by-hand recording. End-of-game stats included.', 'Record every hand: who won, the pot and a tag. Adds hand stats.',
  'Hot streak (3+ wins in a row)', 'Cold streak (3+ losses in a row)', 'Generous donor (biggest single loss)', 'Regular (most games)', 'Best ROI (3+ games)', 'Rebuy king (most buy-ins per game)'];
extra.forEach(s => found.add(s));
global.window = global;
require(path.join(root, 'js', 'i18n.js'));
const missing = [...found].filter(s => !(s in I18N.zh));
const unused = Object.keys(I18N.zh).filter(k => !found.has(k));
console.log('total', found.size, 'missing', missing.length, 'unused', unused.length);
missing.forEach(s => console.log('MISSING: ' + s));
unused.forEach(s => console.log('UNUSED: ' + s));
