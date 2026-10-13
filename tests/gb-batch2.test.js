import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot } from './gb/harness.js';
const puzzles = (slug) => JSON.parse(fs.readFileSync(new URL(`../gameboy/games/${slug}/puzzles.json`, import.meta.url), 'utf8'));

test('binary grid: enter the baked solution, win, then the next puzzle is queued', () => {
  const p = puzzles('binary-grid')[0];
  const g = boot('binary-grid');
  g.tap('START').tap('A');
  assert.ok(g.has('BINARY GRID'), g.text());
  assert.equal(g.mem('n')[0], p.n);
  const cur = { x: 0, y: 0 };
  for (let y = 0; y < p.n; y++) for (let x = 0; x < p.n; x++) {
    if (p.givens[y][x] !== -1) continue;
    g.moveTo(cur, x, y);
    g.tap('A'); if (p.solution[y][x] === 1) g.tap('A'); // blank -> dark(0) -> light(1)
  }
  assert.ok(g.has('Grid complete!'), g.text());
  g.frames(20).tap('A');
  assert.equal(g.sram()[3 + 1], 1, 'next puzzle index for level 0');
});

test('binary grid: the check names a broken rule and a given cannot be changed', () => {
  const p = puzzles('binary-grid')[0];
  const g = boot('binary-grid');
  g.tap('START').tap('A');
  // find a given, try to change it
  let gx = -1, gy = -1, bx = -1, by = -1;
  for (let y = 0; y < p.n; y++) for (let x = 0; x < p.n; x++) { if (p.givens[y][x] !== -1 && gx < 0) { gx = x; gy = y; } if (p.givens[y][x] === -1 && bx < 0) { bx = x; by = y; } }
  const cur = { x: 0, y: 0 };
  g.moveTo(cur, gx, gy).tap('A');
  assert.ok(g.has('That one is given.'), g.text());
  // put the wrong colour in a blank and check: the check marks it
  g.moveTo(cur, bx, by); g.tap('A'); if (p.solution[by][bx] === 0) g.tap('A');
  g.tap('B');
  assert.ok(g.has('Squares with a dark') || g.has('has three alike') || g.has('has too many'), g.text());
});

test('tile logic: fill the baked picture; clues fade; check flags a wrong square', () => {
  const p = puzzles('tile-logic')[0];
  const g = boot('tile-logic');
  g.tap('START').tap('A');
  assert.equal(g.mem('n')[0], p.n);
  const cur = { x: 0, y: 0 };
  // one deliberate wrong fill first, then check
  let wx = -1, wy = -1;
  for (let y = 0; y < p.n && wx < 0; y++) for (let x = 0; x < p.n; x++) if (!p.solution[y][x]) { wx = x; wy = y; break; }
  g.moveTo(cur, wx, wy).tap('A').tap('SELECT');
  assert.ok(g.has('X = not in picture.'), g.text());
  g.tap('A'); // undo it
  for (let y = 0; y < p.n; y++) for (let x = 0; x < p.n; x++) if (p.solution[y][x]) { g.moveTo(cur, x, y); g.tap('A'); }
  assert.ok(g.has('Picture complete!'), g.text());
});

test('mosaic numbers: fill the baked solution and win; check clears a wrong square', () => {
  const p = puzzles('mosaic-numbers')[0];
  const g = boot('mosaic-numbers');
  g.tap('START').tap('A');
  assert.equal(g.mem('n')[0], p.n);
  const cur = { x: 0, y: 0 };
  let wx = -1, wy = -1;
  for (let y = 0; y < p.n && wx < 0; y++) for (let x = 0; x < p.n; x++) if (!p.solution[y][x]) { wx = x; wy = y; break; }
  g.moveTo(cur, wx, wy).tap('A').tap('SELECT');
  assert.ok(g.has('Cleared wrong:'), g.text());
  assert.equal(g.mem(g.sym('state') + wy * p.n + wx)[0], 0);
  for (let y = 0; y < p.n; y++) for (let x = 0; x < p.n; x++) if (p.solution[y][x]) { g.moveTo(cur, x, y); g.tap('A'); }
  assert.ok(g.has('Mosaic complete!'), g.text());
});

test('sudoku: hints alone finish a gentle grid, and each hint matches the solution', () => {
  const p = puzzles('sudoku-calm')[0];
  const g = boot('sudoku-calm');
  g.tap('START').tap('A');
  assert.equal(g.mem('n')[0], p.n);
  let guard = 0;
  while (!g.has('Sudoku complete!') && guard++ < 40) {
    g.tap('SELECT');
    const cells = g.mem('cell', p.n * p.n);
    for (let i = 0; i < cells.length; i++) if (cells[i]) assert.equal(cells[i], p.solution[Math.floor(i / p.n)][i % p.n], `cell ${i} after hint`);
  }
  assert.ok(g.has('Sudoku complete!'), g.text());
});

test('sudoku: a clashing number shows inverted and entering by hand works', () => {
  const p = puzzles('sudoku-calm')[0];
  const g = boot('sudoku-calm');
  g.tap('START').tap('A');
  // find a blank cell and a value already in its row
  let bx = -1, by = -1;
  for (let y = 0; y < p.n && bx < 0; y++) for (let x = 0; x < p.n; x++) if (!p.givens[y][x]) { bx = x; by = y; break; }
  const clash = p.givens[by].find((v) => v);
  const cur = { x: 0, y: 0 }; g.moveTo(cur, bx, by);
  for (let k = 0; k < clash; k++) g.tap('A');
  const tiles = fs.readFileSync(new URL('../gameboy/games/sudoku-calm/tiles.h', import.meta.url), 'utf8');
  const X1 = Number(/GAME_X1 (\d+)/.exec(tiles)[1]);
  const gx0 = g.mem('gx0')[0], gy0 = g.mem('gy0')[0];
  const t = g.tile(gx0 + bx + Math.floor(bx / p.bw), gy0 + by + Math.floor(by / p.bh));
  assert.equal(t, X1 + clash - 1, 'inverted digit for a clash');
  // now set it to the real value
  while (g.mem(g.sym('cell') + by * p.n + bx)[0] !== p.solution[by][bx]) g.tap('A');
  const D1 = Number(/GAME_D1 (\d+)/.exec(tiles)[1]);
  assert.equal(g.tile(gx0 + bx + Math.floor(bx / p.bw), gy0 + by + Math.floor(by / p.bh)), D1 + p.solution[by][bx] - 1);
});
