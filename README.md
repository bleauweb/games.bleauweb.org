# games.bleauweb.org

Small browser games by Bleauweb, served as one static site. The hub at `/` lists them; each
game lives in its own folder under `games/` and is reachable at `/games/<name>/`.

| Game | Path | What it is |
| --- | --- | --- |
| Market Day | `games/market-day/` | Farm-to-market tycoon. Plant six crops, keep chickens, cows and sheep, load a cart and sell in town where prices random-walk daily (festivals, weather, crows), deliver orders, buy equipment (field, watering, tools, cart, barn, stall, scarecrow) until the Golden Tractor wins the game. Growth continues while the tab is closed (capped at 12 h). `economy.js` is pure; a greedy bot test proves the game is winnable within 60 farm days on several seeds and that the player can never get stuck. |
| Bakery Rush | `games/bakery-rush/` | Bake-and-sell tycoon with a daily lunchtime rush, perishable goods, reputation, ovens/heat/mixer/counter/coffee/bike upgrades and the Golden Whisk to win. The tick replays ovens, customers, the bike and day changes in time order, so it catches up correctly after time away. Can take wheat, eggs and milk from a Market Day save. Bot-tested winnable. |
| Shipping Lanes | `games/shipping-lanes/` | Trade between six ports with specialities and daily-drifting prices; storms, charts, sails and bigger ships; the Admiral's flagship wins. Bot-tested winnable. |
| Workshop | `games/workshop/` | Crafting chains (wood → plank, ore → ingot → hammer…) at stations with slots and queues, orders with deadlines, supplier prices, an apprentice who repeats jobs; the Great Clock wins. Bot-tested winnable. |
| Capitals & Flags | `games/capitals/` | 140 countries by region; four quiz modes (capital, country, flag, which flag) with same-region distractors and spaced repetition of misses. Flags are the ISO codes as emoji. |
| Morse Ear | `games/morse-ear/` | Koch-method Morse trainer: character speed and Farnsworth spacing, Learn / Copy (five-character groups) / Words / Send (hand keying decoded by timing). Table, timing and keying decoder are tested. |
| Forecaster | `games/forecaster/` | Weather-prediction puzzle. A hidden atmosphere (seasonal temperature, pressure systems that approach and pass, humidity, gusts) drives a small town's weather; the player sees only what their instruments show and forecasts tomorrow's condition, high and wind (50 + 30 + 20 points). Points buy a better thermometer, almanac, barometer, hygrometer, anemometer, upwind reports, satellite, radar and three model tiers. Five perfect days in a row wins. Tests pin the curve: starter gear makes a perfect day rare, full gear makes it common, a full kit wins within a season. |
| Flute Fingers | `games/flute-fingers/` | Flute fingering trainer for the first two octaves (C4–C♯6). Learn (chart, tips, alternative fingerings), Finger it (set the keys on an SVG flute, get told what to add or lift), Name it (fingering shown, answer on the piano), Play it (play the note on a real flute; the microphone checks pitch and octave). The chart is tested. |
| Note by Note | `games/note-by-note/` | Learn public-domain songs by reading them. Twenty melodies on a scrolling SVG staff (bar lines, note values, rests), answered on the on-screen piano. Listen / Learn (step through, hints after a wrong key, phrase practice) / Play (count-in, metronome, timing windows, accuracy and stars). Songs are text with bar lines; a test checks every bar adds up to the time signature. Shares its music model, piano and synth with Treble Maker. |
| Treble Maker | `games/treble-maker/` | A note-reading trainer: notes on an SVG staff, answered on an on-screen piano. Learn (names and mnemonics on the staff), Practice (12 notes, pass at 80% to unlock the next level), Rush (notes scroll toward a line; three lives). Nine levels from treble lines to sharps and flats; missed notes come back more often. |
| Gate Rush | `games/gate-rush/` | A WebGL lane runner in the style of the "pick the gate" mobile-game ads, except it is tuned so you can actually win. Three.js, touch and keyboard, saves progress in the browser. |

### Pattern games

Built around predictable rules, no timers, and completion. They share `shared/calm.css` and
`shared/calm.js`: a sound / motion / calm-palette strip stored once for the whole hub.

| Game | Path | What it is |
| --- | --- | --- |
| Sequence Lab | `games/sequence-lab/` | What comes next: number rules (steps, multiples, alternating gaps, squares, triangles, sums) and shape rules (shape, colour, size, rotation cycling, up to three at once). Four options, the rule explained after each answer. Generator tested for valid, distinct options across every level. |

| Tile Logic | `games/tile-logic/` | Nonograms. A line-logic solver (placement enumeration per line, iterated) proves every puzzle, random or from the 14-picture library, is finishable by deduction alone; the tests check each picture solves to itself. Tap or drag to fill, mark-empty mode, Check highlights mismatches, finished lines dim. |

| Symmetry Studio | `games/symmetry-studio/` | Complete a colour grid so it has a named symmetry: left–right or top–bottom mirror, four-way mirror, half turn, quarter turns, or eight-way kaleidoscope, from 6×6 to 11×11. Orbit/canonical-cell math is tested for closure and counts; each puzzle's given cells plus symmetry equal the target. |

| Sort and Stack | `games/sort-and-stack/` | Tap an item, tap a bin. Rules: one attribute (labelled), two attributes combined (labelled), then hidden rules shown only by one example per bin, yes/no rules, and a mix. Generator guarantees at least two items per bin; a hint names the attribute after two misses; the rule is spelled out at the end. |

| Rhythm Patterns | `games/rhythm-patterns/` | Step patterns (8 or 16 steps, 1–3 instrument rows) play with a visual sweep and optional clicks; the player marks the steps on an empty grid, untimed, and checks. A separate Tap-along mode scores live taps against the drum row with a tolerance. Generator, comparison and tap scoring are tested. |

| Circuit Paths | `games/circuit-paths/` | Flow-style: connect matching dots without crossing and fill the grid. Puzzles are generated by cutting a full grid into snaking paths (so a solution always exists), with pair-count bounds per level; the validator is tested against each generated solution. Drag to draw, drawing over another path trims it, backtracking shortens your own. |

| Tangram Fit | `games/tangram-fit/` | Grid "tangram": fill a connected silhouette exactly with 3–8 polyomino pieces (trominoes to pentominoes). Silhouettes are made by placing the pieces first, so they always fit; orientations (up to eight) are tested, and a tap places the selected piece in any orientation-fitting position covering the tapped square. |

| Pattern Weaver | `games/pattern-weaver/` | Sandbox, no failure state: paint on 8/16/24 grids with no mirror, ↔, ↕, four-way, turn×4 or kaleidoscope symmetry, repeating 4×4 or 8×8 tiles, flood fill, colour cycling, undo, a "surprise me" seed, a localStorage gallery and PNG download. Symmetry, tiling and fill helpers are tested. |

| Odd One Out | `games/odd-one-out/` | Four to six items share one or two features; one breaks the rule. Generator rejects puzzles where another feature would single out a different item (tested), so there is always exactly one answer. Hint names the feature; the rule is explained after each answer. |

| Light Switch | `games/light-switch/` | Lights Out. Boards are generated by pressing random lights on a dark board (so a solution always exists); the generating set is kept as a hint and updated by parity as the player presses. Tested: press shape and solution clears every generated board. |

| Stacks | `games/stacks/` | Tower of Hanoi for 3–7 discs with tap-to-move, undo, a hint that gives the next optimal move from any legal position (tested to solve every size in 2ⁿ−1 moves and to recover after detours), and a fewest-moves record. |

| Slide Picture | `games/slide-picture/` | Sliding-tile puzzle with a procedural picture (seeded SVG gradient and shapes) shown as the goal. Scrambled by legal blank moves (tested solvable by parity), rows/columns slide as a block, numbers toggle, fewest-moves record. |

| Pairs | `games/pairs/` | Memory pairs, 6–30 cards, with shape-only and colour-only variants. Mismatches turn back after a moment or on the next tap (toggle). Deck generation tested: exactly two of every key, variants differ in the non-matching attribute, perfect play finishes in one turn per pair. |

| Number Chain | `games/number-chain/` | Hidato-style: a Hamiltonian snake fills the grid; givens are thinned while a counting solver confirms exactly one solution (tested for 4×4–7×7). Tap a number then the squares after it to count up or down; conflicts are refused; Check outlines misplaced numbers. |

### Tools

| Tool | Path | What it is |
| --- | --- | --- |
| Flute Tuner | `tools/tuner/` | Chromatic tuner: note, cents needle, A4 reference 438–444, the fingering of the detected note, a reference tone, and flute tuning tips. |

Treble Maker and Note by Note also accept a real instrument through the microphone ("Use my
instrument"): a detected note answers like a key press. Pitch detection is `shared/pitch.js`
(normalised autocorrelation, tested in Node with synthetic tones). Microphone input needs a
secure context: it works on `localhost` and on the deployed HTTPS site, not over plain HTTP on
the LAN.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173/  (hub) and /games/gate-rush/
npm test           # level generator invariants (every level is winnable)
npm run build      # dist/
```

Node 20 or newer. There is no backend: everything is static files built by Vite.

## Add a game

1. Create `games/<name>/index.html` with its own script and styles (any framework or none).
2. Add the page to `rollupOptions.input` in `vite.config.js`.
3. Add a card to `index.html`.

## Offline (PWA)

The whole suite is an installable web app that works without a connection once visited:

- `public/manifest.webmanifest` and `public/icons/` make it installable ("Add to Home Screen").
- `scripts/make-sw.mjs` runs after `vite build` and writes `dist/sw.js`, a service worker that
  precaches every built page and asset (the list is generated, so new games are included
  automatically). Pages are fetched network-first with cache fallback; hashed assets are
  cache-first. A new build gets a new cache name and old caches are dropped on activation.
- `shared/pwa.js` registers the worker on every page (the build fails if a page lacks it). It
  does nothing in `vite dev`, where files change constantly.
- Progress is in `localStorage`, so it is available offline too. Microphone features need no
  network either.

## Deploy

The site is a DigitalOcean App Platform static site described by [`.do/app.yaml`](.do/app.yaml).

- One-time: in the DigitalOcean control panel choose *Create App*, point it at the
  `bleauweb/games.bleauweb.org` repository, and when asked, import the spec from `.do/app.yaml`
  (or run `doctl apps create --spec .do/app.yaml`). The spec names the custom domain
  `games.bleauweb.org`; App Platform shows the CNAME to add at the DNS host.
- After that every push to `main` builds (`npm ci && npm run build`) and redeploys `dist/`.
  GitHub Actions only runs the tests and a build check on pushes and pull requests.

## Gate Rush design notes

The game borrows the parts of the "Top War" and "Hero Wars" ads that are actually fun and makes
them real: the gate lane, the hordes, the hero with a power number, the merge base, and the
pull-the-pin treasure rooms.

- `src/combat.js` holds the fight math. A squad is `{ count, tier, hero }`: troops, their tier
  (Rifles, Heavies, Tanks, Mechs; UPGRADE gates evolve the whole army), and the hero's level
  (a multiplier on everything). Fights follow a Lanchester-style square law: a bigger, better
  army wins with fewer losses. The level generator and the live game share these functions.
- `src/level.js` builds a level from its number. While laying out gates and enemies it tracks a
  "best" squad and an "ok" squad (right gate ~70% of the time) and sizes hordes and the boss so
  the ok squad still wins. `tests/level.test.js` checks this for levels 1 to 80.
- `src/game.js` is the Three.js scene: a platform over water, instanced troops per tier, the
  hero, signboard gates with live result previews, hordes that charge, streak bullets, the boss
  fight with a "YOUR POWER vs BOSS" banner (`bossPowerFor` makes the two numbers honest).
- `src/base.js` is the merge grid. Two units of the same level make one of the next; every unit
  on the grid adds its worth (2^level − 1) to the starting army. Recruits arrive after wins.
- `src/pins.js` is the treasure-room world (falling things, lava, water, gold, potions,
  monsters, pins); `src/rooms.js` holds the rooms as text maps; `src/pinsView.js` draws them.
  `tests/pins.test.js` brute-forces every pin order to prove each room is solvable and that the
  wrong order fails.
- Coins buy permanent upgrades (`src/upgrades.js`); levels are tuned for an un-upgraded squad so
  every upgrade is a real edge rather than a requirement.
