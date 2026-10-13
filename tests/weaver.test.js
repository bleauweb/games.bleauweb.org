import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blank, paint, fill, repeats, cycle, orbit, seedPattern } from '../games/pattern-weaver/src/weaver.js';

test('mirrors paint the right number of cells', () => {
  const n = 8;
  assert.equal(paint(blank(n), { x: 1, y: 2, color: 0, mirror: 'none' }).length, 1);
  assert.equal(paint(blank(n), { x: 1, y: 2, color: 0, mirror: 'v' }).length, 2);
  assert.equal(paint(blank(n), { x: 1, y: 2, color: 0, mirror: 'four' }).length, 4);
  assert.equal(paint(blank(n), { x: 1, y: 2, color: 0, mirror: 'rot4' }).length, 4);
  assert.equal(paint(blank(n), { x: 1, y: 2, color: 0, mirror: 'eight' }).length, 8);
  assert.equal(orbit('eight', 7, 3, 3).length, 1, 'the centre is its own image');
});

test('tiles repeat and flood fill stays inside its region', () => {
  assert.equal(repeats(16, 4, 1, 1).length, 16);
  const g = blank(8);
  assert.equal(paint(g, { x: 0, y: 0, color: 2, tile: 4 }).length, 4);
  const h = blank(6);
  for (let i = 0; i < 6; i++) h[2][i] = 0; // a wall across the middle
  const changed = fill(h, 0, 0, 3);
  assert.equal(changed.length, 12, 'only the top region fills');
  assert.equal(h[5][5], null);
  cycle(h, 10);
  assert.equal(h[0][0], 4);
  assert.equal(h[2][0], 1);
  assert.equal(h[5][5], null);
});

test('seed patterns are symmetric', () => {
  let s = 1;
  const rng = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const g = seedPattern(16, rng);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) assert.equal(g[y][x], g[15 - x][y]);
});
