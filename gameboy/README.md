# Game Boy versions

One ROM per pattern game, built with the GBDK-2020 C toolchain. The ROMs land in
`public/roms/*.gb` and are committed, so the website deploy does not need the compiler.

## Toolchain

GB Studio ships a copy of GBDK-2020 inside its app bundle. Extracting it is all the setup needed:

```bash
npx -y @electron/asar extract "/Applications/GB Studio.app/Contents/Resources/app.asar" /tmp/gbs
cp -R /tmp/gbs/buildTools/darwin-arm64/gbdk ~/.local/share/gbdk && chmod +x ~/.local/share/gbdk/bin/*
```

Any GBDK-2020 release works too: set `GBDK=/path/to/gbdk` when running make.

## Build and test

```bash
npm run roms          # make -C gameboy: tiles, baked puzzles, 17 ROMs
npm test              # bakes puzzles.json, then runs the web tests and the ROM tests
```

`tests/gb/harness.js` boots a ROM in a headless emulator (serverboy), presses buttons, and reads the
background tile map back as text, plus any C global through the linker map. Every ROM has a test
that plays a puzzle through to its win screen.

## Layout

- `common/` shared library: input with d-pad repeat, xorshift random, text and tile drawing, cursor
  sprites, a tiny sound sequencer, SRAM saves, and the title / level-select / pause / win screens.
- `tools/tiles2c.py` turns ASCII tile art (`. 1 2 3` shades) into 2bpp data; `tools/digits.py`
  and `tools/shapes.py` draw digit and shape tiles.
- `gen/*.mjs` bake puzzles from the web games' own generators into `games/<slug>/puzzles.h`
  (and a `.json` twin for the tests), so every ROM puzzle carries the web game's guarantees:
  unique solutions, no guessing.
- `games/<slug>/main.c` one game each; `title` is the cartridge name.

## Game Boy adaptations

Four grey shades stand in for colour: colour attributes become fills (solid, outline, striped),
Symmetry Studio paints with patterns, Circuit Paths numbers its pairs. Stacks stops at six discs
and Tile Logic at 10 x 10 so boards fit beside their clues. Progress and records save to the
cartridge (MBC5 + battery), so flash carts and emulators with save support keep them.

## Playing

Emulators: SameBoy or mGBA on a computer, Delta on iOS, any Game Boy Color flash cart via FlashGBX.
Controls are the same in every ROM: d-pad moves, A acts, B is the secondary action, SELECT is help
or a setting, START opens the pause menu, and nothing is timed.

## Known compiler gotcha

SDCC 4.5.1 (the one GB Studio bundles) can store to the wrong address in the pattern
`if (arr[i] != g) arr[i] = g;` when `g` is a global. Copy the global into a local first.
