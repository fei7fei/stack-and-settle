# BUILD.md: handoff notes

This note is for whoever picks up the code next, whether a person or a fresh Claude session. Read it before changing anything. The spec is the original build prompt (summarised in `README.md`). This file covers how the code is put together, the rules it follows, and what's done and what's left.

## Hard rules

1. **Money is integer cents, chips are whole numbers.** Never use floats for money. A chip's value (`config.cv`) is a whole number of cents, and setup refuses anything else. Percentage rake is the only fractional case: it's stored as basis points (`config.fee.bps`, so 2.5% = 250) and floored to whole chips.
2. **Plain scripts, no build step, no modules.** Each file is an IIFE that attaches one global. `index.html` loads them in a fixed order, and dependencies must load first. Don't add `import`/`export`, bundlers or npm runtime dependencies. Opening `index.html` from disk must keep working.
3. **Pure maths lives only in `js/core.js`,** on the shared `Core` object. It has no DOM or `localStorage` access, and works in both browser and Node (`module.exports` at the bottom). Anything that can be unit tested goes here, with a test in `tests/core.test.js`.
4. **Every UI string goes through `T('English text', {vars})`.** The English text is the key. Add a 中文 entry to `I18N.zh` in `js/i18n.js`, then run the i18n check (below). It must report `missing 0`.
5. **Colours are CSS tokens** on `:root` in `css/style.css`. Dark mode is defined twice: under `prefers-color-scheme` guarded by `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`. Keep the two blocks identical.
6. Results must always sum to exactly zero. Settlement must never make someone both pay and receive.

## File layout and globals

Listed in load order.

| File | Global | Role |
| --- | --- | --- |
| `js/core.js` | `Core` | Money format and parse, `chipValue`, `nearestChipsPerHand`, mixes (`suggestMix`, `exactMix`, `grabMix`), `parsePct`/`rakeChips`, `distribute`, `settle` (minimum payments), `computeFinal`, `playerStats`/`allStats`/`badges`, `gameStats` |
| `js/i18n.js` | `I18N`, `T` | Language switch and the zh dictionary |
| `js/util.js` | `U` | `U.h()` DOM builder, `U.sheet()` bottom sheets (`api.refresh()` / `api.close()`), `U.ask()` confirm returning a Promise, toasts, formatters, `countUp`, download/copy |
| `js/store.js` | `S` | `S.db` state; `S.load`, `S.save`, `S.commit(fn)` (mutate, then save, then `App.render()`); profiles; export/import/wipe |
| `js/sound.js` | `Snd` | Web Audio synth: `clack`, `card`, `cash`, `bell`, `buzz`, `fanfare`, `tick`. Respects `settings.sound` |
| `js/fx.js` | `FX` | `intro()` canvas opening (once per tab via sessionStorage), `confetti()`, `recap(game)` that resolves to a PNG Blob |
| `js/views/table.js` | `TV` | Oval table (`TV.table`), seat positions, mini chip stacks, `TV.pickPlayer()` |
| `js/views/setup.js` | `Setup` | 5-step wizard on `S.db.draft`; `Setup.fromGame()` for quick start; shared `seg`/`toggle`/`initials` controls |
| `js/views/helper.js` | `Helper` | Buy-in colour helper; confirm unlocks only on an exact total, unless free mode is on |
| `js/views/game.js` | `Game` | Live game on `S.db.current`: player panel, buy-ins, cash-out/bust, counter, rake, house pile, hands, blinds (`Game.tick`), count phase, `calculate`/`finalize`, `Game.editPast` |
| `js/views/results.js` | `Results` | Results, payments and stats tabs; share text; recap image |
| `js/views/lists.js` | `Lists` | Home, History, Players (lifetime podium, SVG chart, profile sheet), Settings |
| `js/app.js` | `App` | Top bar, bottom tabs, router (`App.tab`, `App.view`), theme, 1-second timer |

**Rendering model:** `App.render()` rebuilds the whole `<main>` from state on every commit. Sheets sit outside `<main>` and survive renders. A sheet that shows state calls `api.refresh()` after it commits. Inputs that must keep focus while typing update their own derived text in place and never trigger a re-render. Use `U.append` (or `U.h` children) for conditional children, never native `el.append(x, maybe ? y : null)`, because native `append` prints the text "null".

## Data model (localStorage key `stackSettle.v1`)

```
db = { v, settings:{theme:'auto'|'light'|'dark', lang:'en'|'zh', sound}, profiles:[{id,name,etransfer,wechat}],
       games:[game…finished], current:game|null, draft:wizardDraft|null, lastBackup:ts }
game = { id, startedAt, endedAt, phase:'play'|'count'|'done', editOf?,
  config:{ mode:'simple'|'detailed', currency, symbol, handCents, handChips, cv, colours:[{id,name,color,chips}],
           seats, fee:{on,bps,minPot}, blinds:{on,minutes,levels:[{sb,bb}]} },
  players:[{ pid(=profile id), name, seat, buyins:[{id,t,chips,mix}], cashedOut:null|{chips,t,mix},
             finalChips:null|n, mix, hostOnly? }],
  hostPid, hostPlays, rake:[{id,t,chips,pot}], hands:[{id,t,winners:[pid],pot,tag}],
  blinds:{level,running,endsAt,remaining}, final: Core.computeFinal(...) + paidFlags{"from>to":bool} }
```

- A host who only hosts is a `players` entry with `hostOnly: true`, no seat and no buy-ins. They are excluded from counting and lifetime stats, but get paid the rake.
- Editing a past game deep-copies it into `current` with `editOf`. `finalize` writes it back under the original id. Discarding the edit leaves history untouched.

## Running checks

Node isn't on PATH on this Windows machine. Use VS Code's bundled Node instead (it's Node 24):

```powershell
$env:ELECTRON_RUN_AS_NODE='1'; $node="$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe"
& $node --test tests/core.test.js                       # unit tests: 13 passing
& $node tests/i18n-check.js .                            # must print "missing 0"
& $node tests/e2e-smoke.js . "$env:TEMP\ss-e2e"          # browser smoke test
```

Quirks of this setup:
- Its stdout is sometimes dropped when the process exits, and `--check` doesn't work. That's why `e2e-smoke.js` writes `<outDir>/log.txt`; read that file.
- `node --test tests/` with a bare directory fails on Node 24, so pass the file.
- The smoke test serves the folder on port 8765, starts headless Edge on 9333, and plays two full games. Its screenshots are worth looking at after any UI change. If a run hangs, kill the leftover processes whose command line contains `e2e-smoke.js` or `<outDir>\profile` before running again.

## Status

### Done (verified by unit tests and the e2e smoke test)
- [x] Setup wizard:
  - All 5 steps: game type, currency and hand value, colours, host fee and extras, seats.
  - Chip-value validation with the nearest valid chip count suggested.
  - Quick start from the last game.
- [x] Table:
  - 6, 8, 9 or 10 seats, portrait oval on phones.
  - Shuffle seats animation, dealer button for a host who plays, house spot for a host who only hosts.
  - Late joiners.
- [x] Player panel: buy-ins (+½, +1, +2, custom in money or chips), undo any buy-in, cash out, bust, rename, handles, move/swap seat, make host, remove.
- [x] Colour helper: suggested split, exact-or-locked confirm, warning when the target can't be made, free "build by colours" mode.
- [x] Rake: minimum pot, floor to whole chips, which-chips-to-grab breakdown, house pile with undo. Detailed mode offers rake after each hand.
- [x] Dashboard: chips on table, money in, elapsed time, house pile, hands, rebuy leader, blinds timer (bell and toast), hand log with undo.
- [x] End of game:
  - Count in any order; counted players can be reopened.
  - Calculate stays locked until everyone is counted.
  - Mismatch alert with shake, Recount, or distribute (whole chips, leftovers in seat order).
- [x] Settlement: minimum payments (exact up to 20 non-zero players), grouped by payer, paid checkboxes, share text with handles, recap PNG.
- [x] Results, payments and stats tabs, including Detailed hand stats.
- [x] History: edit and delete past games. Players: lifetime stats, all-time podium, running-total chart, all 8 badges.
- [x] Settings: theme, language, sound, export/import, delete all with a double confirm. A backup banner shows after a game until you export.
- [x] Light/dark themes, full 中文 translation, intro, confetti, reduced-motion support, synthesised sounds, README.

### Left / known gaps
- [ ] **Not tried on a real phone.** Still unchecked: iOS Safari audio unlock, the share sheet (`navigator.share` with files), the safe-area insets, and how the 10-seat table fits under 360px wide.
- [ ] **Lifetime stats mix currencies.** Games in different currencies are added together as raw cents and shown with the last game's symbol. Fix: group stats by currency, or warn.
- [ ] **Custom currency stores code `'Custom'`.** The share text then reads "(Custom)". Store the custom symbol or let the user name the code.
- [ ] **A full table can't take a late joiner.** There's no way to add seats mid-game. Settings that can't change mid-game: blind levels, fee %, and whether the host plays.
- [ ] **Settlement above 20 non-zero players** falls back to a single greedy group. The result is valid but not guaranteed minimal.
- [ ] **Awkward rake amounts.** A rake like 99 chips can't be grabbed with 25-chip whites, so the UI says "make change from the pot". Possible options: round the rake down to the smallest chip, or make it a setting.
- [ ] **Import replaces everything.** There's no merge.
- [ ] **No service worker,** so there's no offline cache after the first load.
- [ ] **Chart labels:** the x axis is game order with only the first and last date labelled, and there are no hover values.
- [ ] **Accessibility:** basic ARIA labels only. Focus isn't trapped in sheets, and Escape doesn't close them.
- [ ] **E2E test is Windows-only.** `tests/e2e-smoke.js` hard-codes the Edge path. Make the browser path an argument if it ever runs elsewhere.
