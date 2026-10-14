# Stack & Settle

A poker home-game settlement app that runs on one host phone. It tracks buy-ins, rake (host fee) and final chip counts. It then works out each player's result and the fewest direct payments to settle up. It also keeps game history, lifetime stats, podiums and badges.

It is a static site: plain HTML, CSS and JavaScript with no build step and no server. All data stays in the browser on the host phone (localStorage). Use **Settings → Export** to back up, or before changing phones.

## Deploy to GitHub Pages

1. Create a GitHub repository and push this folder to it (`index.html` must be at the root):
   ```sh
   git init
   git add .
   git commit -m "Stack & Settle"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. On GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to *Deploy from a branch*. Choose `main` and `/ (root)`, then press **Save**.
4. After a minute the site is live at `https://<you>.github.io/<repo>/`. Open it on the host phone and use *Add to Home Screen* for an app-like icon.

Data is stored per web address. If you move the site to a new URL, export from the old one and import on the new one.

## Run locally

Any static file server works, for example:

```sh
npx serve .            # or: python -m http.server 8000
```

Opening `index.html` straight from disk also works, because the scripts are classic scripts, not ES modules.

## Tests

The pure calculation code (money, chip mixes, rake, settlement, results and stats) is in `js/core.js` and is unit tested with Node's built-in test runner. Node 18 or later is needed, with no dependencies:

```sh
npm test               # same as: node --test tests/core.test.js
```

## How the maths works

- Money is always integer cents and chips are always whole numbers. Setup only accepts a chip value that is a whole number of cents. For example, $10 per 300 chips is rejected and the app suggests 250 chips.
- Rake is `floor(pot × percent)` in whole chips. No rake is taken when the pot is below the minimum.
- Each player's result is `final chips × chip value − money paid in`, and the host also gets the house pile. The chip check is: player stacks + house pile = chips handed out.
- If the count is off and you choose to distribute the difference, the missing or extra chips are split equally in whole chips. Leftover chips go one at a time in seat order, so results always add up to exactly zero.
- Settlement tries every way of splitting players into groups whose wins and losses cancel, for up to 20 players with a non-zero result, and keeps the split with the most groups. That gives the true minimum number of payments. Within each group the biggest debtor pays the biggest creditor, so nobody both pays and receives.

## Files

| Path | What it does |
| --- | --- |
| `index.html` | App shell; loads the scripts in order |
| `css/style.css` | All styling, light/dark tokens, animations |
| `js/core.js` | Pure maths: money, mixes, rake, settlement, results, stats, badges |
| `js/i18n.js` | English / 中文 strings |
| `js/store.js` | localStorage persistence, export/import |
| `js/sound.js` | Web Audio sounds (no audio files) |
| `js/fx.js` | Opening sequence, confetti, recap image |
| `js/views/*.js` | Setup wizard, table, live game, colour helper, results, history, players, settings |
| `js/app.js` | Top bar, tabs, routing, timers |
| `tests/core.test.js` | Unit tests for `js/core.js` |
