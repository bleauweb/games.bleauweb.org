import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boot } from './gb/harness.js';

test('light switch: title, level select, a board, and a win via the hint', () => {
  const g = boot('light-switch');
  assert.ok(g.has('LIGHT SWITCH'), g.text());
  assert.ok(g.has('Press START'));
  g.tap('START');
  assert.ok(g.has('3 x 3'), g.text());
  assert.ok(g.has('7 x 7'));
  g.tap('A'); // 3x3
  assert.ok(g.has('Moves:'), g.text());
  // read the board: ON metatile's top-left tile vs OFF
  const n = 3, gx0 = 10 - n, gy0 = 8 - n + 1;
  const onTile = (x, y) => g.tile(gx0 + x * 2, gy0 + y * 2);
  const offId = onTile(0, 0); // unknown which; just check it's a game tile
  assert.ok(offId >= 128, 'board uses game tiles');
  // turn the hint on, then press every hinted cell
  g.tap('B');
  const cur = { x: 0, y: 0 };
  const HINT = hintTile();
  let pressed = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (g.tile(gx0 + x * 2, gy0 + y * 2) === HINT) {
      g.moveTo(cur, x, y); g.tap('A'); pressed++;
    }
  }
  assert.ok(pressed > 0, 'hint marked some cells');
  assert.ok(g.has('All lights out!'), g.text());
  g.frames(20).tap('A');
  assert.ok(g.has('3 x 3'), 'back at level select');
  const sram = g.sram();
  assert.equal(sram[0], 0x53); assert.equal(sram[1], 0x4C); // magic
  assert.equal(sram[3] & 1, 1, 'level 0 marked done');
});

import fs from 'node:fs';
function hintTile() {
  const h = fs.readFileSync(new URL('../gameboy/games/light-switch/tiles.h', import.meta.url), 'utf8');
  return Number(/GAME_HINT (\d+)/.exec(h)[1]);
}
