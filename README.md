# games.bleauweb.org

Small browser games by Bleauweb, served as one static site. The hub at `/` lists them; each
game lives in its own folder under `games/` and is reachable at `/games/<name>/`.

| Game | Path | What it is |
| --- | --- | --- |
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

- `src/combat.js` holds the fight math (a Lanchester-style square law: a bigger squad wins with
  fewer losses). The level generator and the live game share it.
- `src/level.js` builds a level from its number. While laying out gates and enemies it tracks a
  "best" squad and an "ok" squad (right gate ~70% of the time) and sizes enemies and the boss so
  the ok squad still wins. `tests/level.test.js` checks this for levels 1 to 80.
- `src/game.js` is the Three.js scene: instanced soldiers, gates with live result previews,
  bullets and debris pools, boss fight, camera and input.
- Coins buy permanent upgrades (`src/upgrades.js`); levels are tuned for an un-upgraded squad so
  every upgrade is a real edge rather than a requirement.
