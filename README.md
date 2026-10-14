# Stack & Settle

**Run your poker home game from one phone, then settle up in as few payments as possible.**

▶ **Open the app:** https://fei7fei.github.io/stack-and-settle/

The host keeps the app open on their phone for the whole night. It tracks every buy-in, the host's fee and the final chip counts. At the end it shows who won, who lost and exactly who pays whom. Nothing to install, no account, no server: your data stays on your phone.

On the phone, use **Add to Home Screen** to get an app icon.

## Features

### Set up a game on one screen
**New game** opens on **Basics**: what the buy-in costs and how many chips it gets (USD, CAD, CNY, EUR, GBP, AUD, HKD, SGD, NZD or your own symbol), your chip set and the players' names. Pick the 300-chip or 500-chip set, or *My own* to name your colours, set what each one is worth and enter how many of each you have, so the app knows what's left in the bank. Tap **Start game** and you're playing the simplest game: buy-ins, chips and the settle-up at the end. If the numbers don't give a whole-cent chip value, the app suggests the nearest chip count that does.

Everything else sits on the **More options** tab, all on one page, and nothing there repeats the basics. Each extra is a switch, and every switch starts off for a new game:

- **Detailed mode.** Puts the poker table on screen and records each hand: the winner, the pot and how it ended (showdown, everyone folded, or all-in).
- **Fixed buy-ins only.** Players can only buy in for the standard amount.
- **No buying in for more than the chip leader has.**
- **Host fee.** A percentage rake with a minimum pot, and who the host is: one of the players, or someone who only hosts.
- **Blinds timer** with your own levels.
- **Choose seats** (Detailed mode). Pick a 6, 8, 9 or 10-seat table, shuffle the seats, or tap a player to move them. When it's off, players sit in the order you added them.

**Quick start** reuses the setup, extras and players from your last game.

### During the game
Everything during the game is in chips. Money only shows up in setup and in the results at the end.

- **Simple mode is a list** of the players with their buy-ins and chips. Each row has a one-tap buy-in button, and **Add player** lets late arrivals join.
- **Detailed mode shows an oval table** with every player in their seat. The dealer button marks a host who plays, and a house spot shows for a host who only hosts. Tap an empty seat to add a late arrival.
- **Tap a player, tap an amount.** The buy-in is recorded straight away, and a message says which chips to hand over, with an **Undo** button. *Other* lets you type any number of chips (fixed mode only has whole buy-ins). Each buy-in in the log shows its colours, and ✎ changes them. Cash out and bust sit below; rename, payment handles, move seat, make host and remove are under **More**.
- **Chip helper.** For each buy-in it suggests which colours to hand over, and only confirms once the chips add up to the exact amount. The suggestion spreads the colours evenly but never takes so much of one colour that the bank can't serve later buy-ins.
- **Bank.** Shows how many chips of each colour the house still holds. Buy-ins take chips out and cash-outs put them back.
- **Chip-leader rule** (optional). Only for buy-ins bigger than the standard one: the app asks for the chip leader's stack and won't sell more than that.
- **Rake tracking.** Fees are taken in whole chips and only when the pot is big enough. The app shows which chips to pull from the pot, and the house pile has its own undo.
- **Dashboard.** Shows chips on the table, chips bought, time played, the bank, the house pile, the hand count and who has rebought the most.
- **Blinds timer.** Rings a bell and shows a message when the level goes up.
- **Hand log** (Detailed mode). Every hand is listed, and any of them can be undone.

### End of the night
- **Count stacks in any order.** You can reopen a player if you counted wrong. Results stay locked until everyone is counted.
- **Chip check.** If the counted chips don't match the chips handed out, the app warns you. You can recount, or split the difference fairly in whole chips.
- **Fewest payments.** Works out the smallest possible number of payments to settle everyone, and nobody both pays and receives. Payments are grouped by payer, and you can tick each one off as it's paid.
- **Share.** Copy a summary to the group chat, including each player's e-Transfer or WeChat handle. Or save a recap image of the night.
- **Game stats.** Shows how long you played, total rebuys, the biggest win and the biggest loss. In Detailed mode it adds hand stats.

### History and players
- **Every finished game is saved.** You can open, edit or delete any past game.
- **Player profiles** keep lifetime stats: games played, total winnings, best and worst night, return on buy-ins and streaks.
- **An all-time podium**, plus a chart of each player's running total.
- **Badges:** 👑 All-time leader, 💰 Biggest single win, 🎁 Generous donor, 🎯 Best ROI, 🪑 Regular, 🔁 Rebuy king, 🔥 Hot streak, 🧊 Cold streak.

### Settings and extras
- **English and 中文**, switchable at any time.
- **Light, dark or automatic theme.**
- **Sound effects** for chips, cards and cash. You can turn them off.
- **Back up and restore.** Export all your data to a file and import it on another phone. After each game, a reminder shows until you back up.
- **Animations:** an opening animation, confetti for the winner and smooth number count-ups. They respect your phone's reduced-motion setting.

## Your data

Everything is saved in your phone's browser for this website only. It isn't sent anywhere. If you clear your browser data or switch phones, you'll lose it unless you've exported a backup first (**Settings → Export**).

## For developers

It's a static site in plain HTML, CSS and JavaScript, with no build step. How the code is organised, the rules it follows and what's still left to do are all in [BUILD.md](BUILD.md).
