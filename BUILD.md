# BUILD.md: handoff notes

This note is for whoever picks up the code next, whether a person or a fresh Claude session. Read it before changing anything. The spec is the original build prompt (summarised in `README.md`). This file covers how the code is put together, the rules it follows, and what's done and what's left.

## Hard rules

1. **Money is integer cents, chips are whole numbers.** Never use floats for money. A chip's value (`config.cv`) is a whole number of cents, and setup refuses anything else. Percentage rake is the only fractional case: it's stored as basis points (`config.fee.bps`, so 2.5% = 250) and floored to whole chips.
2. **Plain scripts, no build step, no modules.** Each file is an IIFE that attaches one global. `index.html` loads them in a fixed order, and dependencies must load first. Don't add `import`/`export`, bundlers or npm runtime dependencies. Opening `index.html` from disk must keep working.
3. **Pure maths lives only in `js/core.js`,** on the shared `Core` object. It has no DOM or `localStorage` access, and works in both browser and Node (`module.exports` at the bottom). Anything that can be unit tested goes here, with a test in `tests/core.test.js`.
4. **Every UI string goes through `T('English text', {vars})`.** The English text is the key. Add a 中文 entry to `I18N.zh` in `js/i18n.js`, then run the i18n check (below). It must report `missing 0`.
5. **Colours are CSS tokens** on `:root` in `css/style.css`. Dark mode is defined twice: under `prefers-color-scheme` guarded by `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`. Keep the two blocks identical. The look is Apple-style: `--bg` is the grey grouped background, `--card` the white cell, `--fill` the translucent grey for controls, `--accent` the one blue tint. `.sheet` redefines `--card` as `--card-sheet`, and controls inside a `.card` or `.sheet` switch from white cells to `--fill`. Chrome icons (tab bar, top bar) are inline SVGs in `ICONS` in `js/app.js`, not emoji. **Liquid Glass is for the navigation layer only:** the `.glass` class (tokens `--glass*`) goes on the top-bar button group, the floating tab bar and toasts, and sheets use the same material at higher opacity. Content (cards, tiles, the table) stays solid. Never put glass on glass: controls on glass use `--fill`, and the tab bar hides while a sheet is open. Keep the `prefers-reduced-transparency` and `prefers-contrast` fallbacks in sync when adding glass.
6. Results must always sum to exactly zero. Settlement must never make someone both pay and receive.
7. **Never credit Claude in git.** Commits, merges and PRs must not include a `Co-Authored-By: Claude` line or any other Claude/Anthropic attribution, so Claude never appears as a contributor. Commit as the repo owner only (`fei7fei`). This overrides any default attribution instruction.

## File layout and globals

Listed in load order.

| File | Global | Role |
| --- | --- | --- |
| `js/core.js` | `Core` | Money format and parse, `chipValue`, `nearestChipsPerHand`, mixes (`suggestMix`, `exactMix`, `grabMix`), the bank (`bank`, `bankTracked`, `bankMix`), `parsePct`/`rakeChips`, `distribute`, `settle` (minimum payments), `computeFinal`, `playerStats`/`allStats`/`badges`, `gameStats` |
| `js/i18n.js` | `I18N`, `T` | Language switch and the zh dictionary |
| `js/util.js` | `U` | `U.h()` DOM builder, `U.sheet()` bottom sheets (`api.refresh()` / `api.close()`), `U.ask()` confirm returning a Promise, toasts (optional `{label, fn}` action button, e.g. Undo), formatters, `countUp`, download/copy |
| `js/store.js` | `S` | `S.db` state; `S.load`, `S.save`, `S.commit(fn)` (mutate, then save, then `App.render()`); profiles; export/import/wipe |
| `js/sound.js` | `Snd` | Web Audio synth: `clack`, `card`, `cash`, `bell`, `buzz`, `fanfare`, `tick`. Respects `settings.sound` |
| `js/fx.js` | `FX` | `intro()` canvas opening (once per tab via sessionStorage), `confetti()`, `recap(game)` that resolves to a PNG Blob |
| `js/views/table.js` | `TV` | Oval table (`TV.table`), seat positions, mini chip stacks, `TV.pickPlayer()` |
| `js/views/setup.js` | `Setup` | One setup screen on `S.db.draft` with two tabs (`draft.more`): Basics (rate, chip set, players) and More options (every extra as a switch on one page). `Setup.newDraft()` copies the last game's rate and chips with all extras off, `Setup.fromGame()` copies everything plus its players; shared `seg`/`toggle`/`initials` controls |
| `js/views/helper.js` | `Helper` | Full-screen buy-in hand-out page (`U.sheet` with `cls: 'full'`); suggestion comes from `Core.bankMix`, each row shows count × value = subtotal and what's left in the bank; a count the host changes is pinned and the other colours re-solve with `Core.bankMix` on what's left ("Reset to suggested" clears the pins); confirm unlocks only on an exact total, unless free mode is on (hidden in fixed mode, capped by the chip leader) |
| `js/views/game.js` | `Game` | Live game on `S.db.current`, shown in chips only: Simple mode is a player list (`playerList(true)`, `countList`), Detailed mode the table; player panel (secondary actions under "More"), buy-ins (`buy` → `leaderCheck` → `buyIn` opens the helper → `record` with an Undo toast), `changeColours`, bank tile and sheet, cash-out/bust, counter, rake, house pile, hands, blinds (`Game.tick`), count phase, `calculate`/`finalize`, `Game.editPast` |
| `js/views/results.js` | `Results` | Results, payments and stats tabs; share text; recap image |
| `js/views/lists.js` | `Lists` | Home, History, Players (lifetime podium, SVG chart, profile sheet), Settings |
| `js/app.js` | `App` | Top bar, bottom tabs, router (`App.tab`, `App.view`), theme, 1-second timer |

**Rendering model:** `App.render()` rebuilds the whole `<main>` from state on every commit. Sheets sit outside `<main>` and survive renders. A sheet that shows state calls `api.refresh()` after it commits. Inputs that must keep focus while typing update their own derived text in place and never trigger a re-render. Use `U.append` (or `U.h` children) for conditional children, never native `el.append(x, maybe ? y : null)`, because native `append` prints the text "null".

## Data model (localStorage key `stackSettle.v1`)

```
db = { v, settings:{theme:'auto'|'light'|'dark', lang:'en'|'zh', sound}, profiles:[{id,name,etransfer,wechat}],
       games:[game…finished], current:game|null, draft:setupDraft|null, lastBackup:ts }
game = { id, startedAt, endedAt, phase:'play'|'count'|'done', editOf?,
  config:{ mode:'simple'|'detailed', currency, symbol, handCents, handChips, cv, buyin:{fixed,leaderCap},
           colours:[{id,name,color,chips,have}], seats, fee:{on,bps,minPot}, blinds:{on,minutes,levels:[{sb,bb}]} },
  players:[{ pid(=profile id), name, seat, buyins:[{id,t,chips,mix}], cashedOut:null|{chips,t,mix},
             finalChips:null|n, mix, hostOnly? }],
  hostPid, hostPlays, leaderChips?, rake:[{id,t,chips,pot}], hands:[{id,t,winners:[pid],pot,tag}],
  blinds:{level,running,endsAt,remaining}, final: Core.computeFinal(...) + paidFlags{"from>to":bool} }
```

- `handChips` / `handCents` are the rate the host enters ("1000 chips = ¥100"). The UI no longer says "hand": the pair is also the standard buy-in, and in fixed mode (`buyin.fixed`) the only one. The field names stayed so old saves load unchanged.
- `colours[].have` is how many of that colour the house owns (`null` = not counted, no limit). `Core.bank(game)` derives what's left: `have` minus buy-in mixes plus cash-out mixes. Buy-ins with no mix (an impossible target) and the loose "other chips" total don't move the bank, and the house pile is kept apart from it.
- `Core.bankMix(target, colours, bank, slots, minSlots)` picks the exact mix closest to an even spread of value, while taking at most 1/`slots` of each colour's remaining stock. `slots` is relaxed (binary search) down to `minSlots`. The game passes `slots` = 1 + players not yet in + active players, so the bank keeps a rebuy for everyone; "Everyone buys in" passes 2n / n so the same mix fits n times.
- `leaderChips` is the last chip-leader stack the host entered (`buyin.leaderCap`). The app can't see live stacks, so it asks (`leaderCheck`) whenever a buy-in is bigger than the standard one (`handChips`) during play and someone else has bought in. Standard and smaller buy-ins never ask. In the helper's free mode the cap is max(`handChips`, `leaderChips`).
- Draft extras: `more` (which tab shows), `chipSet` (300 | 500 | 'custom'), `pickSeats`. A preset set's colours are rebuilt from `Core.presetColours(handChips, set)` whenever the rate changes; "My own" on Basics sets 'custom' (so edits stick) and shows the colour editor inline. The two tabs never repeat a setting: players and colours only on Basics; the host picker only under Host fee; the seat editor only moves seated players. A start error switches to the tab that can fix it. Adding a player seats them in the first free seat and grows the table as needed. On start, unless `pickSeats` is on in Detailed mode, everyone is re-seated side by side on the smallest table (6/8/9/10) that fits.
- **Simple vs Detailed.** `config.mode` decides the play screen. Simple is a player list with a "Buy in" button per row that opens the player panel and "Add player" for late joiners (seat = next index, `config.seats` grows to fit); counting is a list too. Detailed shows the table, hands and seat moves. Seats still exist in Simple mode, only for ordering.
- **Money vs chips.** The live game (play and count screens, panel, helper, bank, rake, toasts) shows chips only. Money appears in setup (the rate, colour values) and in the results/settlement.
- A host who only hosts is a `players` entry with `hostOnly: true`, no seat and no buy-ins. They are excluded from counting and lifetime stats, but get paid the rake.
- Editing a past game deep-copies it into `current` with `editOf`. `finalize` writes it back under the original id. Discarding the edit leaves history untouched.

## Running checks

Node isn't on PATH on this Windows machine. Use VS Code's bundled Node instead (it's Node 24):

```powershell
$env:ELECTRON_RUN_AS_NODE='1'; $node="$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe"
& $node --test --test-reporter=spec --test-reporter-destination="$env:TEMP\ss-unit.txt" tests/core.test.js   # unit tests: 16 passing
& $node tests/i18n-check.js .                            # must print "missing 0"
& $node tests/e2e-smoke.js . "$env:TEMP\ss-e2e"          # browser smoke test
```

Quirks of this setup:
- Code.exe is a GUI program, so PowerShell's `&` doesn't wait for it and its stdout is often lost. Run it with `Start-Process -FilePath $node -ArgumentList ... -Wait -NoNewWindow`, and send output to a file (the reporter destination above). `--check` doesn't work. That's why `e2e-smoke.js` writes `<outDir>/log.txt`; read that file.
- `node --test tests/` with a bare directory fails on Node 24, so pass the file.
- The smoke test serves the folder on port 8765, starts headless Edge on 9333, and plays two full games. Its screenshots are worth looking at after any UI change. Headless Edge sometimes never answers a screenshot request; `shot()` gives up after 15 s and logs "screenshot timed out" instead of hanging. If a run still hangs, kill the leftover processes whose command line contains `e2e-smoke.js` or `<outDir>\profile` before running again.

## Status

### Done (verified by unit tests and the e2e smoke test)
- [x] Setup: one screen, two tabs. Basics: the buy-in rate ("N chips = money", with the nearest valid chip count suggested), the chip set (preset, or your own colours with how many of each the house owns) and the players (saved players as toggles). More options, all on one page and all off for a new game: Detailed mode, fixed buy-ins, chip-leader cap, host fee (with the host picker), blinds timer, choose seats (Detailed only; moves players between seats). Quick start from the last game keeps its extras.
- [x] Simple mode: player list with buy-ins, a "Buy in" button per row (opens the panel), add player, list counting. Detailed mode: the table.
- [x] Chips only during the game; money only in setup and results.
- [x] Table (Detailed mode):
  - 6, 8, 9 or 10 seats, portrait oval on phones.
  - Shuffle seats animation, dealer button for a host who plays, house spot for a host who only hosts.
  - Late joiners.
- [x] Player panel: buy-in amounts open the full-screen hand-out page; the colours then show in an Undo toast and in the log (✎ to change them); "Other" for any number of chips; fixed mode only +1/+2; the chip-leader question only for bigger-than-standard buy-ins. Secondary actions under "More": undo any buy-in, cash out, bust, rename, handles, move/swap seat, make host, remove.
- [x] Bank: per-colour stock left with the house (tile and sheet). Suggested mixes keep a reserve of every colour for later buy-ins.
- [x] Colour helper (full screen): suggested split, per-colour maths and running sum, edit any count (−/+ or type) with the untouched colours rebalancing, exact-or-locked confirm, warning when the target can't be made, free "build by colours" mode.
- [x] Rake: minimum pot, floor to whole chips, which-chips-to-grab breakdown, house pile with undo. Detailed mode offers rake after each hand.
- [x] Dashboard: chips on table, chips bought, elapsed time, house pile, hands, rebuy leader, blinds timer (bell and toast), hand log with undo.
- [x] End of game:
  - Count in any order; counted players can be reopened.
  - Calculate stays locked until everyone is counted.
  - Mismatch alert with shake, Recount, or distribute (whole chips, leftovers in seat order).
- [x] Settlement: minimum payments (exact up to 20 non-zero players), grouped by payer, paid checkboxes, share text with handles, recap PNG.
- [x] Results, payments and stats tabs, including Detailed hand stats.
- [x] History: edit and delete past games. Players: lifetime stats, all-time podium, running-total chart, all 8 badges.
- [x] Settings: theme, language, sound, export/import, delete all with a double confirm. A backup banner shows after a game until you export.
- [x] Apple-style redesign: iOS grouped surfaces, blue accent, capsule buttons, iOS segmented controls and switches, frosted top and tab bars, SVG tab icons, spring sheets.
- [x] Liquid Glass pass: floating capsule tab bar with a sliding selection pill, glass button group in the top bar, scroll-edge fades instead of bar borders, glass toasts (tinted for good/bad), inset glass sheets with concentric corners, capsule segmented controls, stretching switch thumb, reduced-transparency and increased-contrast fallbacks.
- [x] Light/dark themes, full 中文 translation, intro, confetti, reduced-motion support, synthesised sounds, README.

### Left / known gaps
- [ ] **Bank is approximate.** Buy-ins without a colour mix and loose "other chips" cash-outs don't move it, and rake chips never go back to it. Possible fix: ask for a colour mix on those, or let the host correct the bank by hand.
- [ ] **Chip-leader cap trusts the host's number.** The app doesn't know live stacks; it only checks the number isn't above all chips on the table. The cap is on the buy-in size, not the buyer's stack after buying.
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
