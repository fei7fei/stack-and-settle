# Graph Report - poker  (2026-10-14)

## Corpus Check
- 21 files · ~34,291 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 1 file(s) not represented in the graph (top: .css 1)

## Summary
- 227 nodes · 338 edges · 16 communities (7 shown, 9 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 37 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b98407ca`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Design Rules & Docs
- Game Screen & Bank
- Core Money Maths
- E2E Smoke Test
- Game Setup Screen
- Results, Sharing & FX
- Core Unit Tests
- Package Config
- Game Lists & Profiles
- UI Utilities

## God Nodes (most connected - your core abstractions)
1. `Core` - 32 edges
2. `panel()` - 13 edges
3. `BUILD.md Handoff Notes` - 12 edges
4. `playScreen()` - 11 edges
5. `tableView()` - 8 edges
6. `basicTab()` - 8 edges
7. `countScreen()` - 6 edges
8. `go()` - 6 edges
9. `Data Model (localStorage stackSettle.v1)` - 6 edges
10. `playInfo()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `refresh()` --indirect_call--> `panel()`  [INFERRED]
  js/util.js → js/views/game.js
- `CLAUDE.md graphify Rules` --conceptually_related_to--> `BUILD.md Handoff Notes`  [AMBIGUOUS]
  CLAUDE.md → BUILD.md
- `Back Up and Restore (export/import)` --shares_data_with--> `Data Model (localStorage stackSettle.v1)`  [INFERRED]
  README.md → BUILD.md
- `Local-Only Data (no server, no account)` --conceptually_related_to--> `Data Model (localStorage stackSettle.v1)`  [INFERRED]
  README.md → BUILD.md
- `Fewest Payments Settle-up` --semantically_similar_to--> `Minimum-Payments Settlement (Core.settle)`  [INFERRED] [semantically similar]
  README.md → BUILD.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **BUILD.md Hard Rules** — build_integer_cents_rule, build_no_build_step_iife, build_pure_core_maths, build_i18n_t_rule, build_css_token_theming, build_zero_sum_settlement_rule, build_no_claude_attribution [EXTRACTED 1.00]
- **Bank-Aware Buy-in Flow** — build_bank_derivation, build_bankmix_algorithm, readme_chip_helper, build_chip_leader_cap, build_saved_chip_sets [INFERRED 0.85]
- **End-of-Night Count and Settlement** — readme_chip_check, readme_fewest_payments, build_minimum_payments_settlement, build_zero_sum_settlement_rule [INFERRED 0.85]

## Communities (16 total, 9 thin omitted)

### Community 0 - "Design Rules & Docs"
Cohesion: 0.06
Nodes (31): Gap: Bank Is Approximate, Bank Derivation (Core.bank), Core.bankMix Even-Spread Mix with Slot Reserve, Chip-Leader Buy-in Cap (leaderCheck), Colours Have No Names (U.chip icons), Data Model (localStorage stackSettle.v1), E2E Smoke Test (headless Edge), Editing a Past Game (editOf) (+23 more)

### Community 1 - "Game Screen & Bank"
Cohesion: 0.12
Nodes (38): bankChips(), bankSheet(), bankSlots(), blindsBar(), bust(), buy(), buyBox(), sync() (+30 more)

### Community 3 - "E2E Smoke Test"
Cohesion: 0.08
Nodes (23): edge, errors, ev(), fs, http, LOG, path, pending (+15 more)

### Community 4 - "Game Setup Screen"
Cohesion: 0.14
Nodes (26): basicTab(), blindsEditor(), chipSetPicker(), colourEditor(), extrasOn(), feeEditor(), go(), hostError() (+18 more)

### Community 5 - "Results, Sharing & FX"
Cohesion: 0.29
Nodes (8): handleText(), payments(), podium(), results(), share(), shareImage(), sortedRows(), stats()

### Community 6 - "Core Unit Tests"
Cohesion: 0.15
Nodes (11): card(), chip(), finish(), frame(), roundRect(), shade(), assert, COLOURS (+3 more)

### Community 7 - "Package Config"
Cohesion: 0.33
Nodes (5): description, name, private, scripts, test

## Ambiguous Edges - Review These
- `BUILD.md Handoff Notes` → `CLAUDE.md graphify Rules`  [AMBIGUOUS]
  CLAUDE.md · relation: conceptually_related_to

## Knowledge Gaps
- **10 isolated node(s):** `Colours Have No Names (U.chip icons)`, `Editing a Past Game (editOf)`, `Host-Only Player (hostOnly)`, `Back Up and Restore (export/import)`, `Player Badges (8 lifetime badges)` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 76 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Core` connect `Core Money Maths` to `Results, Sharing & FX`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `playScreen()` (e.g. with `endGame()` and `everyoneBuysIn()`) actually correct?**
  _`playScreen()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Colours Have No Names (U.chip icons)`, `Editing a Past Game (editOf)`, `Host-Only Player (hostOnly)` to the rest of the system?**
  _10 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Design Rules & Docs` be split into smaller, more focused modules?**
  _Cohesion score 0.06097560975609756 - nodes in this community are weakly interconnected._
- **Why does `game()` connect `Core Unit Tests` to `Results, Sharing & FX`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Should `Game Screen & Bank` be split into smaller, more focused modules?**
  _Cohesion score 0.11794871794871795 - nodes in this community are weakly interconnected._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `BUILD.md Handoff Notes` and `CLAUDE.md graphify Rules`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._