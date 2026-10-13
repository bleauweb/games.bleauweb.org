# games.bleauweb.org

Small browser games by Bleauweb, served as one static site. The hub at `/` lists them; each
game lives in its own folder under `games/` and is reachable at `/games/<name>/`.

| Game | Path | What it is |
| --- | --- | --- |
| Treble Maker | `games/treble-maker/` | A note-reading trainer: notes on an SVG staff, answered on an on-screen piano. Learn (names and mnemonics on the staff), Practice (12 notes, pass at 80% to unlock the next level), Rush (notes scroll toward a line; three lives). Nine levels from treble lines to sharps and flats; missed notes come back more often. |
| Gate Rush | `games/gate-rush/` | A WebGL lane runner in the style of the "pick the gate" mobile-game ads, except it is tuned so you can actually win. Three.js, touch and keyboard, saves progress in the browser. |

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
