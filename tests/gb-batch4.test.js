import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot } from './gb/harness.js';
const puzzles = (slug) => JSON.parse(fs.readFileSync(new URL(`../gameboy/games/${slug}/puzzles.json`, import.meta.url), 'utf8'));

test('sequence lab: eight right answers complete the first set; a wrong answer is explained', () => {
  const ps = puzzles('sequence-lab').filter((p) => p.level === 0);
  const g = boot('sequence-lab');
  g.tap('START').tap('A');
  for (let r = 0; r < 8; r++) {
    const p = ps[r];
    assert.ok(g.has(`Round${r + 1}`) || g.has(`Round ${r + 1}`), g.text());
    assert.equal(g.mem('answer')[0], p.answerIndex);
    for (let k = 0; k < p.answerIndex; k++) g.tap(p.kind === 'number' ? 'DOWN' : 'RIGHT');
    g.tap('A');
    assert.ok(g.has('Right!'), g.text());
    g.frames(30).tap('A');
  }
  assert.ok(g.has('Set complete!'), g.text());
  assert.ok(g.has('Right:  8'), g.text());
  g.frames(20).tap('A');
  assert.equal(g.sram()[3] & 1, 1, 'level done');
  // a shape level, answered wrong once
  const h = boot('sequence-lab');
  h.tap('START').tap('DOWN').tap('A');
  const q = puzzles('sequence-lab').filter((p) => p.level === 1)[0];
  assert.equal(h.mem('kind')[0], 1);
  const wrong = (q.answerIndex + 1) % 4;
  for (let k = 0; k < wrong; k++) h.tap('RIGHT');
  h.tap('A');
  assert.ok(h.has('No. It was:'), h.text());
  assert.ok(h.has('goes'), 'rule explained: ' + h.text());
});

test('odd one out: eight right picks complete the set; SELECT shows the hint', () => {
  const ps = puzzles('odd-one-out').filter((p) => p.level === 0);
  const g = boot('odd-one-out');
  g.tap('START').tap('A');
  g.tap('SELECT');
  assert.ok(g.has('Compare'), g.text());
  for (let r = 0; r < 8; r++) {
    const p = ps[r];
    assert.equal(g.mem('odd')[0], p.odd);
    const cur = { x: 0, y: 0 };
    g.moveTo(cur, p.odd % 3, Math.floor(p.odd / 3));
    assert.equal(g.mem('sel')[0], p.odd);
    g.tap('A');
    assert.ok(g.has('Right!'), g.text());
    g.frames(30).tap('A');
  }
  assert.ok(g.has('Set complete!'), g.text());
});

test('sort and stack: sort every item into its bin; a miss is gentle and two misses give a hint', () => {
  const p = puzzles('sort-and-stack')[0];
  const g = boot('sort-and-stack');
  g.tap('START').tap('A');
  assert.equal(g.mem('nitems')[0], p.items.length);
  const cur = { x: 0, y: 0 };
  // two deliberate misses first
  const first = p.items.findIndex((it, i) => !p.examples.includes(i));
  const wrongBin = (p.items[first].bin + 1) % p.bins.length;
  g.moveTo(cur, first % 4, Math.floor(first / 4)).tap('A');
  const toBin = (b) => { let bs = g.mem('bsel')[0]; while (bs < b) { g.tap('RIGHT'); bs++; } while (bs > b) { g.tap('LEFT'); bs--; } };
  toBin(wrongBin); g.tap('A');
  assert.ok(g.has('Not that bin.'), g.text());
  g.tap('A');
  assert.ok(g.has('Look at'), 'hint after two misses: ' + g.text());
  g.tap('B');
  for (let i = 0; i < p.items.length; i++) {
    if (p.examples.includes(i)) continue;
    g.moveTo(cur, i % 4, Math.floor(i / 4)).tap('A');
    toBin(p.items[i].bin); g.tap('A');
  }
  assert.ok(g.has('All sorted!'), g.text());
});

test('slide picture: solve a 3x3 by search, moves counted, best saved', () => {
  const g = boot('slide-picture');
  g.tap('START').tap('DOWN').tap('DOWN').tap('A'); // 3x3 numbers
  g.until('Moves').frames(10);
  const n = 3;
  const start = g.mem('tiles', 9);
  // BFS over the 9! / 2 states
  const key = (t) => t.join(',');
  const goal = key([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  const prev = new Map([[key(start), null]]);
  const queue = [start];
  let found = null;
  while (queue.length && !found) {
    const t = queue.shift(); const k = key(t);
    if (k === goal) { found = t; break; }
    const b = t.indexOf(8), bx = b % n, by = Math.floor(b / n);
    for (const [dx, dy, dir] of [[1, 0, 'LEFT'], [-1, 0, 'RIGHT'], [0, 1, 'UP'], [0, -1, 'DOWN']]) {
      const x = bx + dx, y = by + dy; if (x < 0 || y < 0 || x >= n || y >= n) continue;
      const u = [...t]; u[b] = u[y * n + x]; u[y * n + x] = 8; const uk = key(u);
      if (!prev.has(uk)) { prev.set(uk, [k, dir]); queue.push(u); }
    }
  }
  assert.ok(found, 'solvable');
  const moves = []; for (let k = goal; prev.get(k); k = prev.get(k)[0]) moves.unshift(prev.get(k)[1]);
  for (const m of moves) g.tap(m);
  assert.ok(g.has('Solved!'), g.text());
  g.frames(20).tap('A');
  assert.equal(g.sram()[3 + 1 + 2], moves.length, 'best moves for level 2');
});
